/**
 * Windows Native Runner
 * Bridges Computer Use actions directly to the Windows OS via windows-native-runner.exe
 */

import { exec, execFile, execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BIN_PATH = path.resolve(__dirname, "../bin/windows-native-runner.exe");
const CS_PATH = path.resolve(__dirname, "../bin/windows-native-runner.cs");
const OVERLAY_BIN = path.resolve(__dirname, "../bin/windows-screen-overlay.exe");
const OVERLAY_CS = path.resolve(__dirname, "../bin/windows-screen-overlay.cs");
const INTERRUPT_PATHS = [
  path.resolve(__dirname, "../interrupt.signal"),
  path.join(
    process.env.APPDATA || (process.platform === "win32" ? path.join(os.homedir(), "AppData", "Roaming") : path.join(os.homedir(), ".config")),
    "BetterGravity",
    "plugins",
    "computer-use",
    "interrupt.signal"
  ),
];
const CSC_COMPILER = "C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe";

function checkAndClearInterrupt() {
  let found = false;
  for (const p of INTERRUPT_PATHS) {
    if (fs.existsSync(p)) {
      found = true;
      try { fs.unlinkSync(p); } catch {}
    }
  }
  if (found) {
    throw new Error("Action cancelled by user");
  }
}

let overlayStarted = false;

function pingOverlay() {
  return new Promise((resolve) => {
    const s = net.createConnection({ port: 51830, host: "127.0.0.1" }, () => {
      s.destroy();
      resolve(true);
    });
    s.on("error", () => resolve(false));
    s.setTimeout(150, () => {
      s.destroy();
      resolve(false);
    });
  });
}

function ensureOverlayBinary() {
  if (fs.existsSync(OVERLAY_BIN)) return;
  if (fs.existsSync(OVERLAY_CS) && fs.existsSync(CSC_COMPILER)) {
    try {
      execFileSync(CSC_COMPILER, [
        "/nologo",
        "/target:winexe",
        "/optimize+",
        "/lib:C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\WPF",
        "/r:System.Drawing.dll",
        "/r:System.Windows.Forms.dll",
        "/r:System.Xaml.dll",
        "/r:PresentationCore.dll",
        "/r:PresentationFramework.dll",
        "/r:WindowsBase.dll",
        `/out:${OVERLAY_BIN}`,
        OVERLAY_CS,
      ], { windowsHide: true });
    } catch {
      // Handled silently
    }
  }
}

async function ensureOverlay() {
  ensureOverlayBinary();
  if (!fs.existsSync(OVERLAY_BIN)) return;
  const alive = await pingOverlay();
  if (alive) return;

  try {
    const child = spawn(OVERLAY_BIN, [], {
      detached: true,
      stdio: "ignore",
      windowsHide: false,
    });
    child.unref();
  } catch {}

  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 80));
    if (await pingOverlay()) break;
  }
}

const STATUS_TEXT = "Antigravity is controlling...";

export async function notifyOverlay(x, y, status = STATUS_TEXT) {
  await ensureOverlay();
  return new Promise((resolve) => {
    try {
      const socket = net.createConnection({ port: 51830, host: "127.0.0.1" }, () => {
        const payload = (typeof x === "number" && typeof y === "number")
          ? { x, y, status }
          : { action: "show", status };
        socket.write(JSON.stringify(payload) + "\n");
      });
      socket.on("data", () => {
        socket.end();
        resolve();
      });
      socket.on("error", () => resolve());
      socket.setTimeout(300, () => {
        socket.destroy();
        resolve();
      });
    } catch {
      resolve();
    }
  });
}

export function notifyOverlayDone() {
  return new Promise((resolve) => {
    try {
      const socket = net.createConnection({ port: 51830, host: "127.0.0.1" }, () => {
        socket.write(JSON.stringify({ action: "done" }) + "\n");
      });
      socket.on("data", () => { socket.end(); resolve(); });
      socket.on("error", () => resolve());
      socket.setTimeout(200, () => { socket.destroy(); resolve(); });
    } catch {
      resolve();
    }
  });
}

