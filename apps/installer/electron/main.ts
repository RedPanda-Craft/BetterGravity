import path from "node:path";
import { BrowserWindow, app, dialog, ipcMain, shell } from "electron";
import type { InstallOperation, OperationProgress } from "@bettergravity/patcher";
import { findAntigravityInstallation, inspectInstallation, runOperation, uninstall, unpackedPath } from "@bettergravity/patcher/native";
import { INSTALLER_CHANNEL } from "./ipc.js";

// Set only by the dev script. Without it the built files are loaded, so the
// packaged app and a local `start:desktop` behave identically.
const devServerUrl = process.env["BG_DEV_SERVER_URL"];

import fs from "node:fs";
import { createHash } from "node:crypto";

// The runtime bundles sit next to the compiled main process. In a packaged
// build they are unpacked out of app.asar, because the patcher reads through
// original-fs and cannot see inside an archive.
function resolveRuntimeSource(): string {
  try {
    const cached = path.join(app.getPath("appData"), "BetterGravity", "PatcherCache", "runtime");
    if (fs.existsSync(path.join(cached, "main.cjs")) && fs.existsSync(path.join(cached, "preload.cjs"))) {
      return cached;
    }
  } catch {}
  return path.join(unpackedPath(__dirname), "runtime");
}

async function syncBootstrapper(): Promise<void> {
  const manifestUrl = "https://raw.githubusercontent.com/RedPanda-Craft/SuperGravity/main/apps/installer-windows/Patcher/manifest.json";
  const rawBase = "https://raw.githubusercontent.com/RedPanda-Craft/SuperGravity/main/";
  const cacheDir = path.join(app.getPath("appData"), "BetterGravity", "PatcherCache");
  const runtimeDir = path.join(cacheDir, "runtime");

  try {
    const res = await fetch(manifestUrl, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return;
    const manifest = (await res.json()) as { version?: string; files?: Record<string, { path: string; sha256: string }> };
    if (!manifest?.files) return;

    fs.mkdirSync(runtimeDir, { recursive: true });
    for (const [fileKey, fileInfo] of Object.entries(manifest.files)) {
      const target = fileKey.startsWith("runtime/")
        ? path.join(runtimeDir, path.basename(fileKey))
        : path.join(cacheDir, path.basename(fileKey));

      const fileRes = await fetch(rawBase + fileInfo.path, { signal: AbortSignal.timeout(10000) });
      if (!fileRes.ok) continue;
      const buf = Buffer.from(await fileRes.arrayBuffer());
      const hash = createHash("sha256").update(buf).digest("hex");
      if (hash.toLowerCase() === fileInfo.sha256.toLowerCase()) {
        fs.writeFileSync(target, buf);
      }
    }
  } catch {
    // Offline fallback
  }
}

function createWindow(): void {
  const window = new BrowserWindow({
    width: 720,
    height: 610,
    minWidth: 620,
    minHeight: 540,
    show: false,
    title: "BetterGravity Installer",
    backgroundColor: "#080b12",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  window.once("ready-to-show", () => window.show());
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });

  if (devServerUrl) {
    void window.loadURL(devServerUrl);
    window.webContents.openDevTools({ mode: "detach" });
  } else {
    void window.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

ipcMain.handle(INSTALLER_CHANNEL.chooseDirectory, async () => {
  const result = await dialog.showOpenDialog({
    title: "Choose the Antigravity installation folder or application bundle",
    properties: ["openDirectory", "openFile", "dontAddToRecent", "treatPackageAsDirectory"],
    ...(process.platform === "darwin" ? { filters: [{ name: "Applications", extensions: ["app"] }] } : {})
  });
  return result.canceled ? undefined : result.filePaths[0];
});

ipcMain.handle(INSTALLER_CHANNEL.detectInstallation, () => findAntigravityInstallation());

ipcMain.handle(INSTALLER_CHANNEL.inspectInstallation, (_event, installationPath: string) => inspectInstallation(installationPath));

ipcMain.handle(INSTALLER_CHANNEL.runOperation, (event, operation: InstallOperation, installationPath: string) => {
  const onProgress = (progress: OperationProgress) => event.sender.send(INSTALLER_CHANNEL.progress, progress);
  if (operation === "uninstall") return uninstall(installationPath, onProgress);
  return runOperation(operation, installationPath, { runtimeSource: resolveRuntimeSource() }, onProgress);
});

// The runtime writes its log beside the user's content, not into the
// installation, so this does not depend on which Antigravity was patched.
ipcMain.handle(INSTALLER_CHANNEL.openLogs, () =>
  shell.openPath(path.join(app.getPath("appData"), "BetterGravity", "runtime.log"))
);

ipcMain.on(INSTALLER_CHANNEL.close, () => app.quit());

void app.whenReady().then(() => {
  void syncBootstrapper();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
