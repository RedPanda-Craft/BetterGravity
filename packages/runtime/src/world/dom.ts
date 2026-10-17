import type { PluginDom, WaitForOptions } from "@bettergravity/plugin-api";

const DEFAULT_TIMEOUT_MS = 10_000;

/* ---------------------------------------------------------------------------
 * One observer for every watcher
 * ---------------------------------------------------------------------------
 * `observe` used to hand each caller its own document-wide MutationObserver
 * whose callback re-queried the whole document. Two costs came out of that, and
 * both grow with the number of watchers a plugin installs:
 *
 *   1. Chromium builds a MutationRecord per registered observer, so a plugin
 *      with twenty watchers paid twenty records — each holding NodeLists — for
 *      every node the app touched. Antigravity streams a reply node by node,
 *      and that record churn alone was enough to run the renderer out of
 *      memory on a long conversation.
 *   2. Every batch ran twenty whole-tree `querySelectorAll` calls. Attribute
 *      selectors are not indexed, so each is a walk over every element in the
 *      document.
 *
 * The registry below keeps one observer for the whole runtime and, per batch,
 * scans only what changed. Three things keep that cheap however many watchers
 * there are:
 *
 *   - The attributes watched are the ones the selectors name. An app mid
 *     animation rewrites `style` every frame, and a virtualised list rewrites
 *     the transform of every row it scrolls past; nothing about `style` can
 *     bring an element into a selector that never mentions it, so none of that
 *     traffic is delivered at all.
 *   - A changed root inside another changed root is dropped, so a subtree that
 *     arrives with its attributes already set is scanned once rather than once
 *     per element in it.
 *   - Each root is tested and queried against all the selectors joined
 *     together rather than once per watcher, so a batch that matches nothing —
 *     which is nearly every batch — costs one `matches` and one
 *     `querySelectorAll` for the whole runtime.
 *
 * Watchers are still handed each element exactly once, and still inside the
 * task the app changed the document in, so nothing is painted between the
 * change and the plugin's mark on it.
 * ------------------------------------------------------------------------- */
type Watcher = {
  selector: string;
  onMatch: (element: Element) => void;
  /** Elements already handed over; the app re-renders far too often to hand twice. */
  seen: WeakSet<Element>;
  /**
   * A selector whose subject can start matching because something *else*
   * changed — a sibling arriving, an ancestor gaining a descendant, a child
   * count going up. Nothing inside the changed subtree points back at the
   * subject, so those get the whole document rather than a wrong answer.
   */
  positional: boolean;
};

/**
 * Past this many changed roots in a batch the scoped scans would walk more of
 * the tree than a single pass over the document, so the single pass is taken
 * instead. Both branches now cost one query for every watcher together, which
 * is why the ceiling can sit this high.
 */
const SCOPED_SCAN_LIMIT = 512;

