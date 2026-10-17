/**
 * The contract between the runtime's main-process half and its preload half.
 * Both sides import from here so a channel or payload can never drift.
 */

import type { CatalogEntry } from "@bettergravity/marketplace";

export type { CatalogEntry, CatalogFile } from "@bettergravity/marketplace";
export type { PetCreationProgress, PetLibraryState, PetRecord, PetSprite } from "@bettergravity/plugin-api";
export type { BrowserPanelState, BrowserTabState } from "@bettergravity/plugin-api";

export const CHANNEL = {
  getState: "bettergravity:get-state",
  setSettings: "bettergravity:set-settings",
  openDirectory: "bettergravity:open-directory",
  stateChanged: "bettergravity:state-changed",
  readStorage: "bettergravity:read-storage",
  writeStorage: "bettergravity:write-storage",
  importThemes: "bettergravity:import-themes",
  importThemeFolder: "bettergravity:import-theme-folder",
  importPlugin: "bettergravity:import-plugin",
  installThemeText: "bettergravity:install-theme-text",
  removeItem: "bettergravity:remove-item",
  revealItem: "bettergravity:reveal-item",
  fetchCatalog: "bettergravity:fetch-catalog",
  installFromCatalog: "bettergravity:install-from-catalog",
  presenceOpen: "bettergravity:presence-open",
  presenceUpdate: "bettergravity:presence-update",
  presenceClose: "bettergravity:presence-close",
  presenceStatus: "bettergravity:presence-status",
  geminiConfigure: "bettergravity:gemini-configure",
  geminiRead: "bettergravity:gemini-read",
  geminiTest: "bettergravity:gemini-test",
  geminiStatus: "bettergravity:gemini-status",
  readAccount: "bettergravity:read-account",
  petsRead: "bettergravity:pets-read",
  petsLoad: "bettergravity:pets-load",
  petsPrepare: "bettergravity:pets-prepare",
  petsOpenFolder: "bettergravity:pets-open-folder",
  petsChanged: "bettergravity:pets-changed",
  browserRequest: "bettergravity:browser-request",
  browserBounds: "bettergravity:browser-bounds",
  browserState: "bettergravity:browser-state",
  overlayOpen: "bettergravity:overlay-open",
  overlayClose: "bettergravity:overlay-close",
  overlayInteractive: "bettergravity:overlay-interactive",
  overlayFocusable: "bettergravity:overlay-focusable",
  overlaySend: "bettergravity:overlay-send",
  overlayStatus: "bettergravity:overlay-status",
  overlayMessage: "bettergravity:overlay-message",
  overlaySurface: "bettergravity:overlay-surface",
  overlayAttached: "bettergravity:overlay-attached",
  log: "bettergravity:log"
} as const;

/**
 * Marker on an overlay window's argv. The runtime registers one preload for the
 * whole session, so the overlay window receives the same file as an Antigravity
 * window; this is how that file knows which of the two it is running in.
 */
export const OVERLAY_ARGUMENT = "--bettergravity-overlay";

/**
 * Reserved prefix for a plugin's declared settings inside its own storage. The
 * settings panel writes them, `context.settings` reads them, and the main
 * process reads them at launch for a feature that has to be running before any
 * plugin script does — so the prefix is part of the contract, not a detail of
 * the page.
 */
export const SETTING_PREFIX = "setting:";

export type ContentKind = "theme" | "plugin";

/** Outcome of adding or removing content, phrased for display. */
export interface ContentResult {
  readonly ok: boolean;
  /** Absent when the user simply cancelled the dialog. */
  readonly message?: string;
}

/**
 * The community catalog, read on demand rather than polled. `cached` says the
 * answer came from a recent fetch, which is what lets the panel show a
 * refresh control that means something.
 */
export interface CatalogResult {
  readonly ok: boolean;
  readonly entries?: readonly CatalogEntry[];
  readonly cached?: boolean;
  readonly message?: string;
}

/**
 * What a plugin asks Discord to show. Deliberately not Discord's own shape —
 * the main process translates it — so a plugin never has to know the wire
 * format, and the format can change without touching plugins.
 */
export interface PresenceActivity {
  /** The first line under the application name. */
  readonly details?: string;
  /** The second line. */
  readonly state?: string;
  /** Epoch milliseconds. Discord counts up from it without further updates. */
  readonly startedAt?: number;
  readonly endsAt?: number;
  /** An asset key uploaded to the Discord application, or an image URL. */
  readonly largeImage?: string;
  readonly largeText?: string;
  readonly smallImage?: string;
  readonly smallText?: string;
}

export type PresencePhase = "off" | "connecting" | "connected" | "unavailable";

export interface PresenceStatus {
  readonly phase: PresencePhase;
  /** The signed-in Discord account, once connected. */
  readonly user?: string;
  /** Why the phase is what it is, phrased for display. */
  readonly message?: string;
}

/**
 * Where the Gemini key translator has got to. `listening` means it is serving but
 * the language server has not been pointed at it, so a restart is what is left;
 * `routing` means it has. `blocked` is something wrong with the translator
 * itself, described by `message`.
 */
export type GeminiPhase = "off" | "listening" | "routing" | "blocked";

export interface GeminiCounts {
  readonly translated: number;
  readonly passedThrough: number;
  readonly failed: number;
}

/**
 * Deliberately says only whether a key exists, never what it is. This crosses
 * to the page, so anything in here is readable by every plugin.
 */
