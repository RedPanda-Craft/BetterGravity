import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { isSingleFileTheme, type Catalog, type CatalogEntry, type CatalogFile } from "@bettergravity/marketplace";
import type { CatalogResult, ContentResult } from "../protocol.js";
import { logger } from "./logger.js";
import type { RuntimePaths } from "./paths.js";

/**
 * Browsing and installing community content.
 *
 * The catalog is a file in the BetterGravity repository rather than a service,
 * so there is no server to run and every listing has a review attached to it in
 * git. That also fixes the only host this ever talks to, which is checked on
 * every request below: a listing cannot point the client somewhere else.
 *
 * Nothing here runs on its own. The catalog is fetched when the user opens the
 * Community section and not before, so an installation that is never browsed
 * makes no network requests at all.
 */
const REPOSITORY = "RedPanda-Craft/SuperGravity";
const BRANCH = "main";
const ORIGIN = "https://raw.githubusercontent.com";
const BASE = `${ORIGIN}/${REPOSITORY}/${BRANCH}/`;

/** Long enough to make browsing feel instant, short enough to see new listings. */
const CACHE_MS = 15 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 15_000;

const LIMITS = {
  catalogBytes: 4 * 1024 * 1024,
  themeBytes: 2 * 1024 * 1024,
  themeFolderBytes: 8 * 1024 * 1024,
  pluginBytes: 4 * 1024 * 1024
} as const;

interface Cached {
  readonly entries: readonly CatalogEntry[];
  readonly at: number;
}

let cache: Cached | undefined;

function isCatalogShape(value: unknown): value is Catalog {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Catalog>;
  return candidate.schemaVersion === 1 && Array.isArray(candidate.entries);
}

/**
 * Every request goes through here, so the fixed origin is enforced in one place
 * rather than at each call site.
 */
async function get(relativePath: string): Promise<Response> {
  const url = new URL(relativePath, BASE);
  if (url.origin !== ORIGIN || !url.pathname.startsWith(`/${REPOSITORY}/${BRANCH}/`)) {
    throw new Error(`refusing to fetch outside the catalog: ${url.href}`);
  }

  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: { accept: "*/*" }
  });
  if (!response.ok) throw new Error(`${url.pathname} returned ${response.status}`);
  return response;
}

/** Distinguishes "no internet" from "the catalog is broken", which read differently. */
function explain(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/timed out|aborted|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ENETUNREACH|fetch failed/i.test(message)) {
    return "Could not reach the catalog. Check your connection and try again.";
  }
  return message;
}

/**
 * Checks whether an entry is compatible with the given OS platform.
 * If the entry does not specify `platforms`, it is universal.
 */
export function matchesPlatform(entry: CatalogEntry, platform: string = process.platform): boolean {
  if (!entry.platforms || entry.platforms.length === 0) return true;
  const current = platform === "win32" ? "windows" : platform === "darwin" ? "macos" : platform;
  return entry.platforms.some((p) => {
    const target = p.toLowerCase();
    return (
      target === "all" ||
      target === platform.toLowerCase() ||
      target === current ||
      (target === "mac" && current === "macos")
    );
  });
}

export async function fetchCatalog(force = false, platform: string = process.platform): Promise<CatalogResult> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) {
    return { ok: true, entries: cache.entries.filter((entry) => matchesPlatform(entry, platform)), cached: true };
  }

  try {
    const response = await get("community/catalog.json");
    const text = await response.text();
    if (text.length > LIMITS.catalogBytes) throw new Error("the catalog is implausibly large");

    const parsed: unknown = JSON.parse(text);
    if (!isCatalogShape(parsed)) throw new Error("the catalog is not in a format this version understands");

    cache = { entries: parsed.entries, at: Date.now() };
    return { ok: true, entries: parsed.entries.filter((entry) => matchesPlatform(entry, platform)), cached: false };
  } catch (error) {
    logger.error("Could not read the community catalog.", error);
    return { ok: false, message: explain(error) };
  }
}

/**
 * Refuses a name that would land outside the directory it belongs in. The
 * catalog is reviewed and validated in CI, but it arrives over the network, so
 * it is checked again here rather than trusted.
 */
function safeJoin(base: string, name: string): string | undefined {
  if (name.length === 0 || name.includes("\u0000") || name.includes("\\")) return undefined;
  if (name.startsWith("/") || /^[a-zA-Z]:/.test(name)) return undefined;
  if (name.split("/").some((segment) => segment === "..")) return undefined;

  const target = path.resolve(base, name);
  return target.startsWith(base + path.sep) ? target : undefined;
}

