/**
 * A BetterGravity theme is a plain `.css` file, or a folder whose `theme.css` is
 * one. Rather than pairing it with a separate manifest, its metadata lives in a
 * comment at the top of that file, so a theme stays a single portable artifact:
 *
 *   /**
 *    * @name        Midnight
 *    * @description A calm dark theme.
 *    * @author      someone
 *    * @version     1.0.0
 *    * @source      https://github.com/someone/midnight
 *    *\/
 */

export interface ThemeMetadata {
  readonly name?: string;
  readonly description?: string;
  readonly author?: string;
  readonly version?: string;
  /** Where the theme came from, shown so users can inspect it before trusting it. */
  readonly source?: string;
}

const RECOGNISED_KEYS = ["name", "description", "author", "version", "source"] as const;

type RecognisedKey = (typeof RECOGNISED_KEYS)[number];

const isRecognised = (key: string): key is RecognisedKey => (RECOGNISED_KEYS as readonly string[]).includes(key);

/** Matches the first block comment in the file, which is where metadata belongs. */
const LEADING_COMMENT = /^\s*\/\*+([\s\S]*?)\*\//;

/**
 * Reads `@key value` annotations out of a theme's leading comment. Unknown keys
 * are ignored, and a theme without a header is still perfectly valid.
 */
export function parseThemeMetadata(css: string): ThemeMetadata {
  const comment = LEADING_COMMENT.exec(css);
  if (!comment?.[1]) return {};

  const metadata: Record<RecognisedKey, string | undefined> = {
    name: undefined,
    description: undefined,
    author: undefined,
    version: undefined,
    source: undefined
  };

  for (const line of comment[1].split(/\r?\n/)) {
    const match = /^\s*\*?\s*@(\w+)\s+(.+?)\s*$/.exec(line);
    const key = match?.[1]?.toLowerCase();
    const value = match?.[2];
    if (!key || !value || !isRecognised(key) || metadata[key] !== undefined) continue;
    metadata[key] = value;
  }

  return Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== undefined));
}

/** A starting header for new themes. */
export function themeMetadataTemplate(name: string): string {
  return ["/**", ` * @name        ${name}`, " * @description ", " * @author      ", " * @version     1.0.0", " */", ""].join("\n");
}

export interface RemoteThemeStub {
  /** A file name derived from the URL, safe to write into the themes folder. */
  readonly fileName: string;
  readonly css: string;
}

/**
 * A theme that lives at a URL, in the form BetterDiscord users know: a small
 * local file whose only rule is `@import` of the hosted stylesheet. The local
 * file carries the metadata, and the hosted one can be updated by its author
 * without anyone downloading it again.
 *
 * Returns undefined for anything that is not an http(s) URL.
 */
export function remoteThemeStub(input: string): RemoteThemeStub | undefined {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return undefined;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;

  const lastSegment = url.pathname.split("/").filter(Boolean).pop() ?? "";
  const stem = (lastSegment.replace(/\.css$/i, "") || url.hostname)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const fileName = `${stem || "remote-theme"}.css`;

  // Nothing from the URL is interpolated raw: the comment and the string are
  // both closed by characters a URL can carry, so those are escaped.
  const safeUrl = url.href.replace(/["\\]/g, "\\$&").replace(/\*\//g, "*\\/");
  const displayName = stem
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  const css = [
    "/**",
    ` * @name        ${displayName || "Remote theme"}`,
    ` * @description Loaded from ${safeUrl}`,
    " * @author      Unknown",
    " * @version     1.0.0",
    ` * @source      ${safeUrl}`,
    " */",
    "",
    `@import url("${safeUrl}");`,
    ""
  ].join("\n");

  return { fileName, css };
}

export interface ThemeManifest {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly author?: string;
  readonly version?: string;
  readonly type?: "dark" | "light";
  readonly tokens: Record<string, string>;
}

const ALLOWED_TOKEN_PREFIX = "--sg-";
const BLACKLISTED_VALUE_REGEX = /backdrop-filter|blur\(|url\(\s*['"]?http|expression\(/i;

export function compileThemeManifest(manifest: ThemeManifest): string {
  const declarations: string[] = [];
  for (const [key, rawVal] of Object.entries(manifest.tokens)) {
    const val = String(rawVal).trim();
    if (!key.startsWith(ALLOWED_TOKEN_PREFIX)) continue;
    if (BLACKLISTED_VALUE_REGEX.test(val)) {
      throw new Error(`Security/Performance violation in token ${key}: ${val}`);
    }
    declarations.push(`  ${key}: ${val};`);
  }
  return declarations.length > 0 ? `:root {\n${declarations.join("\n")}\n}` : ":root {}";
}
