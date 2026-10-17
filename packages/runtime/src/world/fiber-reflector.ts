/**
 * SuperGravity Resilient Fiber Reflector
 *
 * Version-independent runtime reflection and capability matching across React 17/18/19.
 * Climbs memoizedProps, Context dependencies, and Hook chains with strict frame-time budgets
 * (<= 2.5ms) and circuit breakers, eliminating fragile regex patches against host files.
 */

export interface ExtendedFiber {
  type: unknown;
  key: string | null;
  stateNode: unknown;
  return: ExtendedFiber | null;
  child: ExtendedFiber | null;
  sibling: ExtendedFiber | null;
  alternate: ExtendedFiber | null;
  memoizedProps: Record<string, unknown> | null;
  memoizedState: unknown;
  dependencies?: {
    firstContext?: {
      context?: { _currentValue?: unknown };
      memoizedValue?: unknown;
      next?: unknown;
    };
  } | null;
}

export type ReflectionSource = "props" | "context" | "hook";

export type ReflectionPredicate = (
  target: unknown,
  source: ReflectionSource,
  fiber: ExtendedFiber
) => boolean;

export interface ClimbResult {
  fiber: ExtendedFiber;
  target: unknown;
  source: ReflectionSource;
}

export class ResilientFiberReflector {
  #fiberKeyCache: string | null = null;
  #serviceCache = new WeakMap<Function, { fiber: ExtendedFiber }>();
  #failureCounts = new Map<string, number>();
  #circuitBroken = new Set<string>();

  /**
   * Dynamically detect React internal property name on DOM node (React 17/18/19 compatible)
   */
  getFiberFromDOM(domNode: unknown): ExtendedFiber | null {
    if (!domNode || typeof domNode !== "object") return null;

    const node = domNode as Record<string, unknown>;

    if (this.#fiberKeyCache && node[this.#fiberKeyCache]) {
      return node[this.#fiberKeyCache] as ExtendedFiber;
    }

    const keys = Object.keys(node);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (!k) continue;
      if (k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$")) {
        this.#fiberKeyCache = k;
        return node[k] as ExtendedFiber;
      }
      if (k.startsWith("__reactContainer$")) {
        const container = node[k] as { current?: ExtendedFiber } | ExtendedFiber;
        return (container && "current" in container ? container.current : container) as ExtendedFiber ?? null;
      }
    }

    return null;
  }

  /**
   * Climb upward along fiber.return, scanning memoizedProps, Context dependencies, and Hook states
   */
  climbUp(
    startDomOrFiber: unknown,
    predicate: ReflectionPredicate,
    maxDepth = 45
  ): ClimbResult | null {
    let curr: ExtendedFiber | null =
      startDomOrFiber && typeof (startDomOrFiber as Element).tagName === "string"
        ? this.getFiberFromDOM(startDomOrFiber)
        : (startDomOrFiber as ExtendedFiber | null);

    let depth = 0;
    while (curr && depth < maxDepth) {
      // 1. Check memoizedProps
      if (curr.memoizedProps && predicate(curr.memoizedProps, "props", curr)) {
        return { fiber: curr, target: curr.memoizedProps, source: "props" };
      }

      // 2. Check React 18/19 Context Dependencies linked list
      let dep = curr.dependencies?.firstContext;
      while (dep) {
        const ctxVal = dep.memoizedValue ?? dep.context?._currentValue;
        if (ctxVal && predicate(ctxVal, "context", curr)) {
          return { fiber: curr, target: ctxVal, source: "context" };
        }
        dep = dep.next as typeof dep;
      }

      // 3. Check Hooks linked list (memoizedState -> next)
      let hook = curr.memoizedState as { memoizedState?: unknown; next?: unknown } | null;
      let hookGuard = 0;
      while (hook && hookGuard < 30) {
        const stateVal = hook.memoizedState;
        if (stateVal && typeof stateVal === "object" && predicate(stateVal, "hook", curr)) {
          return { fiber: curr, target: stateVal, source: "hook" };
        }
        hook = hook.next as typeof hook;
        hookGuard++;
      }

      curr = curr.return;
      depth++;
    }

    return null;
  }

  /**
   * Time-sliced subtree search with hard 2.5ms frame budget guard and circuit breaker
   */
  findInSubtree(
    rootElement: unknown,
    signatureId: string,
    predicate: (props: Record<string, unknown>, fiber: ExtendedFiber) => boolean,
    maxNodes = 800,
    timeBudgetMs = 2.5
  ): Record<string, unknown> | null {
    if (this.#circuitBroken.has(signatureId)) return null;

    // Fast-path: dual-buffering alternate cache lookup
    const cached = this.#serviceCache.get(predicate);
    if (cached) {
      const activeFiber = cached.fiber.alternate?.memoizedProps ? cached.fiber.alternate : cached.fiber;
      if (activeFiber.memoizedProps && predicate(activeFiber.memoizedProps, activeFiber)) {
        return activeFiber.memoizedProps;
      }
    }

    const rootFiber = this.getFiberFromDOM(rootElement);
    if (!rootFiber) return null;

    const stack: ExtendedFiber[] = [rootFiber];
    let visited = 0;
    const startTime = typeof performance !== "undefined" ? performance.now() : Date.now();

    while (stack.length > 0 && visited < maxNodes) {
      // Enforce frame-time budget every 32 nodes
      if ((visited & 31) === 0 && typeof performance !== "undefined") {
        if (performance.now() - startTime > timeBudgetMs) {
          console.warn(`[SuperGravity:Fiber] Search budget exceeded (${timeBudgetMs}ms) for ${signatureId}`);
          break;
        }
      }

      const node = stack.pop()!;
      visited++;

      if (node.memoizedProps && predicate(node.memoizedProps, node)) {
        this.#serviceCache.set(predicate, { fiber: node });
        this.#failureCounts.delete(signatureId);
        return node.memoizedProps;
      }

      if (node.sibling) stack.push(node.sibling);
      if (node.child) stack.push(node.child);
    }

    // Record failure; trip circuit breaker after 3 consecutive search misses
    const failures = (this.#failureCounts.get(signatureId) ?? 0) + 1;
    this.#failureCounts.set(signatureId, failures);
    if (failures >= 3) {
      this.#circuitBroken.add(signatureId);
      console.warn(`[SuperGravity:Fiber] Circuit breaker tripped for signature "${signatureId}" to avoid layout stalls.`);
    }

    return null;
  }

  /**
   * Version-independent duck-typing service resolution: Antigravity chat session controller
   */
  resolveChatSessionService(rootElement?: unknown): unknown | null {
    const isChatService = (candidate: unknown): boolean =>
      candidate !== null &&
      typeof candidate === "object" &&
      typeof (candidate as Record<string, unknown>).sendMessage === "function" &&
      (Array.isArray((candidate as Record<string, unknown>).messages) ||
        typeof (candidate as Record<string, unknown>).abortGeneration === "function");

    if (typeof document !== "undefined") {
      const promptEl = document.querySelector("textarea, [contenteditable='true']");
      if (promptEl) {
        const hit = this.climbUp(promptEl, (target) => isChatService(target));
        if (hit) return hit.target;
      }

      const root = rootElement ?? document.body;
      return this.findInSubtree(root, "ChatSessionService", (props) => isChatService(props));
    }

    return null;
  }

  resetCircuitBreakers(): void {
    this.#circuitBroken.clear();
    this.#failureCounts.clear();
  }
}

export const fiberReflector = new ResilientFiberReflector();
