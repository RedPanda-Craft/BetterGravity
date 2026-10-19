import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RuntimePaths } from "../src/main/paths.js";
import type { CatalogEntry } from "../src/protocol.js";

vi.mock("../src/main/logger.js", () => ({
  logger: { info: () => undefined, error: () => undefined, open: () => undefined }
}));

const { fetchCatalog, installEntry, resetCatalogCache } = await import("../src/main/marketplace.js");

const RAW = "https://raw.githubusercontent.com/RedPanda-Craft/SuperGravity/main/";

const sha256 = (content: string): string => createHash("sha256").update(content).digest("hex");

let root: string;
let paths: RuntimePaths;
let served: Map<string, string>;
let requested: string[];

const entry = (overrides: Partial<CatalogEntry> = {}): CatalogEntry => {
  const kind = overrides.kind ?? "theme";
  const id = overrides.id ?? (kind === "theme" ? "midnight.css" : "word-count");
  return {
    id,
    kind,
    name: "Midnight",
    description: "A quiet accent line.",
    version: "1.0.0",
    author: "someone",
    path: `community/${kind}s/${id}`,
    bytes: 0,
    files: [],
    ...overrides
  };
};

/** Builds a listing whose hashes match what the fake network will serve. */
const listing = (kind: "theme" | "plugin", id: string, contents: Record<string, string>): CatalogEntry => {
  const files = Object.entries(contents).map(([name, text]) => ({
    name,
    bytes: Buffer.byteLength(text),
    sha256: sha256(text)
  }));
  const base = `community/${kind}s/${id}`;
  const singleFile = kind === "theme" && id.endsWith(".css");
  for (const [name, text] of Object.entries(contents)) {
    served.set(singleFile ? base : `${base}/${name}`, text);
  }
  return entry({ kind, id, files, bytes: files.reduce((total, file) => total + file.bytes, 0) });
};

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "bettergravity-market-"));
  paths = {
    root,
    themes: path.join(root, "themes"),
    plugins: path.join(root, "plugins"),
    settings: path.join(root, "settings.json"),
    storage: path.join(root, "storage.json"),
    log: path.join(root, "runtime.log"),
    gemini: path.join(root, "gemini")
  };
  fs.mkdirSync(paths.themes, { recursive: true });
  fs.mkdirSync(paths.plugins, { recursive: true });

  served = new Map();
  requested = [];
  resetCatalogCache();

  vi.stubGlobal("fetch", async (input: URL | RequestInfo) => {
    const url = String(input instanceof URL ? input.href : input);
    requested.push(url);
    if (!url.startsWith(RAW)) throw new Error(`unexpected host: ${url}`);
    const body = served.get(url.slice(RAW.length));
    if (body === undefined) return new Response("not found", { status: 404 });
    return new Response(body, { status: 200 });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  fs.rmSync(root, { recursive: true, force: true });
});

describe("fetching the catalog", () => {
  const catalog = (entries: readonly CatalogEntry[]) => JSON.stringify({ schemaVersion: 1, generatedAt: "", entries });

  it("reads the listings from the repository", async () => {
    served.set("community/catalog.json", catalog([entry()]));

    const result = await fetchCatalog();

    expect(result.ok).toBe(true);
    expect(result.entries?.[0]?.id).toBe("midnight.css");
  });

  it("asks the repository and nowhere else", async () => {
    served.set("community/catalog.json", catalog([]));

    await fetchCatalog();

    expect(requested).toEqual([`${RAW}community/catalog.json`]);
  });

  it("serves a second look from the cache", async () => {
    served.set("community/catalog.json", catalog([entry()]));

    await fetchCatalog();
    const second = await fetchCatalog();

    expect(second.cached).toBe(true);
    expect(requested).toHaveLength(1);
  });

  it("goes back to the network when the user refreshes", async () => {
    served.set("community/catalog.json", catalog([entry()]));

    await fetchCatalog();
    const refreshed = await fetchCatalog(true);

    expect(refreshed.cached).toBe(false);
    expect(requested).toHaveLength(2);
  });

  it("says so plainly when the network is unreachable", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("fetch failed");
    });

    const result = await fetchCatalog();

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/Could not reach the catalog/);
  });

  it("refuses a catalog it does not understand rather than guessing", async () => {
    served.set("community/catalog.json", JSON.stringify({ schemaVersion: 99, entries: [] }));

    const result = await fetchCatalog();

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/format this version understands/);
  });

  it("survives a catalog that is not JSON", async () => {
    served.set("community/catalog.json", "<html>404</html>");

    expect((await fetchCatalog()).ok).toBe(false);
  });

  it("reports a catalog that is missing", async () => {
    expect((await fetchCatalog()).ok).toBe(false);
  });

  it("filters out platform-restricted plugins on incompatible platforms", async () => {
    const winPlugin = entry({ id: "win-tool", kind: "plugin", name: "Win Tool", platforms: ["windows"] });
    const universalPlugin = entry({ id: "any-tool", kind: "plugin", name: "Any Tool" });
    served.set("community/catalog.json", catalog([winPlugin, universalPlugin]));

    const macResult = await fetchCatalog(true, "darwin");
    expect(macResult.ok).toBe(true);
    expect(macResult.entries?.map((e) => e.id)).toEqual(["any-tool"]);

    const winResult = await fetchCatalog(false, "win32");
    expect(winResult.ok).toBe(true);
    expect(winResult.entries?.map((e) => e.id)).toEqual(["win-tool", "any-tool"]);
  });
});