/** Selector syntax that matches on a sibling, an ancestor, or a position. */
const POSITIONAL =
  /:has\(|:nth-|:first-child|:last-child|:only-child|:first-of-type|:last-of-type|:only-of-type|:empty|[+~]/;

/** The attribute a state pseudo-class reads, since it names none itself. */
const PSEUDO_ATTRIBUTES: readonly (readonly [RegExp, string])[] = [
  [/:checked/, "checked"],
  [/:disabled|:enabled/, "disabled"],
  [/:required|:optional/, "required"],
  [/:read-only|:read-write/, "readonly"],
  [/:placeholder-shown/, "placeholder"],
  [/:lang\(/, "lang"],
  [/:dir\(/, "dir"],
  [/:link|:visited|:any-link/, "href"],
  [/:target/, "id"]
];

/** `[data-testid="x"]`, `[class*="y"]`, `[hidden]` — the name in front. */
const ATTRIBUTE_IN_SELECTOR = /\[\s*([A-Za-z_][-\w:.]*)/g;

const watchers = new Set<Watcher>();
/** Watchers by selector, so one selector written twice is still tested once. */
const groups = new Map<string, Set<Watcher>>();
const changedRoots = new Set<Element>();

let combined = "";
let watched: string[] = [];
let positional = 0;
/** A batch arrived while a positional watcher was registered. */
let positionalDirty = false;
let observer: MutationObserver | undefined;
let flushQueued = false;
/**
 * The attributes that can change a selector's verdict on an element are the
 * ones the selector names, so the filter is derived from the text. Deliberately
 * over-inclusive: a stray `.` inside an attribute value costs one extra
 * attribute on the filter, where missing one would lose a match.
 */
function attributesFor(selector: string, into: Set<string>): void {
  if (selector.includes(".")) into.add("class");
  if (selector.includes("#")) into.add("id");
  for (const [pseudo, attribute] of PSEUDO_ATTRIBUTES) {
    if (pseudo.test(selector)) into.add(attribute);
  }
  for (const match of selector.matchAll(ATTRIBUTE_IN_SELECTOR)) {
    const name = match[1];
    if (name) into.add(name.toLowerCase());
  }
}

/** Re-registering the same node replaces its options, per the spec. */
function reobserve(): void {
  if (!observer) return;
  observer.observe(
    document.documentElement,
    watched.length > 0
      ? { childList: true, subtree: true, attributes: true, attributeFilter: watched }
      : { childList: true, subtree: true }
  );
}

/** Recomputes the joined selector and the attribute filter; true if the filter moved. */
function rebuild(): boolean {
  combined = [...groups.keys()].join(",");
  positional = 0;
  const names = new Set<string>();
  for (const [selector, group] of groups) {
    attributesFor(selector, names);
    for (const watcher of group) {
      if (watcher.positional) positional += 1;
    }
  }
  const next = [...names].sort();
  if (next.length === watched.length && next.every((name, at) => name === watched[at])) return false;
  watched = next;
  return true;
}

function deliver(watcher: Watcher, element: Element): void {
  if (watcher.seen.has(element)) return;
  watcher.seen.add(element);
  try {
    watcher.onMatch(element);
  } catch (error) {
    console.error(`[BetterGravity] An observer for "${watcher.selector}" threw.`, error);
  }
}
function scanDocument(watcher: Watcher): void {
  try {
    for (const element of document.querySelectorAll(watcher.selector)) deliver(watcher, element);
  } catch (error) {
    console.error(`[BetterGravity] The selector "${watcher.selector}" cannot be used.`, error);
  }
}

/**
 * Hands one element to whichever watchers asked for something it matches.
 * `matched` says the element already came out of a query for the joined
 * selector, so the cheap rejection has happened; otherwise one `matches`
 * against the joined selector turns away everything the runtime does not want,
 * which is the overwhelming majority of what the app touches.
 */
function route(element: Element, matched: boolean): void {
  if (!matched && groups.size > 1) {
    try {
      if (!element.matches(combined)) return;
    } catch {
      // An unparseable group; the loop below reports the selector at fault.
    }
  }
  for (const [selector, group] of groups) {
    let hit: boolean | undefined;
    for (const watcher of group) {
      if (watcher.seen.has(element)) continue;
      if (hit === undefined) {
        try {
          hit = element.matches(selector);
        } catch {
          hit = false;
        }
      }
      if (hit) deliver(watcher, element);
    }
  }
}

function scanWithin(scope: Element | Document): void {
  if (combined === "") return;
  try {
    for (const element of scope.querySelectorAll(combined)) route(element, true);
  } catch {
    // One malformed selector takes its whole group down, so fall back to a
    // query per selector and let only the offender fail.
    for (const [selector, group] of groups) {
      try {
        for (const element of scope.querySelectorAll(selector)) {
          for (const watcher of group) deliver(watcher, element);
        }
      } catch (error) {
        console.error(`[BetterGravity] The selector "${selector}" cannot be used.`, error);
      }
    }
  }
}
/**
 * A root whose ancestor changed in the same batch is inside that ancestor's
 * scan already. Walking each root's ancestors costs its depth, so a whole
 * conversation arriving as one subtree collapses to a single scan instead of
 * one per element that came with it.
 */
function outermost(): Element[] {
  const kept: Element[] = [];
  for (const root of changedRoots) {
    if (!root.isConnected) continue;
    let ancestor = root.parentElement;
    let covered = false;
    while (ancestor) {
      if (changedRoots.has(ancestor)) {
        covered = true;
        break;
      }
      ancestor = ancestor.parentElement;
    }
    if (!covered) kept.push(root);
  }
  return kept;
}

function flush(): void {
  flushQueued = false;
  const wide = positionalDirty;
  positionalDirty = false;
  const whole = changedRoots.size > SCOPED_SCAN_LIMIT;
  const roots = whole ? [] : outermost();
  changedRoots.clear();
  if (groups.size === 0) return;

  if (whole) {
    // The joined selector means this is one pass for every watcher, not one
    // pass each, and it answers the positional selectors on the way through.
    scanWithin(document);
    return;
  }

  for (const root of roots) {
    route(root, false);
    scanWithin(root);
  }

  // A selector that matches on a sibling or an ancestor cannot be answered from
  // the subtree that changed, so it gets the document. Nothing in the shipped
  // plugins needs this; it is here so a plugin that writes `.a + .b` gets a
  // right answer rather than a fast one.
  if (!wide) return;
  for (const watcher of [...watchers]) {
    if (watcher.positional) scanDocument(watcher);
  }
}
import { typingGuard } from "./typing-guard.js";

export { typingGuard };

export function isUserTyping(): boolean {
  return typingGuard.isUserTyping;
}

/**
 * The observer callback already runs at a microtask checkpoint, so one more
 * microtask coalesces every callback raised in this task without letting a
 * frame through. A watcher's mark still lands before anything is painted.
 *
 * During active user typing, we guard the flush via TypingGuard scheduler to keep
 * keystrokes smooth, responsive, and completely reflow-free.
 */
function queueFlush(): void {
  if (flushQueued) return;
  flushQueued = true;

  if (typingGuard.isUserTyping) {
    typingGuard.guard("dom:flush", () => {
      if (flushQueued) flush();
    })();
    return;
  }

  queueMicrotask(flush);
}

function collect(mutations: MutationRecord[]): void {
  // A positional selector can start matching on a removal, or on an attribute
  // written to a sibling, neither of which leaves anything in the changed set to
  // find it from. So any batch at all puts those watchers back over the whole
  // document — which is what every watcher used to cost, for the few that need it.
  if (positional > 0 && mutations.length > 0) positionalDirty = true;
  for (const mutation of mutations) {
    if (mutation.type === "attributes") {
      // Only the attributes the selectors named reach here, so an element whose
      // verdict cannot have changed never queues a scan.
      if (mutation.target instanceof Element) changedRoots.add(mutation.target);
      continue;
    }
    for (const node of mutation.addedNodes) {
      if (node instanceof Element) changedRoots.add(node);
    }
  }
  if (changedRoots.size > 0 || positionalDirty) queueFlush();
}

function addWatcher(watcher: Watcher): () => void {
  watchers.add(watcher);
  const group = groups.get(watcher.selector) ?? new Set<Watcher>();
  group.add(watcher);
  groups.set(watcher.selector, group);

  const created = !observer;
  if (created) observer = new MutationObserver(collect);
  if (rebuild() || created) reobserve();

  return () => {
    if (!watchers.delete(watcher)) return;
    const remaining = groups.get(watcher.selector);
    remaining?.delete(watcher);
    if (remaining?.size === 0) groups.delete(watcher.selector);
    if (watchers.size > 0) {
      if (rebuild()) reobserve();
      return;
    }
    observer?.disconnect();
    observer = undefined;
    changedRoots.clear();
    groups.clear();
    combined = "";
    watched = [];
    positional = 0;
    positionalDirty = false;
  };
}
/**
 * Antigravity's interface is a single-page app that rebuilds its DOM as the
 * user moves around, so a plugin that queries once at startup finds nothing.
 * These helpers are the supported way to attach to elements as they appear.
 */
export function createDomUtilities(track: (dispose: () => void) => void): PluginDom {
  return {
    waitFor<Element_ extends Element = Element>(selector: string, options: WaitForOptions = {}): Promise<Element_> {
      const within = options.within ?? document;
      const existing = within.querySelector<Element_>(selector);
      if (existing) return Promise.resolve(existing);

      return new Promise<Element_>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          stop();
          reject(new Error(`Timed out after ${options.timeout ?? DEFAULT_TIMEOUT_MS}ms waiting for "${selector}".`));
        }, options.timeout ?? DEFAULT_TIMEOUT_MS);

        const observer = new MutationObserver(() => {
          const found = within.querySelector<Element_>(selector);
          if (!found) return;
          stop();
          resolve(found);
        });

        const stop = () => {
          window.clearTimeout(timeout);
          observer.disconnect();
        };

        observer.observe(document.documentElement, { childList: true, subtree: true });
        track(stop);
      });
    },

    observe<Element_ extends Element = Element>(selector: string, onMatch: (element: Element_) => void): () => void {
      const watcher: Watcher = {
        selector,
        onMatch: onMatch as (element: Element) => void,
        seen: new WeakSet<Element>(),
        positional: POSITIONAL.test(selector)
      };
      const stop = addWatcher(watcher);
      // Whatever is already on screen, before a mutation has arrived.
      scanDocument(watcher);
      track(stop);
      return stop;
    }
  };
}
