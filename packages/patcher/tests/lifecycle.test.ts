import fs from "node:fs";
import path from "node:path";
import asar from "@electron/asar";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BETTERGRAVITY_VERSION } from "@bettergravity/shared";
import { inspectInstallation, installationPaths, runOperation, uninstall } from "../src/native/index.js";
import { createFixture, noopHostControl, writeForeignArchive, writeHostArchive, type Fixture } from "./fixtures.js";

let fixture: Fixture;

const options = () => ({ runtimeSource: fixture.runtimeSource, closeHost: noopHostControl });
const install = () => runOperation("install", fixture.root, options());

function readArchiveJson(archivePath: string, entry: string): Record<string, unknown> {
  asar.uncacheAll();
  const content = asar.extractFile(archivePath, entry);
  asar.uncacheAll();
  return JSON.parse(content.toString("utf8")) as Record<string, unknown>;
}

beforeEach(async () => {
  fixture = await createFixture();
});

afterEach(() => {
  fixture.cleanup();
});

describe("inspectInstallation", () => {
  it("reports a stock installation as unpatched and patchable", () => {
    const state = inspectInstallation(fixture.root);
    expect(state).toMatchObject({ kind: "detected", patchState: "unpatched", antigravityVersion: "2.11.0", nativePatchAvailable: true });
  });

  it("reports a missing installation rather than throwing", () => {
    expect(inspectInstallation(path.join(fixture.root, "nowhere"))).toMatchObject({ kind: "not-found", nativePatchAvailable: false });
  });

  it("refuses an Electron app that is not Antigravity", async () => {
    await writeForeignArchive(installationPaths(fixture.root).currentAsar);
    const state = inspectInstallation(fixture.root);
    expect(state.kind).toBe("corrupted");
    expect(state.error).toMatch(/not a supported Antigravity installation/);
  });

  it("refuses to patch a host version outside the supported major", async () => {
    await writeHostArchive(installationPaths(fixture.root).currentAsar, "3.0.0");
    expect(inspectInstallation(fixture.root).nativePatchAvailable).toBe(false);
  });

  it("reports Antigravity IDE as unsupported-ide with a helpful message", () => {
    const idePath = path.join(fixture.root, "..", "Antigravity IDE");
    const state = inspectInstallation(idePath);
    expect(state.kind).toBe("unsupported-ide");
    expect(state.error).toMatch(/Antigravity IDE/);
  });
});

describe("install", () => {
  it("moves the host bundle aside and installs the bootstrap", async () => {
    const paths = installationPaths(fixture.root);
    const before = fs.readFileSync(paths.currentAsar);

    const result = await install();

    expect(result.installation).toMatchObject({ kind: "patched", patchState: "patched", betterGravityVersion: BETTERGRAVITY_VERSION });
    expect(fs.readFileSync(paths.originalAsar).equals(before)).toBe(true);
    expect(fs.existsSync(paths.stagedAsar)).toBe(false);
  });

  // Regression: the bootstrap once declared itself as "bettergravity-bootstrap".
  // Electron derives app.getName() from that, and Antigravity builds both its
  // userData path and its deep-link protocol from the app name, so a mismatch
  // silently orphaned user data into a directory named after the bootstrap.
  it("gives the bootstrap the host's identity", async () => {
    await install();
    const manifest = readArchiveJson(installationPaths(fixture.root).currentAsar, "package.json");
    expect(manifest).toMatchObject({ name: "antigravity", productName: "Antigravity", version: "2.11.0" });
  });

  it("restores the host name before anything reads a name-derived path", async () => {
    await install();
    const source = asar.extractFile(installationPaths(fixture.root).currentAsar, "index.js").toString("utf8");
    expect(source.indexOf("app.setName")).toBeLessThan(source.indexOf("require(originalMain)"));
    expect(source).toContain("try {");
    expect(source).toMatch(/catch[\s\S]*continuing without it/);
  });

  it("records a marker describing the installation", async () => {
    await install();
    const marker = readArchiveJson(installationPaths(fixture.root).currentAsar, ".bettergravity.json");
    expect(marker).toMatchObject({ schemaVersion: 1, betterGravityVersion: BETTERGRAVITY_VERSION, antigravityVersion: "2.11.0" });
    expect(String(marker["originalAsarSha256"])).toHaveLength(64);
  });

  it("deploys the runtime and creates the content directories", async () => {
    await install();
    const paths = installationPaths(fixture.root);
    expect(fs.existsSync(path.join(paths.runtimeCode, "main.cjs"))).toBe(true);
    expect(fs.existsSync(path.join(paths.runtimeCode, "preload.cjs"))).toBe(true);
    expect(fs.existsSync(path.join(paths.runtimeRoot, "themes"))).toBe(true);
    expect(fs.existsSync(path.join(paths.runtimeRoot, "plugins"))).toBe(true);
  });

  it("is idempotent and keeps the original bundle intact across repeated installs", async () => {
    await install();
    const original = fs.readFileSync(installationPaths(fixture.root).originalAsar);
    await runOperation("reinstall", fixture.root, options());
    expect(fs.readFileSync(installationPaths(fixture.root).originalAsar).equals(original)).toBe(true);
    expect(inspectInstallation(fixture.root).kind).toBe("patched");
  });

  it("refuses to patch an unsupported host", async () => {
    await writeHostArchive(installationPaths(fixture.root).currentAsar, "3.0.0");
    await expect(install()).rejects.toThrow(/has not been marked compatible/);
  });

  it("fails loudly when the runtime is missing from the installer", async () => {
    fs.rmSync(path.join(fixture.runtimeSource, "preload.cjs"));
    await expect(install()).rejects.toThrow(/preload\.cjs is missing/);
  });
});

