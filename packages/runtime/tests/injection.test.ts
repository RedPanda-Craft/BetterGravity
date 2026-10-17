// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STYLE_ATTRIBUTE, applyThemes } from "../src/preload/themes.js";
import { PluginHost } from "../src/world/plugins.js";
import type { PluginRecord, ThemeRecord } from "../src/protocol.js";

const theme = (id: string, enabled: boolean, css = `/* ${id} */`): ThemeRecord => ({
  id,
  name: id.replace(".css", ""),
  description: "",
  author: "test",
  version: "1.0.0",
  css,
  folder: false,
  enabled
});

const plugin = (id: string, enabled: boolean, source = ""): PluginRecord => ({
  id,
  name: id,
  description: "",
  version: "1.0.0",
  author: "test",
  source,
  enabled
});

const written: { pluginId: string; key: string; value: unknown }[] = [];
const reported: string[] = [];
const hosts: PluginHost[] = [];

function createHost(): PluginHost {
  const host = new PluginHost({
    persist: (pluginId, key, value) => void written.push({ pluginId, key, value }),
    report: (message) => void reported.push(message),
    api: { marker: "api" }
  });
  hosts.push(host);
  return host;
}

const nextFrame = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Plugin sources communicate results back through globals on the page. */
const probe = <Value = unknown>(key: string): Value => (globalThis as unknown as Record<string, unknown>)[key] as Value;

beforeEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  written.length = 0;
  reported.length = 0;
});

// Plugins register MutationObservers, which would otherwise outlive the jsdom
// document and fire against a torn-down environment.
afterEach(() => {
  for (const host of hosts.splice(0)) host.sync([]);
});

describe("applyThemes", () => {
  it("injects only the enabled themes", () => {
    const applied = applyThemes([theme("a.css", true), theme("b.css", false), theme("c.css", true)]);
    const injected = [...document.querySelectorAll(`style[${STYLE_ATTRIBUTE}]`)];

    expect(applied).toBe(2);
    expect(injected.map((style) => style.getAttribute(STYLE_ATTRIBUTE))).toEqual(["a.css", "c.css"]);
  });

  it("preserves the css verbatim", () => {
    applyThemes([theme("x.css", true, "body::after { content: 'hi'; }")]);
    expect(document.querySelector(`style[${STYLE_ATTRIBUTE}]`)?.textContent).toBe("body::after { content: 'hi'; }");
  });

  it("removes styles for themes that were turned off", () => {
    applyThemes([theme("a.css", true)]);
    applyThemes([theme("a.css", false)]);
    expect(document.querySelectorAll(`style[${STYLE_ATTRIBUTE}]`)).toHaveLength(0);
  });

  it("does not accumulate duplicates when re-applied", () => {
    for (let attempt = 0; attempt < 3; attempt += 1) applyThemes([theme("a.css", true)]);
    expect(document.querySelectorAll(`style[${STYLE_ATTRIBUTE}]`)).toHaveLength(1);
  });

  it("leaves styles it does not own alone", () => {
    const foreign = document.createElement("style");
    document.head.appendChild(foreign);
    applyThemes([theme("a.css", true)]);
    expect(document.head.contains(foreign)).toBe(true);
  });

  it("reconciles styles in-place without destroying DOM elements", () => {
    applyThemes([theme("a.css", true, "body { color: red; }")]);
    const firstStyle = document.querySelector(`style[${STYLE_ATTRIBUTE}="a.css"]`);
    expect(firstStyle).not.toBeNull();

    // Re-applying with identical CSS should preserve the exact same DOM node
    applyThemes([theme("a.css", true, "body { color: red; }")]);
    const secondStyle = document.querySelector(`style[${STYLE_ATTRIBUTE}="a.css"]`);
    expect(secondStyle).toBe(firstStyle);

    // Re-applying with updated CSS should update textContent in-place on the same node
    applyThemes([theme("a.css", true, "body { color: blue; }")]);
    const thirdStyle = document.querySelector(`style[${STYLE_ATTRIBUTE}="a.css"]`);
    expect(thirdStyle).toBe(firstStyle);
    expect(thirdStyle?.textContent).toBe("body { color: blue; }");
  });
});

