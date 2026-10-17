import fs from "node:fs";
import path from "node:path";
import { parseThemeMetadata } from "@bettergravity/theme-api";
import type { PluginRecord, RuntimeDiagnostic, RuntimeSettings, ThemeRecord } from "../protocol.js";
import { readPatches, type PluginPatches } from "./source-patch.js";
import { THEME_ENTRY_FILES, bundleStylesheet, bundleThemeFolder, containsStylesheet, findThemeEntry } from "./theme-bundle.js";

const MAX_THEME_BYTES = 2 * 1024 * 1024;
const MAX_PLUGIN_BYTES = 4 * 1024 * 1024;

export interface CatalogResult<T> {
  readonly entries: readonly T[];
  readonly diagnostics: readonly RuntimeDiagnostic[];
}

function listEntries(directory: string): readonly fs.Dirent[] {
  try {
    return fs.readdirSync(directory, { withFileTypes: true });
  } catch {
    return [];
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function readBounded(file: string, limit: number): string {
  const { size } = fs.statSync(file);
  if (size > limit) throw new Error(`File is ${Math.round(size / 1024)} KB, above the ${Math.round(limit / 1024)} KB limit.`);
  return fs.readFileSync(file, "utf8");
}

/**
 * A theme is a .css file, or a folder holding a theme.css and the files it
 * refers to. Styling cannot read the filesystem or reach the network on its own,
 * so themes carry none of the trust weight that plugins do.
 */
export function readThemes(directory: string, settings: RuntimeSettings): CatalogResult<ThemeRecord> {
  const entries: ThemeRecord[] = [];
  const diagnostics: RuntimeDiagnostic[] = [];

  const record = (id: string, headerCss: string, css: string, folder: boolean): ThemeRecord => {
    const metadata = parseThemeMetadata(headerCss);
    return {
      id,
      name: metadata.name ?? (folder ? id : path.basename(id, path.extname(id))),
      description: metadata.description ?? "",
      author: metadata.author ?? "Unknown",
      version: metadata.version ?? "0.0.0",
      ...(metadata.source ? { source: metadata.source } : {}),
      css,
      folder,
      enabled: settings.themes.enabled.includes(id)
    };
  };

  for (const entry of listEntries(directory)) {
    const full = path.join(directory, entry.name);
    try {
      if (entry.isFile() && entry.name.toLowerCase().endsWith(".css")) {
        const css = readBounded(full, MAX_THEME_BYTES);
        entries.push(record(entry.name, css, css, false));
      } else if (entry.isDirectory()) {
        // A folder is only a theme once it has an entry stylesheet. One that has
        // stylesheets but no entry is almost certainly a mistake worth reporting;
        // any other folder is none of our business.
        if (!findThemeEntry(full)) {
          if (containsStylesheet(full)) {
            diagnostics.push({ source: `theme ${entry.name}`, message: `The folder has no ${THEME_ENTRY_FILES.join(" or ")}, so it was skipped.` });
          }
          continue;
        }
        const bundle = bundleThemeFolder(full);
        for (const warning of bundle.warnings) diagnostics.push({ source: `theme ${entry.name}`, message: warning });
        entries.push(record(entry.name, bundle.entryCss, bundle.css, true));
      }
    } catch (error) {
      diagnostics.push({ source: `theme ${entry.name}`, message: describe(error) });
    }
  }

  return { entries: entries.sort((a, b) => a.name.localeCompare(b.name)), diagnostics };
}

interface PluginManifest {
  readonly name?: unknown;
  readonly description?: unknown;
  readonly version?: unknown;
  readonly author?: unknown;
  readonly main?: unknown;
  readonly styles?: unknown;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

/** `styles` may be one path or a list of them; anything else is ignored. */
function declaredStyles(value: unknown): readonly string[] {
  const list = Array.isArray(value) ? value : [value];
  return list.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim());
}

/** Resolves a manifest path, refusing one that reaches outside the plugin's directory. */
function insidePlugin(base: string, relative: string, what: string): string {
  const resolved = path.resolve(base, relative);
  if (resolved === base || !resolved.startsWith(base + path.sep)) {
    throw new Error(`The manifest ${what} escapes the plugin directory.`);
  }
  return resolved;
}

/**
 * A plugin is a directory holding plugin.json plus its entry script. Plugins run
 * real code in the page, so they are only read when developer mode is enabled.
 *
 * A manifest may also declare `styles`: stylesheets folded the way a folder
 * theme is and injected while the plugin runs, so a plugin that is mostly a
 * look with some behaviour keeps its CSS in .css files. When `styles` is
 * declared and `main` is not, the entry script is optional.
 */
const BUILTIN_PLUGINS = new Set(["timeslip", "fork-chat", "catppuccin-accent"]);

export function readPlugins(directory: string, settings: RuntimeSettings): CatalogResult<PluginRecord> {
  const isDev = settings.plugins.developerMode;

  const entries: PluginRecord[] = [];
  const diagnostics: RuntimeDiagnostic[] = [];

  for (const entry of listEntries(directory)) {
    if (!entry.isDirectory()) continue;
    if (!isDev && !BUILTIN_PLUGINS.has(entry.name)) continue;
    const base = path.join(directory, entry.name);
    try {
      const manifest = JSON.parse(fs.readFileSync(path.join(base, "plugin.json"), "utf8")) as PluginManifest;
      const main = asString(manifest.main, "index.js");
      const entryFile = insidePlugin(base, main, "entry point");
      const styles = declaredStyles(manifest.styles);

      const sheets: string[] = [];
      for (const declared of styles) {
        const file = insidePlugin(base, declared, `stylesheet "${declared}"`);
        if (!fs.existsSync(file)) {
          diagnostics.push({ source: `plugin ${entry.name}`, message: `Stylesheet "${declared}" was not found.` });
          continue;
        }
        const bundle = bundleStylesheet(base, file);
        for (const warning of bundle.warnings) diagnostics.push({ source: `plugin ${entry.name}`, message: warning });
        sheets.push(`/* ${declared} */\n${bundle.css}`);
      }
      if (sheets.join("").length > MAX_PLUGIN_BYTES) {
        throw new Error(`The stylesheets are above the ${Math.round(MAX_PLUGIN_BYTES / 1024)} KB limit once folded together.`);
      }

      // A plugin that is only a look need not carry a script it has no use for.
      const scriptOptional = styles.length > 0 && typeof manifest.main !== "string";
      const source = scriptOptional && !fs.existsSync(entryFile) ? "" : readBounded(entryFile, MAX_PLUGIN_BYTES);

      entries.push({
        id: entry.name,
        name: asString(manifest.name, entry.name),
        description: asString(manifest.description, ""),
        version: asString(manifest.version, "0.0.0"),
        author: asString(manifest.author, "Unknown"),
        source,
        ...(sheets.length > 0 ? { styles: sheets.join("\n") } : {}),
        enabled: settings.plugins.enabled.includes(entry.name)
      });
    } catch (error) {
      diagnostics.push({ source: `plugin ${entry.name}`, message: describe(error) });
    }
  }

  return { entries: entries.sort((a, b) => a.name.localeCompare(b.name)), diagnostics };
}

/**
 * Patch declarations, read straight from the manifests before any window opens.
 *
 * This runs earlier than everything else in the catalog: the application's
 * bundle has to be rewritten on its way to the renderer, so the declarations
 * must be in hand before the page starts loading. Only enabled plugins count,
 * and only while developer mode is on.
 */
export function readPluginPatches(directory: string, settings: RuntimeSettings): readonly PluginPatches[] {
  if (!settings.plugins.developerMode) return [];

  const sets: PluginPatches[] = [];
  for (const entry of listEntries(directory)) {
    if (!entry.isDirectory() || !settings.plugins.enabled.includes(entry.name)) continue;
    try {
      const manifest: unknown = JSON.parse(fs.readFileSync(path.join(directory, entry.name, "plugin.json"), "utf8"));
      const declared = readPatches(entry.name, manifest);
      if (declared) sets.push(declared);
    } catch {
      // A manifest that cannot be read is reported by readPlugins instead.
    }
  }
  return sets;
}

/**
 * Which enabled plugins declare `"gemini": true`, read even earlier than the
 * patch declarations and for a stronger reason: the translator has to be
 * listening, and the language server's endpoint already rewritten, before
 * Antigravity spawns it. That happens long before a plugin script has run, so
 * the manifest is the only thing there is to go on.
 *
 * Ids, not manifests, because all the main process wants is whose stored
 * settings to read.
 */
export function readGeminiPlugins(directory: string, settings: RuntimeSettings): readonly string[] {
  if (!settings.plugins.developerMode) return [];

  const ids: string[] = [];
  for (const entry of listEntries(directory)) {
    if (!entry.isDirectory() || !settings.plugins.enabled.includes(entry.name)) continue;
    try {
      const manifest = JSON.parse(fs.readFileSync(path.join(directory, entry.name, "plugin.json"), "utf8")) as {
        readonly gemini?: unknown;
      };
      if (manifest.gemini === true) ids.push(entry.name);
    } catch {
      // A manifest that cannot be read is reported by readPlugins instead.
    }
  }
  return ids;
}