export interface GeminiStatus {
  readonly phase: GeminiPhase;
  readonly port?: number;
  readonly keyed: boolean;
  readonly trusted: boolean;
  readonly thumbprint?: string;
  readonly restartRequired: boolean;
  readonly message?: string;
  readonly counts: GeminiCounts;
}

/** What a plugin supplies. The key travels one way only, page to main. */
export interface GeminiConfig {
  readonly apiKey?: string;
  /** Where the translated requests go. Google's own API when empty. */
  readonly baseUrl?: string;
  readonly stream?: boolean;
  readonly thoughts?: boolean;
  readonly bypass?: boolean;
  readonly audit?: boolean;
}

export interface GeminiKeyTest {
  readonly ok: boolean;
  readonly message: string;
  readonly models?: number;
}

/**
 * The name on the Google account Antigravity is signed in with.
 *
 * Deliberately a name and nothing else: no address, no identifier, no picture.
 * This crosses to the page, so anything in here is readable by every plugin, and
 * what a plugin needs to greet the user by name is the name. Both fields are
 * absent when Google's own record cannot be read, which is the honest answer
 * rather than a name guessed from an address.
 */
export interface AccountProfile {
  /** Google's own `given_name` — "Ada" in "Ada Lovelace". */
  readonly firstName?: string;
  readonly fullName?: string;
  readonly email?: string;
  readonly pictureUrl?: string;
}

/** Persisted per-plugin key/value data, keyed by plugin id. */
export type PluginStorageSnapshot = Readonly<Record<string, Readonly<Record<string, unknown>>>>;

// ---------------------------------------------------------------------------
// The desktop overlay
// ---------------------------------------------------------------------------

/**
 * What a plugin asks the main process to put on the desktop.
 *
 * The overlay is a window of its own — transparent, frameless, always on top,
 * and unaware of Antigravity's layout — so what crosses is source rather than
 * DOM: the main process cannot carry nodes between renderers, and the overlay's
 * document is the plugin's to build. `script` is evaluated in the overlay's own
 * world with an `Overlay` global in scope.
 */
export interface OverlaySurface {
  readonly script: string;
  readonly styles?: string;
  /** Which screen to cover. `cursor` picks the one the pointer is on. */
  readonly display?: "primary" | "cursor";
  /**
   * Whether the window should hold pointer input from the moment it opens.
   * Normally false: an overlay that swallowed clicks across the whole screen
   * would make the desktop unusable, so it starts transparent to the pointer
   * and asks for input only while something is under the cursor.
   */
  readonly interactive?: boolean;
}

/** Where the overlay sits, in screen coordinates. */
export interface OverlayBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly scaleFactor: number;
}

export interface OverlayStatus {
  readonly open: boolean;
  readonly bounds?: OverlayBounds;
  /** Why it is not open, phrased for display. */
  readonly message?: string;
}

export type DirectoryKey = "themes" | "plugins" | "root";

export interface RuntimeContext {
  readonly version: string;
  readonly hostVersion: string;
  readonly runtimeDirectory: string;
}

export interface ThemeRecord {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly author: string;
  readonly version: string;
  readonly source?: string;
  /** Ready to inject. For a folder theme this is the folded result, not the entry file. */
  readonly css: string;
  /** A folder with a theme.css rather than a single .css file. */
  readonly folder: boolean;
  readonly enabled: boolean;
}

export interface PluginRecord {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly author: string;
  readonly source: string;
  /**
   * The stylesheets the manifest's `styles` names, folded into one string the
   * way a folder theme is. Injected while the plugin runs; absent when the
   * manifest declares none.
   */
  readonly styles?: string;
  readonly enabled: boolean;
}

export interface RuntimeSettings {
  readonly schemaVersion: 1;
  readonly themes: { readonly enabled: readonly string[] };
  readonly plugins: {
    /**
     * Plugins execute real code in the page. Loading them from disk stays off
     * until the user deliberately turns it on.
     */
    readonly developerMode: boolean;
    readonly enabled: readonly string[];
  };
  /**
   * Whether to reapply the patch after Antigravity updates itself. Antigravity
   * replaces app.asar during an update, which removes BetterGravity entirely.
   */
  readonly reapplyAfterHostUpdate: boolean;
}

/** A theme or plugin that could not be loaded, surfaced instead of swallowed. */
export interface RuntimeDiagnostic {
  readonly source: string;
  readonly message: string;
}

export interface RuntimeState {
  readonly version: string;
  readonly hostVersion: string;
  readonly directories: Record<DirectoryKey, string>;
  readonly settings: RuntimeSettings;
  readonly themes: readonly ThemeRecord[];
  readonly plugins: readonly PluginRecord[];
  readonly diagnostics: readonly RuntimeDiagnostic[];
}

/** Partial update accepted by the settings channel. */
export interface SettingsPatch {
  readonly themes?: { readonly enabled?: readonly string[] };
  readonly plugins?: {
    readonly developerMode?: boolean;
    readonly enabled?: readonly string[];
  };
  readonly reapplyAfterHostUpdate?: boolean;
}

export const DEFAULT_SETTINGS: RuntimeSettings = {
  schemaVersion: 1,
  themes: { enabled: [] },
  plugins: { developerMode: false, enabled: ["timeslip", "fork-chat"] },
  reapplyAfterHostUpdate: true
};