describe("PluginHost lifecycle", () => {
  it("starts only the enabled plugins", () => {
    const outcome = createHost().sync([plugin("one", true), plugin("two", false)]);
    expect(outcome.started).toEqual(["one"]);
    expect(outcome.stopped).toEqual([]);
  });

  it("does not restart a plugin that is already running", () => {
    const host = createHost();
    host.sync([plugin("one", true)]);
    expect(host.sync([plugin("one", true)]).started).toEqual([]);
  });

  it("stops a plugin when it is disabled", () => {
    const host = createHost();
    host.sync([plugin("one", true)]);
    expect(host.sync([plugin("one", false)]).stopped).toEqual(["one"]);
    expect(host.isRunning("one")).toBe(false);
  });

  it("restarts a plugin when its source changes on disk", () => {
    const host = createHost();
    host.sync([plugin("edited", true, "globalThis.__generation = 1;")]);
    expect(probe("__generation")).toBe(1);

    const outcome = host.sync([plugin("edited", true, "globalThis.__generation = 2;")]);

    expect(outcome).toEqual({ started: ["edited"], stopped: ["edited"] });
    expect(probe("__generation")).toBe(2);
  });

  it("cleans up the previous instance when restarting", () => {
    const host = createHost();
    host.sync([plugin("edited", true, "plugin.styles.add('body { color: red; }');")]);
    host.sync([plugin("edited", true, "plugin.styles.add('body { color: blue; }');")]);

    const styles = [...document.querySelectorAll("style[data-bettergravity-plugin-style]")];
    expect(styles).toHaveLength(1);
    expect(styles[0]?.textContent).toBe("body { color: blue; }");
  });

  it("injects declared stylesheets before the script runs and removes them with it", () => {
    const host = createHost();
    host.sync([{ ...plugin("look", true, "globalThis.__styled = document.querySelector('style[data-bettergravity-plugin-style]') !== null;"), styles: "body { color: red; }" }]);

    expect(probe("__styled")).toBe(true);
    const styles = [...document.querySelectorAll("style[data-bettergravity-plugin-style]")];
    expect(styles).toHaveLength(1);
    expect(styles[0]?.textContent).toBe("body { color: red; }");

    host.sync([{ ...plugin("look", false), styles: "body { color: red; }" }]);
    expect(document.querySelectorAll("style[data-bettergravity-plugin-style]")).toHaveLength(0);
  });

  it("restarts a plugin when a declared stylesheet changes on disk", () => {
    const host = createHost();
    host.sync([{ ...plugin("look", true), styles: "body { color: red; }" }]);

    const outcome = host.sync([{ ...plugin("look", true), styles: "body { color: blue; }" }]);

    expect(outcome).toEqual({ started: ["look"], stopped: ["look"] });
    const styles = [...document.querySelectorAll("style[data-bettergravity-plugin-style]")];
    expect(styles).toHaveLength(1);
    expect(styles[0]?.textContent).toBe("body { color: blue; }");
  });

  it("hands the plugin its context and the shared api", () => {
    const host = createHost();
    host.sync([plugin("probe", true, "globalThis.__seen = { api: BetterGravity.marker, id: plugin.manifest.id };")]);

    expect(probe("__seen")).toEqual({ api: "api", id: "probe" });
  });

  it("contains a plugin that throws while starting", () => {
    const silenced = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const host = createHost();

    expect(() => host.sync([plugin("boom", true, "throw new Error('nope');")])).not.toThrow();

    expect(host.isRunning("boom")).toBe(false);
    expect(reported.some((line) => line.includes("boom") && line.includes("nope"))).toBe(true);
    silenced.mockRestore();
  });

  it("keeps healthy plugins running when a sibling fails", () => {
    const silenced = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const host = createHost();

    const outcome = host.sync([plugin("bad", true, "throw new Error('x');"), plugin("good", true)]);

    expect(outcome.started).toEqual(["good"]);
    expect(host.isRunning("good")).toBe(true);
    silenced.mockRestore();
  });
});

