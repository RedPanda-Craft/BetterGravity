// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const source = readFileSync("community/plugins/gemini-app/index.js", "utf8");
const mounts = new Map<string, ((element: HTMLElement) => void)[]>();
const disposers: (() => void)[] = [];
const resizes = new Map<Element, () => void>();
let scrollIntoViewDescriptor: PropertyDescriptor | undefined;
let helpers: {
  ensureTopFade(scroller: HTMLElement, readScroll?: boolean): void;
  readProjectMap(fiber: unknown): void;
  getGoToNewConversation(): unknown;
  updateHistoryArrowsPosition(): void;
  wrapItems(fiber: unknown): void;
  unwrapItems(): void;
};

function startPlugin(scanExisting = false) {
  const plugin = {
    settings: {
      define: () => ({ workspaceColor: "blue" }),
      onChange: () => () => {},
    },
    dom: {
      observe: (selector: string, callback: (element: HTMLElement) => void) => {
        const callbacks = mounts.get(selector) ?? [];
        callbacks.push(callback);
        mounts.set(selector, callbacks);
        if (scanExisting) {
          for (const element of document.querySelectorAll<HTMLElement>(selector)) callback(element);
        }
        return () => {};
      },
    },
    react: { getFiber: () => null },
    onDispose: (cleanup: () => void) => disposers.push(cleanup),
  };
  helpers = new Function("BetterGravity", "plugin", `${source}\nreturn { ensureTopFade, readProjectMap, getGoToNewConversation, updateHistoryArrowsPosition, wrapItems, unwrapItems };`)({}, plugin);
}

function stopPlugin() {
  while (disposers.length) disposers.pop()?.();
  mounts.clear();
}

function mount(selector: string, element: HTMLElement) {
  const callbacks = mounts.get(selector);
  expect(callbacks?.length).toBeGreaterThan(0);
  for (const callback of callbacks ?? []) callback(element);
}

