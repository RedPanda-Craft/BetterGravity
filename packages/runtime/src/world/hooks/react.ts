/**
 * Reaching into Antigravity's React tree.
 *
 * Its bundle is compiled with Closure Compiler, so component names are mangled
 * to things like `fCb` and `YM` and searching by name is worthless. What does
 * survive is props — including `data-testid`, which Antigravity uses widely — so
 * everything here searches by props rather than by name.
 */

export interface Fiber {
  readonly type: unknown;
  readonly key: string | null;
  readonly stateNode: unknown;
  readonly return: Fiber | null;
  readonly child: Fiber | null;
  readonly sibling: Fiber | null;
  readonly memoizedProps: Record<string, unknown> | null;
  readonly memoizedState: unknown;
}

type FiberPredicate = (fiber: Fiber) => boolean;

const FIBER_PREFIXES = ["__reactFiber$", "__reactInternalInstance$"];
const PROPS_PREFIXES = ["__reactProps$", "__reactEventHandlers$"];

function readKeyed(node: object, prefixes: readonly string[]): unknown {
  // getOwnPropertyNames rather than keys: React assigns these as ordinary
  // enumerable properties today, but this does not depend on that.
  for (const key of Object.getOwnPropertyNames(node)) {
    if (prefixes.some((prefix) => key.startsWith(prefix))) return (node as Record<string, unknown>)[key];
  }
  return undefined;
}

import { fiberReflector, type ResilientFiberReflector } from "../fiber-reflector.js";

export { fiberReflector };

export interface ReactTools {
  /** The fiber React attached to a DOM node, if there is one. */
  getFiber(node: Element): Fiber | undefined;
  /** The props React rendered a DOM node with. */
  getProps(node: Element): Record<string, unknown> | undefined;
  /** Walks up from a fiber to the nearest ancestor matching the predicate. */
  findOwner(from: Fiber | Element, predicate: FiberPredicate, depth?: number): Fiber | undefined;
  /** Walks down from a fiber to the first descendant matching the predicate. */
  findChild(from: Fiber | Element, predicate: FiberPredicate, depth?: number): Fiber | undefined;
  /** Every descendant matching the predicate. */
  findAll(from: Fiber | Element, predicate: FiberPredicate, depth?: number): readonly Fiber[];
  /** True when a fiber carries the given props. Handy as a predicate. */
  hasProps(fiber: Fiber, props: Readonly<Record<string, unknown>>): boolean;
  /** Asks React to re-render the component owning this fiber. */
  forceUpdate(fiber: Fiber): boolean;
  /** The component instance for a class component, if it is one. */
  getInstance(fiber: Fiber): Record<string, unknown> | undefined;
  /** Resilient Fiber reflection and duck-typing capability locator */
  readonly reflector?: ResilientFiberReflector;
}

export function createReactTools(): ReactTools {
  const toFiber = (from: Fiber | Element): Fiber | undefined =>
    from instanceof Element ? (readKeyed(from, FIBER_PREFIXES) as Fiber | undefined) : from;

  const tools: ReactTools = {
    reflector: fiberReflector,
    getFiber: (node) => readKeyed(node, FIBER_PREFIXES) as Fiber | undefined,

    getProps: (node) => {
      const direct = readKeyed(node, PROPS_PREFIXES) as Record<string, unknown> | undefined;
      return direct ?? (readKeyed(node, FIBER_PREFIXES) as Fiber | undefined)?.memoizedProps ?? undefined;
    },

    findOwner: (from, predicate, depth = 30) => {
      let fiber = toFiber(from)?.return ?? undefined;
      for (let step = 0; fiber && step < depth; step += 1) {
        if (predicate(fiber)) return fiber;
        fiber = fiber.return ?? undefined;
      }
      return undefined;
    },

    findChild: (from, predicate, depth = 30) => {
      const start = toFiber(from);
      if (!start) return undefined;
      // Breadth-first, so the nearest match wins rather than the deepest.
      let level: Fiber[] = [start];
      for (let step = 0; step < depth && level.length > 0; step += 1) {
        const next: Fiber[] = [];
        for (const fiber of level) {
          if (fiber !== start && predicate(fiber)) return fiber;
          for (let child = fiber.child; child; child = child.sibling) next.push(child);
        }
        level = next;
      }
      return undefined;
    },

    findAll: (from, predicate, depth = 30) => {
      const start = toFiber(from);
      if (!start) return [];
      const found: Fiber[] = [];
      let level: Fiber[] = [start];
      for (let step = 0; step < depth && level.length > 0; step += 1) {
        const next: Fiber[] = [];
        for (const fiber of level) {
          if (predicate(fiber)) found.push(fiber);
          for (let child = fiber.child; child; child = child.sibling) next.push(child);
        }
        level = next;
      }
      return found;
    },

    hasProps: (fiber, props) => {
      const actual = fiber.memoizedProps;
      if (!actual) return false;
      return Object.entries(props).every(([key, value]) => actual[key] === value);
    },

    forceUpdate: (fiber) => {
      const instance = tools.getInstance(fiber);
      if (instance && typeof instance["forceUpdate"] === "function") {
        (instance["forceUpdate"] as () => void).call(instance);
        return true;
      }
      return false;
    },

    getInstance: (fiber) => {
      const node = fiber.stateNode;
      return node && typeof node === "object" && !(node instanceof Element) ? (node as Record<string, unknown>) : undefined;
    }
  };

  return tools;
}

/** `data-testid` is the most stable handle Antigravity offers a plugin. */
export const byTestId =
  (testId: string) =>
  (fiber: Fiber): boolean =>
    fiber.memoizedProps?.["data-testid"] === testId;
