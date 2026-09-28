import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import asar from "@electron/asar";
import { RUNTIME_FILES } from "../src/native/index.js";
import { createArchive } from "../src/native/archive.js";

export interface Fixture {
  readonly root: string;
  readonly runtimeSource: string;
  cleanup(): void;
}

/** Stands in for a real Antigravity bundle: identity plus a trivial main. */
export async function writeHostArchive(destination: string, version: string): Promise<void> {
  const staging = fs.mkdtempSync(path.join(os.tmpdir(), "bg-host-"));
  try {
    const manifest = {
      name: "antigravity",
      productName: "Antigravity",
      version,
      description: "Antigravity - Agentic Desktop Application",
      main: "dist/main.js"
    };
    fs.writeFileSync(path.join(staging, "package.json"), JSON.stringify(manifest, null, 2));
    fs.mkdirSync(path.join(staging, "dist"), { recursive: true });
    fs.writeFileSync(path.join(staging, "dist", "main.js"), `console.log(${JSON.stringify(version)});\n`);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    await createArchive(staging, destination);
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}

/** An Electron app that is emphatically not Antigravity. */
export async function writeForeignArchive(destination: string): Promise<void> {
  const staging = fs.mkdtempSync(path.join(os.tmpdir(), "bg-foreign-"));
  try {
    fs.writeFileSync(
      path.join(staging, "package.json"),
      JSON.stringify({ name: "some-other-app", productName: "Some Other App", version: "1.0.0", main: "index.js" }, null, 2)
    );
    fs.writeFileSync(path.join(staging, "index.js"), "");
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    await createArchive(staging, destination);
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}

export async function createFixture(version = "2.11.0"): Promise<Fixture> {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "bg-fixture-"));
  const root = path.join(base, "Antigravity");
  const runtimeSource = path.join(base, "runtime-source");

  fs.mkdirSync(path.join(root, "resources"), { recursive: true });
  fs.writeFileSync(path.join(root, "Antigravity.exe"), "");
  await writeHostArchive(path.join(root, "resources", "app.asar"), version);

  // Derived from the real list so a new runtime file cannot silently go
  // untested here.
  fs.mkdirSync(runtimeSource, { recursive: true });
  for (const file of RUNTIME_FILES) {
    fs.writeFileSync(path.join(runtimeSource, file), `// ${file}\n`);
  }

  return {
    root,
    runtimeSource,
    cleanup: () => fs.rmSync(base, { recursive: true, force: true })
  };
}

/** Never lets the suite reach the real process table. */
export const noopHostControl = async (): Promise<void> => undefined;