describe("plugin capabilities", () => {
  it("removes styles a plugin added when it is disabled", () => {
    const host = createHost();
    host.sync([plugin("styler", true, "plugin.styles.add('body { color: red; }');")]);
    expect(document.querySelectorAll("style[data-bettergravity-plugin-style]")).toHaveLength(1);

    host.sync([plugin("styler", false)]);
    expect(document.querySelectorAll("style[data-bettergravity-plugin-style]")).toHaveLength(0);
  });

  it("runs cleanups registered with onDispose", () => {
    const host = createHost();
    host.sync([plugin("tidy", true, "plugin.onDispose(function(){ globalThis.__disposed = true; });")]);
    expect(probe("__disposed")).toBeUndefined();

    host.sync([plugin("tidy", false)]);
    expect(probe("__disposed")).toBe(true);
  });

  it("persists storage writes through the bridge", () => {
    createHost().sync([plugin("saver", true, "plugin.storage.set('count', 3);")]);
    expect(written).toEqual([{ pluginId: "saver", key: "count", value: 3 }]);
  });

  it("reads storage that existed before the plugin started", () => {
    const host = createHost();
    host.useStorage({ reader: { greeting: "hello" } });
    host.sync([plugin("reader", true, "globalThis.__read = plugin.storage.get('greeting');")]);
    expect(probe("__read")).toBe("hello");
  });

  it("falls back when a storage key is absent", () => {
    createHost().sync([plugin("fallback", true, "globalThis.__fb = plugin.storage.get('missing', 'default');")]);
    expect(probe("__fb")).toBe("default");
  });

  // Regression: a restart used to hand back the page-load snapshot, so a plugin
  // that had saved something during the session read a stale value.
  it("shows a restarted plugin the values it saved during the session", () => {
    const host = createHost();
    host.useStorage({ counter: { runs: 1 } });
    host.sync([plugin("counter", true, "plugin.storage.set('runs', plugin.storage.get('runs', 0) + 1);")]);

    host.sync([plugin("counter", true, "globalThis.__runs = plugin.storage.get('runs', 0); // edited")]);

    expect(probe("__runs")).toBe(2);
  });

  it("forgets a deleted key on restart", () => {
    const host = createHost();
    host.useStorage({ forgetful: { temp: "value" } });
    host.sync([plugin("forgetful", true, "plugin.storage.delete('temp');")]);

    host.sync([plugin("forgetful", true, "globalThis.__temp = plugin.storage.get('temp', 'gone'); // edited")]);

    expect(probe("__temp")).toBe("gone");
  });

  it("returns the declared default until a setting is changed", () => {
    const host = createHost();
    host.sync([
      plugin(
        "settings",
        true,
        "plugin.settings.define({ compact: { type: 'boolean', label: 'Compact', default: true } });" +
          "globalThis.__before = plugin.settings.get('compact');"
      )
    ]);

    expect(probe("__before")).toBe(true);
    host.get("settings")?.writeSetting("compact", false);
    expect(host.get("settings")?.readSetting("compact")).toBe(false);
  });

  it("notifies the plugin when a setting changes", () => {
    const host = createHost();
    host.sync([plugin("watcher", true, "plugin.settings.onChange(function(k, v){ globalThis.__change = k + '=' + v; });")]);

    host.get("watcher")?.writeSetting("size", 12);

    expect(probe("__change")).toBe("size=12");
  });

  it("keeps settings out of the plugin's own storage keys", () => {
    const host = createHost();
    host.sync([plugin("mixed", true, "plugin.storage.set('real', 1);")]);
    host.get("mixed")?.writeSetting("hidden", true);

    const keys = host.get("mixed")?.context.storage.keys() ?? [];
    expect(keys).toEqual(["real"]);
  });
});