export function notifyOverlayIdle(status = STATUS_TEXT) {
  return new Promise((resolve) => {
    try {
      const socket = net.createConnection({ port: 51830, host: "127.0.0.1" }, () => {
        socket.write(JSON.stringify({ action: "idle", status }) + "\n");
      });
      socket.on("data", () => { socket.end(); resolve(); });
      socket.on("error", () => resolve());
      socket.setTimeout(200, () => { socket.destroy(); resolve(); });
    } catch {
      resolve();
    }
  });
}

export class WindowsNativeRunner {
  constructor() {
    this.binPath = BIN_PATH;
    this.ensureBinary();
  }

  ensureBinary() {
    if (fs.existsSync(this.binPath)) return;
    if (fs.existsSync(CS_PATH) && fs.existsSync(CSC_COMPILER)) {
      try {
        execFileSync(CSC_COMPILER, [
          "/nologo",
          "/optimize+",
          "/lib:C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\WPF",
          "/r:System.Drawing.dll",
          "/r:System.Windows.Forms.dll",
          "/r:UIAutomationClient.dll",
          "/r:UIAutomationTypes.dll",
          "/r:WindowsBase.dll",
          `/out:${this.binPath}`,
          CS_PATH,
        ], { windowsHide: true });
      } catch {
        // Handled silently
      }
    }
  }

  async runCommand(action, args = {}) {
    this.ensureBinary();
    if (!fs.existsSync(this.binPath)) {
      throw new Error(`Native runner binary not found at ${this.binPath}`);
    }

    const cliArgs = [action];
    for (const [k, v] of Object.entries(args)) {
      if (v !== undefined && v !== null) {
        cliArgs.push(`--${k}`, String(v));
      }
    }

    return new Promise((resolve, reject) => {
      execFile(
        this.binPath,
        cliArgs,
        {
          windowsHide: true,
          maxBuffer: 10 * 1024 * 1024, // 10MB for screenshots
        },
        (error, stdout, stderr) => {
          if (error) {
            reject(error);
            return;
          }
          const trimmed = stdout.trim();
          if (!trimmed) {
            resolve({});
            return;
          }
          try {
            const parsed = JSON.parse(trimmed);
            resolve(parsed);
          } catch {
            resolve({ raw: trimmed });
          }
        }
      );
    });
  }

  async listApps() {
    const result = await this.runCommand("list_apps");
    return Array.isArray(result) ? result : [];
  }

  async focus(app) {
    return await this.runCommand("focus", { app });
  }

  async click({ target, mouse_button = "left", click_count = 1, app, element_index }) {
    checkAndClearInterrupt();
    const appStr = (app && typeof app === "object") ? app.name || app.displayName || "" : String(app || "");
    const args = {
      button: mouse_button,
      count: click_count,
      app: appStr,
    };
    if (element_index !== undefined && element_index !== null) {
      args.element_index = element_index;
      await notifyOverlay(null, null, STATUS_TEXT);
      await new Promise((r) => setTimeout(r, 200));
    } else {
      const x = Array.isArray(target) ? target[0] : 100;
      const y = Array.isArray(target) ? target[1] : 100;
      args.x = x;
      args.y = y;
      await notifyOverlay(x, y, STATUS_TEXT);
      await new Promise((r) => setTimeout(r, 450));
    }
    try {
      const res = await this.runCommand("click", args);
      await new Promise((r) => setTimeout(r, 80));
      return res;
    } finally {
      notifyOverlayIdle();
    }
  }

  async drag({ from, to, app }) {
    checkAndClearInterrupt();
    const fx = Array.isArray(from) ? from[0] : 0;
    const fy = Array.isArray(from) ? from[1] : 0;
    const tx = Array.isArray(to) ? to[0] : fx;
    const ty = Array.isArray(to) ? to[1] : fy;
    const appStr = (app && typeof app === "object") ? app.name || app.displayName || "" : String(app || "");
    await notifyOverlay(fx, fy, STATUS_TEXT);
    await new Promise((r) => setTimeout(r, 140));
    await notifyOverlay(tx, ty, STATUS_TEXT);
    await new Promise((r) => setTimeout(r, 180));
    try {
      const res = await this.runCommand("drag", {
        from_x: fx,
        from_y: fy,
        to_x: tx,
        to_y: ty,
        app: appStr,
      });
      await new Promise((r) => setTimeout(r, 80));
      return res;
    } finally {
      notifyOverlayIdle();
    }
  }

