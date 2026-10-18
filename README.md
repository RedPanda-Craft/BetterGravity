<div align="center">

<img src="docs/images/logo.png" alt="SuperGravity Logo" width="130">

# SuperGravity 🚀

**An independent community branch of [BetterGravity](https://github.com/YashjitPal/BetterGravity) for [Google Antigravity](https://antigravity.google).**

[English](README.md) · [简体中文](README_zh.md)

[![Upstream: BetterGravity](https://img.shields.io/badge/Upstream-BetterGravity-blue.svg)](https://github.com/YashjitPal/BetterGravity)
[![Checks](https://github.com/YashjitPal/BetterGravity/actions/workflows/ci.yml/badge.svg)](https://github.com/YashjitPal/BetterGravity/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Antigravity 2.x](https://img.shields.io/badge/Antigravity-2.x-FFC799)](https://antigravity.google)
[![Platform: Windows | macOS | Linux](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-0078D4)](docs/installation.md)

[Install](docs/installation.md) · [Make a theme](docs/themes.md) ·
[Make a plugin](docs/plugins.md) · [How it works](docs/architecture.md) ·
[Community catalog](community/catalog.json)

<br><br>

<img src="docs/images/home.png" alt="The SuperGravity interface inside Google Antigravity" width="800">

</div>

---

> [!NOTE]
> **Upstream Credit & Lineage**:  
> **SuperGravity** is an independent community branch evolving from the awesome [BetterGravity](https://github.com/YashjitPal/BetterGravity) created by [@YashjitPal](https://github.com/YashjitPal).  
> All upstream core architecture, themes, plugin APIs, and MIT licensing are 100% preserved. We regularly sync upstream changes while exploring independent experimental features, typing performance guards, and developer workflows.

> [!IMPORTANT]
> **Compatibility Notice**: SuperGravity is designed specifically for the standalone **Google Antigravity 2.0 desktop application** (`Antigravity.exe` / `Antigravity.app`). It does **not** currently support the separate VS Code-based **Antigravity IDE** (`Antigravity IDE.exe`). Dedicated Antigravity IDE support is planned for a future release.

## Independent Features & Exploration

SuperGravity inherits BetterGravity's extensible modification platform while exploring independent workflow features directly inside Antigravity.

### ⚡ Anti-Thrashing Typing Guard & Zero-Reflow Defense
Engineered for smooth coding: automatically silences high-frequency DOM MutationObservers and Redux store subscriptions while the user is actively typing. Isolates hover overlays with GPU hardware acceleration (`transform: translateZ(0)`) to eliminate frame drops and UI jitter.

### 🛡️ Deterministic Agent Sentinel Harness
Pre-configured with zero-noise verification scripts (`pnpm agent:verify`). Intercepts voluminous CLI logs and condenses them into clean, high-SNR status cards for AI pair-programming assistants (Antigravity, Claude Code, Cursor) without polluting context memory.

### 🎨 Revamped Gemini Workspace
Restyled with the clean Willow design system, dedicated sidebar navigation (Chat, Work, Skills, Scheduled Tasks, and Pets), refined typography, and distraction-free conversation layouts.

### 🐾 Interactive Desktop Companions
Choose from 17+ desktop companions, generate custom animated pixel pets with Gemini, or watch them cheer, idle, and code alongside your agent in real time.

<div align="center">
  <img src="docs/images/pets-manager.png" alt="Antigravity Pets Manager" width="760">
  <br><br>
  <img src="docs/images/pets.gif" alt="Animated Desktop Companion Pet" width="380">
</div>

### 🌐 In-App Browser & Autonomous Computer Use
Test web applications, inspect live DOM trees, and let your agent browse the web or drive mouse and keyboard interactions autonomously without leaving Antigravity.

<div align="center">
  <img src="docs/images/browser-showcase.gif" alt="In-Built Browser and Computer Use" width="760">
</div>

### 🔑 Bring Your Own Gemini Key & 🎮 Discord Rich Presence

<div align="center">

| Bring Your Own Gemini Key (BYOK) | Discord Rich Presence |
| :---: | :---: |
| <img src="docs/images/byok-settings.png" alt="Custom Gemini API Key Settings" width="360"> | <img src="docs/images/discord-rpc.jpg" alt="Discord Rich Presence Profile" width="360"> |
| Bypass quota limits with your own Gemini API key, connect custom base URLs, and stream raw model reasoning & thinking tokens. See [Gemini key guide](docs/gemini-key.md). | Flex your agent's active tasks and elapsed time dynamically on Discord with zero project or code data leaked. See [Discord Rich Presence](docs/presence.md). |

</div>

---

## Platform features

|  | |
| --- | --- |
| **Themes** | A `.css` file, a folder of them with fonts and images, or a link to one hosted elsewhere. Save and Antigravity restyles immediately — no build step, no reload. Around twenty design tokens recolour the entire app. See [theme guide](docs/themes.md). |
| **Plugins** | A folder with a manifest and a script. Persistent storage, declarative settings, scoped styles, and DOM helpers built for a UI that constantly re-renders. See [plugin guide](docs/plugins.md). |
| **Interface hooks** | Add toasts, entries in Antigravity's menus, toolbar buttons, dialogs, and a settings screen of your own — built from the app's own components. See [adding to Antigravity's interface](docs/interface.md). |
| **Deeper hooks** | Patch Antigravity's own functions, read its React tree, intercept its language-server traffic by RPC method name, and rewrite its bundle before it runs. See [reaching into Antigravity](docs/advanced.md). |
| **Native settings** | BetterGravity gets its own heading in Antigravity's settings sidebar — Settings, Plugins, and Themes — built from Antigravity's own components, so it follows your theme automatically. |
| **Community catalogue** | Browse, install, and update themes and plugins right inside the app; every file is checked against the SHA-256 hash recorded when reviewed. See [community content](docs/marketplace.md). |
| **Survives updates** | Antigravity replaces its own program files when it updates, which removes BetterGravity. A detached guardian puts it back the next time you close the app. |
| **Fully reversible** | The original bundle is kept beside the patched one. Uninstall restores it byte for byte and keeps your content. |

## Install

Windows, macOS & Linux, Antigravity 2.x.

Download the installer from [releases](https://github.com/RedPanda-Craft/SuperGravity/releases), run it, and press **Install**.

### Enabling features & plugins

Once installed, BetterGravity adds its own dedicated menu inside Antigravity:

1. Open Antigravity and click **Settings** (gear icon in the bottom-left corner).
2. In the settings sidebar, scroll down to the **BetterGravity** section.
3. Click **Plugins** to toggle on your preferred capabilities:
   - **Gemini App** — Willow UI workspace redesign with dedicated tabs (Chat, Work, Skills, Scheduled Tasks).
   - **Pets** — Desktop companions & interactive manager.
   - **In-App Browser** & **Computer Use** — Autonomous web browsing and UI automation.
   - **Bring Your Own Gemini Key** — Bypass quotas with custom API keys and thinking token pass-through.
   - **Discord Rich Presence** — Live agent status in Discord.
4. Click **Themes** to switch styles or drag-and-drop custom `.css` stylesheets.

> 🛡️ **Safety & Reversibility:**
> - Backups are created automatically before any patch is applied.
> - Uninstalling restores your original Antigravity installation byte for byte.
> - Never touches your local repositories, workspace code, or credentials.

Full instructions and troubleshooting are in the [installation guide](docs/installation.md).

## A theme in ten seconds

```css
/**
 * @name Neon
 * @author you
 */

:root {
  --primary: #22d3ee !important;
  --background: #16091f !important;
}

[data-testid="agent-input-box"] {
  border: 2px solid #7c5cff !important;
  border-radius: 18px !important;
}
```

Drop it on the BetterGravity settings page, or put it in the themes folder.
Switch it on.

> `!important` matters: Antigravity applies its theme as inline custom
> properties, so ordinary rules lose. The [theme guide](docs/themes.md) explains
> what else is reachable, including how to replace the app's own animations.

## A plugin in twenty

```js
plugin.log.info("started");

const settings = plugin.settings.define({
  greeting: { type: "string", label: "Greeting", default: "Hello" }
});

plugin.dom.observe('[data-testid="conversation-row-sidebar"]', (row) => {
  row.title = settings.greeting;
});
```

With a `plugin.json` beside it, that is a complete plugin. Turn on developer
mode, switch it on, and editing the file reloads it live.

Plain JavaScript gets full type checking and editor completion by copying one
[`globals.d.ts`](examples/plugins/session-timer/globals.d.ts) — no TypeScript
required. See [making a plugin](docs/plugins.md).

## How it works

Antigravity is not a normal Electron app, and that shapes everything here. Its
`app.asar` is a small launcher: it starts a native language server and points a
window at `https://127.0.0.1:<port>`, so **the entire interface is a web app
served over loopback**. There are no UI files on disk to patch.

So BetterGravity injects at runtime instead. The installer swaps `app.asar` for
a small bootstrap and keeps the original as `_app.asar`. The bootstrap restores
Antigravity's identity, starts the BetterGravity runtime, and hands control to
the original entry point. If anything in the runtime fails, it is caught and
Antigravity starts exactly as it would without BetterGravity.

**Nothing you install can stop your editor from opening.**

[Architecture](docs/architecture.md) goes into detail.

## Safety

The installer is privileged code that modifies an application on your machine.
It keeps timestamped backups, verifies every step, refuses host versions it has
not been tested against, and never deletes your content.

Plugins are the opposite: untrusted code running in the same page as your source
and credentials. **Plugin loading is off until you turn on developer mode**, and
the settings page says exactly why. Themes are plain CSS and carry no such risk,
so they load freely.

Found a vulnerability? See the [security policy](SECURITY.md).

## Repository

```text
apps/installer          The Windows installer: Electron shell and its UI
packages/patcher        Patching, verification, uninstall, update guardian
packages/runtime        The layer that runs inside Antigravity
packages/plugin-api     The public contract plugins are written against
packages/theme-api      Theme metadata format
packages/marketplace    Submission rules and the catalog shape
packages/shared         Version constants and shared types
community/              Submitted themes and plugins, and the catalog
examples/               A reference plugin, type-checked in CI
docs/                   Everything above, in detail
```

## Development

Node.js 22+ and pnpm 10+.

```bash
pnpm install
pnpm check     # verify structure, typecheck, build, and test
pnpm dev       # the installer UI in a browser, against a safe preview patcher
```

`pnpm dev` never touches Antigravity. To work against a real installation, and
for the DevTools-protocol harness used to develop the injected UI, see
[contributing](CONTRIBUTING.md).

## Sharing what you make

Themes and plugins are submitted to [`community/`](community) as pull requests,
reviewed, and indexed into a [catalog](community/catalog.json). Keeping them in
the repository means every listing has a readable diff and a review attached —
which matters, because a plugin is arbitrary code running beside your source and
your credentials.

`pnpm community:check` runs the same validation CI does. The rules are in the
[community README](community/README.md).

## Status

Windows, macOS & Linux, Antigravity 2.x. In-app community catalogue browsing and 1-click installation are live. Submissions for new community themes and plugins are open via pull request. Binaries are currently unsigned (Windows SmartScreen and macOS Gatekeeper notices apply on first run). See the [roadmap](docs/roadmap.md).

## Licence

[MIT](LICENSE).

BetterGravity is an unofficial community project. It is not affiliated with,
endorsed by, or sponsored by Google, and it distributes none of Google's files.