const digest = (content: Uint8Array): string => createHash("sha256").update(content).digest("hex");

interface Downloaded {
  readonly name: string;
  readonly content: Uint8Array;
}

async function download(entry: CatalogEntry, file: CatalogFile): Promise<Downloaded> {
  // A single-file theme is the listing itself; a folder's files sit under it.
  const relative = isSingleFileTheme(entry) ? entry.path : `${entry.path}/${file.name}`;
  const response = await get(relative);
  const content = new Uint8Array(await response.arrayBuffer());

  if (digest(content) !== file.sha256) {
    throw new Error(`${file.name} does not match the catalog, so it was not installed`);
  }
  return { name: file.name, content };
}

function totalBytes(files: readonly CatalogFile[]): number {
  return files.reduce((total, file) => total + (Number(file.bytes) || 0), 0);
}

/**
 * Downloads everything before writing anything, so a failure halfway through
 * cannot leave a half-installed plugin that BetterGravity would then try to run.
 */
export async function installEntry(
  paths: RuntimePaths,
  entry: CatalogEntry,
  platform: string = process.platform
): Promise<ContentResult> {
  if (!matchesPlatform(entry, platform)) {
    const required = entry.platforms?.join(", ") ?? "other platforms";
    return { ok: false, message: `${entry.name} is only available on ${required}.` };
  }

  if (entry.kind !== "theme" && entry.kind !== "plugin") return { ok: false, message: "Unknown kind of listing." };

  // The catalog arrives over the network, so a listing is checked rather than
  // destructured. An older catalog has no file list at all.
  const listed: readonly CatalogFile[] = Array.isArray(entry.files) ? entry.files : [];
  if (listed.length === 0) return { ok: false, message: `${entry.name} lists no files.` };
  if (listed.some((file) => typeof file?.name !== "string" || typeof file?.sha256 !== "string")) {
    return { ok: false, message: `${entry.name} is described in a way this version does not understand.` };
  }

  const singleFile = isSingleFileTheme(entry);
  const limit = entry.kind === "plugin" ? LIMITS.pluginBytes : singleFile ? LIMITS.themeBytes : LIMITS.themeFolderBytes;
  if (totalBytes(listed) > limit) {
    return { ok: false, message: `${entry.name} is larger than the ${Math.round(limit / 1024 / 1024)} MB limit.` };
  }

  const root = entry.kind === "theme" ? paths.themes : paths.plugins;
  const destination = safeJoin(root, entry.id);
  if (!destination) return { ok: false, message: `${entry.id} is not a name that can be installed.` };

  // A single-file theme is written as the listing itself, so its destination is
  // already checked. A folder's files keep their layout under it, and each one
  // is resolved before anything is downloaded: a listing that could not be
  // installed safely costs nothing to reject.
  if (!singleFile && listed.some((file) => !safeJoin(destination, file.name))) {
    return { ok: false, message: `${entry.name} contains a file path that cannot be installed.` };
  }

  let downloaded: readonly Downloaded[];
  try {
    downloaded = await Promise.all(listed.map(async (file) => download(entry, file)));
  } catch (error) {
    logger.error(`Could not download ${entry.id}.`, error);
    return { ok: false, message: explain(error) };
  }

  const updating = fs.existsSync(destination);
  try {
    fs.mkdirSync(root, { recursive: true });
    if (singleFile) {
      const [file] = downloaded;
      if (file) fs.writeFileSync(destination, file.content);
    } else {
      // Assembled beside the target and swapped in, so an update that fails
      // part way through leaves the installed copy as it was rather than a
      // mixture of two versions.
      const staging = `${destination}.installing`;
      fs.rmSync(staging, { recursive: true, force: true });
      for (const file of downloaded) {
        const target = safeJoin(staging, file.name);
        if (!target) throw new Error(`${file.name} resolved outside its folder`);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, file.content);
      }
      fs.rmSync(destination, { recursive: true, force: true });
      fs.renameSync(staging, destination);
    }
  } catch (error) {
    logger.error(`Could not install ${entry.id}.`, error);
    fs.rmSync(`${destination}.installing`, { recursive: true, force: true });
    return { ok: false, message: `Could not write ${entry.name} to disk.` };
  }

  if (updating) return { ok: true, message: `Updated ${entry.name} to ${entry.version}.` };
  return {
    ok: true,
    message:
      entry.kind === "theme"
        ? `Added ${entry.name}. Switch it on under Themes.`
        : `Added ${entry.name}. Switch it on under Plugins.`
  };
}

/** Test seam: the cache is process-wide otherwise. */
export function resetCatalogCache(): void {
  cache = undefined;
}
