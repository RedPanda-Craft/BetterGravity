import type { ThemeRecord } from "../protocol.js";

export const STYLE_ATTRIBUTE = "data-bettergravity-theme";

/**
 * Themes are reconciled in-place. Instead of destroying and recreating all style
 * elements on every state change (which invalidates Chromium's RuleSet and forces
 * a global layout recalc), existing style tags are diffed and updated in-place.
 */
export function applyThemes(themes: readonly ThemeRecord[]): number {
  const enabled = themes.filter((theme) => theme.enabled);
  const enabledMap = new Map<string, ThemeRecord>();
  for (const theme of enabled) enabledMap.set(theme.id, theme);

  // 1. Reconcile existing style tags: remove disabled/stale ones, update changed ones in-place.
  const existing = document.querySelectorAll(`style[${STYLE_ATTRIBUTE}]`);
  const seen = new Set<string>();

  for (const style of existing) {
    const id = style.getAttribute(STYLE_ATTRIBUTE);
    if (!id || !enabledMap.has(id)) {
      style.remove();
    } else {
      seen.add(id);
      const target = enabledMap.get(id);
      if (target && style.textContent !== target.css) {
        style.textContent = target.css;
      }
    }
  }

  // 2. Insert newly enabled themes that don't have a style tag yet.
  const targetParent = document.head || document.documentElement;
  for (const theme of enabled) {
    if (!seen.has(theme.id) && targetParent) {
      const style = document.createElement("style");
      style.setAttribute(STYLE_ATTRIBUTE, theme.id);
      style.textContent = theme.css;
      targetParent.appendChild(style);
      seen.add(theme.id);
    }
  }

  return enabled.length;
}
