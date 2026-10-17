import { contextBridge, ipcRenderer } from "electron";
import {
  CHANNEL,
  type BrowserPanelState,
  OVERLAY_ARGUMENT,
  type ContentKind,
  type DirectoryKey,
  type GeminiConfig,
  type GeminiStatus,
  type OverlayStatus,
  type OverlaySurface,
  type PresenceActivity,
  type PresenceStatus,
  type RuntimeState,
  type SettingsPatch
} from "../protocol.js";
import { BRIDGE_GLOBAL, type RuntimeBridge } from "../world/bridge.js";
import { applyThemes } from "./themes.js";
import { attachOverlaySurface } from "./overlay.js";

/** The bundled page-world runtime, inlined at build time by build.mjs. */
declare const __WORLD_SOURCE__: string;

// Antigravity's own iframes are left alone; only the top document is modified.
const isTopFrame = (() => {
  try {
    return window.top === window;
  } catch {
    return false;
  }
})();

const isLoopbackHost = (() => {
  try {
    const isLocal = location.hostname === "127.0.0.1" || location.hostname === "localhost" || location.hostname === "[::1]";
    const isHttp = location.protocol === "https:" || location.protocol === "http:";
    return isLocal && isHttp;
  } catch {
    return false;
  }
})();

/**
 * One preload is registered for the whole session, so this same file is what the
 * overlay window loads. The marker on its argv is how the two are told apart:
 * the overlay has no host application to theme and no plugins to host, and the
 * bridge it needs is a different one entirely.
 */
const isOverlayWindow = process.argv.includes(OVERLAY_ARGUMENT) || location.href.includes("overlay.html");

/** The renderer console is unreachable in a packaged build. */
function report(message: string): void {
  try {
    ipcRenderer.send(CHANNEL.log, message);
  } catch {
    // Diagnostics must never break injection.
  }
}

try {
  window.addEventListener("error", (event) => {
    report(`uncaught error: ${event.message} at ${event.filename}:${event.lineno}`);
  });
  window.addEventListener("unhandledrejection", (event) => {
    report(`unhandled rejection: ${event.reason instanceof Error ? event.reason.stack ?? event.reason.message : String(event.reason)}`);
  });
} catch {}

function whenDocumentReady(): Promise<void> {
  if (document.readyState !== "loading") return Promise.resolve();
  return new Promise((resolve) => document.addEventListener("DOMContentLoaded", () => resolve(), { once: true }));
}

/**
 * Injects the page-world runtime as early as the document allows.
 *
 * Timing is the whole point: plugins can wrap fetch, WebSocket, and other page
 * globals, and anything the application does before this runs is missed. The
 * preload is evaluated before the application's own scripts, so injecting here
 * rather than on DOMContentLoaded is what makes those hooks worth having.
 */
function injectWorldRuntime(): void {
  let injected = false;
  const inject = (): boolean => {
    if (injected) return true;
    const parent = document.documentElement ?? document.head;
    if (!parent) return false;
    injected = true;
    const script = document.createElement("script");
    script.setAttribute("data-bettergravity", "runtime");
    script.textContent = __WORLD_SOURCE__;
    parent.appendChild(script);
    script.remove();
    return true;
  };

  if (inject()) return;

  // No document element yet; take the first chance the parser gives us.
  const observer = new MutationObserver(() => {
    if (inject()) observer.disconnect();
  });
  observer.observe(document, { childList: true, subtree: true });
  document.addEventListener("readystatechange", () => {
    if (inject()) observer.disconnect();
  }, { once: true });
}

const stateListeners = new Set<(state: RuntimeState) => void>();
const presenceListeners = new Set<(status: PresenceStatus) => void>();
const geminiListeners = new Set<(status: GeminiStatus) => void>();
const overlayStatusListeners = new Set<(status: OverlayStatus) => void>();
const overlayMessageListeners = new Set<(message: unknown) => void>();
const petsListeners = new Set<() => void>();
const browserListeners = new Set<(state: BrowserPanelState) => void>();

