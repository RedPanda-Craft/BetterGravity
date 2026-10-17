import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";
import net from "node:net";

export interface SubprocessConfig {
  command: string;
  args?: string[];
  useNamedPipe?: boolean;
  spawnOptions?: SpawnOptions;
}

export interface ManagedSubprocess {
  serviceId: string;
  proc: ChildProcess;
  pipeServer: net.Server | null;
  pipePath: string | null;
  refCount: number;
  idleTimer: ReturnType<typeof setTimeout> | null;
}

export interface SupervisorOptions {
  idleTimeoutMs?: number;
  spawnFn?: (command: string, args: string[], options: SpawnOptions) => ChildProcess;
}

/**
 * SuperGravity Disposable Subprocess Supervisor
 *
 * Manages out-of-process heavy plugins (computer-use, in-built-browser, MCP servers)
 * with strict reference counting, 120s idle TTL reclamation, parent-death watchdog,
 * and zero zombie processes or dangling named pipe handles.
 */
export class DisposableSubprocessSupervisor {
  #services = new Map<string, ManagedSubprocess>();
  #idleTimeoutMs: number;
  #spawnFn: (command: string, args: string[], options: SpawnOptions) => ChildProcess;
  #isDisposed = false;

  constructor(options: SupervisorOptions = {}) {
    this.#idleTimeoutMs = options.idleTimeoutMs ?? 120_000;
    this.#spawnFn = options.spawnFn ?? spawn;

    // Safety fallback: ensure children and pipes terminate on parent exit
    const cleanup = () => {
      this.dispose();
    };

    if (typeof process !== "undefined" && typeof process.on === "function") {
      process.on("exit", cleanup);
      process.on("SIGINT", cleanup);
      process.on("SIGTERM", cleanup);
    }
  }

  get activeServiceCount(): number {
    return this.#services.size;
  }

  isRunning(serviceId: string): boolean {
    const entry = this.#services.get(serviceId);
    return Boolean(entry && !entry.proc.killed);
  }

  getRefCount(serviceId: string): number {
    return this.#services.get(serviceId)?.refCount ?? 0;
  }

  /**
   * Acquire a subprocess handle. Spawns lazily if not already running.
   */
  async acquire(serviceId: string, config: SubprocessConfig): Promise<ManagedSubprocess> {
    if (this.#isDisposed) {
      throw new Error(`Cannot acquire service "${serviceId}": Supervisor is disposed.`);
    }

    let entry = this.#services.get(serviceId);
    if (!entry || entry.proc.killed) {
      entry = await this.#spawnIsolatedService(serviceId, config);
      this.#services.set(serviceId, entry);
    }

    entry.refCount++;
    this.#resetIdleTimer(serviceId, entry);
    return entry;
  }

  /**
   * Release a subprocess reference. Starts the idle countdown when refCount drops to 0.
   */
  release(serviceId: string): void {
    const entry = this.#services.get(serviceId);
    if (!entry) return;

    entry.refCount = Math.max(0, entry.refCount - 1);
    this.#resetIdleTimer(serviceId, entry);
  }

  async #spawnIsolatedService(serviceId: string, config: SubprocessConfig): Promise<ManagedSubprocess> {
    const pipePath = config.useNamedPipe
      ? (process.platform === "win32"
          ? `\\\\.\\pipe\\sg-${serviceId}-${process.pid}-${Date.now()}`
          : `/tmp/sg-${serviceId}-${process.pid}-${Date.now()}.sock`)
      : null;

    let pipeServer: net.Server | null = null;
    if (pipePath) {
      pipeServer = net.createServer();
      await new Promise<void>((resolve, reject) => {
        pipeServer!.once("error", reject);
        pipeServer!.listen(pipePath, () => resolve());
      });
    }

    const mergedEnv = {
      ...process.env,
      SG_PARENT_PID: String(process.pid),
      SG_PIPE_PATH: pipePath || "",
      ...config.spawnOptions?.env
    };

    const proc = this.#spawnFn(config.command, config.args ?? [], {
      stdio: ["pipe", "pipe", "pipe"], // stdin EOF acts as parent-death heartbeat
      windowsHide: true,
      ...config.spawnOptions,
      env: mergedEnv
    });

    const entry: ManagedSubprocess = {
      serviceId,
      proc,
      pipeServer,
      pipePath,
      refCount: 0,
      idleTimer: null
    };

    proc.once("exit", () => {
      this.killImmediately(serviceId);
    });

    return entry;
  }

  #resetIdleTimer(serviceId: string, entry: ManagedSubprocess): void {
    if (entry.idleTimer !== null) {
      clearTimeout(entry.idleTimer);
      entry.idleTimer = null;
    }

    if (entry.refCount === 0) {
      entry.idleTimer = setTimeout(() => {
        this.killImmediately(serviceId);
      }, this.#idleTimeoutMs);
    }
  }

  /**
   * Immediately terminates the subprocess, closes any listening pipes, and clears resources.
   */
  killImmediately(serviceId: string): void {
    const entry = this.#services.get(serviceId);
    if (!entry) return;

    this.#services.delete(serviceId);

    if (entry.idleTimer !== null) {
      clearTimeout(entry.idleTimer);
      entry.idleTimer = null;
    }

    // 1. Destroy and close named pipe server
    if (entry.pipeServer) {
      try {
        entry.pipeServer.close();
      } catch {}
      entry.pipeServer = null;
    }

    // 2. Terminate child process
    if (entry.proc && !entry.proc.killed) {
      try {
        entry.proc.stdin?.end(); // Signal EOF to child watchdog
        entry.proc.kill("SIGTERM");
        const killTimer = setTimeout(() => {
          if (!entry.proc.killed) {
            try {
              entry.proc.kill("SIGKILL");
            } catch {}
          }
        }, 500);
        if (typeof killTimer === "object" && typeof killTimer.unref === "function") {
          killTimer.unref();
        }
      } catch {}
    }
  }

  dispose(): void {
    this.#isDisposed = true;
    for (const serviceId of [...this.#services.keys()]) {
      this.killImmediately(serviceId);
    }
    this.#services.clear();
  }
}

export const subprocessSupervisor = new DisposableSubprocessSupervisor();