  async scroll({ target, direction = "down", pages = 1, app, element_index }) {
    checkAndClearInterrupt();
    const appStr = (app && typeof app === "object") ? app.name || app.displayName || "" : String(app || "");
    const args = {
      direction,
      pages,
      app: appStr,
    };
    if (element_index !== undefined && element_index !== null) {
      args.element_index = element_index;
      await notifyOverlay(null, null, STATUS_TEXT);
      await new Promise((r) => setTimeout(r, 100));
    } else if (Array.isArray(target) && target.length >= 2) {
      args.x = target[0];
      args.y = target[1];
      await notifyOverlay(target[0], target[1], STATUS_TEXT);
      await new Promise((r) => setTimeout(r, 140));
    } else {
      await notifyOverlay(null, null, STATUS_TEXT);
      await new Promise((r) => setTimeout(r, 100));
    }
    try {
      return await this.runCommand("scroll", args);
    } finally {
      notifyOverlayIdle();
    }
  }

  async typeText({ text, target, app, element_index }) {
    checkAndClearInterrupt();
    const appStr = (app && typeof app === "object") ? app.name || app.displayName || "" : String(app || "");
    const args = { text, app: appStr };
    if (element_index !== undefined && element_index !== null) {
      args.element_index = element_index;
      await notifyOverlay(null, null, STATUS_TEXT);
      await new Promise((r) => setTimeout(r, 180));
    } else if (Array.isArray(target) && target.length >= 2) {
      args.x = target[0];
      args.y = target[1];
      await notifyOverlay(target[0], target[1], STATUS_TEXT);
      await new Promise((r) => setTimeout(r, 180));
    } else {
      await notifyOverlay(null, null, STATUS_TEXT);
    }
    try {
      const res = await this.runCommand("type_text", args);
      await new Promise((r) => setTimeout(r, 60));
      return res;
    } finally {
      notifyOverlayIdle();
    }
  }

  async pressKey({ key, app }) {
    checkAndClearInterrupt();
    const appStr = (app && typeof app === "object") ? app.name || app.displayName || "" : String(app || "");
    await notifyOverlay(null, null, STATUS_TEXT);
    await new Promise((r) => setTimeout(r, 150));
    try {
      return await this.runCommand("press_key", {
        key,
        app: appStr,
      });
    } finally {
      notifyOverlayIdle();
    }
  }

  async performAccessibilityAction({ element_index, action, app }) {
    checkAndClearInterrupt();
    const appStr = (app && typeof app === "object") ? app.name || app.displayName || "" : String(app || "");
    await notifyOverlay(null, null, STATUS_TEXT);
    await new Promise((r) => setTimeout(r, 150));
    try {
      return await this.runCommand("perform_accessibility_action", {
        element_index,
        action: action || "invoke",
        app: appStr,
      });
    } finally {
      notifyOverlayIdle();
    }
  }

  async setValue({ element_index, value, app }) {
    checkAndClearInterrupt();
    const appStr = (app && typeof app === "object") ? app.name || app.displayName || "" : String(app || "");
    await notifyOverlay(null, null, STATUS_TEXT);
    await new Promise((r) => setTimeout(r, 150));
    try {
      return await this.runCommand("set_value", {
        element_index,
        value: value ?? "",
        app: appStr,
      });
    } finally {
      notifyOverlayIdle();
    }
  }

  async getAppState({ app }) {
    checkAndClearInterrupt();
    const appStr = (app && typeof app === "object") ? app.name || app.displayName || "" : String(app || "");
    notifyOverlay(null, null, STATUS_TEXT);
    try {
      return await this.runCommand("get_app_state", {
        app: appStr,
      });
    } finally {
      notifyOverlayIdle();
    }
  }
}
