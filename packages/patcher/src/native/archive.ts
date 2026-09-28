import crypto from "node:crypto";
import asar from "@electron/asar";
import { fs } from "./fs.js";
import type { InstallationMarker } from "@bettergravity/shared";
import { MARKER_NAME } from "./paths.js";

export interface HostManifest {
  readonly name: string;
  readonly productName: string;
  readonly version: string;
  readonly main: string;
}

function readJsonFromArchive(archivePath: string, entry: string): unknown {
  asar.uncacheAll();
  const content = asar.extractFile(archivePath, entry);
  asar.uncacheAll();
  return JSON.parse(content.toString("utf8"));
}

/**
 * Reads and validates an Antigravity bundle manifest. Guards against pointing
 * the patcher at some unrelated Electron application.
 */
export function readHostManifest(archivePath: string): HostManifest {
  const manifest = readJsonFromArchive(archivePath, "package.json") as Partial<HostManifest>;
  if (manifest.name !== "antigravity" || manifest.productName !== "Antigravity" || typeof manifest.main !== "string") {
    throw new Error("The selected application is not a supported Antigravity installation.");
  }
  return {
    name: manifest.name,
    productName: manifest.productName,
    version: typeof manifest.version === "string" ? manifest.version : "unknown",
    main: manifest.main
  };
}

export function readMarker(archivePath: string): InstallationMarker | undefined {
  try {
    return readJsonFromArchive(archivePath, MARKER_NAME) as InstallationMarker;
  } catch {
    return undefined;
  }
}

/**
 * Identified by the marker file, never by package name: the bootstrap mirrors
 * the host's name and productName so Electron derives the same app name,
 * userData path, and deep-link protocol that stock Antigravity would.
 */
export function isBootstrapArchive(archivePath: string): boolean {
  return readMarker(archivePath) !== undefined;
}

/**
 * Robustly verifies that a newly written bootstrap archive is fully flushed,
 * readable, and contains a valid installation marker, retrying briefly to
 * prevent race conditions with async stream flushes under high I/O.
 */
export async function verifyBootstrapArchive(archivePath: string, retries = 5, delayMs = 25): Promise<boolean> {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    uncacheAll();
    if (isBootstrapArchive(archivePath)) {
      return true;
    }
    if (attempt < retries - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return false;
}

export function sha256(filePath: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

export function uncacheAll(): void {
  asar.uncacheAll();
}

async function waitForArchiveReady(archivePath: string, maxAttempts = 10, delayMs = 20): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      asar.uncacheAll();
      asar.getRawHeader(archivePath);
      asar.uncacheAll();
      return;
    } catch (error) {
      if (attempt === maxAttempts - 1) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

export async function createArchive(sourceDirectory: string, destination: string): Promise<void> {
  const stream = (await asar.createPackage(sourceDirectory, destination)) as {
    closed?: boolean;
    on?: (event: string, listener: (...args: any[]) => void) => void;
    off?: (event: string, listener: (...args: any[]) => void) => void;
    once?: (event: string, listener: (...args: any[]) => void) => void;
  } | undefined;

  if (stream && typeof stream.once === "function" && !stream.closed) {
    await new Promise<void>((resolve, reject) => {
      if (stream.closed) {
        resolve();
        return;
      }
      const onClose = () => {
        stream.off?.("error", onError);
        resolve();
      };
      const onError = (err: unknown) => {
        stream.off?.("close", onClose);
        reject(err);
      };
      stream.once?.("close", onClose);
      stream.once?.("error", onError);
    });
  }

  asar.uncacheAll();
  await waitForArchiveReady(destination);
}