describe("installing a theme", () => {
  it("writes it into the themes folder", async () => {
    const css = "/* @name Midnight */\nbody { color: red; }";
    const result = await installEntry(paths, listing("theme", "midnight.css", { "midnight.css": css }));

    expect(result.ok).toBe(true);
    expect(fs.readFileSync(path.join(paths.themes, "midnight.css"), "utf8")).toBe(css);
  });

  it("says where to switch it on, since installing does not enable it", async () => {
    const result = await installEntry(paths, listing("theme", "midnight.css", { "midnight.css": "body{}" }));

    expect(result.message).toMatch(/Switch it on under Themes/);
  });

  it("reports an update rather than an add when it is already there", async () => {
    fs.writeFileSync(path.join(paths.themes, "midnight.css"), "old");

    const result = await installEntry(paths, listing("theme", "midnight.css", { "midnight.css": "new" }));

    expect(result.message).toMatch(/^Updated Midnight to 1\.0\.0/);
    expect(fs.readFileSync(path.join(paths.themes, "midnight.css"), "utf8")).toBe("new");
  });

  it("installs a folder theme with its layout intact", async () => {
    const files = { "theme.css": '@import "parts/menu.css";', "parts/menu.css": "[role=menu] {}", "fonts/x.woff2": "font bytes" };
    const result = await installEntry(paths, listing("theme", "midnight", files));

    expect(result.ok).toBe(true);
    expect(requested).toEqual(
      expect.arrayContaining([`${RAW}community/themes/midnight/theme.css`, `${RAW}community/themes/midnight/parts/menu.css`])
    );
    expect(fs.readFileSync(path.join(paths.themes, "midnight", "theme.css"), "utf8")).toBe(files["theme.css"]);
    expect(fs.readFileSync(path.join(paths.themes, "midnight", "parts", "menu.css"), "utf8")).toBe(files["parts/menu.css"]);
    expect(fs.existsSync(path.join(paths.themes, "midnight.installing"))).toBe(false);
  });

  it("refuses a folder theme whose file path would escape its folder", async () => {
    const entry_ = listing("theme", "midnight", { "theme.css": "body {}" });
    const files = [...entry_.files, { name: "../escape.css", bytes: 1, sha256: sha256("x") }];

    const result = await installEntry(paths, { ...entry_, files });

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/cannot be installed/);
  });
});

