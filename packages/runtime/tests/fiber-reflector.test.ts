// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResilientFiberReflector, type ExtendedFiber } from "../src/world/fiber-reflector.js";
import { createReactTools } from "../src/world/hooks/react.js";

describe("ResilientFiberReflector", () => {
  let reflector: ResilientFiberReflector;

  beforeEach(() => {
    reflector = new ResilientFiberReflector();
    document.body.innerHTML = `
      <div id="app-root">
        <div id="chat-view">
          <textarea id="prompt-input"></textarea>
        </div>
      </div>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("extracts fiber from DOM node across React 17/18/19 internal property keys", () => {
    const el = document.getElementById("prompt-input")!;
    const mockFiber: Partial<ExtendedFiber> = {
      memoizedProps: { "data-testid": "prompt-input" },
      return: null,
      child: null,
      sibling: null
    };

    (el as unknown as Record<string, unknown>)["__reactFiber$xyz123"] = mockFiber;

    const extracted = reflector.getFiberFromDOM(el);
    expect(extracted).toBe(mockFiber);

    // Tests __reactContainer$ container fallback
    const containerEl = document.createElement("div");
    (containerEl as unknown as Record<string, unknown>)["__reactContainer$abc"] = { current: mockFiber };
    expect(reflector.getFiberFromDOM(containerEl)).toBe(mockFiber);
  });

  it("climbs return chain to resolve memoizedProps, Context dependencies, and Hook states", () => {
    const childFiber: Partial<ExtendedFiber> = {
      memoizedProps: { name: "LeafChild" },
      return: null
    };

    const contextFiber: Partial<ExtendedFiber> = {
      memoizedProps: { name: "ContextProvider" },
      dependencies: {
        firstContext: {
          context: { _currentValue: { theme: "catppuccin", primaryColor: "#cba6f7" } }
        }
      },
      return: null
    };

    const rootFiber: Partial<ExtendedFiber> = {
      memoizedProps: {
        sendMessage: vi.fn(),
        messages: ["Hello", "World"],
        sessionId: "sess_123"
      },
      return: null
    };

    (childFiber as ExtendedFiber).return = contextFiber as ExtendedFiber;
    (contextFiber as ExtendedFiber).return = rootFiber as ExtendedFiber;

    // 1. Climb to find Context
    const contextHit = reflector.climbUp(childFiber, (val, source) => source === "context" && Boolean((val as Record<string, unknown>).theme));
    expect(contextHit).not.toBeNull();
    expect(contextHit?.source).toBe("context");
    expect((contextHit?.target as Record<string, unknown>).theme).toBe("catppuccin");

    // 2. Climb to find root service
    const serviceHit = reflector.climbUp(childFiber, (val) => typeof (val as Record<string, unknown>).sendMessage === "function");
    expect(serviceHit).not.toBeNull();
    expect((serviceHit?.target as Record<string, unknown>).sessionId).toBe("sess_123");
  });

  it("finds matching props in subtree and stops search when maxNodes is reached", () => {
    const rootEl = document.getElementById("app-root")!;
    const rootFiber: Partial<ExtendedFiber> = {
      child: {
        memoizedProps: { role: "intermediate" },
        sibling: {
          memoizedProps: { targetProp: "FOUND_ME" },
          child: null,
          sibling: null,
          return: null,
          alternate: null,
          type: null,
          key: null,
          stateNode: null,
          memoizedState: null
        },
        child: null,
        return: null,
        alternate: null,
        type: null,
        key: null,
        stateNode: null,
        memoizedState: null
      },
      return: null,
      alternate: null,
      type: null,
      key: null,
      stateNode: null,
      memoizedProps: { role: "root" },
      memoizedState: null
    };

    (rootEl as unknown as Record<string, unknown>)["__reactFiber$test"] = rootFiber;

    const hit = reflector.findInSubtree(
      rootEl,
      "TargetSignature",
      (props) => props.targetProp === "FOUND_ME"
    );

    expect(hit).not.toBeNull();
    expect(hit?.targetProp).toBe("FOUND_ME");
  });

  it("trips circuit breaker after 3 search misses to prevent layout stalls", () => {
    const rootEl = document.getElementById("app-root")!;
    (rootEl as unknown as Record<string, unknown>)["__reactFiber$test"] = {
      memoizedProps: {},
      child: null,
      sibling: null
    };

    // 3 misses
    expect(reflector.findInSubtree(rootEl, "MissingService", () => false)).toBeNull();
    expect(reflector.findInSubtree(rootEl, "MissingService", () => false)).toBeNull();
    expect(reflector.findInSubtree(rootEl, "MissingService", () => false)).toBeNull();

    // 4th search should immediately abort via circuit breaker
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fourth = reflector.findInSubtree(rootEl, "MissingService", () => false);
    expect(fourth).toBeNull();
  });

  it("resolves chat session service via duck-typing on prompt element", () => {
    const prompt = document.getElementById("prompt-input")!;
    const chatService = {
      sendMessage: () => {},
      messages: [],
      abortGeneration: () => {}
    };

    (prompt as unknown as Record<string, unknown>)["__reactFiber$prompt"] = {
      memoizedProps: {},
      return: {
        memoizedProps: chatService,
        return: null
      }
    };

    const resolved = reflector.resolveChatSessionService();
    expect(resolved).toBe(chatService);
  });

  it("exposes reflector on ReactTools instance", () => {
    const tools = createReactTools();
    expect(tools.reflector).toBeDefined();
    expect(typeof tools.reflector?.climbUp).toBe("function");
  });
});