async function settle() {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

beforeEach(() => {
  document.body.innerHTML = "";
  document.head.innerHTML = "";
  document.documentElement.removeAttribute("style");
  localStorage.clear();
  resizes.clear();
  vi.useFakeTimers();
  scrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
  vi.stubGlobal("ResizeObserver", class {
    private readonly elements = new Set<Element>();
    constructor(private readonly callback: (entries: { target: Element }[]) => void) {}
    observe(element: Element) { this.elements.add(element); resizes.set(element, () => this.callback([{ target: element }])); }
    unobserve(element: Element) { this.elements.delete(element); resizes.delete(element); }
    disconnect() { for (const element of this.elements) resizes.delete(element); this.elements.clear(); }
  });
});

afterEach(() => {
  stopPlugin();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (scrollIntoViewDescriptor) Object.defineProperty(HTMLElement.prototype, "scrollIntoView", scrollIntoViewDescriptor);
  else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
  document.body.innerHTML = "";
  document.head.innerHTML = "";
});

describe("Gemini App repeated work", () => {
  it("restores sidebar collapse handlers when starting on an already mounted page", async () => {
    document.body.innerHTML = '<div><div><nav role="navigation" aria-label="Sidebar"><div class="shrink-0 flex items-center"></div><div class="px-2"><div class="flex flex-col"><button data-testid="new-conversation-button">New conversation</button><button data-testid="history-button">History</button></div></div><div class="relative"><div data-testid="conversation-list-sidebar"></div></div></nav></div></div><button data-testid="sidebar-toggle" aria-label="Toggle Sidebar" aria-expanded="true"></button>';
    const sidebar = document.querySelector<HTMLElement>('nav[aria-label="Sidebar"]')!;
    const toggle = document.querySelector<HTMLButtonElement>('[data-testid="sidebar-toggle"]')!;
    const frame = sidebar.parentElement!.parentElement!;
    for (let cycle = 0; cycle < 2; cycle++) {
      startPlugin(true);
      await settle();
      const extraButton = document.createElement("button");
      extraButton.setAttribute("data-bettergravity-button", "reload-check");
      sidebar.querySelector(".px-2 > .flex-col")!.append(extraButton);
      await settle();
      expect(extraButton.parentElement).toBe(document.getElementById("gemini-scroll-nav"));
      extraButton.remove();
      toggle.click();
      expect(sidebar.dataset.collapsed).toBe("true");
      toggle.setAttribute("aria-expanded", "false");
      await settle();
      expect(frame.style.width).toBe("52px");
      toggle.setAttribute("aria-expanded", "true");
      await settle();
      expect(sidebar.dataset.collapsed).toBe("false");
      expect(frame.style.width).toBe("288px");
      stopPlugin();
    }
  });

  it("keeps the same fade threshold without measuring scroll position when virtual rows change", async () => {
    startPlugin();
    document.body.innerHTML = '<div><div data-testid="conversation-list-sidebar"></div></div>';
    const scroller = document.querySelector<HTMLElement>('[data-testid="conversation-list-sidebar"]')!;
    let scrollTop = 0;
    const readScroll = vi.fn(() => scrollTop);
    Object.defineProperty(scroller, "scrollTop", { configurable: true, get: readScroll });
    mount('[data-testid="conversation-list-sidebar"]', scroller);
    await settle();
    expect(document.getElementById("gemini-top-fade")?.dataset.scrolled).toBe("false");

    readScroll.mockClear();
    for (let i = 0; i < 5; i++) {
      scroller.append(document.createElement("div"));
      await settle();
    }
    expect(readScroll).not.toHaveBeenCalled();

    for (const [position, expected] of [[5, "false"], [6, "true"], [300, "true"], [0, "false"]] as const) {
      scrollTop = position;
      scroller.dispatchEvent(new Event("scroll"));
      expect(document.getElementById("gemini-top-fade")?.dataset.scrolled).toBe(expected);
    }
    expect(readScroll).toHaveBeenCalledTimes(4);

    document.getElementById("gemini-top-fade")?.remove();
    scrollTop = 25;
    scroller.append(document.createElement("div"));
    await settle();
    expect(document.getElementById("gemini-top-fade")?.dataset.scrolled).toBe("true");
  });

  it("recognizes each navigation callback once and still follows a replacement callback", () => {
    startPlugin();
    const first = () => {};
    const second = () => {};
    const unrelated = () => {};
    const firstSource = vi.spyOn<any, any>(first, "toString").mockReturnValue('()=>navigate("AGENT_MANAGER_HOME")');
    const secondSource = vi.spyOn<any, any>(second, "toString").mockReturnValue('()=>otherNavigate("AGENT_MANAGER_HOME")');
    const unrelatedSource = vi.spyOn<any, any>(unrelated, "toString").mockReturnValue("()=>0");
    const fiber = { memoizedState: { memoizedState: [first, []], next: { memoizedState: unrelated, next: null } } };
    for (let i = 0; i < 20; i++) helpers.readProjectMap(fiber);
    expect(firstSource).toHaveBeenCalledTimes(1);
    expect(unrelatedSource).toHaveBeenCalledTimes(1);
    expect(helpers.getGoToNewConversation()).toBe(first);

    fiber.memoizedState.memoizedState = [second, []];
    helpers.readProjectMap(fiber);
    expect(secondSource).toHaveBeenCalledTimes(1);
    expect(helpers.getGoToNewConversation()).toBe(second);
  });

  it("leaves toolbar styles alone until their measured position changes", () => {
    startPlugin();
    document.body.innerHTML = '<div data-testid="title-menu-bar"><span></span></div><button data-testid="sidebar-toggle"></button><div><button aria-label="Go Back"></button></div>';
    const child = document.querySelector<HTMLElement>('[data-testid="title-menu-bar"] > span')!;
    let right = 300;
    vi.spyOn(child, "getBoundingClientRect").mockImplementation(() => ({ left: 0, right, width: right, height: 30 }) as DOMRect);
    helpers.updateHistoryArrowsPosition();
    const arrows = document.querySelector<HTMLElement>('[data-testid="sidebar-toggle"] + div')!;
    expect(arrows.style.left).toBe("308px");
    expect(arrows.style.getPropertyPriority("left")).toBe("important");

    const rootWrites = vi.spyOn(document.documentElement.style, "setProperty");
    const arrowWrites = vi.spyOn(arrows.style, "setProperty");
    for (let i = 0; i < 10; i++) helpers.updateHistoryArrowsPosition();
    expect(rootWrites).not.toHaveBeenCalled();
    expect(arrowWrites).not.toHaveBeenCalled();
    right = 345;
    helpers.updateHistoryArrowsPosition();
    expect(arrows.style.left).toBe("353px");
    expect(document.documentElement.style.getPropertyValue("--gemini-history-arrows-left")).toBe("353px");
  });

  it("removes page event handlers across repeated plugin reloads", () => {
    // Warm the selector engine before watching the plugin's registrations.
    document.querySelectorAll(":scope > div:has(span)");
    const documentAdds = vi.spyOn(document, "addEventListener");
    const documentRemoves = vi.spyOn(document, "removeEventListener");
    const windowAdds = vi.spyOn(window, "addEventListener");
    const windowRemoves = vi.spyOn(window, "removeEventListener");
    const capture = (options: unknown) => typeof options === "boolean" ? options : Boolean((options as AddEventListenerOptions | undefined)?.capture);
    for (let cycle = 0; cycle < 3; cycle++) {
      startPlugin();
      stopPlugin();
    }
    const pairs: [typeof documentAdds, typeof documentRemoves][] = [
      [documentAdds, documentRemoves],
      [windowAdds, windowRemoves]
    ];
    for (const [adds, removes] of pairs) {
      for (const [type, listener, options] of adds.mock.calls) {
        expect(removes.mock.calls.some(([removedType, removedListener, removedOptions]) =>
          type === removedType && listener === removedListener && capture(options) === capture(removedOptions)),
        `Leaked ${type} handler`).toBe(true);
      }
    }
  });

  it("leaves user messages clean without wrapping them into fake clipping containers", async () => {
    startPlugin();
    document.body.innerHTML = '<div data-testid="user-input-step"><div data-testid="lifted-context-menu-trigger"><div class="bg-card"><div class="flex-1"><div class="whitespace-pre-wrap">A long user message</div></div></div></div></div>';
    const step = document.querySelector<HTMLElement>('[data-testid="user-input-step"]')!;
    const text = step.querySelector<HTMLElement>(".whitespace-pre-wrap")!;
    await settle();
    expect(step.querySelector(".willow-bubble-clip")).toBeNull();
    expect(step.querySelector(".willow-bubble-toggle-btn")).toBeNull();
    expect(text.textContent).toBe("A long user message");
  });

  it("removes native sidebar handlers and restores both live React fibers on dispose", () => {
    startPlugin();
    document.body.innerHTML = '<button data-testid="sidebar-toggle" aria-label="Toggle Sidebar" aria-expanded="true"></button><div class="bg-sidebar"><button class="group/headerbtn"><span class="truncate">Project</span></button></div>';
    const toggle = document.querySelector<HTMLButtonElement>('[data-testid="sidebar-toggle"]')!;
    const heading = document.querySelector<HTMLButtonElement>('[class="group/headerbtn"]')!;
    const toggleAdds = vi.spyOn(toggle, "addEventListener");
    const toggleRemoves = vi.spyOn(toggle, "removeEventListener");
    const headingAdds = vi.spyOn(heading, "addEventListener");
    const headingRemoves = vi.spyOn(heading, "removeEventListener");
    mount('button[data-testid="sidebar-toggle"][aria-label="Toggle Sidebar"]', toggle);
    mount('.group\\/headerbtn, button[class*="group/headerbtn"]', heading);
    const original = () => null;
    const fiber = { type: original, alternate: { type: original } };
    helpers.wrapItems(fiber);
    expect(fiber.type).not.toBe(original);
    expect(fiber.alternate.type).toBe(fiber.type);
    stopPlugin();
    expect(fiber.type).toBe(original);
    expect(fiber.alternate.type).toBe(original);
    for (const [adds, removes] of [[toggleAdds, toggleRemoves], [headingAdds, headingRemoves]] as const) {
      for (const [type, listener] of adds.mock.calls) {
        expect(removes.mock.calls.some(([removedType, removedListener]) => type === removedType && listener === removedListener), `Leaked ${type} handler`).toBe(true);
      }
    }
  });

  it("does not hijack schedule view and leaves native view untouched", async () => {
    startPlugin();
    document.body.innerHTML = '<div data-testid="sidecars-view" data-sidecar-type="schedule"><div class="w-full max-w-2xl"><div class="flex items-center justify-between"></div><div data-testid="sidecar-list-empty"></div></div></div>';
    const view = document.querySelector<HTMLElement>('[data-testid="sidecars-view"]')!;
    await settle();
    expect(view.querySelector(".spark-customise-header")).toBeNull();
    expect(view.querySelector(".spark-schedules-heading")).toBeNull();
  });

  it("does not lock the conversation row resting container with inline display none", async () => {
    startPlugin();
    document.body.innerHTML = `
      <div data-testid="conversation-row-sidebar" data-cascade-id="c1">
        <div class="pointer-events-auto">
          <div>
            <div class="absolute"><button data-testid="conversation-pin-button" aria-label="Pin conversation"></button></div>
            <div class="flex items-center gap-1.5 group-hover:opacity-0">
              <span data-screenshot-volatile="true">2m</span>
            </div>
          </div>
        </div>
      </div>
    `;
    const row = document.querySelector<HTMLElement>('[data-testid="conversation-row-sidebar"]')!;
    const resting = row.querySelector<HTMLElement>('[class*="group-hover:opacity-0"]')!;
    mount('[data-testid="conversation-row-sidebar"]', row);
    await settle();

    // The resting container must NOT have inline display: none !important
    expect(resting.style.display).toBe("");

    // Simulate chat becoming working: React mounts spinner inside resting
    const spinner = document.createElement("svg");
    spinner.setAttribute("data-testid", "status-loading-spinner");
    spinner.setAttribute("class", "animate-spin");
    resting.appendChild(spinner);
    await settle();

    // Resting container remains clean without inline display: none
    expect(resting.style.display).toBe("");
  });

  it("does not spawn background url or top-chips polling intervals", () => {
    const setIntervalSpy = vi.spyOn(window, "setInterval");
    startPlugin();
    const calls = setIntervalSpy.mock.calls;
    expect(calls.some(([, ms]) => ms === 300)).toBe(false);
    expect(calls.some(([, ms]) => ms === 1000)).toBe(false);
    setIntervalSpy.mockRestore();
  });
});