const bridge: RuntimeBridge = {
  getState: () => ipcRenderer.invoke(CHANNEL.getState),
  setSettings: (patch: SettingsPatch) => ipcRenderer.invoke(CHANNEL.setSettings, patch),
  openDirectory: (key: DirectoryKey) => ipcRenderer.invoke(CHANNEL.openDirectory, key),
  readStorage: () => ipcRenderer.invoke(CHANNEL.readStorage),
  writeStorage: (pluginId, key, value) => ipcRenderer.send(CHANNEL.writeStorage, pluginId, key, value),
  importThemes: () => ipcRenderer.invoke(CHANNEL.importThemes),
  importThemeFolder: () => ipcRenderer.invoke(CHANNEL.importThemeFolder),
  importPlugin: () => ipcRenderer.invoke(CHANNEL.importPlugin),
  installThemeText: (fileName, css) => ipcRenderer.invoke(CHANNEL.installThemeText, fileName, css),
  removeItem: (kind: ContentKind, id, label) => ipcRenderer.invoke(CHANNEL.removeItem, kind, id, label),
  revealItem: (kind: ContentKind, id) => ipcRenderer.invoke(CHANNEL.revealItem, kind, id),
  fetchCatalog: (force) => ipcRenderer.invoke(CHANNEL.fetchCatalog, force),
  installFromCatalog: (entry) => ipcRenderer.invoke(CHANNEL.installFromCatalog, entry),
  presenceOpen: (clientId) => ipcRenderer.invoke(CHANNEL.presenceOpen, clientId),
  presenceUpdate: (activity: PresenceActivity | undefined) => ipcRenderer.invoke(CHANNEL.presenceUpdate, activity),
  presenceClose: () => ipcRenderer.invoke(CHANNEL.presenceClose),
  onPresenceStatus: (listener) => {
    presenceListeners.add(listener);
  },
  geminiConfigure: (config: GeminiConfig) => ipcRenderer.invoke(CHANNEL.geminiConfigure, config),
  geminiRead: () => ipcRenderer.invoke(CHANNEL.geminiRead),
  geminiTest: () => ipcRenderer.invoke(CHANNEL.geminiTest),
  onGeminiStatus: (listener) => {
    geminiListeners.add(listener);
  },
  readAccount: () => ipcRenderer.invoke(CHANNEL.readAccount),
  petsRead: owner => ipcRenderer.invoke(CHANNEL.petsRead, owner),
  petsLoad: (owner, id) => ipcRenderer.invoke(CHANNEL.petsLoad, owner, id),
  petsPrepare: owner => ipcRenderer.invoke(CHANNEL.petsPrepare, owner),
  petsOpenFolder: owner => ipcRenderer.invoke(CHANNEL.petsOpenFolder, owner),
  onPetsChanged: listener => { petsListeners.add(listener); },
  browserRequest: (owner, action, args) => ipcRenderer.invoke(CHANNEL.browserRequest, owner, action, args),
  browserBounds: (owner, bounds) => ipcRenderer.send(CHANNEL.browserBounds, owner, bounds),
  onBrowserState: listener => { browserListeners.add(listener); },
  overlayOpen: (owner, surface: OverlaySurface) => ipcRenderer.invoke(CHANNEL.overlayOpen, owner, surface),
  overlayClose: (owner) => ipcRenderer.invoke(CHANNEL.overlayClose, owner),
  overlaySend: (message) => ipcRenderer.send(CHANNEL.overlaySend, message),
  onOverlayStatus: (listener) => {
    overlayStatusListeners.add(listener);
  },
  onOverlayMessage: (listener) => {
    overlayMessageListeners.add(listener);
  },
  log: (message) => report(message),
  onStateChanged: (listener) => {
    stateListeners.add(listener);
  }
};

/**
 * Themes are applied from the preload rather than the page world: they are
 * plain CSS, so they keep working even if the plugin runtime fails to boot.
 *
 * Injects themes as early as possible (document_start) rather than waiting for
 * DOMContentLoaded. This eliminates FOUC and avoids secondary layout reflow.
 */
function applyThemesEarly(state: RuntimeState): void {
  let applied = false;
  const inject = (): boolean => {
    if (applied) return true;
    const parent = document.head ?? document.documentElement;
    if (!parent) return false;
    applied = true;
    if (document.documentElement && state.version) {
      document.documentElement.setAttribute("data-bettergravity", state.version);
    }
    applyThemes(state.themes);
    return true;
  };

  if (inject()) return;

  const observer = new MutationObserver(() => {
    if (inject()) observer.disconnect();
  });
  observer.observe(document, { childList: true, subtree: true });
  document.addEventListener(
    "readystatechange",
    () => {
      if (inject()) observer.disconnect();
    },
    { once: true }
  );
}

async function bootThemesEarly(): Promise<void> {
  const state = (await ipcRenderer.invoke(CHANNEL.getState).catch(() => undefined)) as RuntimeState | undefined;
  if (!state) return;

  applyThemesEarly(state);
  for (const diagnostic of state.diagnostics) report(`diagnostic — ${diagnostic.source}: ${diagnostic.message}`);
}

if (isOverlayWindow) {
  attachOverlaySurface();
} else if (isTopFrame && isLoopbackHost) {
  try {
    contextBridge.exposeInMainWorld(BRIDGE_GLOBAL, bridge);
  } catch (error) {
    report(`could not expose the runtime bridge: ${error instanceof Error ? error.message : String(error)}`);
  }
  ipcRenderer.on(CHANNEL.stateChanged, (_event, state: RuntimeState) => {
    applyThemes(state.themes);
    for (const listener of stateListeners) {
      try {
        listener(state);
      } catch (error) {
        report(`a bridge listener threw: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  });

  ipcRenderer.on(CHANNEL.presenceStatus, (_event, status: PresenceStatus) => {
    for (const listener of presenceListeners) {
      try {
        listener(status);
      } catch (error) {
        report(`a presence listener threw: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  });

  ipcRenderer.on(CHANNEL.geminiStatus, (_event, status: GeminiStatus) => {
    for (const listener of geminiListeners) {
      try {
        listener(status);
      } catch (error) {
        report(`a Gemini listener threw: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  });

  ipcRenderer.on(CHANNEL.overlayStatus, (_event, status: OverlayStatus) => {
    for (const listener of overlayStatusListeners) {
      try {
        listener(status);
      } catch (error) {
        report(`an overlay listener threw: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  });

  ipcRenderer.on(CHANNEL.petsChanged, () => {
    for (const listener of petsListeners) {
      try { listener(); } catch { /* Keep other pet-library subscribers active. */ }
    }
  });

  ipcRenderer.on(CHANNEL.browserState, (_event, state: BrowserPanelState) => {
    for (const listener of browserListeners) {
      try { listener(state); } catch { /* A plugin listener must not block other subscribers. */ }
    }
  });

  ipcRenderer.on(CHANNEL.overlayMessage, (_event, message: unknown) => {
    for (const listener of overlayMessageListeners) {
      try {
        listener(message);
      } catch (error) {
        report(`an overlay message listener threw: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  });

  injectWorldRuntime();
  void bootThemesEarly().catch((error: unknown) =>
    report(`could not apply themes: ${error instanceof Error ? error.message : String(error)}`)
  );
}
