# Installing BetterGravity

Windows, macOS & Linux, Antigravity 2.x.

## Install

### Windows
1. Download `BetterGravity-Installer-<version>-<arch>.exe` (or native `BetterGravity-Installer-Windows-<arch>.exe`) from the
   [releases page](https://github.com/YashjitPal/BetterGravity/releases). Choose **x64** for Intel/AMD processors or **arm64** for Snapdragon X Elite and Windows on ARM devices.
2. Run it. Windows SmartScreen will warn, because the build is not code-signed
   yet — choose **More info → Run anyway**.
3. The installer finds Antigravity on its own. Press **Install**.
4. Reopen Antigravity. BetterGravity is now in **Settings → BetterGravity**.

### macOS
1. Download `BetterGravity-Installer-<version>-<arch>.dmg` from the
   [releases page](https://github.com/YashjitPal/BetterGravity/releases).
2. Open the DMG and launch BetterGravity Installer.
   - **If macOS warns that the app is "damaged and can’t be opened" or cannot be verified**: Because BetterGravity is an open-source tool without paid Apple Developer ID notarization, macOS Gatekeeper quarantines downloaded binaries.
     - **Quick Terminal fix**: Run:
       ```bash
       xattr -cr /Applications/BetterGravityInstaller.app
       ```
       (or `xattr -cr /Volumes/BetterGravity/BetterGravityInstaller.app` if running directly from the disk image).
     - **Settings alternative**: Open **System Settings → Privacy & Security**, scroll down to the **Security** section, and click **Open Anyway**.
3. The installer automatically discovers `/Applications/Antigravity.app`. Press **Install**.
4. Reopen Antigravity. BetterGravity is now in **Settings → BetterGravity**.

### Linux
1. Download `BetterGravity-Installer-<version>-<arch>.AppImage` (or `.deb` / `.tar.gz`) from the
   [releases page](https://github.com/YashjitPal/BetterGravity/releases).
2. For AppImage: make it executable (`chmod +x BetterGravity-Installer-*.AppImage`) and run it.
   For Debian/Ubuntu: `sudo dpkg -i BetterGravity-Installer-*.deb`.
3. The installer automatically discovers `/opt/Antigravity` or `~/.local/share/Antigravity`. Press **Install**.
4. Reopen Antigravity. BetterGravity is now in **Settings → BetterGravity**.

The installer closes Antigravity if it is running, backs up the original program
bundle, and verifies the result before reporting success.

## Enabling Features & Plugins

Once installed, open Antigravity to activate the capabilities you want:

1. Open Antigravity and click **Settings** (gear icon in the bottom-left corner).
2. In the settings sidebar, scroll down to the **BetterGravity** section.
3. Click **Plugins** to toggle on your features:
   - **Gemini App** — Willow UI workspace redesign with dedicated tabs (Chat, Work, Skills, Scheduled Tasks).
   - **Pets** — Desktop companions & interactive companion manager.
   - **In-App Browser** & **Computer Use** — In-editor autonomous web browsing and UI automation.
   - **Bring Your Own Gemini Key** — Custom Gemini API keys with thinking token streaming.
   - **Discord Rich Presence** — Dynamic agent status in Discord.
4. Click **Themes** to switch styles or drag-and-drop custom `.css` stylesheets.

## Uninstall

Run the installer again and press **Uninstall**. Antigravity is restored exactly
as it was, byte for byte.

Your themes, plugins, settings, and saved plugin data are kept, so reinstalling
picks up where you left off. To remove those too, delete:
- Windows: `%APPDATA%\BetterGravity`
- macOS: `~/Library/Application Support/BetterGravity`
- Linux: `~/.config/BetterGravity`

## Where things are kept

```text
BetterGravity content directory:
  Windows: %APPDATA%\BetterGravity\
  macOS:   ~/Library/Application Support/BetterGravity/
  Linux:   ~/.config/BetterGravity/
├── themes/           your .css files
├── plugins/          one folder per plugin
├── settings.json     what is switched on
├── storage.json      data plugins have saved
└── runtime.log       what the runtime did, and anything that failed
```

This lives outside Antigravity on purpose, so it survives Antigravity being
updated, reinstalled, or removed.

## When Antigravity updates

Antigravity replaces its own program files when it updates, which removes
BetterGravity. It is put back automatically once the update finishes.

You can turn that off under **Settings → BetterGravity → General**. With it off,
the installer will report **Antigravity changed** next time you open it, and
**Reapply** restores things.

## Troubleshooting

**Does BetterGravity support Antigravity IDE?**
No. Google offers two distinct applications: the standalone **Antigravity 2.0** desktop app (`Antigravity.exe`) and the VS Code-based **Antigravity IDE** (`Antigravity IDE.exe`). BetterGravity is currently built specifically for the Antigravity 2.0 desktop app. Antigravity IDE support is on the roadmap for a future release.

**macOS displays “BetterGravityInstaller is damaged and can’t be opened. You should eject the disk image.”**
This is a standard macOS Gatekeeper check triggered on macOS (Sonoma, Sequoia) when an open-source application is downloaded outside the App Store without paid Apple Developer ID notarization. The binary is intact and not actually damaged.

To clear the quarantine attribute and open the installer, run this command in Terminal:
```bash
xattr -cr /Applications/BetterGravityInstaller.app
```
*(Or `xattr -cr /Volumes/BetterGravity/BetterGravityInstaller.app` if opening from the mounted DMG).* Alternatively, go to **System Settings → Privacy & Security**, scroll down to the **Security** section, and click **Open Anyway**.

**The installer says Antigravity was not found.**
Use **Choose a different location** and pick the folder containing
`Antigravity.exe` (Windows), `/Applications/Antigravity.app` (macOS), or
`/opt/Antigravity` / `~/.local/share/Antigravity` (Linux). Standard
locations are checked automatically.

**It says the version has not been marked compatible.**
BetterGravity is verified against Antigravity 2.x and refuses versions it has
not been tested against rather than patching hopefully. Please
[open an issue](https://github.com/YashjitPal/BetterGravity/issues) with your
Antigravity version.

**Antigravity opens but BetterGravity is not in Settings.**
Check `runtime.log` in your BetterGravity content directory (`%APPDATA%\BetterGravity\` on Windows,
`~/Library/Application Support/BetterGravity/` on macOS, or `~/.config/BetterGravity/` on Linux).
If the runtime failed, Antigravity starts as though BetterGravity were not installed — that is deliberate.
The log says what went wrong.

**A theme or plugin is not showing up.**
Themes must end in `.css`. Plugins must be a folder containing `plugin.json`,
and only load when **Developer mode** is on. Anything that failed to load is
listed under the **Problems** tab with the reason.

**Antigravity will not start after installing.**
Run the installer and press **Uninstall**, which restores the original bundle
from its backup. Then please open an issue — this should not be possible, since
the patch is designed to fall back to a normal launch if anything goes wrong.

**Something looks broken after enabling a theme.**
Switch the theme off in settings. Themes are plain CSS and cannot damage
anything, but they can certainly hide things.

## Building it yourself

```bash
pnpm install
pnpm build:installer
```

The portable executable is written to `release-<version>/`. See
[contributing](../CONTRIBUTING.md) for the development workflow.
