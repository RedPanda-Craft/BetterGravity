import os from "node:os";
import path from "node:path";
import { fs } from "./fs.js";
import { BETTERGRAVITY_VERSION, type InstallationMarker } from "@bettergravity/shared";
import { createArchive, type HostManifest } from "./archive.js";
import { MARKER_NAME, RUNTIME_DIRECTORY_NAME } from "./paths.js";

/**
 * Source for the bootstrap's index.js. It replaces Antigravity's app.asar, so
 * the one hard rule is that control always reaches require(originalMain): a
 * broken BetterGravity runtime must degrade to a stock launch, never to an
 * application that will not start.
 */
export function bootstrapSource(version = BETTERGRAVITY_VERSION): string {
  return [
    `"use strict";`,
    `const path = require("node:path");`,
    `const { app } = require("electron");`,
    ``,
    `const resources = path.join(__dirname, "..");`,
    `const originalAsar = path.join(resources, "_app.asar");`,
    `const originalPackage = require(path.join(originalAsar, "package.json"));`,
    `const originalMain = path.join(originalAsar, originalPackage.main);`,
    ``,
    `// Restore the host's identity before anything derives a name-dependent`,
    `// value: app.getName() feeds both the userData path and the deep-link`,
    `// protocol, so a mismatch here silently orphans user data.`,
    `app.setName(originalPackage.productName || originalPackage.name);`,
    `app.setAppPath(originalAsar);`,
    ``,
    `global.BetterGravity = Object.freeze({`,
    `  version: ${JSON.stringify(version)},`,
    `  hostVersion: originalPackage.version,`,
    `  runtimeDirectory: path.join(resources, ${JSON.stringify(RUNTIME_DIRECTORY_NAME)})`,
    `});`,
    ``,
    `try {`,
    `  require(path.join(global.BetterGravity.runtimeDirectory, "runtime", "main.cjs")).activate(global.BetterGravity);`,
    `} catch (error) {`,
    `  console.error("[BetterGravity] Runtime failed to start; continuing without it.", error);`,
    `}`,
    ``,
    `require.main.filename = originalMain;`,
    `require(originalMain);`,
    ``
  ].join("\n");
}

export function superGravityBootstrapSource(version = BETTERGRAVITY_VERSION): string {
  return [
    `"use strict";`,
    `const path = require("node:path");`,
    `const { app } = require("electron");`,
    ``,
    `const resources = path.join(__dirname, "..");`,
    `const originalAsar = path.join(resources, "_app.asar");`,
    `let originalPackage = {};`,
    `try {`,
    `  originalPackage = require(path.join(originalAsar, "package.json"));`,
    `} catch {}`,
    `const originalMain = path.join(originalAsar, originalPackage.main || "index.js");`,
    ``,
    `if (originalPackage.productName || originalPackage.name) {`,
    `  app.setName(originalPackage.productName || originalPackage.name);`,
    `}`,
    `app.setAppPath(originalAsar);`,
    ``,
    `const runtimeInfo = Object.freeze({`,
    `  version: ${JSON.stringify(version)},`,
    `  hostVersion: originalPackage.version || "unknown",`,
    `  runtimeDirectory: path.join(resources, ${JSON.stringify(RUNTIME_DIRECTORY_NAME)})`,
    `});`,
    `global.SuperGravity = runtimeInfo;`,
    `global.BetterGravity = runtimeInfo;`,
    ``,
    `try {`,
    `  const mainScript = path.join(runtimeInfo.runtimeDirectory, "runtime", "main.cjs");`,
    `  require(mainScript).activate(runtimeInfo);`,
    `} catch (error) {`,
    `  console.error("[SuperGravity] Runtime self-healing fallback activated; launching vanilla host.", error);`,
    `}`,
    ``,
    `require.main.filename = originalMain;`,
    `require(originalMain);`,
    ``
  ].join("\n");
}

export function createMarker(host: HostManifest, originalAsarSha256: string, version = BETTERGRAVITY_VERSION): InstallationMarker {
  return {
    schemaVersion: 1,
    betterGravityVersion: version,
    antigravityVersion: host.version,
    originalAsarSha256,
    installedAt: new Date().toISOString()
  };
}

export async function createBootstrapArchive(destination: string, host: HostManifest, originalAsarSha256: string): Promise<void> {
  const staging = fs.mkdtempSync(path.join(os.tmpdir(), "bettergravity-bootstrap-"));
  try {
    const manifest = { name: host.name, productName: host.productName, version: host.version, private: true, main: "index.js" };
    fs.writeFileSync(path.join(staging, "package.json"), JSON.stringify(manifest, null, 2));
    fs.writeFileSync(path.join(staging, "index.js"), bootstrapSource());
    fs.writeFileSync(path.join(staging, MARKER_NAME), JSON.stringify(createMarker(host, originalAsarSha256), null, 2));
    await createArchive(staging, destination);
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}
