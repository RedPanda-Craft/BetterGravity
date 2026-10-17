// Validates community submissions and builds the catalog from them.
//
//   node scripts/community.mjs check    validate, and fail if the catalog is stale
//   node scripts/community.mjs build    validate and write the catalog
//
// Validation itself lives in @bettergravity/marketplace so it can be tested
// without a filesystem; this script only walks files and reports.

import { createRequire } from "node:module";
import { build as esbuild } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.dirname(import.meta.dirname);
const community = path.join(root, "community");
const catalogFile = path.join(community, "catalog.json");

// The validation package is TypeScript, so it is bundled the same way the
// installer bundles the patcher rather than duplicated in plain JavaScript.
const staging = await mkdtemp(path.join(os.tmpdir(), "bettergravity-catalog-"));
let marketplace;
try {
  const bundle = path.join(staging, "marketplace.cjs");
  await esbuild({
    entryPoints: [path.join(root, "packages", "marketplace", "src", "index.ts")],
    outfile: bundle,
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node22",
    logLevel: "warning"
  });
  marketplace = createRequire(import.meta.url)(bundle);
} finally {
  // The module is loaded; the file on disk is no longer needed.
  setTimeout(() => void rm(staging, { recursive: true, force: true }), 0);
}

const { buildCatalog, sha256, validatePlugin, validateTheme, validateThemeFolder } = marketplace;

function listFiles(directory, prefix = "") {
  const found = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    // A running computer-use plugin writes this local stop signal. It is not
    // a distributable asset and must not enter another plugin's catalog build.
    if (entry.name === "interrupt.signal") continue;
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) found.push(relative, ...listFiles(path.join(directory, entry.name), relative));
    else found.push(relative);
  }
  return found;
}

/**
 * The catalog records a hash per file so a client can check that what it
 * downloaded is what was reviewed in this commit.
 *
 * Read as bytes, which means the hash is of the checkout rather than of the
 * blob. `.gitattributes` pins `eol=lf` for exactly this reason, and `check`
 * runs on Windows as well as Linux, so a checkout that disagreed with what
 * GitHub serves would fail there rather than ship a catalog nobody can verify.
 */
function describeFiles(directory) {
  return listFiles(directory)
    .filter((relative) => statSync(path.join(directory, relative)).isFile())
    .map((relative) => {
      const content = readFileSync(path.join(directory, relative));
      return { name: relative, bytes: content.byteLength, sha256: sha256(content) };
    });
}


const entries = [];
const problems = [];
const notes = [];

// --- themes -----------------------------------------------------------------
const themesDirectory = path.join(community, "themes");
if (existsSync(themesDirectory)) {
  for (const fileName of readdirSync(themesDirectory)) {
    if (fileName === "README.md" || fileName.endsWith(".manifest.json")) continue;
    const full = path.join(themesDirectory, fileName);

    // A theme is one .css file, or a folder with a theme.css and what it uses.
    let result;
    if (statSync(full).isFile()) {
      result = validateTheme(fileName, readFileSync(full, "utf8"));
    } else {
      const fileNames = listFiles(full);
      const files = describeFiles(full);
      const stylesheets = fileNames
        .filter((relative) => relative.toLowerCase().endsWith(".css") && statSync(path.join(full, relative)).isFile())
        .map((relative) => ({ name: relative, css: readFileSync(path.join(full, relative), "utf8") }));
      result = validateThemeFolder(fileName, {
        fileNames,
        stylesheets,
        totalBytes: files.reduce((total, file) => total + file.bytes, 0),
        files
      });
    }

    for (const finding of result.findings) {
      (finding.severity === "error" ? problems : notes).push([`themes/${fileName}`, finding.message]);
    }
    if (result.entry) entries.push(result.entry);
  }
}

// --- plugins ----------------------------------------------------------------
const pluginsDirectory = path.join(community, "plugins");
if (existsSync(pluginsDirectory)) {
  for (const folderName of readdirSync(pluginsDirectory)) {
    if (folderName === "README.md") continue;
    const full = path.join(pluginsDirectory, folderName);
    if (!statSync(full).isDirectory()) {
      problems.push([`plugins/${folderName}`, "A plugin must be a folder containing plugin.json."]);
      continue;
    }

    const manifestPath = path.join(full, "plugin.json");
    const manifest = existsSync(manifestPath) ? readFileSync(manifestPath, "utf8") : undefined;

    let entrySource;
    try {
      const main = manifest ? (JSON.parse(manifest).main ?? "index.js") : "index.js";
      const entryPath = path.join(full, main);
      if (existsSync(entryPath) && statSync(entryPath).isFile()) entrySource = readFileSync(entryPath, "utf8");
    } catch {
      // A broken manifest is reported by the validator below.
    }

    const fileNames = listFiles(full);
    const files = describeFiles(full);
    // A plugin's stylesheets are reviewed for remote references as a theme's are.
    const stylesheets = fileNames
      .filter((relative) => relative.toLowerCase().endsWith(".css") && statSync(path.join(full, relative)).isFile())
      .map((relative) => ({ name: relative, css: readFileSync(path.join(full, relative), "utf8") }));
    const result = validatePlugin(folderName, {
      manifest,
      fileNames,
      entrySource,
      totalBytes: files.reduce((total, file) => total + file.bytes, 0),
      files,
      stylesheets
    });
    for (const finding of result.findings) {
      (finding.severity === "error" ? problems : notes).push([`plugins/${folderName}`, finding.message]);
    }
    if (result.entry) entries.push(result.entry);
  }
}

// --- report -----------------------------------------------------------------
for (const [where, message] of notes) console.log(`note  ${where}: ${message}`);
for (const [where, message] of problems) console.error(`error ${where}: ${message}`);

if (problems.length > 0) {
  console.error(`\n${problems.length} problem(s) found. Nothing was written.`);
  process.exit(1);
}

const command = process.argv[2] ?? "check";
const existing = existsSync(catalogFile) ? JSON.parse(readFileSync(catalogFile, "utf8")) : undefined;
// generatedAt is carried over so an unchanged catalog stays byte-identical and
// `check` does not fail purely because time passed.
const catalog = buildCatalog(entries, existing?.generatedAt);
const serialised = `${JSON.stringify(catalog, null, 2)}\n`;

if (command === "build") {
  const changed = !existing || JSON.stringify(existing.entries) !== JSON.stringify(catalog.entries);
  writeFileSync(catalogFile, changed ? `${JSON.stringify(buildCatalog(entries), null, 2)}\n` : serialised);
  console.log(`Catalog written with ${entries.length} entr${entries.length === 1 ? "y" : "ies"}.`);
} else {
  if (!existing || JSON.stringify(existing.entries) !== JSON.stringify(catalog.entries)) {
    console.error("\ncommunity/catalog.json is out of date. Run `pnpm community:build` and commit the result.");
    process.exit(1);
  }
  console.log(`Community content verified: ${entries.length} entr${entries.length === 1 ? "y" : "ies"}, catalog up to date.`);
}
