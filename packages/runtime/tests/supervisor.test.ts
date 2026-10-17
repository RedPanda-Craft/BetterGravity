import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DisposableSubprocessSupervisor } from "../src/main/supervisor.js";
import type { ChildProcess } from "node:child_process";

class MockChildProcess extends EventEmitter {
  pid = 12345;
  killed = false;
  stdin = {
    end: vi.fn()
  };

  kill(signal?: string): boolean {
    this.killed = true;
    this.emit("exit", signal === "SIGKILL" ? 137 : 0);
    return true;
  }
}

describe("DisposableSubprocessSupervisor", () => {
  let supervisor: DisposableSubprocessSupervisor;
  let mockProc: MockChildProcess;
  const mockSpawn = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    mockProc = new MockChildProcess();
    mockSpawn.mockReturnValue(mockProc as unknown as ChildProcess);

    supervisor = new DisposableSubprocessSupervisor({
      idleTimeoutMs: 2000,
      spawnFn: mockSpawn
    });
  });

  afterEach(() => {
    supervisor.dispose();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("spawns subprocess lazily on acquire and shares instance on multiple acquires", async () => {
    expect(supervisor.activeServiceCount).toBe(0);

    const sub1 = await supervisor.acquire("computer-use", {
      command: "mock-runner.exe",
      args: ["--server"]
    });

    expect(supervisor.activeServiceCount).toBe(1);
    expect(supervisor.isRunning("computer-use")).toBe(true);
    expect(supervisor.getRefCount("computer-use")).toBe(1);
    expect(mockSpawn).toHaveBeenCalledTimes(1);

    // Second acquire reuses the running process
    const sub2 = await supervisor.acquire("computer-use", {
      command: "mock-runner.exe"
    });

    expect(sub2.proc).toBe(sub1.proc);
    expect(supervisor.getRefCount("computer-use")).toBe(2);
    expect(mockSpawn).toHaveBeenCalledTimes(1);
  });

  it("reclaims idle process automatically after idle timeout when refCount drops to 0", async () => {
    await supervisor.acquire("browser-cdp", { command: "node", args: ["server.js"] });
    expect(supervisor.getRefCount("browser-cdp")).toBe(1);

    // Release active reference
    supervisor.release("browser-cdp");
    expect(supervisor.getRefCount("browser-cdp")).toBe(0);
    expect(supervisor.isRunning("browser-cdp")).toBe(true); // Still running during idle lease

    // Fast forward 1000ms (timeout is 2000ms)
    vi.advanceTimersByTime(1000);
    expect(supervisor.isRunning("browser-cdp")).toBe(true);

    // Fast forward another 1100ms (total > 2000ms)
    vi.advanceTimersByTime(1100);
    expect(mockProc.stdin.end).toHaveBeenCalled();
    expect(supervisor.isRunning("browser-cdp")).toBe(false);
    expect(supervisor.activeServiceCount).toBe(0);
  });

  it("cancels idle eviction if acquired again before timeout expires", async () => {
    await supervisor.acquire("mcp-server", { command: "node" });
    supervisor.release("mcp-server");
    expect(supervisor.getRefCount("mcp-server")).toBe(0);

    // 1500ms into 2000ms idle timer
    vi.advanceTimersByTime(1500);

    // New request comes in, canceling idle countdown
    await supervisor.acquire("mcp-server", { command: "node" });
    expect(supervisor.getRefCount("mcp-server")).toBe(1);

    // Advance past original 2000ms mark
    vi.advanceTimersByTime(1000);
    expect(supervisor.isRunning("mcp-server")).toBe(true);
    expect(mockProc.killed).toBe(false);
  });

  it("kills process and closes named pipe immediately on explicit killImmediately or dispose", async () => {
    await supervisor.acquire("test-service", { command: "dummy", useNamedPipe: true });
    expect(supervisor.isRunning("test-service")).toBe(true);

    supervisor.killImmediately("test-service");
    expect(supervisor.isRunning("test-service")).toBe(false);
    expect(mockProc.stdin.end).toHaveBeenCalled();
  });
});