describe("host updates", () => {
  it("detects a self-update that overwrote the patch", async () => {
    await install();
    // electron-updater replaces app.asar wholesale, leaving _app.asar behind.
    await writeHostArchive(installationPaths(fixture.root).currentAsar, "2.12.0");

    const state = inspectInstallation(fixture.root);
    expect(state).toMatchObject({ kind: "needs-repatch", patchState: "needs-repatch", antigravityVersion: "2.12.0" });
  });

  it("adopts the newer bundle as the original when repatching", async () => {
    await install();
    await writeHostArchive(installationPaths(fixture.root).currentAsar, "2.12.0");

    await runOperation("update", fixture.root, options());

    const state = inspectInstallation(fixture.root);
    expect(state).toMatchObject({ kind: "patched", antigravityVersion: "2.12.0" });
    expect(readArchiveJson(installationPaths(fixture.root).originalAsar, "package.json")["version"]).toBe("2.12.0");
  });

  it("asks for a repatch when the runtime files have gone missing", async () => {
    await install();
    fs.rmSync(installationPaths(fixture.root).runtimeCode, { recursive: true, force: true });
    expect(inspectInstallation(fixture.root).kind).toBe("needs-repatch");
  });
});

describe("uninstall", () => {
  it("restores the original bundle byte for byte", async () => {
    const paths = installationPaths(fixture.root);
    const before = fs.readFileSync(paths.currentAsar);

    await install();
    const result = await uninstall(fixture.root, () => undefined, { closeHost: noopHostControl });

    expect(result.installation).toMatchObject({ kind: "detected", patchState: "unpatched" });
    expect(fs.readFileSync(paths.currentAsar).equals(before)).toBe(true);
    expect(fs.existsSync(paths.originalAsar)).toBe(false);
    expect(fs.existsSync(paths.runtimeCode)).toBe(false);
  });

  it("preserves themes, plugins, and settings", async () => {
    await install();
    const paths = installationPaths(fixture.root);
    fs.writeFileSync(path.join(paths.runtimeRoot, "themes", "mine.css"), "body { color: red; }");
    fs.writeFileSync(path.join(paths.runtimeRoot, "settings.json"), "{}");

    await uninstall(fixture.root, () => undefined, { closeHost: noopHostControl });

    expect(fs.existsSync(path.join(paths.runtimeRoot, "themes", "mine.css"))).toBe(true);
    expect(fs.existsSync(path.join(paths.runtimeRoot, "settings.json"))).toBe(true);
  });

  it("refuses when nothing is installed", async () => {
    await expect(uninstall(fixture.root, () => undefined, { closeHost: noopHostControl })).rejects.toThrow(/not installed/);
  });

  it("round-trips cleanly through install and uninstall twice", async () => {
    const original = fs.readFileSync(installationPaths(fixture.root).currentAsar);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await install();
      expect(inspectInstallation(fixture.root).kind).toBe("patched");
      await uninstall(fixture.root, () => undefined, { closeHost: noopHostControl });
      expect(inspectInstallation(fixture.root).kind).toBe("detected");
    }
    expect(fs.readFileSync(installationPaths(fixture.root).currentAsar).equals(original)).toBe(true);
  });
});

describe("backups", () => {
  it("keeps a bounded number of snapshots", async () => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      await runOperation(attempt === 0 ? "install" : "reinstall", fixture.root, options());
    }
    const backups = fs.readdirSync(installationPaths(fixture.root).backups);
    expect(backups.length).toBeLessThanOrEqual(5);
    expect(backups.length).toBeGreaterThan(0);
  });
});

describe("progress reporting", () => {
  it("reports monotonic progress ending at complete", async () => {
    const seen: { percent: number; stage: string }[] = [];
    await runOperation("install", fixture.root, options(), (progress) => seen.push(progress));

    expect(seen.length).toBeGreaterThan(3);
    expect(seen.at(-1)).toMatchObject({ percent: 100, stage: "complete" });
    for (let index = 1; index < seen.length; index += 1) {
      expect(seen[index]!.percent).toBeGreaterThanOrEqual(seen[index - 1]!.percent);
    }
  });
});
