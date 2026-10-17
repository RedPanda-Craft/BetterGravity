import { describe, expect, it } from "vitest";
import { compileThemeManifest, type ThemeManifest } from "../src/index.js";

describe("ThemeManifest Compiler", () => {
  it("compiles valid --sg- design tokens into a clean CSS :root block", () => {
    const manifest: ThemeManifest = {
      id: "catppuccin-mocha",
      name: "Catppuccin Mocha Zero-Reflow",
      type: "dark",
      tokens: {
        "--sg-surface-canvas": "#1e1e2e",
        "--sg-surface-base": "#181825",
        "--sg-text-primary": "#cdd6f4",
        "--sg-accent-primary": "#cba6f7",
        "invalid-token": "red" // Non-prefixed token should be ignored
      }
    };

    const css = compileThemeManifest(manifest);
    expect(css).toContain("--sg-surface-canvas: #1e1e2e;");
    expect(css).toContain("--sg-surface-base: #181825;");
    expect(css).toContain("--sg-text-primary: #cdd6f4;");
    expect(css).toContain("--sg-accent-primary: #cba6f7;");
    expect(css).not.toContain("invalid-token");
  });

  it("rejects tokens containing blacklisted performance-degrading properties", () => {
    const badManifest: ThemeManifest = {
      id: "bad-blur-theme",
      name: "Bad Blur Theme",
      tokens: {
        "--sg-surface-overlay": "blur(10px) rgba(0,0,0,0.5)"
      }
    };

    expect(() => compileThemeManifest(badManifest)).toThrowError(/Security\/Performance violation/);
  });
});
