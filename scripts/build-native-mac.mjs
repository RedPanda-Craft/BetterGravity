import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const workspace = resolve(import.meta.dirname, "..");
const pkg = JSON.parse(readFileSync(resolve(workspace, "package.json"), "utf8"));
const appVersion = pkg.version || "3.0.0";
const outDir = resolve(workspace, "dist-native");
const macDir = resolve(workspace, "apps", "installer-macos");
const appDir = resolve(outDir, "BetterGravityInstaller.app");
const contentsDir = resolve(appDir, "Contents");
const macosBinDir = resolve(contentsDir, "MacOS");
const resourcesDir = resolve(contentsDir, "Resources");

mkdirSync(macosBinDir, { recursive: true });
mkdirSync(resourcesDir, { recursive: true });

// 1. Build Swift release executable (universal for Apple Silicon & Intel)
try {
  execSync("swift build -c release --arch arm64 --arch x86_64", { cwd: macDir, stdio: "inherit" });
} catch {
  execSync("swift build -c release", { cwd: macDir, stdio: "inherit" });
}

// Locate compiled binary (.build/release or .build/apple/Products/Release)
const possibleBinaryPaths = [
  resolve(macDir, ".build", "apple", "Products", "Release", "BetterGravityInstaller"),
  resolve(macDir, ".build", "release", "BetterGravityInstaller")
];

let binaryPath = possibleBinaryPaths.find((p) => existsSync(p));
if (!binaryPath) {
  // Try searching for BetterGravityInstaller executable in .build
  const found = execSync("find .build -type f -name BetterGravityInstaller -perm +111", {
    cwd: macDir,
    encoding: "utf8"
  }).trim().split("\n")[0];
  if (found) binaryPath = resolve(macDir, found);
}

if (!binaryPath || !existsSync(binaryPath)) {
  throw new Error("Could not find compiled BetterGravityInstaller binary after swift build");
}

const targetBinary = resolve(macosBinDir, "BetterGravityInstaller");
cpSync(binaryPath, targetBinary);
execSync(`chmod +x "${targetBinary}"`);

// 2. Copy Resources
const srcResources = resolve(macDir, "Sources", "BetterGravityInstaller", "Resources");
if (existsSync(srcResources)) {
  cpSync(srcResources, resourcesDir, { recursive: true });
}

// 3. Create Info.plist
const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>BetterGravityInstaller</string>
    <key>CFBundleIdentifier</key>
    <string>com.bettergravity.installer</string>
    <key>CFBundleName</key>
    <string>BetterGravity Installer</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>${appVersion}</string>
    <key>LSMinimumSystemVersion</key>
    <string>13.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>`;
writeFileSync(resolve(contentsDir, "Info.plist"), plistContent, "utf8");

// 3.5. Ad-hoc codesign the application bundle so macOS Gatekeeper can verify binary integrity
try {
  execSync(`xattr -cr "${appDir}"`);
} catch {}
try {
  execSync(`codesign --force --deep --sign - "${appDir}"`, { stdio: "inherit" });
} catch (e) {
  console.warn("Notice: Ad-hoc codesign skipped or unavailable:", e.message);
}

// 4. Archive into BetterGravity-Installer-macOS.zip
const zipDest = resolve(outDir, "BetterGravity-Installer-macOS.zip");
try {
  execSync(`ditto -c -k --sequesterRsrc --keepParent "${appDir}" "${zipDest}"`);
} catch {
  execSync(`zip -r -y "${zipDest}" "BetterGravityInstaller.app"`, { cwd: outDir });
}

// 5. Create native macOS DMG (<1MB)
const dmgDest = resolve(outDir, "BetterGravity-Installer-macOS.dmg");
try {
  execSync(`hdiutil create -volname "BetterGravity" -srcfolder "${appDir}" -ov -format UDZO "${dmgDest}"`, {
    cwd: workspace,
    stdio: "inherit"
  });
} catch {}

// Clean up intermediate .app bundle
rmSync(appDir, { recursive: true, force: true });
