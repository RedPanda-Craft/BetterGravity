import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const workspace = resolve(import.meta.dirname, "..");
const outDir = resolve(workspace, "dist-native");
const lightPublishDir = resolve(outDir, "windows-light");

mkdirSync(outDir, { recursive: true });

// Ensure runtime and patcher CLI are freshly bundled
execSync("node build.mjs", { cwd: resolve(workspace, "packages/runtime"), stdio: "inherit" });
execSync("node packages/patcher/build-cli.mjs", { cwd: workspace, stdio: "inherit" });

const patcherCliSrc = resolve(workspace, "packages/patcher/dist/native/patcher-cli.cjs");
const patcherCliDest = resolve(workspace, "apps/installer-windows/Patcher/patcher-cli.cjs");
if (existsSync(patcherCliSrc)) {
  cpSync(patcherCliSrc, patcherCliDest, { force: true });
}

// Ensure runtime bundles are synced to installer-windows Patcher directory
const windowsRuntimeDest = resolve(workspace, "apps/installer-windows/Patcher/runtime");
mkdirSync(windowsRuntimeDest, { recursive: true });

const runtimeMainSrc = resolve(workspace, "packages/runtime/dist/main.cjs");
const runtimePreloadSrc = resolve(workspace, "packages/runtime/dist/preload.cjs");
const runtimeRepairSrc = resolve(workspace, "packages/patcher/dist/native/repair.cjs");
const runtimeOverlaySrc = resolve(workspace, "packages/runtime/dist/overlay.html");

if (existsSync(runtimeMainSrc)) cpSync(runtimeMainSrc, resolve(windowsRuntimeDest, "main.cjs"), { force: true });
if (existsSync(runtimePreloadSrc)) cpSync(runtimePreloadSrc, resolve(windowsRuntimeDest, "preload.cjs"), { force: true });
if (existsSync(runtimeRepairSrc)) cpSync(runtimeRepairSrc, resolve(windowsRuntimeDest, "repair.cjs"), { force: true });
if (existsSync(runtimeOverlaySrc)) cpSync(runtimeOverlaySrc, resolve(windowsRuntimeDest, "overlay.html"), { force: true });

// Generate Patcher manifest.json with fresh SHA-256 hashes
const { createHash } = await import("node:crypto");
const { readFileSync, writeFileSync } = await import("node:fs");

function getSha256(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

const pkg = JSON.parse(readFileSync(resolve(workspace, "package.json"), "utf8"));
const manifest = {
  version: pkg.version,
  generatedAt: new Date().toISOString(),
  files: {
    "patcher-cli.cjs": {
      path: "apps/installer-windows/Patcher/patcher-cli.cjs",
      sha256: getSha256(patcherCliDest)
    },
    "runtime/main.cjs": {
      path: "apps/installer-windows/Patcher/runtime/main.cjs",
      sha256: getSha256(resolve(windowsRuntimeDest, "main.cjs"))
    },
    "runtime/preload.cjs": {
      path: "apps/installer-windows/Patcher/runtime/preload.cjs",
      sha256: getSha256(resolve(windowsRuntimeDest, "preload.cjs"))
    },
    "runtime/repair.cjs": {
      path: "apps/installer-windows/Patcher/runtime/repair.cjs",
      sha256: getSha256(resolve(windowsRuntimeDest, "repair.cjs"))
    },
    "runtime/overlay.html": {
      path: "apps/installer-windows/Patcher/runtime/overlay.html",
      sha256: getSha256(resolve(windowsRuntimeDest, "overlay.html"))
    }
  }
};
writeFileSync(resolve(workspace, "apps/installer-windows/Patcher/manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

// Determine target architectures: default to both x64 and arm64
const args = process.argv.slice(2);
let targetArches = ["x64", "arm64"];
if (args.includes("--x64-only") || args.includes("--x64")) {
  targetArches = ["x64"];
} else if (args.includes("--arm64-only") || args.includes("--arm64")) {
  targetArches = ["arm64"];
}

// 1. Build self-contained single-file executable for each architecture
for (const arch of targetArches) {
  const rid = `win-${arch}`;
  const winPublishDir = resolve(outDir, `windows-publish-${arch}`);

  execSync(
    `dotnet publish apps/installer-windows/BetterGravityInstaller.csproj -c Release -r ${rid} --self-contained true -p:PublishSingleFile=true -p:EnableCompressionInSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o "${winPublishDir}"`,
    { cwd: workspace, stdio: "inherit" }
  );

  const exeSrc = resolve(winPublishDir, "BetterGravityInstaller.exe");
  const exeDest = resolve(outDir, `BetterGravity-Installer-Windows-${arch}.exe`);
  const superExeDest = resolve(outDir, `SuperGravity-Installer-Windows-${arch}.exe`);

  if (existsSync(exeSrc)) {
    cpSync(exeSrc, exeDest);
    cpSync(exeSrc, superExeDest);
  }

  // Create standalone zip
  const standaloneZip = resolve(outDir, `SuperGravity-Installer-Windows-${arch}.zip`);
  execSync(
    `powershell -NoProfile -Command "Compress-Archive -Path '${winPublishDir}\\BetterGravityInstaller.exe' -DestinationPath '${standaloneZip}' -Force"`,
    { cwd: workspace, stdio: "inherit" }
  );

  // Clean up intermediate staging directory
  rmSync(winPublishDir, { recursive: true, force: true });
}

// 2. Build lightweight framework-dependent package (<1MB)
execSync(
  `dotnet publish apps/installer-windows/BetterGravityInstaller.csproj -c Release -r win-x64 --self-contained false -o "${lightPublishDir}"`,
  { cwd: workspace, stdio: "inherit" }
);

try {
  rmSync(resolve(lightPublishDir, "BetterGravityInstaller.pdb"), { force: true });
} catch {}

const lightZip = resolve(outDir, "BetterGravity-Installer-Windows-Light.zip");
const superLightZip = resolve(outDir, "SuperGravity-Installer-Windows-Light.zip");
execSync(
  `powershell -NoProfile -Command "Compress-Archive -Path '${lightPublishDir}\\*' -DestinationPath '${lightZip}' -Force"`,
  { cwd: workspace, stdio: "inherit" }
);
execSync(
  `powershell -NoProfile -Command "Compress-Archive -Path '${lightPublishDir}\\*' -DestinationPath '${superLightZip}' -Force"`,
  { cwd: workspace, stdio: "inherit" }
);

// Clean up intermediate staging directory
rmSync(lightPublishDir, { recursive: true, force: true });
