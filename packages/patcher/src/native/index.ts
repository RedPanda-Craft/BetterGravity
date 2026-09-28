import path from "node:path";
import { BETTERGRAVITY_VERSION, isSupportedHostVersion } from "@bettergravity/shared";
import { fs } from "./fs.js";
import type { InstallOperation, InstallationState, OperationResult, ProgressReporter } from "../types.js";
import { createBootstrapArchive } from "./bootstrap.js";
import { isBootstrapArchive, readHostManifest, readMarker, sha256, uncacheAll, verifyBootstrapArchive } from "./archive.js";
import { closeAntigravity } from "./process.js";
import { installationPaths, isAntigravityIde, type InstallationPaths } from "./paths.js";

export { findAntigravityInstallation, installationPaths, isAntigravityIde, unpackedPath } from "./paths.js";
export { closeAntigravity, parseDarwinProcessIds, parsePosixProcessIds } from "./process.js";
export { bootstrapSource } from "./bootstrap.js";

/**
 * Files copied verbatim into the installation. `repair.cjs` is the guardian the
 * runtime spawns before quitting, so it must live alongside the runtime.
 */
export const RUNTIME_FILES = ["main.cjs", "preload.cjs", "repair.cjs", "overlay.html"] as const;

const MAX_RETAINED_BACKUPS = 5;

export type HostController = (installationPath: string, onProgress: ProgressReporter) => Promise<void>;

export interface PatcherOptions {
  /** Directory holding the built runtime bundles. */
  readonly runtimeSource: string;
  /**
   * Overridden by the test suite so the filesystem state machine can be
   * exercised without shelling out to PowerShell for process discovery.
   */
  readonly closeHost?: HostController;
}

export interface UninstallOptions {
  readonly closeHost?: HostController;
}

