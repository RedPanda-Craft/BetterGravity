// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TypingGuard } from "../src/world/typing-guard.js";

describe("TypingGuard Scheduler", () => {
  let guard: TypingGuard;

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = `
      <input id="test-input" type="text" />
      <textarea id="test-textarea"></textarea>
      <div id="editable" contenteditable="true"></div>
      <div id="regular">Not editable</div>
    `;
    guard = new TypingGuard(180);
  });

  afterEach(() => {
    guard.dispose();
    vi.clearAllTimers();
    vi.useRealTimers();
    document.body.innerHTML = "";
    delete document.documentElement.dataset.sgTyping;
  });

  it("detects keydown in editable elements and enters typing state", () => {
    const input = document.getElementById("test-input")!;
    expect(guard.isUserTyping).toBe(false);
    expect(document.documentElement.dataset.sgTyping).toBeUndefined();

    input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true }));
    expect(guard.isUserTyping).toBe(true);
    expect(document.documentElement.dataset.sgTyping).toBe("true");

    // Advance 100ms - still typing
    vi.advanceTimersByTime(100);
    expect(guard.isUserTyping).toBe(true);

    // After 180ms cooldown, typing exits
    vi.advanceTimersByTime(85);
    expect(guard.isUserTyping).toBe(false);
    expect(document.documentElement.dataset.sgTyping).toBeUndefined();
  });

  it("resets cooldown when typing continues (sliding cooldown)", () => {
    const textarea = document.getElementById("test-textarea")!;
    textarea.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true }));
    expect(guard.isUserTyping).toBe(true);

    vi.advanceTimersByTime(150);
    // User types another key at 150ms
    textarea.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true }));
    expect(guard.isUserTyping).toBe(true);

    // Another 150ms passes (total 300ms from start, but 150ms from last key)
    vi.advanceTimersByTime(150);
    expect(guard.isUserTyping).toBe(true);

    // Another 40ms passes (> 180ms from last key)
    vi.advanceTimersByTime(40);
    expect(guard.isUserTyping).toBe(false);
  });

  it("maintains typing state throughout IME composition", () => {
    const input = document.getElementById("test-input")!;
    input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    expect(guard.isUserTyping).toBe(true);
    expect(guard.isComposing).toBe(true);

    // 500ms passes during composition
    vi.advanceTimersByTime(500);
    expect(guard.isUserTyping).toBe(true);

    // End composition
    input.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }));
    expect(guard.isComposing).toBe(false);
    expect(guard.isUserTyping).toBe(true); // Still in 180ms cooldown

    vi.advanceTimersByTime(185);
    expect(guard.isUserTyping).toBe(false);
  });

  it("guards tasks and flushes deferred tasks after cooldown", () => {
    const task = vi.fn();
    const guardedTask = guard.guard("my-task", task);

    // When idle, task runs immediately
    guardedTask("hello");
    expect(task).toHaveBeenCalledWith("hello");
    task.mockClear();

    // Start typing
    const input = document.getElementById("test-input")!;
    input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true }));

    // Task is now queued, not called
    guardedTask("deferred-1");
    guardedTask("deferred-2"); // Replaces deferred-1 for same task ID
    expect(task).not.toHaveBeenCalled();
    expect(guard.pendingTaskCount).toBe(1);

    // Fast-forward cooldown
    vi.advanceTimersByTime(200);

    // Cooldown ended, requestIdleCallback runs
    expect(task).toHaveBeenCalledWith("deferred-2");
    expect(guard.pendingTaskCount).toBe(0);
  });

  it("ignores keydown on non-editable elements", () => {
    const regular = document.getElementById("regular")!;
    regular.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true }));
    expect(guard.isUserTyping).toBe(false);
  });
});