describe("installing a plugin", () => {
  const files = { "plugin.json": '{"name":"Word Count"}', "index.js": "plugin.log.info('hi');" };

  it("writes the whole folder", async () => {
    const result = await installEntry(paths, listing("plugin", "word-count", files));

    expect(result.ok).toBe(true);
    expect(fs.readFileSync(path.join(paths.plugins, "word-count", "index.js"), "utf8")).toBe(files["index.js"]);
    expect(fs.existsSync(path.join(paths.plugins, "word-count", "plugin.json"))).toBe(true);
  });

  it("keeps files in nested folders where they belong", async () => {
    const result = await installEntry(
      paths,
      listing("plugin", "word-count", { "plugin.json": "{}", "index.js": "//", "lib/helper.js": "// helper" })
    );

    expect(result.ok).toBe(true);
    expect(fs.readFileSync(path.join(paths.plugins, "word-count", "lib", "helper.js"), "utf8")).toBe("// helper");
  });

  it("says it will not run until developer mode is on", async () => {
    const result = await installEntry(paths, listing("plugin", "word-count", files));

    expect(result.message).toMatch(/Switch it on under Plugins/);
  });

  // An update that wrote in place would leave files from the old version behind
  // and, if it failed halfway, a mixture of two versions on disk.
  it("replaces the folder rather than writing over it", async () => {
    const target = path.join(paths.plugins, "word-count");
    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(path.join(target, "gone.js"), "from the old version");

    await installEntry(paths, listing("plugin", "word-count", files));

    expect(fs.existsSync(path.join(target, "gone.js"))).toBe(false);
    expect(fs.existsSync(path.join(target, "index.js"))).toBe(true);
  });

  it("leaves the installed version alone when a download fails", async () => {
    const target = path.join(paths.plugins, "word-count");
    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(path.join(target, "index.js"), "the working version");

    const broken = listing("plugin", "word-count", files);
    served.delete("community/plugins/word-count/index.js");

    const result = await installEntry(paths, broken);

    expect(result.ok).toBe(false);
    expect(fs.readFileSync(path.join(target, "index.js"), "utf8")).toBe("the working version");
    expect(fs.existsSync(`${target}.installing`)).toBe(false);
  });
});

describe("refusing what it should not install", () => {
  it("rejects content that does not match the catalog's hash", async () => {
    const entry_ = listing("theme", "midnight.css", { "midnight.css": "the reviewed text" });
    served.set("community/themes/midnight.css", "something else entirely");

    const result = await installEntry(paths, entry_);

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/does not match the catalog/);
    expect(fs.existsSync(path.join(paths.themes, "midnight.css"))).toBe(false);
  });

  it.each([
    ["../escape.css", "a parent directory"],
    ["/etc/passwd", "an absolute path"],
    ["C:\\Windows\\evil.css", "a drive letter"]
  ])("refuses the id %s, which is %s", async (id) => {
    const result = await installEntry(paths, entry({ id, files: [{ name: id, bytes: 1, sha256: sha256("x") }] }));

    expect(result.ok).toBe(false);
    expect(requested).toEqual([]);
  });

  it.each([["../../evil.js"], ["/tmp/evil.js"], ["nested/../../evil.js"]])(
    "refuses a plugin file named %s",
    async (name) => {
      const result = await installEntry(
        paths,
        entry({ kind: "plugin", id: "word-count", files: [{ name, bytes: 1, sha256: sha256("x") }] })
      );

      expect(result.ok).toBe(false);
      expect(result.message).toMatch(/cannot be installed/);
      expect(requested).toEqual([]);
    }
  );

  it("refuses a listing that declares no files", async () => {
    expect((await installEntry(paths, entry({ files: [] }))).ok).toBe(false);
  });

  // A catalog published before file hashes existed, or one that has been
  // tampered with, must not reach the download step.
  it("refuses a listing from a catalog it does not understand", async () => {
    const older = entry();
    delete (older as { files?: unknown }).files;

    const result = await installEntry(paths, older);

    expect(result.ok).toBe(false);
    expect(requested).toEqual([]);
  });

  it("refuses a listing whose files are not described properly", async () => {
    const result = await installEntry(paths, entry({ files: [{ name: 1, bytes: 1 } as unknown as never] }));

    expect(result.ok).toBe(false);
    expect(requested).toEqual([]);
  });

  it("refuses a listing larger than the limit before downloading it", async () => {
    const result = await installEntry(
      paths,
      entry({ files: [{ name: "midnight.css", bytes: 9 * 1024 * 1024, sha256: sha256("x") }] })
    );

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/larger than/);
    expect(requested).toEqual([]);
  });

  it("refuses a kind it does not know", async () => {
    const result = await installEntry(paths, entry({ kind: "firmware" as "theme" }));
    expect(result.ok).toBe(false);
  });

  it("refuses a listing on an incompatible platform", async () => {
    const winOnly = entry({ id: "win-tool", kind: "plugin", name: "Win Tool", platforms: ["windows"] });
    const result = await installEntry(paths, winOnly, "darwin");
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/only available on windows/i);
    expect(requested).toEqual([]);
  });
});