export function inspectInstallation(installationPath: string): InstallationState {
  if (isAntigravityIde(installationPath)) {
    return {
      kind: "unsupported-ide",
      patchState: "unknown",
      path: installationPath,
      nativePatchAvailable: false,
      error: "Antigravity IDE (VS Code editor) is not supported yet. BetterGravity currently targets the standalone Antigravity 2.0 desktop application."
    };
  }

  const paths = installationPaths(installationPath);
  if (!fs.existsSync(paths.executable) || !fs.existsSync(paths.currentAsar)) {
    return { kind: "not-found", patchState: "unknown", nativePatchAvailable: false };
  }

  try {
    const marker = readMarker(paths.currentAsar);

    if (!marker) {
      // A stock bundle sitting next to a leftover _app.asar means Antigravity
      // updated itself and overwrote the patch.
      const host = readHostManifest(paths.currentAsar);
      const wasPatched = fs.existsSync(paths.originalAsar);
      return {
        kind: wasPatched ? "needs-repatch" : "detected",
        patchState: wasPatched ? "needs-repatch" : "unpatched",
        path: installationPath,
        antigravityVersion: host.version,
        nativePatchAvailable: isSupportedHostVersion(host.version)
      };
    }

    if (!fs.existsSync(paths.originalAsar)) {
      return {
        kind: "corrupted",
        patchState: "corrupted",
        path: installationPath,
        betterGravityVersion: marker.betterGravityVersion,
        nativePatchAvailable: false,
        error: "The patched bundle is present but the original Antigravity bundle is missing."
      };
    }

    const host = readHostManifest(paths.originalAsar);
    const runtimePresent = RUNTIME_FILES.every((file) => fs.existsSync(path.join(paths.runtimeCode, file)));
    const current = marker.betterGravityVersion === BETTERGRAVITY_VERSION && runtimePresent;

    return {
      kind: current ? "patched" : "needs-repatch",
      patchState: current ? "patched" : "needs-repatch",
      path: installationPath,
      antigravityVersion: host.version,
      betterGravityVersion: marker.betterGravityVersion,
      nativePatchAvailable: isSupportedHostVersion(host.version)
    };
  } catch (error) {
    return {
      kind: "corrupted",
      patchState: "corrupted",
      path: installationPath,
      nativePatchAvailable: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function timestamp(): string {
  return new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
}

function pruneBackups(directory: string): void {
  if (!fs.existsSync(directory)) return;
  const archives = fs
    .readdirSync(directory)
    .filter((name) => name.endsWith(".asar"))
    .sort()
    .reverse();
  for (const stale of archives.slice(MAX_RETAINED_BACKUPS)) {
    fs.rmSync(path.join(directory, stale), { force: true });
  }
}

function snapshot(source: string, paths: InstallationPaths, label: string): void {
  if (!fs.existsSync(source)) return;
  fs.mkdirSync(paths.backups, { recursive: true });
  fs.copyFileSync(source, path.join(paths.backups, `${label}-${timestamp()}.asar`));
  pruneBackups(paths.backups);
}

/**
 * The runtime is written beside the ASAR rather than inside it, so it can be
 * replaced without repatching and so user content survives an uninstall.
 */
export function deployRuntime(paths: InstallationPaths, runtimeSource: string): void {
  fs.mkdirSync(paths.runtimeCode, { recursive: true });
  for (const file of RUNTIME_FILES) {
    const from = path.join(runtimeSource, file);
    if (!fs.existsSync(from)) throw new Error(`The BetterGravity runtime file ${file} is missing from the installer (looked in ${runtimeSource}).`);
    fs.writeFileSync(path.join(paths.runtimeCode, file), fs.readFileSync(from));
  }
  for (const directory of ["themes", "plugins"]) {
    fs.mkdirSync(path.join(paths.runtimeRoot, directory), { recursive: true });
  }
}

export async function runOperation(
  operation: Exclude<InstallOperation, "uninstall">,
  installationPath: string,
  options: PatcherOptions,
  onProgress: ProgressReporter = () => undefined
): Promise<OperationResult> {
  const paths = installationPaths(installationPath);
  const before = inspectInstallation(installationPath);
  if (before.kind === "unsupported-ide") throw new Error(before.error ?? "Antigravity IDE (VS Code editor) is not supported yet.");
  if (before.kind === "not-found") throw new Error("Antigravity could not be found at the selected location.");
  if (!before.nativePatchAvailable) {
    throw new Error(`Antigravity ${before.antigravityVersion ?? "unknown"} has not been marked compatible yet.`);
  }

  await (options.closeHost ?? closeAntigravity)(installationPath, onProgress);
  onProgress({ percent: 16, stage: "inspect", message: `Detected Antigravity ${before.antigravityVersion}.` });

  snapshot(paths.currentAsar, paths, "app");
  snapshot(paths.originalAsar, paths, "original-app");
  onProgress({ percent: 34, stage: "backup", message: "Created a recoverable snapshot of the host bundle." });

  // When the live bundle is stock it becomes the new original, which is exactly
  // what happens after Antigravity updates itself over a previous patch.
  if (!isBootstrapArchive(paths.currentAsar)) {
    const currentHost = readHostManifest(paths.currentAsar);
    const hasOriginal = fs.existsSync(paths.originalAsar);
    const originalHost = hasOriginal ? readHostManifest(paths.originalAsar) : undefined;
    if (!hasOriginal || (originalHost && currentHost.version !== originalHost.version)) {
      fs.copyFileSync(paths.currentAsar, paths.originalAsar);
    }
  }

  const host = readHostManifest(paths.originalAsar);
  deployRuntime(paths, options.runtimeSource);
  onProgress({ percent: 52, stage: "apply", message: "Deployed the BetterGravity runtime." });

  fs.rmSync(paths.stagedAsar, { force: true });
  await createBootstrapArchive(paths.stagedAsar, host, sha256(paths.originalAsar));
  if (!(await verifyBootstrapArchive(paths.stagedAsar))) {
    fs.rmSync(paths.stagedAsar, { force: true });
    throw new Error("The BetterGravity bootstrap could not be verified before installation.");
  }

  fs.rmSync(paths.currentAsar, { force: true });
  fs.renameSync(paths.stagedAsar, paths.currentAsar);
  uncacheAll();
  onProgress({ percent: 74, stage: "apply", message: "Installed the BetterGravity bootstrap." });

  const after = inspectInstallation(installationPath);
  if (after.kind !== "patched") {
    throw new Error("Verification failed. The original Antigravity bundle and a backup were kept.");
  }
  onProgress({ percent: 94, stage: "verify", message: "Verified app.asar, _app.asar, and the BetterGravity marker." });
  onProgress({ percent: 100, stage: "complete", message: "BetterGravity is ready. Antigravity can be reopened." });

  const messages: Record<Exclude<InstallOperation, "uninstall">, string> = {
    install: "BetterGravity installed successfully.",
    update: "BetterGravity updated successfully.",
    reinstall: "BetterGravity reinstalled successfully.",
    repair: "BetterGravity repaired successfully."
  };
  return { installation: after, message: messages[operation] };
}

/**
 * Restores the host bundle. Content under .bettergravity (themes, plugins,
 * settings, backups) is deliberately left in place so reinstalling is lossless.
 */
export async function uninstall(
  installationPath: string,
  onProgress: ProgressReporter = () => undefined,
  options: UninstallOptions = {}
): Promise<OperationResult> {
  if (isAntigravityIde(installationPath)) {
    throw new Error("Antigravity IDE (VS Code editor) is not supported yet.");
  }
  const paths = installationPaths(installationPath);
  if (!fs.existsSync(paths.originalAsar)) {
    throw new Error("BetterGravity is not installed at the selected location.");
  }

  await (options.closeHost ?? closeAntigravity)(installationPath, onProgress);
  onProgress({ percent: 20, stage: "inspect", message: "Preparing to restore the original bundle." });

  const restored = readHostManifest(paths.originalAsar);
  snapshot(paths.currentAsar, paths, "app");
  onProgress({ percent: 45, stage: "backup", message: "Snapshotted the patched bundle." });

  fs.rmSync(paths.currentAsar, { force: true });
  fs.renameSync(paths.originalAsar, paths.currentAsar);
  fs.rmSync(paths.runtimeCode, { recursive: true, force: true });
  uncacheAll();
  onProgress({ percent: 80, stage: "apply", message: "Restored the original Antigravity bundle." });

  const after = inspectInstallation(installationPath);
  if (after.patchState !== "unpatched") {
    throw new Error("Verification failed. A backup of the patched bundle was kept.");
  }
  onProgress({ percent: 100, stage: "complete", message: `Removed BetterGravity. Antigravity ${restored.version} is unmodified.` });
  return { installation: after, message: "BetterGravity removed successfully." };
}
