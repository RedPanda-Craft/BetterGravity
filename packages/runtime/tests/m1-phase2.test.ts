// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StreamingViewportController } from "../src/world/streaming-viewport.js";
import { TurnMetadataLRUStore, MAX_TURN_CAPACITY } from "../src/world/turn-lru-store.js";

describe("StreamingViewportController", () => {
  let controller: StreamingViewportController;
  let scroller: HTMLElement;
  let content: HTMLElement;
  let resizeObserverCallback: (entries: { target: Element; contentRect: { height: number } }[]) => void;

  beforeEach(() => {
    vi.useFakeTimers();
    scroller = document.createElement("div");
    content = document.createElement("div");
    document.body.append(scroller);
    scroller.append(content);

    vi.stubGlobal("ResizeObserver", class {
      constructor(callback: typeof resizeObserverCallback) {
        resizeObserverCallback = callback;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    });

    controller = new StreamingViewportController({ anchorThreshold: 30, dampingFactor: 0.5 });
    controller.attach(scroller, content);
  });

  afterEach(() => {
    controller.dispose();
    document.body.innerHTML = "";
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("transitions between IDLE and AUTO_ANCHORED on stream lifecycle", () => {
    expect(controller.state).toBe("IDLE");
    expect(controller.isAnchored).toBe(false);

    controller.onStreamStart();
    expect(controller.state).toBe("AUTO_ANCHORED");
    expect(controller.isAnchored).toBe(true);

    controller.onStreamEnd();
    expect(controller.state).toBe("IDLE");
  });

  it("detaches anchor on user upward scroll gesture (deltaY < 0)", () => {
    controller.onStreamStart();
    expect(controller.state).toBe("AUTO_ANCHORED");

    // Simulate user wheel upward
    scroller.dispatchEvent(new WheelEvent("wheel", { deltaY: -50, bubbles: true }));
    expect(controller.state).toBe("USER_DETACHED");
    expect(controller.isAnchored).toBe(false);
  });

  it("re-anchors when user scrolls downward into anchor threshold", () => {
    controller.onStreamStart();
    scroller.dispatchEvent(new WheelEvent("wheel", { deltaY: -50, bubbles: true }));
    expect(controller.state).toBe("USER_DETACHED");

    // Mock dimensions: content=1000px, scroller=400px -> maxScroll = 600px
    resizeObserverCallback([
      { target: content, contentRect: { height: 1000 } },
      { target: scroller, contentRect: { height: 400 } }
    ]);

    // Position scroll at 580px (distance to bottom = 20px <= 30px threshold)
    scroller.scrollTop = 580;

    scroller.dispatchEvent(new WheelEvent("wheel", { deltaY: 20, bubbles: true }));
    expect(controller.state).toBe("AUTO_ANCHORED");
  });

  it("executes smooth convergence when scrollToBottomSmooth is called", () => {
    controller.onStreamStart();
    scroller.dispatchEvent(new WheelEvent("wheel", { deltaY: -100, bubbles: true }));
    expect(controller.state).toBe("USER_DETACHED");

    controller.scrollToBottomSmooth();
    expect(controller.state).toBe("CONVERGING");
  });
});

describe("TurnMetadataLRUStore", () => {
  let store: TurnMetadataLRUStore;
  const TEST_KEY = "sg:test:turn_meta_lru";

  beforeEach(() => {
    localStorage.clear();
    store = new TurnMetadataLRUStore(TEST_KEY, 5); // capacity = 5 for easy testing
  });

  afterEach(() => {
    store.clear();
    localStorage.clear();
  });

  it("sanitizes forbidden large fields (fullText, rawHtml, tokens)", () => {
    const entry = store.upsert("session_1", "turn_1", {
      sequenceIndex: 0,
      previewSnippet: "How do I optimize DOM reflow?",
      fullText: "A massive prompt containing 50KB of unneeded text...",
      rawHtml: "<div>huge html</div>",
      tokens: [1, 2, 3, 4]
    });

    expect(entry.previewSnippet).toBe("How do I optimize DOM reflow?");
    expect((entry as unknown as Record<string, unknown>).fullText).toBeUndefined();
    expect((entry as unknown as Record<string, unknown>).rawHtml).toBeUndefined();
    expect((entry as unknown as Record<string, unknown>).tokens).toBeUndefined();
  });

  it("enforces LRU capacity by evicting oldest turns", () => {
    for (let i = 1; i <= 7; i++) {
      store.upsert("session_1", `turn_${i}`, { sequenceIndex: i });
    }

    expect(store.size).toBe(5);
    // Turns 1 and 2 should have been evicted
    expect(store.get("session_1", "turn_1")).toBeNull();
    expect(store.get("session_1", "turn_2")).toBeNull();
    expect(store.get("session_1", "turn_3")).not.toBeNull();
    expect(store.get("session_1", "turn_7")).not.toBeNull();
  });

  it("truncates future turns on 'Undo to this point'", () => {
    const onTruncated = vi.fn();
    window.addEventListener("sg:history-truncated", onTruncated);

    store.upsert("sess_A", "t1", { sequenceIndex: 1, timestamp: 1000 });
    store.upsert("sess_A", "t2", { sequenceIndex: 2, timestamp: 2000 });
    store.upsert("sess_A", "t3", { sequenceIndex: 3, timestamp: 3000 });
    store.upsert("sess_A", "t4", { sequenceIndex: 4, timestamp: 4000 });

    // Undo to turn 2 (exclusive): t3 and t4 should be deleted
    const evicted = store.truncateOnUndo("sess_A", "t2", false);
    expect(evicted).toEqual(["t3", "t4"]);

    expect(store.get("sess_A", "t1")).not.toBeNull();
    expect(store.get("sess_A", "t2")).not.toBeNull();
    expect(store.get("sess_A", "t3")).toBeNull();
    expect(store.get("sess_A", "t4")).toBeNull();

    expect(onTruncated).toHaveBeenCalledTimes(1);
    window.removeEventListener("sg:history-truncated", onTruncated);
  });
});
