/**
 * SuperGravity Typing Guard Scheduler
 *
 * Enforces zero-reflow runtime invariants during user keystrokes and IME composition.
 * Suspends non-critical DOM observations, state polling, and flushes deferred tasks
 * via time-sliced requestIdleCallback chunks.
 */

export interface ManagedObserver {
  start(): void;
  suspend(): void;
  resume(): void;
}

export class TypingGuard {
  #isTyping = false;
  #isComposing = false;
  #cooldownTimer: ReturnType<typeof setTimeout> | null = null;
  #cooldownMs: number;
  #deferredQueue = new Map<string, () => void>();
  #observers = new Set<ManagedObserver>();
  #idleCallbackId: number | null = null;
  #cleanupListeners: (() => void)[] = [];

  constructor(cooldownMs = 180) {
    this.#cooldownMs = cooldownMs;
    this.#installCaptureHooks();
  }

  get isUserTyping(): boolean {
    if (this.#isTyping || this.#isComposing) return true;
    if (typeof document !== "undefined" && document.activeElement) {
      const active = document.activeElement;
      const tag = active.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea" || (active as HTMLElement).isContentEditable) {
        return this.#isTyping;
      }
    }
    return false;
  }

  get isComposing(): boolean {
    return this.#isComposing;
  }

  get pendingTaskCount(): number {
    return this.#deferredQueue.size;
  }

  #isEditableTarget(target: EventTarget | null): boolean {
    if (!target || !(target instanceof Element)) return false;
    const el = target as HTMLElement;
    if (el.isContentEditable) return true;
    const tag = el.tagName.toLowerCase();
    return tag === "textarea" || tag === "input";
  }

  #installCaptureHooks(): void {
    if (typeof window === "undefined") return;

    const onTypingTrigger = (e: Event): void => {
      if (!this.#isEditableTarget(e.target)) return;
      this.#enterTypingState();
    };

    const onCompositionStart = (e: Event): void => {
      if (!this.#isEditableTarget(e.target)) return;
      this.#isComposing = true;
      this.#enterTypingState();
    };

    const onCompositionEnd = (): void => {
      this.#isComposing = false;
      this.#scheduleExit();
    };

    window.addEventListener("keydown", onTypingTrigger, { capture: true, passive: true });
    window.addEventListener("beforeinput", onTypingTrigger, { capture: true, passive: true });
    window.addEventListener("input", onTypingTrigger, { capture: true, passive: true });
    window.addEventListener("compositionstart", onCompositionStart, { capture: true, passive: true });
    window.addEventListener("compositionend", onCompositionEnd, { capture: true, passive: true });

    this.#cleanupListeners.push(() => {
      window.removeEventListener("keydown", onTypingTrigger, { capture: true });
      window.removeEventListener("beforeinput", onTypingTrigger, { capture: true });
      window.removeEventListener("input", onTypingTrigger, { capture: true });
      window.removeEventListener("compositionstart", onCompositionStart, { capture: true });
      window.removeEventListener("compositionend", onCompositionEnd, { capture: true });
    });
  }

  #enterTypingState(): void {
    if (!this.#isTyping) {
      this.#isTyping = true;
      if (typeof document !== "undefined" && document.documentElement) {
        document.documentElement.dataset.sgTyping = "true";
      }
      for (const obs of this.#observers) {
        try {
          obs.suspend();
        } catch (e) {
          console.error("[SuperGravity:TypingGuard] Observer suspend failed:", e);
        }
      }
    }
    this.#scheduleExit();
  }

  #scheduleExit(): void {
    if (this.#cooldownTimer !== null) {
      clearTimeout(this.#cooldownTimer);
      this.#cooldownTimer = null;
    }
    if (this.#isComposing) return;

    this.#cooldownTimer = setTimeout(() => {
      this.#isTyping = false;
      this.#cooldownTimer = null;
      if (typeof document !== "undefined" && document.documentElement) {
        delete document.documentElement.dataset.sgTyping;
      }
      for (const obs of this.#observers) {
        try {
          obs.resume();
        } catch (e) {
          console.error("[SuperGravity:TypingGuard] Observer resume failed:", e);
        }
      }
      this.#flushDeferredTasks();
    }, this.#cooldownMs);
  }

  guard<Args extends unknown[]>(taskId: string, fn: (...args: Args) => void): (...args: Args) => void {
    return (...args: Args): void => {
      if (this.isUserTyping) {
        this.#deferredQueue.set(taskId, () => fn(...args));
        return;
      }
      fn(...args);
    };
  }

  registerObserver(
    target: Node,
    options: MutationObserverInit,
    callback: (records: MutationRecord[]) => void,
    taskId: string
  ): ManagedObserver {
    let bufferedRecords: MutationRecord[] = [];
    const guardedCallback = this.guard(taskId, (records: MutationRecord[]) => callback(records));

    const nativeObserver = new MutationObserver((records) => {
      if (this.isUserTyping) {
        bufferedRecords.push(...records);
        return;
      }
      guardedCallback(records);
    });

    const controller: ManagedObserver = {
      start: () => nativeObserver.observe(target, options),
      suspend: () => {
        bufferedRecords.push(...nativeObserver.takeRecords());
        nativeObserver.disconnect();
      },
      resume: () => {
        nativeObserver.observe(target, options);
        if (bufferedRecords.length > 0) {
          const toProcess = bufferedRecords;
          bufferedRecords = [];
          this.#deferredQueue.set(taskId, () => callback(toProcess));
        }
      }
    };

    this.#observers.add(controller);
    controller.start();
    return controller;
  }

  #flushDeferredTasks(): void {
    if (this.#deferredQueue.size === 0) return;

    const runChunk = (deadline?: { timeRemaining: () => number; didTimeout?: boolean }): void => {
      if (this.isUserTyping) return;

      while (
        this.#deferredQueue.size > 0 &&
        (!deadline || deadline.timeRemaining() > 3 || deadline.didTimeout)
      ) {
        const next = this.#deferredQueue.entries().next();
        if (next.done) break;
        const [taskId, task] = next.value;
        this.#deferredQueue.delete(taskId);
        try {
          task();
        } catch (err) {
          console.error(`[SuperGravity:TypingGuard] Task ${taskId} threw:`, err);
        }
      }

      if (this.#deferredQueue.size > 0 && !this.isUserTyping) {
        this.#scheduleIdleFlush(runChunk);
      }
    };

    this.#scheduleIdleFlush(runChunk);
  }

  #scheduleIdleFlush(callback: (deadline?: { timeRemaining: () => number; didTimeout?: boolean }) => void): void {
    if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
      this.#idleCallbackId = window.requestIdleCallback(callback as IdleRequestCallback, { timeout: 1000 });
    } else {
      setTimeout(() => callback(), 0);
    }
  }

  dispose(): void {
    if (this.#cooldownTimer !== null) clearTimeout(this.#cooldownTimer);
    if (this.#idleCallbackId !== null && typeof window !== "undefined" && typeof window.cancelIdleCallback === "function") {
      window.cancelIdleCallback(this.#idleCallbackId);
    }
    this.#observers.clear();
    this.#deferredQueue.clear();
    for (const cleanup of this.#cleanupListeners) cleanup();
    this.#cleanupListeners = [];
    if (typeof document !== "undefined" && document.documentElement) {
      delete document.documentElement.dataset.sgTyping;
    }
  }
}

export const typingGuard = new TypingGuard();