describe("plugin dom utilities", () => {
  it("resolves waitFor immediately for an element that already exists", async () => {
    document.body.innerHTML = `<div class="target">here</div>`;
    const host = createHost();
    host.sync([plugin("dom", true, "globalThis.__found = plugin.dom.waitFor('.target');")]);

    await expect(probe<Promise<Element>>("__found")).resolves.toHaveProperty("textContent", "here");
  });

  it("resolves waitFor once a matching element appears", async () => {
    const host = createHost();
    host.sync([plugin("dom", true, "globalThis.__later = plugin.dom.waitFor('.late');")]);

    const element = document.createElement("div");
    element.className = "late";
    document.body.appendChild(element);

    await expect(probe<Promise<Element>>("__later")).resolves.toBe(element);
  });

  it("rejects waitFor after the timeout", async () => {
    const host = createHost();
    host.sync([plugin("dom", true, "globalThis.__never = plugin.dom.waitFor('.absent', { timeout: 20 });")]);

    await expect(probe<Promise<Element>>("__never")).rejects.toThrow(/Timed out/);
  });

  it("delivers current and future matches to observe exactly once", async () => {
    document.body.innerHTML = `<b class="item"></b>`;
    const host = createHost();
    host.sync([plugin("dom", true, "globalThis.__hits = []; plugin.dom.observe('.item', function(el){ globalThis.__hits.push(el); });")]);

    const added = document.createElement("b");
    added.className = "item";
    document.body.appendChild(added);
    await nextFrame();

    const hits = probe<Element[]>("__hits") ?? [];
    expect(hits).toHaveLength(2);
    expect(hits[1]).toBe(added);
  });

  it("delivers an element nested inside an added subtree", async () => {
    const host = createHost();
    host.sync([plugin("dom", true, "globalThis.__deep = []; plugin.dom.observe('.deep', function(el){ globalThis.__deep.push(el); });")]);

    const branch = document.createElement("div");
    branch.innerHTML = `<span><em><i class="deep"></i></em></span>`;
    document.body.appendChild(branch);
    await nextFrame();

    expect(probe<Element[]>("__deep") ?? []).toEqual([branch.querySelector(".deep")]);
  });

  it("delivers an element that only starts matching when its class changes", async () => {
    const element = document.createElement("u");
    document.body.appendChild(element);
    const host = createHost();
    host.sync([plugin("dom", true, "globalThis.__armed = []; plugin.dom.observe('.armed', function(el){ globalThis.__armed.push(el); });")]);

    expect(probe<Element[]>("__armed") ?? []).toHaveLength(0);
    element.className = "armed";
    await nextFrame();

    expect(probe<Element[]>("__armed") ?? []).toEqual([element]);
  });

  it("delivers a match to every watcher of the same selector", async () => {
    const host = createHost();
    host.sync([
      plugin("first", true, "globalThis.__a = 0; plugin.dom.observe('.shared', function(){ globalThis.__a += 1; });"),
      plugin("second", true, "globalThis.__b = 0; plugin.dom.observe('.shared', function(){ globalThis.__b += 1; });")
    ]);

    const element = document.createElement("s");
    element.className = "shared";
    document.body.appendChild(element);
    await nextFrame();

    expect(probe<number>("__a")).toBe(1);
    expect(probe<number>("__b")).toBe(1);
  });

  it("keeps one watcher running when another plugin's is disposed", async () => {
    const keeper = "globalThis.__kept = 0; plugin.dom.observe('.both', function(){ globalThis.__kept += 1; });";
    const host = createHost();
    host.sync([
      plugin("keeper", true, keeper),
      plugin("goer", true, "globalThis.__gone = 0; plugin.dom.observe('.both', function(){ globalThis.__gone += 1; });")
    ]);
    // The keeper's source is unchanged, so it is left running rather than restarted.
    host.sync([plugin("keeper", true, keeper), plugin("goer", false)]);

    const element = document.createElement("q");
    element.className = "both";
    document.body.appendChild(element);
    await nextFrame();

    expect(probe<number>("__kept")).toBe(1);
    expect(probe<number>("__gone")).toBe(0);
  });

  it("scans what changed rather than the whole document for every watcher", async () => {
    const host = createHost();
    host.sync([
      ...Array.from({ length: 19 }, (_unused, index) =>
        plugin(`filler-${index}`, true, `plugin.dom.observe('.filler-${index}', function(){});`)
      ),
      plugin("last", true, "globalThis.__last = []; plugin.dom.observe('.last', function(el){ globalThis.__last.push(el); });")
    ]);

    // Registration scans the document once per watcher, which is the only time it
    // should have to: from here on a batch is answered from what it changed.
    let documentScans = 0;
    const query = Document.prototype.querySelectorAll;
    Document.prototype.querySelectorAll = function patched(this: Document, ...args: [string]) {
      documentScans += 1;
      return query.apply(this, args);
    } as typeof query;

    const element = document.createElement("div");
    element.className = "last";
    try {
      document.body.appendChild(element);
      await nextFrame();
    } finally {
      Document.prototype.querySelectorAll = query;
    }

    expect(probe<Element[]>("__last") ?? []).toEqual([element]);
    expect(documentScans).toBe(0);
  });

  it("answers a positional selector after a removal", async () => {
    document.body.innerHTML = `<div id="pen"><p class="solo"></p><p class="spare"></p></div>`;
    const host = createHost();
    host.sync([plugin("dom", true, "globalThis.__solo = []; plugin.dom.observe('.solo:only-child', function(el){ globalThis.__solo.push(el); });")]);

    expect(probe<Element[]>("__solo") ?? []).toHaveLength(0);
    // A removal leaves nothing in the changed set to find the subject from.
    document.querySelector(".spare")?.remove();
    await nextFrame();

    expect(probe<Element[]>("__solo") ?? []).toEqual([document.querySelector(".solo")]);
  });

  it("widens the watched attributes for a watcher registered later", async () => {
    const element = document.createElement("div");
    document.body.appendChild(element);
    const early = "plugin.dom.observe('.early', function(){});";
    const host = createHost();
    host.sync([plugin("first", true, early)]);
    // The first watcher only needs `class`; the second brings a new attribute to
    // an observer that is already running.
    host.sync([
      plugin("first", true, early),
      plugin("second", true, "globalThis.__flagged = []; plugin.dom.observe('[data-flagged]', function(el){ globalThis.__flagged.push(el); });")
    ]);

    element.setAttribute("data-flagged", "true");
    await nextFrame();

    expect(probe<Element[]>("__flagged") ?? []).toEqual([element]);
  });

  it("answers a sibling selector from the whole document", async () => {
    document.body.innerHTML = `<p class="follower"></p>`;
    const host = createHost();
    host.sync([plugin("dom", true, "globalThis.__after = []; plugin.dom.observe('.leader + .follower', function(el){ globalThis.__after.push(el); });")]);

    // Nothing in the subtree that changed points at the element that starts
    // matching, so a scoped scan alone would never find it.
    expect(probe<Element[]>("__after") ?? []).toHaveLength(0);
    const leader = document.createElement("p");
    leader.className = "leader";
    document.body.insertBefore(leader, document.body.firstChild);
    await nextFrame();

    expect(probe<Element[]>("__after") ?? []).toEqual([document.querySelector(".follower")]);
  });

  it("costs one match and one query for twenty watchers together", async () => {
    const host = createHost();
    host.sync(
      Array.from({ length: 20 }, (_unused, index) =>
        plugin(`watcher-${index}`, true, `plugin.dom.observe('.watcher-${index}', function(){});`)
      )
    );

    let matched = 0;
    let scans = 0;
    const matcher = Element.prototype.matches;
    const query = Element.prototype.querySelectorAll;
    Element.prototype.matches = function patched(this: Element, ...args: [string]) {
      matched += 1;
      return matcher.apply(this, args);
    } as typeof matcher;
    Element.prototype.querySelectorAll = function patched(this: Element, ...args: [string]) {
      scans += 1;
      return query.apply(this, args);
    } as typeof query;

    try {
      document.body.appendChild(document.createElement("aside"));
      await nextFrame();
    } finally {
      Element.prototype.matches = matcher;
      Element.prototype.querySelectorAll = query;
    }

    expect(matched).toBe(1);
    expect(scans).toBe(1);
  });

  it("scans an added subtree once when its own descendants change with it", async () => {
    const host = createHost();
    host.sync([plugin("dom", true, "globalThis.__nested = []; plugin.dom.observe('.nested', function(el){ globalThis.__nested.push(el); });")]);

    const branch = document.createElement("div");
    branch.innerHTML = `<span><em></em></span>`;
    const inner = branch.querySelector("em") as Element;

    let scans = 0;
    const query = Element.prototype.querySelectorAll;
    Element.prototype.querySelectorAll = function patched(this: Element, ...args: [string]) {
      scans += 1;
      return query.apply(this, args);
    } as typeof query;

    try {
      document.body.appendChild(branch);
      // Same batch: the class lands on a node inside the subtree that arrived.
      inner.className = "nested";
      await nextFrame();
    } finally {
      Element.prototype.querySelectorAll = query;
    }

    expect(probe<Element[]>("__nested") ?? []).toEqual([inner]);
    expect(scans).toBe(1);
  });

  it("ignores an attribute no selector mentions", async () => {
    const bystander = document.createElement("div");
    document.body.appendChild(bystander);
    const host = createHost();
    host.sync([plugin("dom", true, "globalThis.__quiet = 0; plugin.dom.observe('.quiet', function(){ globalThis.__quiet += 1; });")]);

    // An app mid animation rewrites `style` every frame and a virtualised list
    // rewrites the transform of every row it scrolls past. No selector here
    // mentions it, so none of that traffic should reach a scan at all.
    let scans = 0;
    const query = Element.prototype.querySelectorAll;
    Element.prototype.querySelectorAll = function patched(this: Element, ...args: [string]) {
      scans += 1;
      return query.apply(this, args);
    } as typeof query;

    try {
      for (let frame = 0; frame < 10; frame += 1) {
        bystander.setAttribute("style", `transform: translateY(${frame}px)`);
        await nextFrame();
      }
    } finally {
      Element.prototype.querySelectorAll = query;
    }

    expect(scans).toBe(0);
    expect(probe<number>("__quiet")).toBe(0);
  });

  it("stops observing when the plugin is disabled", async () => {
    const host = createHost();
    host.sync([plugin("dom", true, "globalThis.__count = 0; plugin.dom.observe('.watched', function(){ globalThis.__count += 1; });")]);

    host.sync([plugin("dom", false)]);
    const element = document.createElement("i");
    element.className = "watched";
    document.body.appendChild(element);
    await nextFrame();

    expect(probe<number>("__count")).toBe(0);
  });
});
