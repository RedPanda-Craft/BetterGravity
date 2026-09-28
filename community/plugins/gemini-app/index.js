// Gemini App — the behaviour. The look is in styles/, declared in plugin.json
// and injected by BetterGravity before this script runs.
//
// CSS can move, hide, and restyle, but it cannot rewrite text, reach for a name,
// or measure a distance that only exists once it happens, so what lives here is
// what needs code. The first of it was the prompt box's model pill: it reads
// "3.1 Pro", not "Gemini 3.1 Pro". The model menu, the aria-label
// that screen readers announce, and every other place a model is named keep
// the full name.
//
// The rule for Gemini models is Willow's (features/code/src/workbench/
// model-labels.ts): drop the word "Gemini" and whatever follows it stays. It is
// a rule, not a list, so "Gemini 4 Pro" will read "4 Pro" the day it appears.
// Other vendors' models are listed by hand below; Antigravity adds those rarely.

// ---------------------------------------------------------------------------
// Workspace Theme & Colors — Willow OKLCh Perceptual Engine
// ---------------------------------------------------------------------------

const WORKSPACE_COLOR_DEFINITIONS = [
  { id: "green", label: "Willow Green", hex: "#4a7c59" },
  { id: "blue", label: "Blue", hex: "#3b82f6", isDefault: true },
  { id: "pink", label: "Pink", hex: "#ec4899" },
  { id: "yellow", label: "Yellow", hex: "#eab308" },
  { id: "orange", label: "Orange", hex: "#f97316" },
  { id: "purple", label: "Purple", hex: "#8b5cf6" },
  { id: "lilac", label: "Lilac", hex: "#c084fc" },
  { id: "coral", label: "Coral", hex: "#f43f5e" },
  { id: "teal", label: "Teal", hex: "#14b8a6" }
];

const pluginSettings = plugin.settings.define({
  workspaceColor: {
    type: "palette",
    label: "Workspace color",
    description: "Accent color theme for the background glow, send button, and UI highlights.",
    default: "blue",
    options: WORKSPACE_COLOR_DEFINITIONS.map((d) => ({ value: d.id, label: d.label, hex: d.hex }))
  }
});

// Color Space Maths (sRGB <-> Linear <-> OKLab <-> OKLCh)
const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const linearToSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

const linearToOklab = ([r, g, b]) => {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  ];
};

const oklabToLinear = ([L, a, b]) => {
  const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
  ];
};

const oklabToOklch = ([L, a, b]) => [
  L,
  Math.hypot(a, b),
  ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360
];

const oklchToOklab = ([L, C, h]) => [
  L,
  C * Math.cos((h * Math.PI) / 180),
  C * Math.sin((h * Math.PI) / 180)
];

const isInGamut = ([r, g, b]) => [r, g, b].every((c) => c >= -1e-5 && c <= 1 + 1e-5);

const hexToRgb = (hex) => [
  parseInt(hex.slice(1, 3), 16) / 255,
  parseInt(hex.slice(3, 5), 16) / 255,
  parseInt(hex.slice(5, 7), 16) / 255
];

const rgbToHex = ([r, g, b]) => {
  const clamp = (v) => Math.min(255, Math.max(0, Math.round(v * 255)));
  return `#${clamp(r).toString(16).padStart(2, "0")}${clamp(g).toString(16).padStart(2, "0")}${clamp(b).toString(16).padStart(2, "0")}`;
};

const rgbToOklch = (rgb) => oklabToOklch(linearToOklab(rgb.map(srgbToLinear)));

const oklchToRgb = ([L, C, h]) => {
  let lo = 0;
  let hi = C;
  if (isInGamut(oklabToLinear(oklchToOklab([L, C, h])))) {
    lo = C;
  } else {
    for (let i = 0; i < 64; i += 1) {
      const mid = (lo + hi) / 2;
      if (isInGamut(oklabToLinear(oklchToOklab([L, mid, h])))) lo = mid;
      else hi = mid;
    }
  }
  const linear = oklabToLinear(oklchToOklab([L, lo, h]));
  return linear.map((c) => Math.min(1, Math.max(0, linearToSrgb(c))));
};

const GLOW_ACCENT_TRANSFORM = {
  lightnessRatio: 0.424245154339543,
  chromaRatio: 0.46688940886964236,
  hueShiftDeg: 9.038231999938716
};

const GLOW_TO_BUTTON_TRANSFORM = {
  lightnessRatio: 1.5055348233608743,
  chromaRatio: 1.6820248383608614,
  hueShiftDeg: -5.072855244339735
};

const GLOW_TO_CHIP_TRANSFORM = {
  lightnessRatio: 1.1694180324862116,
  chromaRatio: 1.2611264321248365,
  hueShiftDeg: -0.6335269870383513
};

// Willow's exact measured glow accents
const WILLOW_HOME_GLOW_ACCENTS = {
  green: "rgb(6, 78, 59)",
  blue: "rgb(20, 32, 79)",
  pink: "rgb(76, 9, 35)",
  yellow: "rgb(66, 54, 0)",
  orange: "rgb(72, 34, 0)",
  purple: "rgb(45, 17, 75)",
  lilac: "rgb(62, 32, 76)",
  coral: "rgb(78, 7, 10)",
  teal: "rgb(0, 53, 52)"
};

// Willow's exact measured send button pairs
const WILLOW_SEND_BUTTONS = {
  green: { bg: "#127352", hover: "#0d5c41" },
  blue: { bg: "#1b3f95", hover: "#153277" },
  pink: { bg: "#8c064b", hover: "#70053c" },
  yellow: { bg: "#7c6100", hover: "#634e00" },
  orange: { bg: "#863e00", hover: "#6b3200" },
  purple: { bg: "#512192", hover: "#450e83" },
  lilac: { bg: "#6f3c92", hover: "#5f2c81" },
  coral: { bg: "#900021", hover: "#78001a" },
  teal: { bg: "#00625c", hover: "#00514c" }
};

// Willow's exact creamy tints for text selection
const WILLOW_CREAMY = {
  green: "rgba(156, 228, 179, 0.35)",
  blue: "rgba(168, 199, 250, 0.35)",
  pink: "rgba(250, 178, 205, 0.35)",
  yellow: "rgba(253, 221, 65, 0.35)",
  orange: "rgba(255, 202, 138, 0.35)",
  purple: "rgba(188, 149, 250, 0.35)",
  lilac: "rgba(215, 175, 252, 0.35)",
  coral: "rgba(255, 140, 160, 0.35)",
  teal: "rgba(130, 230, 220, 0.35)"
};

// Antigravity mark hue rotation filters (calibrated against default blue mark)
const ANTIGRAVITY_LOGO_FILTERS = {
  blue: "none",
  green: "hue-rotate(-95deg) saturate(1.1)",
  pink: "hue-rotate(75deg) saturate(1.2)",
  yellow: "hue-rotate(170deg) saturate(1.3)",
  orange: "hue-rotate(145deg) saturate(1.25)",
  purple: "hue-rotate(35deg) saturate(1.2)",
  lilac: "hue-rotate(50deg) saturate(1.15)",
  coral: "hue-rotate(95deg) saturate(1.2)",
  teal: "hue-rotate(-45deg) saturate(1.1)"
};

function computeWorkspaceTheme(def) {
  let glowAccent = WILLOW_HOME_GLOW_ACCENTS[def.id];
  let glowRgb;
  if (!glowAccent) {
    const [L, C, h] = rgbToOklch(hexToRgb(def.hex));
    glowRgb = oklchToRgb([
      L * GLOW_ACCENT_TRANSFORM.lightnessRatio,
      C * GLOW_ACCENT_TRANSFORM.chromaRatio,
      (h + GLOW_ACCENT_TRANSFORM.hueShiftDeg + 360) % 360
    ]);
    const [r, g, b] = glowRgb.map((c) => Math.round(c * 255));
    glowAccent = `rgb(${r}, ${g}, ${b})`;
  } else {
    const m = glowAccent.match(/\d+/g);
    glowRgb = m ? [Number(m[0]) / 255, Number(m[1]) / 255, Number(m[2]) / 255] : [6 / 255, 78 / 255, 59 / 255];
  }

  let sendButton = WILLOW_SEND_BUTTONS[def.id];
  if (!sendButton) {
    const [L_glow, C_glow, h_glow] = rgbToOklch(glowRgb);
    const L_btn = L_glow * GLOW_TO_BUTTON_TRANSFORM.lightnessRatio;
    const C_btn = C_glow * GLOW_TO_BUTTON_TRANSFORM.chromaRatio;
    const h_btn = (h_glow + GLOW_TO_BUTTON_TRANSFORM.hueShiftDeg + 360) % 360;
    sendButton = {
      bg: rgbToHex(oklchToRgb([L_btn, C_btn, h_btn])),
      hover: rgbToHex(oklchToRgb([L_btn * 0.82, C_btn, h_btn]))
    };
  }

  let chipBg = def.id === "blue" ? "#192967" : def.id === "green" ? "#127352" : null;
  if (!chipBg) {
    const [L_glow, C_glow, h_glow] = rgbToOklch(glowRgb);
    chipBg = rgbToHex(oklchToRgb([
      L_glow * GLOW_TO_CHIP_TRANSFORM.lightnessRatio,
      C_glow * GLOW_TO_CHIP_TRANSFORM.chromaRatio,
      (h_glow + GLOW_TO_CHIP_TRANSFORM.hueShiftDeg + 360) % 360
    ]));
  }

  let creamyRgba = WILLOW_CREAMY[def.id];
  if (!creamyRgba) {
    const [, C, h] = rgbToOklch(hexToRgb(def.hex));
    const creamyRgb = oklchToRgb([0.85, Math.min(C * 0.55, 0.11), h]);
    const [cr, cg, cb] = creamyRgb.map((c) => Math.round(c * 255));
    creamyRgba = `rgba(${cr}, ${cg}, ${cb}, 0.35)`;
  }

  let logoFilter = ANTIGRAVITY_LOGO_FILTERS[def.id];
  if (!logoFilter) {
    if (def.id === "blue") {
      logoFilter = "none";
    } else {
      const [, , h_swatch] = rgbToOklch(hexToRgb(def.hex));
      const angle = Math.round((h_swatch - 245 + 360) % 360);
      logoFilter = `hue-rotate(${angle > 180 ? angle - 360 : angle}deg) saturate(1.15)`;
    }
  }

  return {
    id: def.id,
    label: def.label,
    swatchHex: def.hex,
    glowAccent,
    sendButton,
    chipBg,
    creamyRgba,
    logoFilter
  };
}

function getWorkspaceTheme(colorId) {
  const match = WORKSPACE_COLOR_DEFINITIONS.find((d) => d.id === colorId);
  return computeWorkspaceTheme(match || WORKSPACE_COLOR_DEFINITIONS[0]);
}

function applyWorkspaceTheme(colorId) {
  const theme = getWorkspaceTheme(colorId);
  const root = document.documentElement;

  root.style.setProperty("--gemini-home-glow-accent", theme.glowAccent);
  root.style.setProperty("--gemini-send-bg", theme.sendButton.bg);
  root.style.setProperty("--gemini-send-bg-hover", theme.sendButton.hover);
  root.style.setProperty("--gemini-chip-bg", theme.chipBg);
  root.style.setProperty("--gemini-selection-bg", theme.creamyRgba);
  root.style.setProperty("--gemini-logo-filter", theme.logoFilter);
  root.style.setProperty("--gemini-theme-accent", theme.swatchHex);
  root.style.setProperty("--gemini-unread-dot-color", theme.swatchHex);

  let themeStyle = document.getElementById("gemini-theme-dynamic-styles");
  if (!themeStyle) {
    themeStyle = document.createElement("style");
    themeStyle.id = "gemini-theme-dynamic-styles";
    document.head.appendChild(themeStyle);
  }
  themeStyle.textContent = `
    :root {
      --gemini-home-glow-accent: ${theme.glowAccent} !important;
      --gemini-send-bg: ${theme.sendButton.bg} !important;
      --gemini-send-bg-hover: ${theme.sendButton.hover} !important;
      --gemini-chip-bg: ${theme.chipBg} !important;
      --gemini-selection-bg: ${theme.creamyRgba} !important;
      --gemini-logo-filter: ${theme.logoFilter} !important;
      --gemini-theme-accent: ${theme.swatchHex} !important;
      --gemini-unread-dot-color: ${theme.swatchHex} !important;
    }
    ::selection {
      background: ${theme.creamyRgba} !important;
    }
  `;
}

// Initialise theme and listen for settings changes
applyWorkspaceTheme(pluginSettings.workspaceColor);
plugin.settings.onChange((key, value) => {
  if (key === "workspaceColor" && typeof value === "string") {
    applyWorkspaceTheme(value);
    enhanceWorkspaceColorSettings();
  }
});

function enhanceWorkspaceColorSettings() {
  if (!document.querySelector(".settings-modal-container") && !document.querySelector('[role="dialog"]') && !document.querySelector(".py-2.px-3")) {
    return;
  }
  const rows = document.querySelectorAll(".py-2.px-3");
  let targetRow = null;
  for (const r of rows) {
    if ((r.textContent || "").includes("Workspace color")) {
      targetRow = r;
      break;
    }
  }
  if (!targetRow) return;

  const controlSlot = targetRow.querySelector(".shrink-0");
  if (!controlSlot) return;

  const input = controlSlot.querySelector("input, select");
  if (input) {
    input.style.display = "none";
  }

  const currentVal =
    window.BetterGravity && window.BetterGravity.plugins && window.BetterGravity.plugins.getSetting
      ? window.BetterGravity.plugins.getSetting("gemini-app", "workspaceColor") || pluginSettings.workspaceColor || "blue"
      : pluginSettings.workspaceColor || "blue";

  let container = controlSlot.querySelector(".gemini-palette-picker");
  if (container && (container.querySelector(".gemini-palette-badge") || container.querySelector(".gemini-palette-swatches"))) {
    container.remove();
    container = null;
  }
  if (!container) {
    container = document.createElement("div");
    container.className = "gemini-palette-picker";
    container.style.cssText = "display: flex; align-items: center; gap: 7px; flex-wrap: wrap; justify-content: flex-end;";
    controlSlot.appendChild(container);
  } else {
    container.style.cssText = "display: flex; align-items: center; gap: 7px; flex-wrap: wrap; justify-content: flex-end;";
  }

  if (container.getAttribute("data-active-color") === currentVal && container.children.length === WORKSPACE_COLOR_DEFINITIONS.length) {
    return;
  }
  container.setAttribute("data-active-color", currentVal);

  container.innerHTML = "";
  for (const col of WORKSPACE_COLOR_DEFINITIONS) {
    const isSelected = col.id === currentVal;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.title = col.label;
    btn.setAttribute("aria-label", col.label);
    btn.style.cssText = [
      "width: 24px",
      "height: 24px",
      "border-radius: 6px",
      "background-color: " + col.hex,
      "cursor: pointer",
      "position: relative",
      "display: inline-flex",
      "align-items: center",
      "justify-content: center",
      "border: 1px solid rgba(255, 255, 255, 0.18)",
      "transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.15s ease, outline 0.15s ease, opacity 0.15s ease",
      "box-sizing: border-box",
      "padding: 0",
      isSelected
        ? "transform: scale(1.1); outline: 2px solid #ffffff; outline-offset: 2px; box-shadow: 0 0 0 1px #18181b, 0 2px 8px rgba(0,0,0,0.5); z-index: 2;"
        : "opacity: 0.8;"
    ].join(";");

    btn.onmouseenter = () => {
      if (btn.getAttribute("data-selected") !== "true") {
        btn.style.transform = "scale(1.15)";
        btn.style.opacity = "1";
        btn.style.zIndex = "1";
      }
    };
    btn.onmouseleave = () => {
      if (btn.getAttribute("data-selected") !== "true") {
        btn.style.transform = "scale(1)";
        btn.style.opacity = "0.8";
        btn.style.zIndex = "0";
      }
    };

    if (isSelected) {
      btn.setAttribute("data-selected", "true");
      const check = document.createElement("span");
      check.style.cssText = "color: #ffffff; display: flex; align-items: center; justify-content: center; pointer-events: none; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.6));";
      check.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 -960 960 960" fill="currentColor"><path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z"/></svg>';
      btn.appendChild(check);
    }

    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      applyWorkspaceTheme(col.id);
      if (input) {
        input.value = col.id;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
      if (window.BetterGravity && window.BetterGravity.plugins && window.BetterGravity.plugins.setSetting) {
        window.BetterGravity.plugins.setSetting("gemini-app", "workspaceColor", col.id);
      }
      enhanceWorkspaceColorSettings();
    };

    container.appendChild(btn);
  }
}

let settingsRafId = null;
function scheduleEnhanceWorkspaceColorSettings() {
  if (settingsRafId) return;
  settingsRafId = requestAnimationFrame(() => {
    settingsRafId = null;
    enhanceWorkspaceColorSettings();
  });
}

let settingsObserver = null;
function initSettingsObserver() {
  if (typeof document === "undefined" || settingsObserver) return;
  const target = document.body || document.documentElement;
  if (!target) return;
  scheduleEnhanceWorkspaceColorSettings();
  settingsObserver = new MutationObserver((mutations) => {
    for (let i = 0; i < mutations.length; i++) {
      const added = mutations[i].addedNodes;
      for (let j = 0; j < added.length; j++) {
        const node = added[j];
        if (node.nodeType === 1 && (node.matches?.('.settings-modal-container, [role="dialog"]') || node.querySelector?.('.settings-modal-container, [role="dialog"]'))) {
          scheduleEnhanceWorkspaceColorSettings();
          return;
        }
      }
    }
  });
  settingsObserver.observe(target, { childList: true, subtree: true });
}
if (typeof document !== "undefined") {
  if (document.body) {
    initSettingsObserver();
  } else {
    document.addEventListener("DOMContentLoaded", initSettingsObserver, { once: true });
  }
}


/**
 * Hand-written shortenings for models that are not Gemini. Each entry is a
 * pattern and a replacement; the first that matches wins.
 *
 * "Claude Opus 4.6 (Thinking)" → "Opus 4.6"; "Claude Sonnet 4.5" → "Sonnet 4.5".
 * "GPT-OSS 120B (Medium)" → "GPT-OSS".
 */
const VENDOR_RULES = [
  { pattern: /^Claude\s+(Opus|Sonnet|Haiku)\s+([\d.]+).*$/i, replace: "$1 $2" },
  { pattern: /^GPT-OSS\b.*$/i, replace: "GPT-OSS" }
];

/** Willow's rule: the word "Gemini" goes, and so does a trailing "Extended". */
const GEMINI_WORD = /\bGemini\s+/gi;
const GEMINI_SUFFIX = /\s+Extended$/i;

function shorten(fullName) {
  const name = fullName.replace(/\s+/g, " ").trim();
  if (!name) return fullName;
  for (const rule of VENDOR_RULES) {
    if (rule.pattern.test(name)) return name.replace(rule.pattern, rule.replace).trim();
  }
  return name.replace(GEMINI_WORD, "").replace(GEMINI_SUFFIX, "").trim();
}

// Only the pill in the prompt box. The same trigger component may appear
// elsewhere; those keep full names, as the model menu does.
const PILL_SELECTOR = '[data-testid="agent-input-box"] [data-testid="model-selector-trigger"]';

/**
 * The name is the first text node inside the pill's label span. It is edited in
 * place rather than replaced: React holds a reference to that very node and
 * writes the next model's name into it, so replacing it would leave the pill
 * frozen on whatever it said when the plugin started.
 */
function nameNode(pill) {
  const label = pill.querySelector("span");
  if (!label) return null;
  for (const node of label.childNodes) {
    if (node.nodeType === Node.TEXT_NODE && node.data.trim()) return node;
  }
  return null;
}

function apply(pill) {
  const node = nameNode(pill);
  if (!node) return;
  const current = node.data;
  const short = shorten(current);
  // A name that shortens to itself is either already short or not ours to touch.
  if (short === current) return;
  // The full name stays on the pill, for the theme to use and for switching
  // the plugin off to restore.
  pill.dataset.fullModelName = current.trim();
  node.data = short;
}

/* ---------------------------------------------------------------------------
 * Element-scoped observers, held weakly
 * ---------------------------------------------------------------------------
 * This was a `Map` keyed by the element, and the elements kept here are the
 * short-lived ones: a tooltip for every hover, a language label for every code
 * block in every reply, a row for every conversation ever scrolled past. A
 * detached tooltip that nothing can reach is collected together with the
 * observer watching it; one sitting in a `Map` is reachable forever. So the
 * renderer's heap only ever grew, and a long session ended in the window dying
 * outright rather than in anything getting slower first.
 *
 * A `WeakMap` cannot be walked, and switching the plugin off has to walk this
 * to disconnect everything. So the elements are held weakly and one `WeakRef`
 * per element is kept alongside for that walk: the ref outlives its element,
 * the element is free to go, and refs whose element has gone are dropped as
 * they are noticed. What is left growing is a pointer-sized object per element
 * instead of the element, its subtree and its observer.
 * ------------------------------------------------------------------------- */
const observers = new WeakMap();
const observed = new Set();

/** Page listeners must leave with this instance when the plugin reloads. */
function listenToPage(target, type, listener, options) {
  target.addEventListener(type, listener, options);
  plugin.onDispose(() => target.removeEventListener(type, listener, options));
}

/** Refs whose element has been collected, dropped in a batch now and then. */
function pruneObserved() {
  if (observed.size < 512) return;
  for (const ref of observed) {
    if (!ref.deref()) observed.delete(ref);
  }
}

/** Every element still on the heap with its disposer, for the passes below. */
function rememberedObservers() {
  const entries = [];
  for (const ref of observed) {
    const element = ref.deref();
    if (!element) {
      observed.delete(ref);
      continue;
    }
    const disposer = observers.get(element);
    if (disposer) entries.push([element, disposer]);
  }
  return entries;
}

/**
 * A conversation row is watched by two separate observers, so keying the map by
 * element alone loses whichever registered first. Chain them instead: dispose
 * calls both, and neither leaks.
 */
function remember(element, disposer) {
  const existing = observers.get(element);
  if (existing) {
    observers.set(element, {
      disconnect: () => {
        existing.disconnect();
        disposer.disconnect();
      }
    });
    return;
  }
  observers.set(element, disposer);
  observed.add(new WeakRef(element));
  pruneObserved();
}

function listenToElement(element, type, listener, options) {
  element.addEventListener(type, listener, options);
  remember(element, { disconnect: () => element.removeEventListener(type, listener, options) });
}

plugin.dom.observe(PILL_SELECTOR, (pill) => {
  apply(pill);
  // React writes the new name into the existing text node when the model
  // changes, and rebuilds the span outright in some updates. Both are caught
  // here. Writing the short name triggers the observer once more, but a short
  // name shortens to itself, so that pass does nothing and the loop ends.
  const observer = new MutationObserver(() => apply(pill));
  observer.observe(pill, { subtree: true, childList: true, characterData: true });
  remember(pill, observer);
});

/* ---------------------------------------------------------------------------
 * Left sidebar: "New conversation" row and collapse motion
 * ------------------------------------------------------------------------- */
const NEW_CONV_SELECTOR = '[data-testid="new-conversation-button"]';
const SIDEBAR_SELECTOR = '[role="navigation"][aria-label="Sidebar"]';
const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPod|iPad/i.test(navigator.userAgent);
const NEW_CONV_SHORTCUT = isMac ? "⌘+Shift+O" : "Ctrl+Shift+O";

function newConvLabelNode(btn) {
  const label = btn.querySelector(".truncate") || btn.querySelector("span:last-child");
  if (!label) return null;
  for (const node of label.childNodes) {
    if (node.nodeType === Node.TEXT_NODE && (node.data.trim() === "New Conversation" || node.data.trim() === "New conversation" || node.data.trim() === "New chat")) {
      return node;
    }
  }
  return null;
}

/* The current-destination pill is drawn from Antigravity's own state, not from
 * anything marked here: every sidebar nav row is one `SideBarButton` taking a
 * `selected` prop, and it spends that prop on the class `bg-sidebar-secondary`,
 * which styles/sidebar.css reads directly. A `data-active` attribute used to be
 * set here from `location.pathname`, and it went stale the moment the router
 * navigated by pushState — leaving "New Conversation" lit while a conversation
 * was open. The app's own class cannot go stale. */
function applyNewConv(btn) {
  const node = newConvLabelNode(btn);
  if (node && node.data.trim() === "New chat") {
    node.data = "New conversation";
  }
  if (!btn.hasAttribute("data-shortcut")) {
    btn.setAttribute("data-shortcut", NEW_CONV_SHORTCUT);
  }
}

plugin.dom.observe(NEW_CONV_SELECTOR, (btn) => {
  applyNewConv(btn);
  const observer = new MutationObserver(() => applyNewConv(btn));
  observer.observe(btn, { subtree: true, childList: true, characterData: true });
  btn.addEventListener('click', handleNewConversationActivation, true);
  remember(btn, {
    disconnect: () => {
      btn.removeEventListener('click', handleNewConversationActivation, true);
      observer.disconnect();
    }
  });
});

// Willow's exact sidebar widths (expanded = 288px, collapsed = 52px) and motion curve
const WILLOW_SIDEBAR_EXPANDED_WIDTH = "288px";
const WILLOW_SIDEBAR_COLLAPSED_WIDTH = "52px";
const WILLOW_SIDEBAR_TRANSITION = "width 300ms cubic-bezier(0.2, 0, 0, 1), background-color 300ms cubic-bezier(0.2, 0, 0, 1)";
const TOGGLE_SELECTOR = 'button[data-testid="sidebar-toggle"][aria-label="Toggle Sidebar"]';

function getMainSidebarToggle() {
  return document.querySelector('.absolute.top-0.left-0 button[data-testid="sidebar-toggle"]') ||
         document.querySelector('div.absolute.top-0.left-0 button[data-testid="sidebar-toggle"]') ||
         document.querySelector('button[data-testid="sidebar-toggle"][aria-label="Toggle Sidebar"]') ||
         document.querySelector('button[data-testid="sidebar-toggle"]');
}

function isSidebarCollapsed() {
  const toggle = getMainSidebarToggle();
  if (toggle && toggle.hasAttribute("aria-expanded")) {
    return toggle.getAttribute("aria-expanded") === "false";
  }
  const sidebar = document.querySelector(SIDEBAR_SELECTOR);
  return sidebar?.getAttribute("data-collapsed") === "true";
}

let isEnforcingSidebarGeometry = false;

function enforceSidebarGeometry(grandParent, collapsed) {
  if (!grandParent || isEnforcingSidebarGeometry) return;
  isEnforcingSidebarGeometry = true;
  try {
    const targetWidth = collapsed ? WILLOW_SIDEBAR_COLLAPSED_WIDTH : WILLOW_SIDEBAR_EXPANDED_WIDTH;
    if (grandParent.style.width !== targetWidth) {
      grandParent.style.width = targetWidth;
    }
    if (grandParent.style.minWidth !== "0px") {
      grandParent.style.minWidth = "0px";
    }
    if (grandParent.style.visibility !== "visible") {
      grandParent.style.visibility = "visible";
    }
    if (grandParent.style.maxWidth !== "none") {
      grandParent.style.maxWidth = "none";
    }
    if (grandParent.style.transition !== WILLOW_SIDEBAR_TRANSITION) {
      grandParent.style.transition = WILLOW_SIDEBAR_TRANSITION;
    }
    const child = grandParent.firstElementChild;
    if (child) {
      if (child.style.width !== "100%") {
        child.style.width = "100%";
      }
      if (child.style.minWidth !== "0px") {
        child.style.minWidth = "0px";
      }
      if (child.style.maxWidth !== "none") {
        child.style.maxWidth = "none";
      }
      if (child.style.transition !== "none") {
        child.style.transition = "none";
      }
      const targetLeft = "0px";
      if (child.style.left !== targetLeft) {
        child.style.left = targetLeft;
      }
      const targetRight = "auto";
      if (child.style.right !== targetRight) {
        child.style.right = targetRight;
      }
      const sidebar = child.querySelector(SIDEBAR_SELECTOR);
      if (sidebar) {
        if (sidebar.style.width !== "100%") {
          sidebar.style.width = "100%";
        }
        if (sidebar.style.minWidth !== "0px") {
          sidebar.style.minWidth = "0px";
        }
        if (sidebar.style.maxWidth !== "none") {
          sidebar.style.maxWidth = "none";
        }
        if (sidebar.style.transition !== "none") {
          sidebar.style.transition = "none";
        }
      }
    }
  } finally {
    isEnforcingSidebarGeometry = false;
  }
}

function ensureSidebarHeader(sidebar, collapsed) {
  const header = sidebar?.querySelector(':scope > div.shrink-0.flex.items-center') ||
                 (sidebar?.firstElementChild?.id === "gemini-experience-switch" ? sidebar?.children[1] : sidebar?.firstElementChild);
  if (!header) return;

  let logoBtn = header.querySelector(".gemini-logo-btn");
  if (!logoBtn) {
    logoBtn = document.createElement("button");
    logoBtn.type = "button";
    logoBtn.className = "gemini-logo-btn";
    logoBtn.innerHTML = `
      <div class="gemini-logo-wrap">
        <div class="gemini-logo-mark"></div>
      </div>
      <div class="gemini-logo-expand-wrap">
        <span class="gemini-logo-expand-icon">side_nav_expand</span>
      </div>
    `;
    logoBtn.addEventListener("click", () => {
      const sb = document.querySelector(SIDEBAR_SELECTOR);
      if (!sb) return;
      const willCollapse = !isSidebarCollapsed();
      sb.setAttribute("data-collapsed", String(willCollapse));
      document.documentElement.setAttribute("data-sidebar-collapsed", String(willCollapse));
      const gp = sb.parentElement?.parentElement;
      if (gp) enforceSidebarGeometry(gp, willCollapse);
      const toggle = getMainSidebarToggle();
      if (toggle) toggle.click();
      ensureExperienceSwitch(sb);
      ensureScrollNav();
      updateSidebarItemsState(sb, willCollapse);
    });
    header.prepend(logoBtn);
  }

  const logoLabel = collapsed ? "Expand sidebar" : "Collapse sidebar";
  if (logoBtn.getAttribute("aria-label") !== logoLabel) {
    logoBtn.setAttribute("aria-label", logoLabel);
  }
  const logoTitle = collapsed ? "Expand sidebar" : "";
  if (logoBtn.getAttribute("title") !== logoTitle && !logoBtn.hasAttribute("data-willow-tooltip")) {
    if (logoTitle) logoBtn.setAttribute("title", logoTitle);
    else logoBtn.removeAttribute("title");
  }
  const logoPos = collapsed ? "right" : "below";
  if (logoBtn.getAttribute("data-tooltip-position") !== logoPos) {
    logoBtn.setAttribute("data-tooltip-position", logoPos);
  }

  let textSpan = header.querySelector(".willow-sidenav-text");
  if (!textSpan) {
    textSpan = document.createElement("span");
    textSpan.className = "willow-sidenav-text";
    textSpan.textContent = "Antigravity";
    logoBtn.after(textSpan);
  }
}

function updateSidebarItemsState(sidebar, collapsed) {
  const navSpecs = [
    { selector: '[data-testid="new-conversation-button"]', title: "New conversation" },
    { selector: '[data-testid="history-button"]', title: "History" },
    { selector: '#gemini-skills-button', title: "Skills" },
    { selector: '#gemini-scheduled-tasks-button', title: "Scheduled tasks" },
    { selector: '[data-testid="automations-button"]', title: "Scheduled tasks" },
    { selector: '#gemini-new-project-button', title: "New project" },
    { selector: '#gemini-display-options-button', title: "Display options" },
    { selector: '[data-testid="settings-button"]', title: "Settings" }
  ];

  for (const spec of navSpecs) {
    const el = sidebar.querySelector(spec.selector) || document.querySelector(spec.selector);
    if (el) {
      if (collapsed) {
        if (el.getAttribute("data-tooltip-position") !== "right") {
          el.setAttribute("data-tooltip-position", "right");
        }
        if (!el.getAttribute("title") && !el.hasAttribute("data-willow-tooltip")) {
          el.setAttribute("title", spec.title);
        }
      } else {
        if (el.getAttribute("data-tooltip-position") === "right") {
          el.removeAttribute("data-tooltip-position");
        }
      }
    }
  }

  const pluginButtons = sidebar.querySelectorAll('[data-bettergravity-button]');
  for (const btn of pluginButtons) {
    if (collapsed) {
      if (btn.getAttribute("data-tooltip-position") !== "right") {
        btn.setAttribute("data-tooltip-position", "right");
      }
    } else {
      if (btn.getAttribute("data-tooltip-position") === "right") {
        btn.removeAttribute("data-tooltip-position");
      }
    }
  }

  const userPill = sidebar.querySelector("#gemini-sidebar-user-pill");
  if (userPill) {
    if (collapsed) {
      userPill.setAttribute("data-tooltip-position", "right");
    } else {
      userPill.removeAttribute("data-tooltip-position");
    }
  }
}

function syncSidebarState(sidebar) {
  if (!sidebar) return;
  const grandParent = sidebar.parentElement?.parentElement;
  const collapsed = isSidebarCollapsed();

  enforceSidebarGeometry(grandParent, collapsed);
  if (sidebar.getAttribute("data-collapsed") !== String(collapsed)) {
    sidebar.setAttribute("data-collapsed", String(collapsed));
  }
  if (document.documentElement.getAttribute("data-sidebar-collapsed") !== String(collapsed)) {
    document.documentElement.setAttribute("data-sidebar-collapsed", String(collapsed));
  }

  const exp = getStoredExperience();
  if (sidebar.getAttribute("data-gemini-experience") !== exp) {
    sidebar.setAttribute("data-gemini-experience", exp);
  }
  if (document.documentElement.getAttribute("data-gemini-experience") !== exp) {
    document.documentElement.setAttribute("data-gemini-experience", exp);
  }

  ensureSidebarHeader(sidebar, collapsed);
  sidebar.querySelector(".gemini-sidebar-expand-rail")?.remove();
  ensureExperienceSwitch(sidebar);
  ensureScrollNav();
  updateSidebarItemsState(sidebar, collapsed);
}


/* ---------------------------------------------------------------------------
 * The Chat / Work switch
 *
 * Willow draws a segmented pill under the sidebar's header band
 * (apps/studio/src/shell/sidebar/Sidebar.tsx:1579-1704) to move between its two
 * experiences. Antigravity has no such control, so this is one of the few
 * places where there is no host markup to restyle: the pill is built here and
 * drawn by styles/sidebar.css, the same split the added nav rows below use.
 *
 * It selects between Chat (standalone conversations) and Work (projects and
 * their conversations).
 * ------------------------------------------------------------------------- */
const EXPERIENCES = [
  { id: "chat", label: "Chat" },
  // Willow's second tab reads "Spark". Here it is "Work".
  { id: "work", label: "Work", badge: "beta" }
];

const conversationProjectMap = new Map();

const EXPERIENCE_STORAGE_KEY = "bettergravity-experience";

function getStoredExperience() {
  try {
    const val = localStorage.getItem(EXPERIENCE_STORAGE_KEY);
    if (val === "work" || val === "chat") return val;
  } catch {}
  return "chat";
}

try {
  document.documentElement.setAttribute("data-gemini-experience", getStoredExperience());
} catch {}

function setStoredExperience(val) {
  try {
    localStorage.setItem(EXPERIENCE_STORAGE_KEY, val);
  } catch {}
}

const EXPERIENCE_LABELS = new Map(EXPERIENCES.map((experience) => [experience.id, experience.label]));

let activeGoToNewConversation = null;
let firstDiscoveredProjectId = null;
const LAST_PROJECT_STORAGE_KEY = 'bettergravity-last-project-id';

function getLastSelectedProjectId() {
  try {
    const val = localStorage.getItem(LAST_PROJECT_STORAGE_KEY);
    if (val && val !== 'outside-of-project') return val;
  } catch {}
  return firstDiscoveredProjectId;
}

function setLastSelectedProjectId(projId) {
  if (!projId || projId === 'outside-of-project') return;
  try {
    localStorage.setItem(LAST_PROJECT_STORAGE_KEY, projId);
  } catch {}
}

const newConversationCallbacks = new WeakMap();

function isNewConversationCallback(fn) {
  if (typeof fn !== 'function') return false;
  let matches = newConversationCallbacks.get(fn);
  if (matches === undefined) {
    matches = fn.toString().includes('AGENT_MANAGER_HOME');
    newConversationCallbacks.set(fn, matches);
  }
  return matches;
}

function getGoToNewConversation() {
  if (typeof activeGoToNewConversation === 'function') {
    return activeGoToNewConversation;
  }
  const navBtn = document.querySelector('[data-testid="new-conversation-button"]');
  if (navBtn) {
    let fiber = null;
    for (const k in navBtn) {
      if (k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance')) {
        fiber = navBtn[k];
        break;
      }
    }
    let curr = fiber;
    while (curr) {
      let h = curr.memoizedState;
      while (h) {
        const v = h.memoizedState;
        const fn = typeof v === 'function' ? v : (Array.isArray(v) && typeof v[0] === 'function' ? v[0] : null);
        if (isNewConversationCallback(fn)) {
          activeGoToNewConversation = fn;
          return fn;
        }
        h = h.next;
      }
      curr = curr.return;
    }
  }
  return null;
}

function navigateToExperienceNewConversation(exp) {
  const fn = getGoToNewConversation();
  if (exp === 'chat') {
    if (typeof fn === 'function') {
      fn('outside-of-project');
    } else {
      const secPlusBtn = document.querySelector('[data-testid="section-header"] button[aria-label="New Conversation"]');
      if (secPlusBtn) {
        const props = plugin.react.getProps(secPlusBtn);
        if (typeof props?.onClick === 'function') {
          props.onClick({ preventDefault: () => {}, stopPropagation: () => {} });
        } else {
          secPlusBtn.click();
        }
      } else {
        const url = new URL(window.location.href);
        url.pathname = '/';
        url.search = '?section=outside-of-project';
        window.location.href = url.toString();
      }
    }
    return;
  }

  if (exp === 'work') {
    let targetProjId = getLastSelectedProjectId();
    if (!targetProjId) {
      const firstCard = document.querySelector('button[data-project-card="true"]');
      if (firstCard) {
        let curr = plugin.react.getFiber(firstCard);
        while (curr) {
          const pid = curr.memoizedProps?.sectionId || curr.memoizedProps?.projectId || curr.memoizedProps?.item?.id;
          if (pid) {
            targetProjId = String(pid).replace(/^header-/, '');
            setLastSelectedProjectId(targetProjId);
            break;
          }
          curr = curr.return;
        }
      }
    }

    if (typeof fn === 'function') {
      if (targetProjId) {
        fn(targetProjId);
      } else {
        fn();
      }
    } else {
      const projPlusBtn = document.querySelector('[data-testid="project-group"] button[aria-label="New Conversation"]');
      if (projPlusBtn) {
        const props = plugin.react.getProps(projPlusBtn);
        if (typeof props?.onClick === 'function') {
          props.onClick({ preventDefault: () => {}, stopPropagation: () => {} });
        } else {
          projPlusBtn.click();
        }
      } else {
        const url = new URL(window.location.href);
        url.pathname = '/';
        if (targetProjId) {
          url.search = `?section=${encodeURIComponent(targetProjId)}`;
        }
        window.location.href = url.toString();
      }
    }
  }
}

/**
 * Willow gives the tooltip to the inactive tab only, so it names where you
 * would go rather than where you are (Sidebar.tsx:1636 and :1661, each passing
 * `undefined` for its own tab). Willow's also names a keyboard shortcut; there
 * is none here, so the text stops at the destination.
 *
 * Clearing it takes two attributes, not one. The tooltip engine further down
 * this file moves `title` into `data-willow-tooltip` the first time an element
 * is hovered and reads it back from there, so a tab that has been pointed at
 * once no longer holds the text in `title` — dropping only that would leave the
 * active tab still offering to switch to itself.
 */
// observe() also mounts existing elements during a live reload. The top-chip
// state is initialized later in this file, before its own initial reconciliation.
let topChipsReady = false;

function markExperience(pill, selected, shouldRerender = true) {
  setStoredExperience(selected);
  pill.dataset.geminiExperience = selected;
  document.documentElement.setAttribute("data-gemini-experience", selected);
  const sidebar = pill.closest(SIDEBAR_SELECTOR) || document.querySelector(SIDEBAR_SELECTOR);
  if (sidebar) sidebar.setAttribute("data-gemini-experience", selected);

  for (const tab of pill.querySelectorAll("[data-gemini-experience-tab]")) {
    const isSelected = tab.dataset.geminiExperienceTab === selected;
    tab.setAttribute("aria-pressed", String(isSelected));
    if (isSelected) {
      tab.removeAttribute("title");
      tab.removeAttribute("data-willow-tooltip");
    } else {
      // Written afresh rather than left to the stash: the engine only opens for
      // an element matching `[title]`, so restoring it is what lets the tooltip
      // come back after the tab has been active.
      tab.title = `Switch to ${EXPERIENCE_LABELS.get(tab.dataset.geminiExperienceTab)}`;
      tab.removeAttribute("data-willow-tooltip");
    }
  }

  const collapsedBtn = pill.querySelector(".gemini-experience-collapsed-btn");
  if (collapsedBtn) {
    const isWork = selected === "work";
    collapsedBtn.setAttribute("aria-pressed", String(isWork));
    const nextTarget = isWork ? "Chat" : "Work";
    collapsedBtn.title = `Switch to ${nextTarget}`;
    collapsedBtn.setAttribute("aria-label", `Switch to ${nextTarget}`);
    collapsedBtn.removeAttribute("data-willow-tooltip");
  }

  // Reset scroll position on switch so the active list starts from the top
  const scroller = document.querySelector(LIST_SELECTOR);
  if (scroller) scroller.scrollTop = 0;

  ensureScrollNav();
  if (topChipsReady) {
    reconcileTopChips();
  }
  if (shouldRerender) {
    triggerListRerender();
  }
  updateExperienceSwitchDots(pill);
}

function getElementFiber(element) {
  if (!element) return null;
  if (typeof plugin?.react?.getFiber === 'function') {
    return plugin.react.getFiber(element);
  }
  const key = Object.keys(element).find((k) => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
  return key ? element[key] : null;
}

let hostReduxStore = null;
let hostStoreUnsubscribe = null;

function getHostStore() {
  if (hostReduxStore && typeof hostReduxStore.getState === 'function') return hostReduxStore;
  const anchors = [
    document.querySelector('[data-testid="conversation-view"]'),
    document.querySelector('[data-testid="conversation-row-sidebar"]'),
    document.querySelector('#gemini-experience-switch'),
    document.body
  ];
  for (const anchor of anchors) {
    if (!anchor) continue;
    let fiber = getElementFiber(anchor);
    for (let depth = 0; fiber && depth < 40; depth += 1, fiber = fiber.return) {
      const s = fiber.memoizedProps?.store;
      if (typeof s?.getState === 'function') {
        hostReduxStore = s;
        return s;
      }
      let dep = fiber.dependencies?.firstContext;
      for (let i = 0; dep && i < 30; i += 1, dep = dep.next) {
        const depStore = dep.memoizedValue?.store;
        if (typeof depStore?.getState === 'function') {
          hostReduxStore = depStore;
          return depStore;
        }
      }
    }
  }
  return null;
}

function parseExperienceTimestamp(timeObj) {
  if (!timeObj) return 0;
  return Number(timeObj.seconds || 0) + Number(timeObj.nanos || 0) / 1e9;
}

function isEligibleConversation(summary) {
  if (!summary) return false;
  if (summary.annotations?.archived) return false;
  if (summary.trajectoryMetadata?.isBattleModeFork || summary.trajectoryMetadata?.parentConversationId) return false;
  if (summary.trajectoryType === 2 || summary.trajectoryType === 3) return false;
  return true;
}

const RECENT_UNREAD_WINDOW_SECONDS = 7 * 86400;

function isConversationCompletedUnread(summary, cascadeId, activeCascadeId, localViewTime, isDocumentFocused) {
  if (!cascadeId) return false;
  if (cascadeId === activeCascadeId && isDocumentFocused) return false;
  if (!isEligibleConversation(summary)) return false;

  const modSec = Number(summary.lastModifiedTime?.seconds || 0);
  if (!modSec) return false;

  const now = Date.now() / 1000;
  if (now - modSec > RECENT_UNREAD_WINDOW_SECONDS) return false;

  if (summary.waitingSteps && summary.waitingSteps.length > 0) return true;
  if (summary.notFullyIdle) return false;
  if (summary.annotations?.markedAsUnread) return true;

  const viewSec = parseExperienceTimestamp(summary.annotations?.lastUserViewTime);
  const localSec = Number(localViewTime || 0);
  const lastSeen = Math.max(viewSec, localSec);

  return modSec > lastSeen;
}

function setExperienceUnreadIndicator(element, unread) {
  if (!element) return;
  // Store updates arrive during streaming even when the unread state is stable.
  // Avoid invalidating the sidebar's styles for an identical attribute value.
  if (unread) {
    if (element.getAttribute('data-has-unread') !== 'true') element.setAttribute('data-has-unread', 'true');
  } else if (element.hasAttribute('data-has-unread')) {
    element.removeAttribute('data-has-unread');
  }
}

function updateExperienceSwitchDots(switchElement) {
  const pills = switchElement ? [switchElement] : Array.from(document.querySelectorAll('#gemini-experience-switch'));
  if (pills.length === 0) return;

  const store = getHostStore();
  if (!store) return;

  if (!hostStoreUnsubscribe && typeof store.subscribe === 'function') {
    hostStoreUnsubscribe = store.subscribe(() => {
      updateExperienceSwitchDots();
    });
  }

  const state = store.getState();
  const summaries = state?.trajectorySummaries?.summaries || {};
  const sections = state?.conversation?.sidebarSections || [];
  const localTimes = state?.conversation?.localLastViewedTimes || {};
  const urlMatch = typeof window !== 'undefined' && window.location?.pathname ? window.location.pathname.match(/\/c\/([a-zA-Z0-9_-]+)/) : null;
  const activeCascadeId = state?.conversation?.convoState?.cascadeId || state?.conversation?.activeCascadeId || (urlMatch ? urlMatch[1] : '');
  const isDocumentFocused = typeof document.hasFocus === 'function' ? document.hasFocus() : true;

  const chatIds = new Set();
  const workIds = new Set();

  for (const sec of sections) {
    const isChat = sec.id === 'outside-of-project';
    const targetSet = isChat ? chatIds : workIds;
    for (const id of (sec.conversationIds || [])) {
      targetSet.add(id);
    }
  }

  let hasUnreadChat = false;
  for (const cid of chatIds) {
    if (isConversationCompletedUnread(summaries[cid], cid, activeCascadeId, localTimes[cid], isDocumentFocused)) {
      hasUnreadChat = true;
      break;
    }
  }

  let hasUnreadWork = false;
  for (const cid of workIds) {
    if (isConversationCompletedUnread(summaries[cid], cid, activeCascadeId, localTimes[cid], isDocumentFocused)) {
      hasUnreadWork = true;
      break;
    }
  }

  if (!hasUnreadWork && typeof conversationProjectMap !== 'undefined' && conversationProjectMap.size > 0) {
    for (const [key] of conversationProjectMap) {
      const cid = key.endsWith(':groupId') ? key.slice(0, -8) : key;
      if (cid && !workIds.has(cid)) {
        if (isConversationCompletedUnread(summaries[cid], cid, activeCascadeId, localTimes[cid], isDocumentFocused)) {
          hasUnreadWork = true;
          break;
        }
      }
    }
  }

  for (const pill of pills) {
    setExperienceUnreadIndicator(pill.querySelector('[data-gemini-dot="chat"]'), hasUnreadChat);
    setExperienceUnreadIndicator(pill.querySelector('[data-gemini-dot="work"]'), hasUnreadWork);

    const collapsedBtn = pill.querySelector('.gemini-experience-collapsed-btn');
    if (collapsedBtn) {
      const currentExp = pill.dataset.geminiExperience || getStoredExperience();
      const hasInactiveUnread = currentExp === 'chat' ? hasUnreadWork : hasUnreadChat;
      setExperienceUnreadIndicator(collapsedBtn, hasInactiveUnread);
    }
  }
}

function buildExperienceSwitch() {
  const pill = document.createElement("div");
  pill.id = "gemini-experience-switch";

  const track = document.createElement("div");
  track.dataset.geminiExperienceTrack = "";
  const slider = document.createElement("div");
  slider.dataset.geminiExperienceSlider = "";
  track.append(slider);

  const tabsWrap = document.createElement("div");
  tabsWrap.className = "gemini-experience-tabs-wrap";

  for (const experience of EXPERIENCES) {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.dataset.geminiExperienceTab = experience.id;
    const dot = document.createElement("span");
    dot.className = "gemini-experience-dot";
    dot.dataset.geminiDot = experience.id;
    dot.setAttribute("aria-hidden", "true");
    tab.append(dot);
    const label = document.createElement("span");
    label.dataset.geminiExperienceLabel = "";
    label.textContent = experience.label;
    tab.append(label);
    if (experience.badge) {
      const badge = document.createElement("span");
      badge.dataset.geminiExperienceBadge = "";
      // "beta" in the markup, BETA on screen: the uppercasing is Willow's, in CSS.
      badge.textContent = experience.badge;
      tab.append(badge);
    }
    tab.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      markExperience(pill, experience.id, true);
      navigateToExperienceNewConversation(experience.id);
    });
    tabsWrap.append(tab);
  }
  track.append(tabsWrap);

  const collapsedBtn = document.createElement("button");
  collapsedBtn.type = "button";
  collapsedBtn.className = "gemini-experience-collapsed-btn";
  collapsedBtn.setAttribute("data-tooltip-position", "right");
  collapsedBtn.innerHTML = `
    <svg class="gemini-experience-collapsed-icon" width="20" height="13" viewBox="0 0 20 13" fill="none">
      <rect x="0.8" y="0.8" width="18.4" height="11.4" rx="5.7" stroke="currentColor" stroke-width="1.6"/>
      <circle cx="5.7" cy="6.5" r="2.6" fill="currentColor" class="gemini-switch-dot"/>
    </svg>
    <span class="gemini-experience-collapsed-dot" aria-hidden="true"></span>
  `;
  collapsedBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const current = pill.dataset.geminiExperience || getStoredExperience();
    const next = current === "chat" ? "work" : "chat";
    markExperience(pill, next, true);
    navigateToExperienceNewConversation(next);
  });
  track.append(collapsedBtn);

  pill.append(track);
  markExperience(pill, getStoredExperience(), false);
  updateExperienceSwitchDots(pill);
  return pill;
}

/** Directly under the header band, where Willow has it, and back there if a
 * re-render moves it. The selection lives on the element, so a pill that is
 * only re-seated keeps the tab the user chose. */
function ensureExperienceSwitch(sidebar) {
  if (!sidebar) return;
  const header = sidebar.querySelector(':scope > div.shrink-0.flex.items-center') ||
                 (sidebar.firstElementChild?.id === "gemini-experience-switch" ? null : sidebar.firstElementChild);
  if (!header) return;
  const pills = document.querySelectorAll("#gemini-experience-switch");
  const pill = pills[0] ?? buildExperienceSwitch();
  for (let i = 1; i < pills.length; i++) pills[i].remove();
  if (header.nextElementSibling !== pill) header.after(pill);

  const exp = getStoredExperience();
  if (pill.dataset.geminiExperience !== exp) {
    markExperience(pill, exp, false);
  }
  updateExperienceSwitchDots(pill);
}

/* ---------------------------------------------------------------------------
 * The scrolling half of the navigation (Sidebar.tsx:1881-1925)
 *
 * Willow pins two rows and no more. Its fixed block is labelled "Fixed
 * top-level navigation: Home & Search" and holds New chat and Search chats
 * (Sidebar.tsx:1882-1910); Code, Media, every section heading and every chat
 * live in the scroller below it (1919-1925) and scroll away. Antigravity pins
 * its whole nav block, so Scheduled Tasks, New project and Display options hold
 * the top of the rail while the list moves under them.
 *
 * Those three go into the scroller instead, above the chat list. Two are this
 * plugin's own rows and are simply built there. The third is Antigravity's
 * Scheduled Tasks row, and that one is deliberately NOT moved: main.js renders
 * it inside `D && <Fragment>` with two conditional rows after it (`C && !w` for
 * UI Plugins, `w &&` for the toolbox), so React may call
 * `insertBefore(row, automationsButton)` or `removeChild(automationsButton)` on
 * the nav column whenever one of those flags flips. Both throw NotFoundError
 * once that node is somewhere else, and a throw inside a commit takes the
 * sidebar with it. So it stays where React put it, hidden by styles/sidebar.css,
 * and the row below carries its glyph, its label, its selected state and its
 * clicks. When Antigravity does not render it at all, neither does this.
 *
 * The chat list is a virtualiser and does not know it now starts 96px lower. It
 * absorbs that because it overscans generously: measured live at 0, 200 and
 * 600px and at 25/50/75/100% of the range, ~230px is rendered above the viewport
 * and ~430px below it, and no blank band ever reaches an edge.
 * ------------------------------------------------------------------------- */
const AUTOMATIONS_SELECTOR = '[data-testid="automations-button"]';
const LIST_SELECTOR = '[data-testid="conversation-list-sidebar"]';

/** A bare row in this plugin's own shape; styles/sidebar.css draws the rest. */
function navRow(id) {
  const btn = document.createElement('button');
  btn.id = id;
  btn.className = 'gemini-nav-item';
  btn.setAttribute('type', 'button');
  return btn;
}

function triggerNativeProjectAction(actionText) {
  let orig = document.querySelector('[data-testid="sidebar-add-project-button"]');
  if (!orig) {
    const scroller = document.querySelector('[data-testid="conversation-list-sidebar"]');
    if (scroller) scroller.scrollTop = 0;
    orig = document.querySelector('[data-testid="sidebar-add-project-button"]');
  }
  if (!orig) return;

  const obs = new MutationObserver(() => {
    const btns = Array.from(document.querySelectorAll('button.main-row-trigger'));
    const target = btns.find(b => b.innerText.toLowerCase().includes(actionText.toLowerCase()));
    if (target) {
      obs.disconnect();
      target.click();
    }
  });

  obs.observe(document.body, { childList: true, subtree: true });
  orig.click();

  setTimeout(() => obs.disconnect(), 2000);
}

function openNewProjectDialog() {
  const existing = document.getElementById('gemini-new-project-dialog-host');
  if (existing) {
    existing.querySelector('.willow-gdlg-option-card')?.focus();
    return;
  }

  const host = document.createElement('div');
  host.id = 'gemini-new-project-dialog-host';
  host.className = 'willow-gdlg-host';

  const backdrop = document.createElement('div');
  backdrop.className = 'willow-gdlg-backdrop';
  backdrop.setAttribute('aria-hidden', 'true');

  const surface = document.createElement('div');
  surface.className = 'willow-gdlg-surface';
  surface.setAttribute('role', 'dialog');
  surface.setAttribute('aria-modal', 'true');
  surface.setAttribute('aria-label', 'New project');
  surface.tabIndex = -1;
  surface.style.maxWidth = '460px';

  const title = document.createElement('h2');
  title.className = 'willow-gdlg-title';
  title.textContent = 'New project';

  const content = document.createElement('div');
  content.className = 'willow-gdlg-content';
  content.style.paddingTop = '20px';

  const list = document.createElement('div');
  list.className = 'willow-gdlg-options-list';

  // Option 1: New project
  const optNewProj = document.createElement('button');
  optNewProj.type = 'button';
  optNewProj.className = 'willow-gdlg-option-card';
  optNewProj.innerHTML = `
    <div class="willow-gdlg-option-icon">
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        <line x1="12" y1="11" x2="12" y2="17"></line>
        <line x1="9" y1="14" x2="15" y2="14"></line>
      </svg>
    </div>
    <div class="willow-gdlg-option-info">
      <span class="willow-gdlg-option-title">New Project</span>
      <span class="willow-gdlg-option-desc">Open or choose an existing project folder</span>
    </div>
  `;

  // Option 2: Quick start
  const optQuickStart = document.createElement('button');
  optQuickStart.type = 'button';
  optQuickStart.className = 'willow-gdlg-option-card';
  optQuickStart.innerHTML = `
    <div class="willow-gdlg-option-icon">
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
      </svg>
    </div>
    <div class="willow-gdlg-option-info">
      <span class="willow-gdlg-option-title">Quick Start</span>
      <span class="willow-gdlg-option-desc">Start immediately with an empty scratch workspace</span>
    </div>
  `;

  list.appendChild(optNewProj);
  list.appendChild(optQuickStart);
  content.appendChild(list);

  const actions = document.createElement('div');
  actions.className = 'willow-gdlg-actions';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'willow-gdlg-pill';
  cancelBtn.innerHTML = '<span class="willow-gdlg-pill__label">Cancel</span>';

  actions.appendChild(cancelBtn);

  surface.appendChild(title);
  surface.appendChild(content);
  surface.appendChild(actions);

  host.appendChild(backdrop);
  host.appendChild(surface);
  document.body.appendChild(host);

  let isClosing = false;
  const closeDialog = (callback) => {
    if (isClosing) return;
    isClosing = true;
    window.removeEventListener('keydown', onKeyDown, true);
    backdrop.classList.add('willow-gdlg-backdrop--closing');
    backdrop.classList.remove('willow-gdlg-backdrop--shown');
    surface.classList.remove('willow-gdlg-surface--shown');
    setTimeout(() => {
      host.remove();
      if (callback) callback();
    }, 120);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      e.preventDefault();
      closeDialog();
    }
  };
  window.addEventListener('keydown', onKeyDown, true);

  backdrop.addEventListener('click', () => closeDialog());
  cancelBtn.addEventListener('click', () => closeDialog());

  optNewProj.addEventListener('click', () => {
    closeDialog(() => {
      triggerNativeProjectAction('New Project');
    });
  });

  optQuickStart.addEventListener('click', () => {
    closeDialog(() => {
      triggerNativeProjectAction('Quick Start');
    });
  });

  requestAnimationFrame(() => {
    backdrop.classList.add('willow-gdlg-backdrop--shown');
    surface.classList.add('willow-gdlg-surface--shown');
    optNewProj.focus();
  });
}

function ensureNewProjectRow(block) {
  let newProjectBtn = document.getElementById('gemini-new-project-button');
  if (!newProjectBtn) {
    newProjectBtn = navRow('gemini-new-project-button');
    newProjectBtn.innerHTML = `
      <span class="icon-box">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect width="7" height="7" x="3" y="3" rx="1"/>
          <rect width="7" height="7" x="14" y="3" rx="1"/>
          <rect width="7" height="7" x="14" y="14" rx="1"/>
          <rect width="7" height="7" x="3" y="14" rx="1"/>
        </svg>
      </span>
      <span class="truncate">New project</span>
    `;
    newProjectBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openNewProjectDialog();
    });
  }
  if (newProjectBtn.parentElement !== block) block.appendChild(newProjectBtn);
}

function ensureDisplayOptionsRow(block) {
  let displayOptsBtn = document.getElementById('gemini-display-options-button');
  if (!displayOptsBtn) {
    displayOptsBtn = navRow('gemini-display-options-button');
    displayOptsBtn.innerHTML = `
      <span class="icon-box">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 -960 960 960" fill="currentColor">
          <path d="M411.15-260v-60H548.46v60H411.15Zm-155-190v-60H703.46v60H256.16ZM140-640v-60H820v60H140Z"/>
        </svg>
      </span>
      <span class="truncate">Display options</span>
    `;
    displayOptsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      let orig = document.querySelector('[aria-label="Display Options"]');
      if (!orig) {
        const scroller = document.querySelector('[data-testid="conversation-list-sidebar"]');
        if (scroller) scroller.scrollTop = 0;
        orig = document.querySelector('[aria-label="Display Options"]');
      }
      if (orig) {
        const r = displayOptsBtn.getBoundingClientRect();
        orig.style.display = 'block';
        orig.style.position = 'fixed';
        orig.style.top = `${r.bottom}px`;
        orig.style.left = `${Math.max(10, r.right - 180)}px`;
        orig.style.width = '180px';
        orig.style.height = '1px';
        orig.style.opacity = '0';
        orig.style.pointerEvents = 'none';
        orig.click();
        setTimeout(() => {
          orig.style.position = '';
          orig.style.top = '';
          orig.style.left = '';
          orig.style.width = '';
          orig.style.height = '';
          orig.style.opacity = '';
          orig.style.pointerEvents = '';
          orig.style.display = '';
        }, 100);
      }
    });
  }
  if (displayOptsBtn.parentElement !== block) block.appendChild(displayOptsBtn);
}


/* ===========================================================================
 * Gemini App — Skills Section & Tab (Willow Spark Skills Fidelity)
 * ======================================================================== */

const INPUT_BOX = '[data-testid="agent-input-box"]';

function setComposerPromptText(text) {
  const textarea = document.querySelector('textarea');
  if (!textarea) return;
  textarea.focus();
  const prototype = Object.getPrototypeOf(textarea);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value') || Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
  if (descriptor && descriptor.set) {
    descriptor.set.call(textarea, text);
  } else {
    textarea.value = text;
  }
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.dispatchEvent(new Event('change', { bubbles: true }));
  textarea.selectionStart = textarea.selectionEnd = text.length;
}

const ANTIGRAVITY_BUILTIN_SKILLS = [
  { id: 'agy-customizations', name: 'agy-customizations', scope: 'Built-in', description: 'Comprehensive guide and reference for the Antigravity Customization System. Use to explain how customizations work, their loading priority, discovery mechanisms, and to guide the creation of skills, rules, plugins, hooks, and MCP servers.' },
  { id: 'antigravity-guide', name: 'antigravity-guide', scope: 'Built-in', description: 'Comprehensive guide, quick reference, and sitemap for Google Antigravity (AGY), including the Antigravity CLI (agy), Antigravity 2.0, Antigravity IDE, Python SDK, slash commands, keybindings, and customizations.' },
  { id: 'generative_ui', name: 'generative_ui', scope: 'Built-in', description: 'How to render rich interactive HTML widgets inline in the chat or as standalone artifacts. Use this skill when you want to show the user diagrams, data visualizations, interactive controls, or rich visual content.' },
  { id: 'migrate-workflows', name: 'migrate-workflows', scope: 'Built-in', description: 'Automatically migrate legacy workflows to modern skills across global and workspace configurations. Scans for existing workflows, creates target SKILL.md files, and safely archives old workflow files.' },
  { id: 'gemini-api-dev', name: 'gemini-api-dev', scope: 'Plugin', description: 'Use this skill when building applications with Gemini API hosted models, including Gemini and Gemma, working with multimodal content, implementing function calling, or needing current model specifications.' },
  { id: 'gemini-interactions-api', name: 'gemini-interactions-api', scope: 'Plugin', description: 'Use this skill when writing code that calls the Gemini API for text generation, multi-turn chat, multimodal understanding, image generation, video generation, streaming responses, or structured output.' },
  { id: 'gemini-live-api-dev', name: 'gemini-live-api-dev', scope: 'Plugin', description: 'Use this skill when building real-time, bidirectional streaming applications with the Gemini Live API. Covers WebSocket streaming, voice activity detection (VAD), session management, and live translation.' },
  { id: 'gemini-omni-flash-api', name: 'gemini-omni-flash-api', scope: 'Plugin', description: 'Use this skill for generative video editing, text-to-video, image-referenced video generation, and first-frame-to-video transitions using Gemini Omni 1.1 Flash.' },
  { id: 'android-cli', name: 'android-cli', scope: 'Plugin', description: 'Provides instructions for installing and using the android CLI. Manage Android SDK components, virtual devices, UI inspection, and official Android documentation.' },
  { id: 'alphafold-database-fetch-and-analyze', name: 'alphafold-database-fetch-and-analyze', scope: 'Plugin', description: 'Retrieve and analyze AlphaFold predicted structures for a protein. Provides structural confidence metrics (pLDDT), domain boundary analysis, and disorder assessment.' },
  { id: 'alphagenome-single-variant-analysis', name: 'alphagenome-single-variant-analysis', scope: 'Plugin', description: 'Analyzes genetic variant effects on gene expression (RNA-seq), chromatin accessibility (DNASE), histone marks (ChIP), and transcription factors using the AlphaGenome API.' },
  { id: 'chembl-database', name: 'chembl-database', scope: 'Plugin', description: 'Query the ChEMBL database for bioactive molecules, drug targets, bioactivity data, approved drugs, and chemical structures.' },
  { id: 'clinical-trials-database', name: 'clinical-trials-database', scope: 'Plugin', description: 'Query ClinicalTrials.gov via APIv2 for trials by condition, drug, location, status, or phase; retrieve trial details by NCT ID; check eligibility/inclusion criteria.' },
  { id: 'clinvar-database', name: 'clinvar-database', scope: 'Plugin', description: 'Clinical significance, pathogenicity classifications (Pathogenic, Benign, VUS), and clinical evidence rationales for human genomic variants.' },
  { id: 'credentials', name: 'credentials', scope: 'Plugin', description: 'Instructions for handling API keys and credentials safely, verifying their presence, and prompting the user to add them if missing using a safe protocol.' },
  { id: 'dbsnp-database', name: 'dbsnp-database', scope: 'Plugin', description: 'Look up, map, and search for short genetic variants (SNPs, indels) in NCBI dbSNP database. Resolves rsIDs, genomic coordinates, and HGVS strings.' },
  { id: 'embl-ebi-ols', name: 'embl-ebi-ols', scope: 'Plugin', description: 'Query and search the EMBL-EBI Ontology Lookup Service (OLS) for biomedical ontology terms, definitions, and hierarchies across 250+ ontologies.' },
  { id: 'encode-ccres-database', name: 'encode-ccres-database', scope: 'Plugin', description: 'Query the ENCODE Registry of cis-Regulatory Elements (cCREs) via the SCREEN GraphQL API and query regulatory annotations across human cell types.' },
  { id: 'ensembl-database', name: 'ensembl-database', scope: 'Plugin', description: 'Query the Ensembl database to resolve gene, transcript, and protein IDs, fetch genomic or protein sequences, and get variant consequence predictions (VEP).' },
  { id: 'foldseek-structural-search', name: 'foldseek-structural-search', scope: 'Plugin', description: 'Performs 3D structural searches of proteins against databases (PDB, AlphaFold, CATH, MGnify) using the Foldseek API.' },
  { id: 'gnomad-database', name: 'gnomad-database', scope: 'Plugin', description: 'Query the Genome Aggregation Database (gnomAD) for rarity or allele frequency of genetic variants and gene constraint metrics (pLI, LOEUF).' },
  { id: 'gtex-database', name: 'gtex-database', scope: 'Plugin', description: 'Retrieve quantitative RNA expression data and variant eQTL information from the GTEx Project across 54 non-diseased tissue sites.' },
  { id: 'human-protein-atlas-database', name: 'human-protein-atlas-database', scope: 'Plugin', description: 'Retrieve semi-quantitative protein expression and spatial localisation data from the Human Protein Atlas (HPA).' },
  { id: 'interpro-database', name: 'interpro-database', scope: 'Plugin', description: 'Identify domains, families, and sites in proteins; find all proteins in a family or sharing a domain; explore species distribution for a domain.' },
  { id: 'jaspar-database', name: 'jaspar-database', scope: 'Plugin', description: 'Query the JASPAR database for Transcription Factor (TF) binding profiles, PFMs, PWMs, and resolve gene symbols to Matrix IDs.' },
  { id: 'literature-search-arxiv', name: 'literature-search-arxiv', scope: 'Plugin', description: 'Search for scientific papers, preprints, and publications on arXiv. Extract metadata, abstracts, and download PDFs or HTML versions.' },
  { id: 'literature-search-biorxiv', name: 'literature-search-biorxiv', scope: 'Plugin', description: 'Browse, filter, and download life sciences, biology, and medical preprints from bioRxiv and medRxiv.' },
  { id: 'literature-search-europepmc', name: 'literature-search-europepmc', scope: 'Plugin', description: 'Search Europe PMC for scientific literature and download open-access full texts, XML, and PDFs.' },
  { id: 'literature-search-openalex', name: 'literature-search-openalex', scope: 'Plugin', description: 'Query the OpenAlex scholarly database for research papers, authors, institutions, topics, sources, and bibliometric data.' },
  { id: 'ncbi-sequence-fetch', name: 'ncbi-sequence-fetch', scope: 'Plugin', description: 'Retrieve protein and nucleotide sequences from NCBI databases using E-utilities. Supports direct accession lookup and CDS translation.' },
  { id: 'openfda-database', name: 'openfda-database', scope: 'Plugin', description: 'Query, search, and download data from the openFDA API for drugs, devices, adverse events, recalls, labeling, and shortages.' },
  { id: 'opentargets-database', name: 'opentargets-database', scope: 'Plugin', description: 'Query Open Targets Platform for target-disease associations, drug target discovery, tractability/safety data, and genetics evidence.' },
  { id: 'pdb-database', name: 'pdb-database', scope: 'Plugin', description: 'Search for or download experimentally-determined 3D biomolecular structures (proteins, nucleic acids, bound ligands) from the Protein Data Bank.' },
  { id: 'predictingthepast', name: 'predictingthepast', scope: 'Plugin', description: 'Ancient text restoration, attribution, dating, contextualization, and embedding via Aeneas (Latin) / Ithaca (Ancient Greek).' },
  { id: 'protein-sequence-msa', name: 'protein-sequence-msa', scope: 'Plugin', description: 'Performs multiple sequence alignment of proteins with EBI Clustal Omega to assess similarity and domain conservation.' },
  { id: 'protein-sequence-similarity-search', name: 'protein-sequence-similarity-search', scope: 'Plugin', description: 'Searches for homologous protein sequences using MMseqs2 or BLAST to infer protein function based on sequence similarity.' },
  { id: 'pubchem-database', name: 'pubchem-database', scope: 'Plugin', description: 'Query PubChem, search by name/CID/SMILES, retrieve molecular properties, chemical structure searches, and bioactivity data.' },
  { id: 'pubmed-database', name: 'pubmed-database', scope: 'Plugin', description: 'Search PubMed for scientific literature and clinical trials; link published research to biological databases (genes, proteins, compounds).' },
  { id: 'pymol', name: 'pymol', scope: 'Plugin', description: 'Visualize, analyze, and render protein and molecular structures using PyMOL. Highlight binding sites, active site residues, and color by pLDDT.' },
  { id: 'quickgo-database', name: 'quickgo-database', scope: 'Plugin', description: 'Query the QuickGO and Evidence & Conclusion Ontology (ECO) REST API for Gene Ontology terms, annotations, and hierarchies.' },
  { id: 'reactome-database', name: 'reactome-database', scope: 'Plugin', description: 'Query the Reactome database for biological pathway analysis, gene list enrichment, reaction participants, and pathway diagrams.' },
  { id: 'science-skills-common', name: 'science-skills-common', scope: 'Plugin', description: 'Shared Python package for Science Skills with rate limiting, retries, and exponential backoff HTTP client.' },
  { id: 'scienceskillscommon', name: 'scienceskillscommon', scope: 'Plugin', description: 'Shared Python package for Science Skills with unified HTTP client and rate limiting.' },
  { id: 'string-database', name: 'string-database', scope: 'Plugin', description: 'Query the STRING database for protein-protein interactions (PPIs), functional enrichment, confidence scores, and homology.' },
  { id: 'ucsc-conservation-and-tfbs', name: 'ucsc-conservation-and-tfbs', scope: 'Plugin', description: 'Fetch Evolutionary Conservation scores (phyloP, phastCons) and Transcription Factor Binding Sites (TFBS) from UCSC Genome Browser.' },
  { id: 'unibind-database', name: 'unibind-database', scope: 'Plugin', description: 'Query the UniBind database for experimentally validated transcription factor (TF) binding sites.' },
  { id: 'uniprot-database', name: 'uniprot-database', scope: 'Plugin', description: 'Access protein metadata, function, taxonomy, and sequences across UniProtKB, UniParc, and UniRef.' },
  { id: 'uv', name: 'uv', scope: 'Plugin', description: 'Checks whether the uv Python package manager is installed and installs it if missing. Ensures uv is on PATH.' },
  { id: 'workflow-skill-creator', name: 'workflow-skill-creator', scope: 'Plugin', description: 'Distills a completed user workflow or interaction into a reusable agent skill.' }
];

const RECOMMENDED_SKILLS = [
  {
    title: 'Match your writing style',
    description: 'Learns your voice from your real writing across Workspace apps',
    instructions: 'Analyze the tone, phrasing, cadence, and vocabulary from my inputs and match that voice consistently in all written responses.'
  },
  {
    title: 'Focus your energy',
    description: 'Align your workload with your energy instead of your calendar',
    instructions: 'When planning or reviewing tasks, prioritize demanding cognitive work for peak energy windows and group routine tasks together.'
  },
  {
    title: 'Get more perspectives',
    description: 'Get 3\u20135 distinct viewpoints before you commit to a decision',
    instructions: 'Whenever evaluating an architecture, strategy, or implementation, provide 3 to 5 distinct perspectives highlighting trade-offs, potential blind spots, and counter-arguments.'
  },
  {
    title: 'Generate fresh ideas',
    description: 'Turn existing content into 5 entirely new creative concepts',
    instructions: 'Take the current concept or topic and generate 5 creative, distinct, and unconventional alternative angles or improvements.'
  },
  {
    title: 'Write clearer updates',
    description: 'Turn rough notes into concise, audience-ready project updates',
    instructions: 'Transform rough status notes or commit logs into concise, professional updates structured into Summary, Progress, and Next Steps.'
  },
  {
    title: 'Challenge your assumptions',
    description: 'Surface risks, counterarguments and missing evidence before you decide',
    instructions: 'Critically analyze proposals, find unstated assumptions, flag potential risks, and identify what evidence is missing before moving forward.'
  },
  {
    title: 'Prepare for meetings',
    description: 'Create a focused brief with context, questions and desired outcomes',
    instructions: 'Create a concise meeting brief outline with meeting goal, background context, key discussion questions, and intended decisions/outcomes.'
  },
  {
    title: 'Turn feedback into action',
    description: 'Organise feedback into themes, priorities and concrete next steps',
    instructions: 'Synthesize raw feedback or code review comments into thematic groups, prioritized by impact, with concrete actionable steps.'
  }
];

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function parseSkillFile(text, filename) {
  let name = filename ? filename.replace(/\.[^/.]+$/, '') : '';
  let description = '';
  let instructions = text;
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (match) {
    const fm = match[1];
    instructions = match[2].trim();
    const nameMatch = fm.match(/^name:\s*(.+)$/m);
    if (nameMatch) name = nameMatch[1].trim();
    const descMatch = fm.match(/^description:\s*(?:>-\s*)?([\s\S]*?)(?=\n[a-z_]+:|$)/m);
    if (descMatch) description = descMatch[1].trim();
  }
  return { name, description, instructions, scope: 'Custom' };
}

function getUserSkills() {
  try {
    const raw = localStorage.getItem('bettergravity-user-skills');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveUserSkill(skill) {
  try {
    const list = getUserSkills();
    const cleanName = (skill.name || 'custom-skill').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
    const existingIndex = list.findIndex(s => s.id === skill.id || s.name.toLowerCase() === cleanName);
    const entry = {
      id: skill.id || 'custom-' + Date.now(),
      name: cleanName,
      description: (skill.description || '').trim(),
      instructions: (skill.instructions || '').trim(),
      scope: 'Custom',
      updatedAt: Date.now()
    };
    if (existingIndex >= 0) {
      list[existingIndex] = { ...list[existingIndex], ...entry };
    } else {
      entry.createdAt = Date.now();
      list.unshift(entry);
    }
    localStorage.setItem('bettergravity-user-skills', JSON.stringify(list));
    return entry;
  } catch {
    return null;
  }
}

function deleteUserSkill(id) {
  try {
    const list = getUserSkills().filter(s => s.id !== id && s.name !== id);
    localStorage.setItem('bettergravity-user-skills', JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

let liveAntigravitySkills = [];
let liveSkillsFetchPromise = null;

function skillScopeFromPath(p) {
  if (!p || typeof p !== 'string') return 'Skill';
  const pLower = p.toLowerCase().replace(/\\/g, '/');
  if (pLower.includes('/.agents/') || pLower.includes('/.agent/') || pLower.includes('/_agents/') || pLower.includes('/_agent/')) {
    return 'Workspace';
  }
  if (pLower.includes('/builtin/') || pLower.includes('/built-in/')) {
    return 'Built-in';
  }
  if (pLower.includes('/plugins/') || pLower.includes('bettergravity')) {
    return 'Plugin';
  }
  return 'Skill';
}

function refreshLiveAntigravitySkills() {
  if (liveSkillsFetchPromise) return liveSkillsFetchPromise;
  const props = composerProps();
  if (!props || typeof props.getSlashCommandItems !== 'function') {
    return Promise.resolve(liveAntigravitySkills);
  }

  liveSkillsFetchPromise = Promise.resolve()
    .then(() => props.getSlashCommandItems())
    .then((items) => {
      if (!Array.isArray(items)) return liveAntigravitySkills;
      const discovered = [];
      const seen = new Set();
      for (const item of items) {
        if (!item || typeof item !== 'object') continue;
        const isSkill = (
          item.info?.type === 2 ||
          (typeof item.info?.modelFacingText === 'string' && item.info.modelFacingText.includes('<SKILL>')) ||
          (typeof item.info?.definitionPath === 'string' && item.info.definitionPath.toLowerCase().includes('skill'))
        );
        if (!isSkill) continue;

        const name = (typeof item.info?.name === 'string' ? item.info.name : item.name) || '';
        const cleanName = name.trim();
        if (!cleanName || seen.has(cleanName.toLowerCase())) continue;
        seen.add(cleanName.toLowerCase());

        const path = typeof item.info?.definitionPath === 'string' ? item.info.definitionPath : '';
        const title = typeof item.title === 'string' && item.title.trim() ? item.title.trim() : cleanName;
        const description = typeof item.description === 'string' ? item.description.trim() : '';
        const modelFacingText = typeof item.info?.modelFacingText === 'string' ? item.info.modelFacingText : '';
        const scope = skillScopeFromPath(path);

        discovered.push({
          id: cleanName,
          name: cleanName,
          title,
          description,
          path,
          instructions: description,
          modelFacingText,
          scope,
          isHostSkill: true
        });
      }

      if (discovered.length > 0) {
        liveAntigravitySkills = discovered;
        if (isSkillsViewOpen()) {
          renderSkillsLibrary(currentFilterQuery);
        }
      }
      return liveAntigravitySkills;
    })
    .catch(() => liveAntigravitySkills)
    .finally(() => {
      liveSkillsFetchPromise = null;
    });

  return liveSkillsFetchPromise;
}

function getAllSkills() {
  const userSkills = getUserSkills();
  const baseSkills = liveAntigravitySkills.length > 0 ? liveAntigravitySkills : ANTIGRAVITY_BUILTIN_SKILLS;

  const result = [];
  const seen = new Set();

  for (const s of userSkills) {
    const key = (s.name || s.id || '').toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(s);
  }

  for (const s of baseSkills) {
    const key = (s.name || s.id || '').toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(s);
  }

  if (baseSkills !== ANTIGRAVITY_BUILTIN_SKILLS) {
    for (const s of ANTIGRAVITY_BUILTIN_SKILLS) {
      const key = (s.name || s.id || '').toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      result.push(s);
    }
  }

  return result;
}

setTimeout(() => {
  refreshLiveAntigravitySkills();
}, 200);

function downloadSkillFile(skill) {
  const frontmatter = [
    '---',
    `name: ${skill.name}`,
    `description: ${skill.description || ''}`,
    '---',
    '',
    (skill.instructions || skill.description || '').trim(),
    ''
  ].join('\n');
  const blob = new Blob([frontmatter], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const fileName = (skill.name || 'skill').toLowerCase().replace(/[^a-z0-9_-]+/g, '-') || 'skill';
  a.download = `${fileName}.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function getMainViewportContainer() {
  const convView = document.querySelector('[data-testid="conversation-view"]');
  if (convView && convView.parentElement) return convView.parentElement;
  const flexMain = document.querySelector('.flex-1.flex.flex-col.min-w-0.h-full');
  if (flexMain) {
    const viewport = flexMain.querySelector('.flex-1.min-h-0') || flexMain.children[1];
    if (viewport) return viewport;
  }
  return document.body;
}

let activeKebabPopover = null;

function closeActiveKebabPopover() {
  if (activeKebabPopover) {
    activeKebabPopover.remove();
    activeKebabPopover = null;
  }
  for (const r of document.querySelectorAll('.spark-skill-row.has-menu-open')) {
    r.classList.remove('has-menu-open');
  }
}

function openKebabPopover(triggerBtn, rowEl, skill) {
  closeActiveKebabPopover();
  rowEl.classList.add('has-menu-open');

  const popover = document.createElement('div');
  popover.className = 'spark-row-action-menu__popover';

  const isCustom = skill.scope === 'Custom';

  popover.innerHTML = `
    <button type="button" class="spark-row-action-menu__item" data-action="use-now">
      <span class="luminous-symbol item-icon">contract</span>
      <span>Use now</span>
    </button>
    <button type="button" class="spark-row-action-menu__item" data-action="edit-gemini">
      <span class="luminous-symbol item-icon">auto_awesome</span>
      <span>Edit with Gemini</span>
    </button>
    <button type="button" class="spark-row-action-menu__item" data-action="edit-manual">
      <span class="google-symbols item-icon is-google-symbols">edit_note</span>
      <span>${isCustom ? 'Edit manually' : 'View / customize'}</span>
    </button>
    <div class="spark-row-action-menu__divider"></div>
    <button type="button" class="spark-row-action-menu__item" data-action="download">
      <span class="google-symbols item-icon is-google-symbols">download</span>
      <span>Download</span>
    </button>
    ${isCustom ? `
      <div class="spark-row-action-menu__divider"></div>
      <button type="button" class="spark-row-action-menu__item is-danger" data-action="delete">
        <span class="luminous-symbol item-icon">delete</span>
        <span>Delete</span>
      </button>
    ` : ''}
  `;

  document.body.appendChild(popover);
  activeKebabPopover = popover;

  const rect = triggerBtn.getBoundingClientRect();
  const menuWidth = 190;
  let left = rect.right - menuWidth;
  if (left < 16) left = 16;
  let top = rect.bottom + 6;
  if (top + 220 > window.innerHeight) {
    top = Math.max(16, rect.top - 220);
  }
  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;

  popover.addEventListener('click', (e) => {
    const item = e.target.closest('[data-action]');
    if (!item) return;
    const action = item.dataset.action;
    closeActiveKebabPopover();

    if (action === 'use-now') {
      closeSkillsView();
      navigateToExperienceNewConversation('chat');
      setTimeout(() => {
        setComposerPromptText('/' + skill.name + ' ');
      }, 150);
    } else if (action === 'edit-gemini') {
      closeSkillsView();
      navigateToExperienceNewConversation('chat');
      setTimeout(() => {
        setComposerPromptText('Please help me refine and customize the Antigravity skill "' + skill.name + '". Description: ' + (skill.description || '') + '. How can we adapt or extend it?');
      }, 150);
    } else if (action === 'edit-manual') {
      renderSkillEditor(skill, isCustom);
    } else if (action === 'download') {
      downloadSkillFile(skill);
    } else if (action === 'delete') {
      deleteUserSkill(skill.id);
      renderSkillsLibrary(currentFilterQuery);
    }
  });
}

let currentFilterQuery = '';
let showAllRecommendationsState = false;

function isSkillsViewOpen() {
  const view = document.getElementById('gemini-skills-view');
  return !!(view && view.parentElement && view.style.display !== 'none');
}

function getActiveCustomView() {
  if (isSkillsViewOpen()) {
    return { id: 'gemini-skills-view', buttonId: 'gemini-skills-button' };
  }
  const petsView = document.getElementById('bettergravity-pets-view');
  if ((petsView && petsView.isConnected && petsView.style.display !== 'none') || document.body.classList.contains('bettergravity-pets-open')) {
    return { id: 'bettergravity-pets-view', buttonSelector: '[data-bettergravity-button="Pets"]' };
  }

  // Any custom view mounted in the main viewport or marked with data-bettergravity-view
  const container = getMainViewportContainer();
  if (container) {
    for (const child of container.children) {
      if (child.nodeType === 1 &&
          child.id &&
          (child.id.endsWith('-view') || child.id.endsWith('-page') || child.hasAttribute('data-bettergravity-view')) &&
          child.id !== 'conversation-view' &&
          child.id !== 'gemini-skills-view' &&
          child.id !== 'bettergravity-pets-view' &&
          child.dataset.testid !== 'conversation-view' &&
          child.dataset.testid !== 'sidecars-view' &&
          child.isConnected &&
          child.style.display !== 'none') {
        const btnId = child.id.replace(/-view$|-page$/, '-button');
        return { id: child.id, buttonId: btnId, buttonSelector: `[data-bettergravity-button], #${btnId}` };
      }
    }
  }

  // Any sidebar button explicitly active via aria-pressed or data-bettergravity-active
  const activePluginBtn = document.querySelector(
    '[role="navigation"][aria-label="Sidebar"] [data-bettergravity-button][aria-pressed="true"], ' +
    '[role="navigation"][aria-label="Sidebar"] [data-bettergravity-button][data-bettergravity-active="true"], ' +
    '[role="navigation"][aria-label="Sidebar"] #gemini-scroll-nav > [aria-pressed="true"]:not(#gemini-skills-button):not(#gemini-scheduled-tasks-button)'
  );
  if (activePluginBtn) {
    return { id: 'custom-plugin-active', buttonElement: activePluginBtn };
  }

  return null;
}

function isAnyCustomViewOpen() {
  return getActiveCustomView() !== null;
}

function syncActiveSidebarState() {
  const activeView = getActiveCustomView();
  const hasCustomView = !!activeView;
  document.body.classList.toggle('gemini-custom-view-open', hasCustomView);
  if (hasCustomView && activeView.id) {
    document.body.dataset.geminiActiveTab = activeView.id;
  } else {
    delete document.body.dataset.geminiActiveTab;
  }

  // Update Scheduled Tasks row
  const schedRow = document.getElementById('gemini-scheduled-tasks-button');
  const automations = document.querySelector(AUTOMATIONS_SELECTOR);
  if (schedRow && automations) {
    const shouldHighlight = automations.classList.contains('bg-sidebar-secondary') && !hasCustomView;
    schedRow.classList.toggle('bg-sidebar-secondary', shouldHighlight);
  }

  // Update Skills row
  const skillsRow = document.getElementById('gemini-skills-button');
  if (skillsRow) {
    skillsRow.classList.toggle('bg-sidebar-secondary', isSkillsViewOpen());
  }

  // Update adopted plugin buttons in #gemini-scroll-nav
  const pluginButtons = document.querySelectorAll(
    '[role="navigation"][aria-label="Sidebar"] [data-bettergravity-button], ' +
    '[role="navigation"][aria-label="Sidebar"] #gemini-scroll-nav > button:not(#gemini-skills-button):not(#gemini-scheduled-tasks-button):not(#gemini-new-project-button):not(#gemini-display-options-button)'
  );
  for (const btn of pluginButtons) {
    const isThisActive = (
      btn.getAttribute('aria-pressed') === 'true' ||
      btn.getAttribute('data-active') === 'true' ||
      btn.getAttribute('data-bettergravity-active') === 'true' ||
      (activeView?.buttonElement === btn) ||
      (activeView?.buttonSelector && btn.matches(activeView.buttonSelector)) ||
      (activeView?.buttonId && btn.id === activeView.buttonId)
    );
    btn.classList.toggle('bg-sidebar-secondary', isThisActive);
    if (isThisActive && btn.getAttribute('aria-pressed') !== 'true') {
      btn.setAttribute('aria-pressed', 'true');
    } else if (!isThisActive && !hasCustomView && btn.getAttribute('aria-pressed') === 'true') {
      btn.setAttribute('aria-pressed', 'false');
    }
  }
}

function closeOpenCustomViews(exceptTarget) {
  if (isSkillsViewOpen() && (!exceptTarget || !exceptTarget.closest('#gemini-skills-view, #gemini-skills-button'))) {
    closeSkillsView();
  }
  const petsView = document.getElementById('bettergravity-pets-view');
  if (petsView && (!exceptTarget || !exceptTarget.closest('#bettergravity-pets-view, [data-bettergravity-button="Pets"]'))) {
    const petBtn = document.querySelector('[data-bettergravity-button="Pets"]');
    if (petBtn) {
      if (petBtn.getAttribute('aria-pressed') === 'true') {
        petBtn.click();
      }
      petBtn.classList.remove('bg-sidebar-secondary');
      petBtn.setAttribute('aria-pressed', 'false');
      petBtn.removeAttribute('data-bettergravity-active');
    }
    petsView.remove();
    document.body.classList.remove('bettergravity-pets-open');
  }

  const viewport = getMainViewportContainer();
  if (viewport) {
    for (const child of Array.from(viewport.children)) {
      if (child.nodeType === 1 &&
          child.id &&
          (child.id.endsWith('-view') || child.id.endsWith('-page') || child.hasAttribute('data-bettergravity-view')) &&
          child.id !== 'conversation-view' &&
          child.dataset.testid !== 'conversation-view' &&
          child.dataset.testid !== 'sidecars-view' &&
          child.id !== 'gemini-skills-view' &&
          child.id !== 'bettergravity-pets-view') {
        if (!exceptTarget || !exceptTarget.closest(`#${CSS.escape(child.id)}`)) {
          const btnId = child.id.replace(/-view$|-page$/, '-button');
          const btn = document.getElementById(btnId) || document.querySelector(`[data-bettergravity-button]`);
          if (btn && btn.getAttribute('aria-pressed') === 'true') {
            btn.click();
          } else {
            child.style.display = 'none';
          }
        }
      }
    }
  }
}

function openSkillsView() {
  closeOpenCustomViews(document.getElementById('gemini-skills-button'));
  const container = getMainViewportContainer();
  if (!container) return;

  for (const child of container.children) {
    if (child.id !== 'gemini-skills-view') {
      child.dataset.geminiSkillsHidden = child.style.display || '';
      child.style.display = 'none';
    }
  }

  let view = document.getElementById('gemini-skills-view');
  if (!view) {
    view = document.createElement('div');
    view.id = 'gemini-skills-view';
    view.className = 'spark-customise-page spark-customise-page--skills';
    container.appendChild(view);
  } else {
    if (view.parentElement !== container) container.appendChild(view);
    view.style.display = 'flex';
  }

  document.body.classList.add('gemini-skills-open');
  const skillsBtn = document.getElementById('gemini-skills-button');
  if (skillsBtn) skillsBtn.classList.add('bg-sidebar-secondary');

  const otherBtns = document.querySelectorAll(
    '[data-testid="new-conversation-button"], [data-testid="history-button"], #gemini-scheduled-tasks-button, [data-testid="automations-button"], [data-bettergravity-button]'
  );
  for (const b of otherBtns) b.classList.remove('bg-sidebar-secondary');

  syncActiveSidebarState();
  renderSkillsLibrary();
  refreshLiveAntigravitySkills();
}

function closeSkillsView() {
  document.body.classList.remove('gemini-skills-open');
  const view = document.getElementById('gemini-skills-view');
  if (view) view.remove();

  const container = getMainViewportContainer();
  if (container) {
    for (const child of container.children) {
      if (child.dataset.geminiSkillsHidden !== undefined) {
        const prev = child.dataset.geminiSkillsHidden;
        child.style.display = (prev === '' || prev === 'none' || prev === 'block') ? '' : prev;
        delete child.dataset.geminiSkillsHidden;
      } else if (child.id !== 'gemini-skills-view') {
        if (child.style.display === 'block' || child.style.display === 'none') {
          child.style.display = '';
        }
      }
    }
  }

  const convView = document.querySelector('[data-testid="conversation-view"]');
  if (convView && (convView.style.display === 'block' || convView.style.display === 'none')) {
    convView.style.display = '';
  }

  const skillsBtn = document.getElementById('gemini-skills-button');
  if (skillsBtn) skillsBtn.classList.remove('bg-sidebar-secondary');
  closeActiveKebabPopover();
  syncActiveSidebarState();
}

function renderSkillsLibrary(filterText = '', showAllRecs = showAllRecommendationsState) {
  currentFilterQuery = filterText;
  showAllRecommendationsState = showAllRecs;

  const view = document.getElementById('gemini-skills-view');
  if (!view) return;

  closeActiveKebabPopover();

  const allSkills = getAllSkills();
  if (liveAntigravitySkills.length === 0) {
    refreshLiveAntigravitySkills();
  }

  const q = filterText.toLowerCase().trim();
  const filtered = q
    ? allSkills.filter(s => s.name.toLowerCase().includes(q) || (s.description && s.description.toLowerCase().includes(q)))
    : allSkills;

  const recVisible = showAllRecs ? RECOMMENDED_SKILLS : RECOMMENDED_SKILLS.slice(0, 4);

  view.innerHTML = `
    <div class="spark-customise-page__narrow-inner">
      <header class="spark-customise-header">
        <h1>Skills</h1>
        <p>Create custom, reusable instructions for more helpful responses. Gemini uses relevant skills automatically, or you can apply them using /.</p>
      </header>

      <div class="spark-page-actions spark-skills-actions" aria-label="Add a skill">
        <button type="button" class="spark-page-action spark-page-action--primary" id="gemini-skills-btn-gemini">
          <span class="luminous-symbol spark-action-icon is-luminous">edit_rectangle</span>
          <span>Create with Gemini</span>
        </button>
        <button type="button" class="spark-page-action" id="gemini-skills-btn-manual">
          <span class="google-symbols spark-action-icon is-google-symbols">edit_note</span>
          <span>Create manually</span>
        </button>
        <button type="button" class="spark-page-action spark-page-action--icon-only" id="gemini-skills-btn-upload" title="Upload skill" aria-label="Upload skill">
          <span class="luminous-symbol spark-action-icon is-luminous">upload</span>
        </button>
      </div>

      <div class="spark-skills-search-row">
        <div class="spark-skills-search-box">
          <span class="luminous-symbol search-icon">search</span>
          <input type="text" id="gemini-skills-search-input" placeholder="Search skills..." value="${escapeHtml(filterText)}" />
        </div>
      </div>
    </div>

    <section class="spark-skills-library">
      <h2>Active (${filtered.length})</h2>
      ${filtered.length === 0 ? `
        <div class="spark-skills-empty">
          <h2>No matching skills</h2>
          <p>Try a different search term or add a new skill</p>
        </div>
      ` : `
        <div class="spark-skills-library__list" id="gemini-skills-active-list"></div>
      `}
    </section>

    <section class="spark-recommended-skills">
      <h2>Recommended</h2>
      <div class="spark-recommended-skills__grid" id="gemini-skills-recommended-grid"></div>
      <button type="button" class="spark-show-more" id="gemini-skills-show-more-toggle">
        <span>${showAllRecs ? 'Show less' : 'Show more'}</span>
        <span class="luminous-symbol arrow-icon">${showAllRecs ? 'expand_less' : 'expand_more'}</span>
      </button>
    </section>
  `;

  // Attach Header Action Listeners
  view.querySelector('#gemini-skills-btn-gemini')?.addEventListener('click', () => {
    closeSkillsView();
    navigateToExperienceNewConversation('chat');
    setTimeout(() => {
      setComposerPromptText('I want to create a new skill for Antigravity. Please ask me questions about what the skill should do and help me design it.');
    }, 150);
  });

  view.querySelector('#gemini-skills-btn-manual')?.addEventListener('click', () => {
    renderSkillEditor({ name: '', description: '', instructions: '', scope: 'Custom' }, false);
  });

  view.querySelector('#gemini-skills-btn-upload')?.addEventListener('click', () => {
    renderUploadDialog();
  });

  // Attach Search Listener
  const searchInput = view.querySelector('#gemini-skills-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      renderSkillsLibrary(e.target.value, showAllRecommendationsState);
      const updatedInput = document.getElementById('gemini-skills-search-input');
      if (updatedInput) {
        updatedInput.focus();
        updatedInput.selectionStart = updatedInput.selectionEnd = updatedInput.value.length;
      }
    });
  }

  // Populate Active Skills List
  const activeList = view.querySelector('#gemini-skills-active-list');
  if (activeList) {
    filtered.forEach((skill) => {
      const row = document.createElement('div');
      row.className = 'spark-skill-row';

      const cardBtn = document.createElement('button');
      cardBtn.type = 'button';
      cardBtn.className = 'spark-skill-card';
      const scopeSlug = (skill.scope || 'Custom').toLowerCase().replace(/[^a-z0-9]+/g, '-');
      cardBtn.innerHTML = `
        <span class="spark-skill-card__copy">
          <span class="spark-skill-card__header">
            <span class="spark-skill-card__title">${escapeHtml(skill.name)}</span>
            <span class="spark-skill-badge spark-skill-badge--${scopeSlug}">${escapeHtml(skill.scope || 'Custom')}</span>
          </span>
          <span class="spark-skill-card__description">${escapeHtml(skill.description || 'Custom reusable instructions')}</span>
        </span>
      `;
      cardBtn.addEventListener('click', () => {
        renderSkillEditor(skill, skill.scope === 'Custom');
      });

      const actionsWell = document.createElement('div');
      actionsWell.className = 'spark-skill-row__actions';
      const kebabBtn = document.createElement('button');
      kebabBtn.type = 'button';
      kebabBtn.className = 'spark-row-action-menu__trigger';
      kebabBtn.title = 'Skill options';
      kebabBtn.innerHTML = '<span class="luminous-symbol">more_vert</span>';
      kebabBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openKebabPopover(kebabBtn, row, skill);
      });
      actionsWell.appendChild(kebabBtn);

      row.appendChild(cardBtn);
      row.appendChild(actionsWell);
      activeList.appendChild(row);
    });
  }

  // Populate Recommended Skills Grid
  const recGrid = view.querySelector('#gemini-skills-recommended-grid');
  if (recGrid) {
    recVisible.forEach((rec) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'spark-recommended-skill';
      card.innerHTML = `
        <span class="spark-recommended-skill__copy">
          <h3 class="spark-recommended-skill__title">${escapeHtml(rec.title)}</h3>
          <p class="spark-recommended-skill__description">${escapeHtml(rec.description)}</p>
        </span>
      `;
      card.addEventListener('click', () => {
        const defaultName = rec.title.toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
        renderSkillEditor({
          name: defaultName,
          description: rec.description,
          instructions: rec.instructions,
          scope: 'Custom'
        }, false);
      });
      recGrid.appendChild(card);
    });
  }

  // Toggle Show More / Less
  view.querySelector('#gemini-skills-show-more-toggle')?.addEventListener('click', () => {
    renderSkillsLibrary(currentFilterQuery, !showAllRecs);
  });
}

function renderSkillEditor(draft, isEditing = false) {
  const view = document.getElementById('gemini-skills-view');
  if (!view) return;

  closeActiveKebabPopover();

  const currentDraft = {
    id: draft.id || '',
    name: draft.name || '',
    description: draft.description || '',
    instructions: draft.instructions || '',
    scope: draft.scope || 'Custom'
  };

  const initialSnapshot = JSON.stringify([currentDraft.name, currentDraft.description, currentDraft.instructions]);

  view.innerHTML = `
    <div class="spark-skill-editor">
      <form class="spark-skill-editor__content" id="gemini-skill-editor-form">
        <header class="spark-skill-editor__header">
          <button type="button" class="spark-skill-editor__back" id="gemini-skill-editor-back">
            <span class="luminous-symbol back-icon">arrow_back</span>
            <span>Skills</span>
          </button>
          <div class="spark-skill-editor__header-actions">
            ${isEditing && currentDraft.scope === 'Custom' ? `
              <button type="button" class="spark-skill-editor__delete" id="gemini-skill-editor-delete" title="Delete skill">
                <span class="luminous-symbol del-icon">delete</span>
              </button>
            ` : ''}
            <button type="submit" class="spark-skill-editor__create" id="gemini-skill-editor-submit" disabled>
              <span>${isEditing ? 'Save' : 'Create'}</span>
            </button>
          </div>
        </header>

        <section class="spark-skill-editor__panel">
          <div class="spark-skill-editor__field">
            <label for="gemini-skill-input-name">Skill name</label>
            <input id="gemini-skill-input-name" type="text" placeholder="Name your skill" autocomplete="off" value="${escapeHtml(currentDraft.name)}" />
          </div>

          <div class="spark-skill-editor__field">
            <label for="gemini-skill-input-desc">Description</label>
            <textarea id="gemini-skill-input-desc" rows="2" placeholder="Give your skill a description" autocomplete="off">${escapeHtml(currentDraft.description)}</textarea>
          </div>

          <div class="spark-skill-editor__field spark-skill-editor__field--instructions">
            <div class="spark-skill-editor__instructions-heading">
              <label for="gemini-skill-input-inst">Instructions</label>
            </div>
            <textarea id="gemini-skill-input-inst" placeholder="Describe what you want Gemini to do">${escapeHtml(currentDraft.instructions)}</textarea>
          </div>
        </section>
      </form>
    </div>
  `;

  const nameInput = view.querySelector('#gemini-skill-input-name');
  const descInput = view.querySelector('#gemini-skill-input-desc');
  const instInput = view.querySelector('#gemini-skill-input-inst');
  const submitBtn = view.querySelector('#gemini-skill-editor-submit');
  const backBtn = view.querySelector('#gemini-skill-editor-back');
  const deleteBtn = view.querySelector('#gemini-skill-editor-delete');

  const checkCanSubmit = () => {
    const valid = !!(nameInput.value.trim() && instInput.value.trim());
    submitBtn.disabled = !valid;
  };

  nameInput.addEventListener('input', checkCanSubmit);
  instInput.addEventListener('input', checkCanSubmit);
  descInput.addEventListener('input', checkCanSubmit);
  checkCanSubmit();

  const isDirty = () => {
    const snap = JSON.stringify([nameInput.value, descInput.value, instInput.value]);
    return snap !== initialSnapshot;
  };

  backBtn.addEventListener('click', () => {
    if (isDirty()) {
      if (confirm('Leave without saving? You will lose any recent changes.')) {
        renderSkillsLibrary(currentFilterQuery);
      }
    } else {
      renderSkillsLibrary(currentFilterQuery);
    }
  });

  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => {
      if (confirm(`Delete "${currentDraft.name}"? This cannot be undone.`)) {
        deleteUserSkill(currentDraft.id);
        renderSkillsLibrary(currentFilterQuery);
      }
    });
  }

  view.querySelector('#gemini-skill-editor-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (submitBtn.disabled) return;
    saveUserSkill({
      id: currentDraft.id,
      name: nameInput.value.trim(),
      description: descInput.value.trim(),
      instructions: instInput.value.trim(),
      scope: 'Custom'
    });
    renderSkillsLibrary(currentFilterQuery);
  });
}

function renderUploadDialog() {
  closeActiveKebabPopover();

  const backdrop = document.createElement('div');
  backdrop.className = 'spark-upload-dialog-backdrop';
  backdrop.innerHTML = `
    <div class="spark-upload-dialog" role="dialog" aria-modal="true">
      <h2>Upload skill</h2>
      <div class="spark-upload-dialog__requirements">
        <p>To upload a skill:</p>
        <ul>
          <li>File must contain a name, description, and instructions</li>
          <li>Accepted formats: .md, .txt, .py, .zip</li>
        </ul>
      </div>
      <div class="spark-upload-dialog__dropzone" id="gemini-skill-dropzone">
        <input type="file" id="gemini-skill-file-input" accept=".md,.txt,.py,.zip" style="display:none;" />
        <div class="spark-upload-dialog__drop-content">
          <span class="luminous-symbol upload-icon">upload</span>
          <span>Drag and drop skill file here or <button type="button" class="spark-inline-link" id="gemini-skill-browse-link">browse</button></span>
        </div>
      </div>
      <div class="spark-upload-dialog__actions">
        <button type="button" class="spark-upload-dialog__btn spark-upload-dialog__btn--cancel" id="gemini-skill-upload-close">Cancel</button>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);

  const closeDialog = () => backdrop.remove();

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeDialog();
  });
  backdrop.querySelector('#gemini-skill-upload-close')?.addEventListener('click', closeDialog);

  const fileInput = backdrop.querySelector('#gemini-skill-file-input');
  const dropzone = backdrop.querySelector('#gemini-skill-dropzone');
  const browseLink = backdrop.querySelector('#gemini-skill-browse-link');

  browseLink?.addEventListener('click', (e) => {
    e.preventDefault();
    fileInput?.click();
  });

  dropzone?.addEventListener('click', (e) => {
    if (e.target !== browseLink) fileInput?.click();
  });

  dropzone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('is-dragging');
  });

  dropzone?.addEventListener('dragleave', () => {
    dropzone.classList.remove('is-dragging');
  });

  const handleFiles = (files) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || '');
      const parsed = parseSkillFile(content, file.name);
      closeDialog();
      renderSkillEditor(parsed, false);
    };
    reader.readAsText(file);
  };

  dropzone?.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('is-dragging');
    handleFiles(e.dataTransfer?.files);
  });

  fileInput?.addEventListener('change', (e) => {
    handleFiles(e.target.files);
  });
}

function ensureSkillsRow(block) {
  let row = document.getElementById('gemini-skills-button');
  if (!row) {
    row = navRow('gemini-skills-button');
    row.innerHTML = '<span class="icon-box"></span><span class="truncate">Skills</span>';
    row.addEventListener('click', (e) => {
      e.preventDefault();
      if (isSkillsViewOpen()) {
        closeSkillsView();
      } else {
        openSkillsView();
      }
    });
  }
  const slot = row.querySelector('span:last-child');
  if (slot && slot.textContent !== 'Skills') slot.textContent = 'Skills';
  row.classList.toggle('bg-sidebar-secondary', isSkillsViewOpen());
  if (row.parentElement !== block) block.appendChild(row);
}

listenToPage(document, 'click', (e) => {
  const target = e.target;
  if (!target || !target.closest) return;
  if (
    target.closest('#gemini-skills-view') ||
    target.closest('#gemini-skills-button') ||
    target.closest('#bettergravity-pets-view') ||
    target.closest('.spark-row-action-menu__popover') ||
    target.closest('.spark-upload-dialog-backdrop')
  ) {
    return;
  }
  if (
    target.closest('[data-testid="new-conversation-button"]') ||
    target.closest('[data-testid="history-button"]') ||
    target.closest('#gemini-scheduled-tasks-button') ||
    target.closest('[data-testid="automations-button"]') ||
    target.closest('#gemini-new-project-button') ||
    target.closest('[data-testid="conversation-row-sidebar"]') ||
    target.closest('#gemini-experience-switch') ||
    target.closest('a[href*="/c/"]') ||
    target.closest('[role="navigation"][aria-label="Sidebar"] a') ||
    target.closest('[data-bettergravity-button]') ||
    target.closest('#gemini-scroll-nav > *')
  ) {
    cancelSentPromptGlide();
    closeOpenCustomViews(target);
    setTimeout(syncActiveSidebarState, 0);
  }
}, true);

listenToPage(window, 'popstate', () => {
  cancelSentPromptGlide();
  closeOpenCustomViews();
  setTimeout(syncActiveSidebarState, 0);
});

listenToPage(document, 'pointerdown', (e) => {
  if (activeKebabPopover && !activeKebabPopover.contains(e.target) && !e.target.closest('.spark-row-action-menu__trigger')) {
    closeActiveKebabPopover();
  }
}, true);

listenToPage(document, 'keydown', (e) => {
  if (e.key === 'Escape') {
    closeActiveKebabPopover();
    const uploadDialog = document.querySelector('.spark-upload-dialog-backdrop');
    if (uploadDialog) uploadDialog.remove();
  }
});

function ensureScheduledTasksRow(block) {
  const original = document.querySelector(AUTOMATIONS_SELECTOR);
  let row = document.getElementById('gemini-scheduled-tasks-button');
  if (!original) {
    row?.remove();
    return;
  }
  if (!row) {
    row = navRow('gemini-scheduled-tasks-button');
    // No <svg> here. The native row draws its glyph as a Luminous ligature on
    // the icon slot's ::before (styles/sidebar.css), and so does this one, so
    // the stand-in and the row it stands in for cannot drift apart.
    row.innerHTML = '<span class="icon-box"></span><span class="truncate"></span>';
    row.addEventListener('click', (e) => {
      e.preventDefault();
      closeOpenCustomViews();
      document.querySelector(AUTOMATIONS_SELECTOR)?.click();
    });
  }
  // Both of these live on the hidden row, so read them off it every pass: the
  // label because Antigravity owns its wording, and `bg-sidebar-secondary`
  // because that is where it spends the row's `selected` prop (main.js).
  const label = original.querySelector('span:last-child')?.textContent?.trim();
  const slot = row.querySelector('span:last-child');
  if (label && slot.textContent !== label) slot.textContent = label;
  const customActive = isAnyCustomViewOpen();
  const shouldHighlight = original.classList.contains('bg-sidebar-secondary') && !customActive;
  row.classList.toggle('bg-sidebar-secondary', shouldHighlight);
  if (row.parentElement !== block) block.appendChild(row);
}

function isPinnedTopNavItem(node) {
  if (!node || node.nodeType !== 1) return true;
  if (node.id === 'gemini-scroll-nav') return true;
  if (node.matches('[data-testid="new-conversation-button"]') || node.querySelector?.('[data-testid="new-conversation-button"]')) return true;
  if (node.matches('[data-testid="history-button"]') || node.querySelector?.('[data-testid="history-button"]')) return true;
  if (node.matches(AUTOMATIONS_SELECTOR) || node.querySelector?.(AUTOMATIONS_SELECTOR)) return true;
  return false;
}

const observedTopNavs = new WeakSet();

function ensureScrollNav() {
  const collapsed = isSidebarCollapsed();
  const topNav = document.querySelector('[role="navigation"][aria-label="Sidebar"] > .px-2 > div.flex-col') ||
                 document.querySelector('[role="navigation"][aria-label="Sidebar"] > div.px-2 > div.flex-col');
  const scroller = document.querySelector(LIST_SELECTOR);
  if (!topNav && !scroller) return;

  if (topNav && !observedTopNavs.has(topNav)) {
    observedTopNavs.add(topNav);
    const topNavObserver = new MutationObserver(() => ensureScrollNav());
    topNavObserver.observe(topNav, { childList: true });
    remember(topNav, topNavObserver);
  }

  let block = document.getElementById('gemini-scroll-nav');
  if (!block) {
    block = document.createElement('div');
    block.id = 'gemini-scroll-nav';
  }
  ensureSkillsRow(block);
  ensureScheduledTasksRow(block);

  const isWork = getStoredExperience() === 'work';
  if (isWork) {
    ensureNewProjectRow(block);
  } else {
    document.getElementById('gemini-new-project-button')?.remove();
  }
  ensureDisplayOptionsRow(block);

  const topRowIds = isWork
    ? ['gemini-skills-button', 'gemini-scheduled-tasks-button', 'gemini-new-project-button']
    : ['gemini-skills-button', 'gemini-scheduled-tasks-button'];

  const topRows = topRowIds
    .map((id) => document.getElementById(id))
    .filter((row) => row && row.parentElement === block);

  const bottomRows = ['gemini-display-options-button']
    .map((id) => document.getElementById(id))
    .filter((row) => row && row.parentElement === block);

  // Global rule: only New Conversation and History remain pinned at the top.
  // Any other items in topNav (such as plugin buttons) are adopted into the scroll block.
  const unpinnedTopNavItems = topNav
    ? Array.from(topNav.children).filter((child) => !isPinnedTopNavItem(child))
    : [];

  const existingAdoptedInBlock = Array.from(block.children).filter((child) => {
    return child.id !== 'gemini-skills-button' &&
           child.id !== 'gemini-scheduled-tasks-button' &&
           child.id !== 'gemini-new-project-button' &&
           child.id !== 'gemini-display-options-button';
  });

  const otherPluginButtons = Array.from(
    document.querySelectorAll('[role="navigation"][aria-label="Sidebar"] [data-bettergravity-button]')
  ).filter((b) => b.parentElement !== block && !isPinnedTopNavItem(b));

  const adoptedPluginItems = [];
  const seenNodes = new Set();
  for (const item of [...existingAdoptedInBlock, ...unpinnedTopNavItems, ...otherPluginButtons]) {
    if (!seenNodes.has(item)) {
      seenNodes.add(item);
      adoptedPluginItems.push(item);
    }
  }

  for (const item of adoptedPluginItems) {
    if (!item.classList.contains('gemini-nav-item')) {
      item.classList.add('gemini-nav-item');
    }
    const isItemActive = item.getAttribute('aria-pressed') === 'true' ||
                         item.getAttribute('data-active') === 'true' ||
                         item.getAttribute('data-bettergravity-active') === 'true';
    item.classList.toggle('bg-sidebar-secondary', isItemActive);
    if (item.firstElementChild && item.firstElementChild.tagName.toLowerCase() === 'svg') {
      const iconWrap = document.createElement('span');
      iconWrap.className = 'icon-box shrink-0 flex items-center';
      item.insertBefore(iconWrap, item.firstElementChild);
      iconWrap.appendChild(item.children[1]);
    }
  }

  // Every write from here down is guarded, because the observers that call this
  // watch the nodes it writes to, and a `replaceChildren` or an `insertBefore`
  // that changes nothing still reports a mutation. That is a loop.
  const wanted = [...topRows, ...adoptedPluginItems, ...bottomRows];
  const current = [...block.children];
  if (wanted.length !== current.length || wanted.some((row, i) => current[i] !== row)) {
    block.replaceChildren(...wanted);
  }

  if (collapsed) {
    if (topNav && block.parentElement !== topNav) {
      topNav.appendChild(block);
    }
  } else {
    if (scroller && scroller.firstChild !== block) {
      scroller.insertBefore(block, scroller.firstChild);
    }
  }

  syncActiveSidebarState();
}

/* ---------------------------------------------------------------------------
 * The soft top edge (Sidebar.tsx:2122-2135)
 *
 * "Fancy top glow overlay matching sidebar background under Search tab", in
 * Willow's own words: a 12px band across the top of the scroll region,
 * `pointer-events-none z-10`, fading in over 200ms once `isScrolled`, which it
 * defines as `scrollTop > 5` (Sidebar.tsx:883). The gradient is the rail's own
 * colour, so a row scrolling out dissolves into the rail instead of sliding
 * under a scrim.
 *
 * It is a sibling of the scroller inside the `relative` box the scroller fills —
 * not a mask on the scroller, and not a child of it. Willow tried the mask and
 * ended up dimming the same row twice (its comment at Sidebar.tsx:1912-1917).
 * Antigravity's structure has the same shape, so this goes in the same place.
 * ------------------------------------------------------------------------- */
function ensureTopFade(scroller, readScroll = true) {
  const holder = scroller.parentElement;
  if (!holder) return;
  let fade = document.getElementById('gemini-top-fade');
  // Replacing virtualised rows does not change this flag; an actual scroll
  // reports its new position through the scroll listener below. Reading here
  // after every row replacement forced a layout of the whole page each time.
  const scrolled = readScroll || !fade?.hasAttribute('data-scrolled')
    ? String(scroller.scrollTop > 5)
    : null;
  if (!fade) {
    fade = document.createElement('div');
    fade.id = 'gemini-top-fade';
    fade.setAttribute('aria-hidden', 'true');
  }
  if (fade.parentElement !== holder) holder.appendChild(fade);
  if (scrolled !== null && fade.dataset.scrolled !== scrolled) fade.dataset.scrolled = scrolled;
}

plugin.dom.observe(SIDEBAR_SELECTOR, (sidebar) => {
  syncSidebarState(sidebar);
  const sidebarObserver = new MutationObserver(() => {
    ensureSidebarHeader(sidebar, isSidebarCollapsed());
    ensureExperienceSwitch(sidebar);
    sidebar.querySelector(".gemini-sidebar-expand-rail")?.remove();
  });
  sidebarObserver.observe(sidebar, { childList: true });
  remember(sidebar, sidebarObserver);
});

plugin.dom.observe(TOGGLE_SELECTOR, (toggle) => {
  const sidebar = document.querySelector(SIDEBAR_SELECTOR);
  if (sidebar) syncSidebarState(sidebar);
  listenToElement(toggle, "click", () => {
    const sb = document.querySelector(SIDEBAR_SELECTOR);
    if (sb) {
      const willCollapse = toggle.hasAttribute("aria-expanded")
        ? toggle.getAttribute("aria-expanded") !== "false"
        : !isSidebarCollapsed();
      sb.setAttribute("data-collapsed", String(willCollapse));
      document.documentElement.setAttribute("data-sidebar-collapsed", String(willCollapse));
      const grandParent = sb.parentElement?.parentElement;
      if (grandParent) enforceSidebarGeometry(grandParent, willCollapse);
      ensureExperienceSwitch(sb);
      ensureScrollNav();
      updateSidebarItemsState(sb, willCollapse);
    }
  });
  const toggleObserver = new MutationObserver(() => {
    const sb = document.querySelector(SIDEBAR_SELECTOR);
    if (sb) syncSidebarState(sb);
  });
  toggleObserver.observe(toggle, { attributes: true, attributeFilter: ["aria-expanded", "class"] });
  remember(toggle, toggleObserver);
});

plugin.dom.observe(LIST_SELECTOR, (scroller) => {
  ensureScrollNav();
  ensureTopFade(scroller);
  // Willow re-checks its scroll flags on resize too (Sidebar.tsx:892-906), but
  // that is for the other one: `isAtScrollEnd` moves with scrollHeight and
  // clientHeight, which a resize changes without a scroll event. This flag only
  // watches scrollTop, and that cannot move silently.
  const onScroll = () => ensureTopFade(scroller);
  scroller.addEventListener('scroll', onScroll, { passive: true });
  // React owns the virtualiser sitting next to the block. If it swaps that out,
  // the block has to be put back in front of it.
  const children = new MutationObserver(() => {
    ensureScrollNav();
    ensureTopFade(scroller, false);
    const sidebar = scroller.closest(SIDEBAR_SELECTOR);
    if (sidebar) {
      ensureExperienceSwitch(sidebar);
      if (isSidebarCollapsed()) {
        updateSidebarItemsState(sidebar, true);
      }
    }
  });
  children.observe(scroller, { childList: true });
  remember(scroller, {
    disconnect: () => {
      scroller.removeEventListener('scroll', onScroll);
      children.disconnect();
    }
  });
});

plugin.dom.observe(AUTOMATIONS_SELECTOR, (autoBtn) => {
  ensureScrollNav();
  // The hidden row is the source for the stand-in's label and selected pill;
  // its column tells us when Antigravity stops rendering it at all. Neither is
  // written to any more, so watching them cannot feed this back to itself.
  const observer = new MutationObserver(() => ensureScrollNav());
  observer.observe(autoBtn, {
    attributes: true,
    attributeFilter: ['class'],
    childList: true,
    subtree: true,
    characterData: true,
  });
  remember(autoBtn, observer);
  if (autoBtn.parentElement) {
    const columnObserver = new MutationObserver(() => ensureScrollNav());
    columnObserver.observe(autoBtn.parentElement, { childList: true });
    remember(autoBtn.parentElement, columnObserver);
  }
});

const activeViewBodyObserver = new MutationObserver((mutations) => {
  const hasRelevant = mutations.some(m => {
    if (m.type === 'childList') {
      const added = Array.from(m.addedNodes);
      const removed = Array.from(m.removedNodes);
      return added.concat(removed).some(n =>
        n.nodeType === 1 && (
          n.id === 'bettergravity-pets-view' ||
          n.id === 'gemini-skills-view' ||
          n.id?.endsWith('-view') ||
          n.id?.endsWith('-page') ||
          n.getAttribute?.('data-bettergravity-button') !== null
        )
      );
    }
    if (m.type === 'attributes') {
      if (m.attributeName === 'aria-pressed' || m.attributeName === 'data-bettergravity-active') return true;
      if (m.attributeName === 'class' && (m.target === document.body || m.target === document.documentElement)) {
        const oldClass = m.oldValue || '';
        const newClass = (document.body || document.documentElement).className;
        return oldClass.includes('bettergravity-') !== newClass.includes('bettergravity-') ||
               oldClass.includes('gemini-skills-') !== newClass.includes('gemini-skills-');
      }
    }
    return false;
  });
  if (hasRelevant) {
    syncActiveSidebarState();
  }
});

function bindActiveViewBodyObserver() {
  const target = document.body || document.documentElement;
  if (!target) return;
  activeViewBodyObserver.observe(target, {
    attributes: true,
    attributeFilter: ['class', 'aria-pressed', 'data-bettergravity-active'],
    attributeOldValue: true,
    childList: true,
    subtree: true
  });
}
bindActiveViewBodyObserver();
if (typeof document !== 'undefined' && !document.body) {
  document.addEventListener('DOMContentLoaded', () => {
    activeViewBodyObserver.disconnect();
    bindActiveViewBodyObserver();
    syncActiveSidebarState();
  }, { once: true });
}
plugin.onDispose(() => activeViewBodyObserver.disconnect());

const HEADERBTN_SELECTOR = '.group\\/headerbtn, button[class*="group/headerbtn"]';

let cachedReferenceLeft = 0;
let cachedReferenceTime = 0;

function getReferenceLeft(sidebar) {
  const now = performance.now();
  if (cachedReferenceLeft > 0 && (now - cachedReferenceTime) < 500) {
    return cachedReferenceLeft;
  }
  const row = document.querySelector('[data-testid="conversation-row-sidebar"] span.truncate');
  if (row) {
    const r = row.getBoundingClientRect();
    if (r.width > 0 && r.left > 0) {
      cachedReferenceLeft = r.left;
      cachedReferenceTime = now;
      return r.left;
    }
  }
  const header = document.querySelector('[data-testid="section-header"], .group\\/section-header, [role="navigation"][aria-label="Sidebar"] h2, [role="navigation"][aria-label="Sidebar"] h3');
  if (header) {
    const r = header.getBoundingClientRect();
    if (r.width > 0 && r.left > 0) {
      cachedReferenceLeft = r.left;
      cachedReferenceTime = now;
      return r.left;
    }
  }
  if (sidebar) {
    const val = sidebar.getBoundingClientRect().left + 14;
    cachedReferenceLeft = val;
    cachedReferenceTime = now;
    return val;
  }
  return 14;
}

/**
 * Steps 1 to 3 of the alignment: everything that only writes. Returns the span
 * holding the title, which is what step 4 has to measure.
 */
function normaliseSubheading(btn) {
  const truncate = btn.querySelector('span.truncate, span[class*="truncate"]');
  if (!truncate) return null;

  // 1. Walk up from truncate to btn, hiding all previous siblings at every layer
  let current = truncate;
  while (current && current !== btn) {
    let prev = current.previousElementSibling;
    while (prev) {
      if (prev.style.display !== 'none') {
        prev.style.setProperty('display', 'none', 'important');
        prev.style.setProperty('width', '0px', 'important');
        prev.style.setProperty('min-width', '0px', 'important');
        prev.style.setProperty('max-width', '0px', 'important');
        prev.style.setProperty('margin', '0px', 'important');
        prev.style.setProperty('padding', '0px', 'important');
      }
      prev = prev.previousElementSibling;
    }
    if (current.parentElement && current.parentElement !== btn) {
      if (current.parentElement.style.paddingLeft !== '0px') {
        current.parentElement.style.setProperty('padding-left', '0px', 'important');
        current.parentElement.style.setProperty('margin-left', '0px', 'important');
        current.parentElement.style.setProperty('gap', '0px', 'important');
      }
    }
    current = current.parentElement;
  }

  // 2. Normalize btn padding
  if (btn.style.paddingLeft !== '8px') {
    btn.style.setProperty('padding-left', '8px', 'important');
    btn.style.setProperty('margin-left', '0px', 'important');
  }

  // 3. Normalize parent wrapper if present
  if (btn.parentElement && btn.parentElement.style.paddingLeft !== '0px') {
    btn.parentElement.style.setProperty('padding-left', '0px', 'important');
    btn.parentElement.style.setProperty('margin-left', '0px', 'important');
  }

  return truncate;
}

/** Step 4: the correction itself, from a measurement taken by the caller. */
function applySubheadingOffset(truncate, headingLeft, targetLeft) {
  if (!(headingLeft > 0) || !(targetLeft > 0)) return;
  const diff = headingLeft - targetLeft;
  if (Math.abs(diff) <= 0.5 || Math.abs(diff) >= 80) return;
  const currentMargin = parseFloat(truncate.style.marginLeft || '0');
  const targetMargin = `${currentMargin - diff}px`;
  if (truncate.style.marginLeft !== targetMargin) {
    truncate.style.setProperty('margin-left', targetMargin, 'important');
  }
}

/*
 * The same alignment for a whole list of headings, with every measurement taken
 * together. Reading a rect after a style write makes the browser lay the page
 * out there and then, so heading-by-heading this cost one layout of the sidebar
 * per heading, on every frame of a scroll; batched it costs one in total. There
 * is deliberately no single-heading version to reach for.
 */
function alignSubheadings(buttons) {
  const pending = [];
  for (const btn of buttons) {
    const truncate = normaliseSubheading(btn);
    if (truncate) pending.push({ btn, truncate, left: 0, width: 0 });
  }
  if (pending.length === 0) return;

  const first = pending[0].btn;
  const sidebar = first.closest('[role="navigation"][aria-label="Sidebar"]') || document.querySelector('[role="navigation"][aria-label="Sidebar"]');
  const targetLeft = getReferenceLeft(sidebar);
  for (const item of pending) {
    const rect = item.truncate.getBoundingClientRect();
    item.left = rect.left;
    item.width = rect.width;
  }
  for (const item of pending) {
    if (item.width > 0) applySubheadingOffset(item.truncate, item.left, targetLeft);
  }
}

function findHeaderRow(btn) {
  let curr = btn.parentElement;
  let candidate = null;
  while (curr && curr !== document.body) {
    if (curr.classList?.contains('group/header') ||
        curr.className?.includes?.('group/header') ||
        curr.classList?.contains('bg-sidebar') ||
        curr.style?.transform?.includes('translateY')) {
      candidate = curr;
      if (curr.classList?.contains('bg-sidebar') || curr.style?.transform?.includes('translateY')) {
        return curr;
      }
    }
    curr = curr.parentElement;
  }
  return candidate || btn.closest('.group\\/header, div[class*="group/header"]') || btn.parentElement?.parentElement;
}

const cleanedHeaderRows = new WeakSet();

function cleanHeaderActions(btn) {
  const row = findHeaderRow(btn);
  if (!row) return;

  const hideThreeDots = () => {
    const buttons = row.querySelectorAll('button');
    for (const b of buttons) {
      if (b === btn || b.classList?.contains('group/headerbtn') || b.matches?.('[class*="group/headerbtn"]')) {
        continue;
      }
      const hasPlus = b.querySelector('svg.lucide-plus, svg[class*="plus"], path[d*="M12 5"], path[d*="m12 5"], path[d*="M5 12"], path[d*="m5 12"], path[d*="12 5"], path[d*="5 12"]');
      const label = ((b.getAttribute('aria-label') || '') + ' ' + (b.getAttribute('title') || '')).toLowerCase();
      const isPlus = hasPlus || /new|add|chat|conv|plus/.test(label);
      if (!isPlus) {
        if (b.style.display !== 'none') {
          b.style.setProperty('display', 'none', 'important');
          b.style.setProperty('width', '0px', 'important');
          b.style.setProperty('min-width', '0px', 'important');
          b.style.setProperty('max-width', '0px', 'important');
          b.style.setProperty('margin', '0px', 'important');
          b.style.setProperty('padding', '0px', 'important');
          b.style.setProperty('pointer-events', 'none', 'important');
          b.style.setProperty('opacity', '0', 'important');
          b.style.setProperty('visibility', 'hidden', 'important');
        }

        if (b.parentElement && b.parentElement !== row && b.parentElement.children.length === 1) {
          if (b.parentElement.style.display !== 'none') {
            b.parentElement.style.setProperty('display', 'none', 'important');
            b.parentElement.style.setProperty('width', '0px', 'important');
            b.parentElement.style.setProperty('min-width', '0px', 'important');
            b.parentElement.style.setProperty('margin', '0px', 'important');
            b.parentElement.style.setProperty('padding', '0px', 'important');
          }
        }
      }
    }
  };

  hideThreeDots();
  if (!cleanedHeaderRows.has(row)) {
    cleanedHeaderRows.add(row);
    row.dataset.geminiCleaned = "true";
    row.addEventListener('mouseenter', hideThreeDots, { passive: true });
    const obs = new MutationObserver(hideThreeDots);
    obs.observe(row, { childList: true });
    remember(row, {
      disconnect: () => {
        row.removeEventListener('mouseenter', hideThreeDots);
        cleanedHeaderRows.delete(row);
        delete row.dataset.geminiCleaned;
        obs.disconnect();
      }
    });
  }
}

function isProjectExpanded(btn) {
  // 1. Check native SVG indicator inside btn
  const svgs = btn.querySelectorAll('svg');
  for (const svg of svgs) {
    const cls = ((svg.getAttribute('class') || '') + ' ' + (svg.className?.baseVal || '')).toLowerCase();
    if (cls.includes('rotate-90')) return true;
    if (cls.includes('rotate-0') || (cls.includes('rotate') && !cls.includes('90'))) return false;
    if (cls.includes('chevron-down') || cls.includes('arrow-down')) return true;
    if (cls.includes('chevron-right') || cls.includes('arrow-right')) return false;

    const path = svg.querySelector('path');
    const d = (path?.getAttribute('d') || '').toLowerCase();
    if (d.includes('6 9') || d.includes('m6 9')) return true;
    if (d.includes('9 18') || d.includes('m9 18')) return false;
    if (cls.includes('folder-open')) return true;
  }

  // 2. Check parent data-state or native aria attributes
  const parent = btn.parentElement;
  const parentState = parent?.getAttribute('data-state');
  if (parentState === 'open' || parentState === 'expanded') return true;
  if (parentState === 'closed' || parentState === 'collapsed') return false;

  // 3. Inspect virtualized list DOM in the scroller
  const row = findHeaderRow(btn);
  if (row && row.parentElement) {
    let next = row.nextElementSibling;
    while (next && (next.style?.display === 'none' || next.clientHeight === 0)) {
      next = next.nextElementSibling;
    }
    if (next) {
      if (next.matches?.('[data-testid="conversation-row-sidebar"]') ||
          next.querySelector?.('[data-testid="conversation-row-sidebar"]')) {
        return true;
      }
      if (next.matches?.('.bg-sidebar, .group\\/header, div[class*="group/header"]') ||
          next.querySelector?.(HEADERBTN_SELECTOR)) {
        return false;
      }
    }

    const matchY = (str) => {
      const m = str?.match(/translateY\(\s*([\d.]+)px\s*\)/);
      return m ? parseFloat(m[1]) : null;
    };
    const currentY = matchY(row.style?.transform);
    if (currentY !== null) {
      const siblings = Array.from(row.parentElement.children);
      let nextY = Infinity;
      let nextIsConv = false;
      for (const sib of siblings) {
        if (sib === row || sib.style?.display === 'none') continue;
        const y = matchY(sib.style?.transform);
        if (y !== null && y > currentY && y < nextY) {
          nextY = y;
          nextIsConv = sib.matches?.('[data-testid="conversation-row-sidebar"]') ||
                       !!sib.querySelector?.('[data-testid="conversation-row-sidebar"]');
        }
      }
      if (nextY !== Infinity) {
        if (nextIsConv) return true;
        if (nextY - currentY <= 45) return false;
      }
    }
  }

  return btn.dataset.projectExpanded !== 'false';
}

function writeProjectExpandedState(btn, expanded) {
  const value = expanded ? 'true' : 'false';
  if (btn.dataset.projectExpanded !== value) btn.dataset.projectExpanded = value;
  if (btn.getAttribute('aria-expanded') !== value) btn.setAttribute('aria-expanded', value);
}

function updateProjectExpandedState(btn) {
  writeProjectExpandedState(btn, isProjectExpanded(btn));
}

/*
 * The whole heading pass for a group of headings, with every question asked
 * before any of the answers are written down.
 *
 * `isProjectExpanded` sometimes has to measure a row's height, and a written
 * attribute makes the browser lay the sidebar out again before the next
 * measurement — so heading by heading this cost one layout per heading. Asking
 * for all of them first costs one for the group. `alignSubheadings` already
 * works this way for the titles, and this puts the two halves in the right
 * order: read, read, write, write.
 */
function headingPass(buttons, clean) {
  if (buttons.length === 0) return;
  const expanded = buttons.map((btn) => isProjectExpanded(btn));
  buttons.forEach((btn, index) => writeProjectExpandedState(btn, expanded[index]));
  alignSubheadings(buttons);
  if (clean) for (const btn of buttons) cleanHeaderActions(btn);
}

/*
 * Collects the headings that have asked for a pass and gives them one pass
 * between them.
 *
 * Each heading watches itself, so one re-render of the list wakes all of them and
 * the requests arrive in a burst. A microtask ends the task that burst arrived in
 * and still runs before the frame is drawn, so the batch lands in the same frame
 * the separate passes would have — at one measurement of the sidebar instead of
 * one per heading.
 */
const pendingHeadings = new Set();
let headingPassQueued = false;

function scheduleHeadingPass(btn) {
  pendingHeadings.add(btn);
  if (headingPassQueued) return;
  headingPassQueued = true;
  queueMicrotask(() => {
    headingPassQueued = false;
    const buttons = [...pendingHeadings].filter((candidate) => candidate.isConnected);
    pendingHeadings.clear();
    headingPass(buttons, true);
  });
}

plugin.dom.observe(HEADERBTN_SELECTOR, (btn) => {
  scheduleHeadingPass(btn);
  // Antigravity fills the heading in a moment after it appears, so the pass is
  // asked for again once the first frame is out.
  requestAnimationFrame(() => scheduleHeadingPass(btn));

  const observer = new MutationObserver(() => scheduleHeadingPass(btn));
  observer.observe(btn, { childList: true });
  remember(btn, observer);

  listenToElement(btn, 'click', () => {
    // Blur immediately on click to prevent focus from keeping the plus button visible
    btn.blur();
    const scroller = document.querySelector('[data-testid="conversation-list-sidebar"]');

    setTimeout(() => {
      btn.blur();
      scheduleHeadingPass(btn);
      if (scroller) reorganizePinnedItems(scroller);
    }, 60);

    setTimeout(() => {
      btn.blur();
      updateProjectExpandedState(btn);
      if (scroller) reorganizePinnedItems(scroller);
    }, 250);
  });

  listenToElement(btn, 'mouseup', () => {
    btn.blur();
  });
});

plugin.dom.observe('[role="navigation"][aria-label="Sidebar"]', (sidebar) => {
  const onHover = (e) => {
    const row = e.target?.closest?.('.group\\/header, div[class*="group/header"], .bg-sidebar');
    if (row) {
      const headerBtn = row.querySelector(HEADERBTN_SELECTOR);
      if (headerBtn) cleanHeaderActions(headerBtn);
    }
  };
  sidebar.addEventListener('mouseover', onHover, { passive: true });
  remember(sidebar, { disconnect: () => sidebar.removeEventListener('mouseover', onHover) });
});

/* ---------------------------------------------------------------------------
 * Project conversation list expand/collapse toggle ("All conversations" / "Show less")
 * ------------------------------------------------------------------------- */
const PROJECT_CONV_TOGGLE_SELECTOR = '[role="navigation"][aria-label="Sidebar"] div[class*="pl-[22px]"] > button';

function syncProjectConvToggle(btn) {
  const text = (btn.textContent || '').trim().toLowerCase();
  const isExpanded = /less|collapse|fewer/i.test(text);
  const val = String(isExpanded);
  if (btn.dataset.geminiExpanded !== val) {
    btn.dataset.geminiExpanded = val;
  }
}

plugin.dom.observe(PROJECT_CONV_TOGGLE_SELECTOR, (btn) => {
  syncProjectConvToggle(btn);
  const observer = new MutationObserver(() => syncProjectConvToggle(btn));
  observer.observe(btn, { subtree: true, childList: true, characterData: true });
  const onClick = () => queueMicrotask(() => syncProjectConvToggle(btn));
  btn.addEventListener('click', onClick);
  remember(btn, {
    disconnect: () => {
      btn.removeEventListener('click', onClick);
      observer.disconnect();
    }
  });
});

/* ---------------------------------------------------------------------------
 * Pinned conversations under project headers
 * ---------------------------------------------------------------------------
 * Antigravity keeps pinned conversations in a section of their own at the top
 * of the sidebar; Willow shows each one under the project it belongs to. The
 * list is virtualised — every row is placed by script out of an `items` array —
 * so this is the one part of the sidebar CSS cannot reach, and the array has to
 * be rewritten on its way into the component that renders it.
 *
 * Two rules keep that from wedging the renderer, which is what the first
 * attempt at this did:
 *
 *   1. Nothing here asks React to render. The wrapper is installed and takes
 *      effect on the host's own next render — and pinning, the act this exists
 *      for, always causes one. Forcing a render instead (dispatching into a
 *      hook queue, or firing a synthetic scroll on the element whose scroll
 *      handler runs this) feeds the observer that called it, and the renderer
 *      never reaches another frame.
 *   2. `fiber.type` is swapped and `fiber.elementType` is left alone. React
 *      reconciles children on elementType, so the fiber survives; swapping
 *      both makes every parent render see a changed type and rebuild the whole
 *      list from scratch — which drops the wrapper, so it is installed again,
 *      and again.
 *
 * Every pass below is idempotent, so the mutations a render causes settle
 * instead of feeding themselves.
 * ------------------------------------------------------------------------- */
function handleNewConversationActivation(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  // A pet quick chat belongs to Conversations even while Work is selected.
  // React carries the explicit DOM event marker on nativeEvent.
  const projectless = (e?.nativeEvent ?? e)?.betterGravityProjectless === true;
  if (projectless) {
    const pill = document.querySelector('#gemini-experience-switch');
    if (pill) markExperience(pill, 'chat', true);
    else {
      setStoredExperience('chat');
      document.documentElement.setAttribute('data-gemini-experience', 'chat');
    }
  }
  navigateToExperienceNewConversation(projectless ? 'chat' : getStoredExperience());
}

function checkUrlForProjectSwitch() {
  const params = new URLSearchParams(window.location.search);
  const section = params.get('section');
  if (section && section !== 'outside-of-project') {
    setLastSelectedProjectId(section);
    if (getStoredExperience() === 'chat') {
      const pill = document.querySelector('#gemini-experience-switch');
      if (pill) markExperience(pill, 'work', true);
    }
    return;
  } else if (section === 'outside-of-project') {
    if (getStoredExperience() === 'work') {
      const pill = document.querySelector('#gemini-experience-switch');
      if (pill) markExperience(pill, 'chat', true);
    }
    return;
  }

  const m = window.location.pathname.match(/\/c\/([a-zA-Z0-9_-]+)/);
  if (m && m[1]) {
    const cid = m[1];
    const gid = conversationProjectMap.get(cid + ':groupId');
    if (gid) {
      setLastSelectedProjectId(gid);
      if (getStoredExperience() === 'chat') {
        const pill = document.querySelector('#gemini-experience-switch');
        if (pill) markExperience(pill, 'work', true);
      }
    } else if (conversationProjectMap.size > 0) {
      const isProjectChat = conversationProjectMap.has(cid) || conversationProjectMap.has(cid + ':groupId');
      if (!isProjectChat && getStoredExperience() === 'work') {
        const pill = document.querySelector('#gemini-experience-switch');
        if (pill) markExperience(pill, 'chat', true);
      }
    }
  }
}

/**
 * The component holding the pinned and project state is found by its own source
 * text, since the compiler mangles names. `toString()` on a compiled component
 * is not cheap and this is asked once per render, so each function is judged
 * once and remembered.
 */
const pinnedStateOwners = new WeakMap();

function ownsPinnedState(type) {
  if (typeof type !== 'function') return false;
  let owns = pinnedStateOwners.get(type);
  if (owns === undefined) {
    let source = '';
    try {
      source = type.toString();
    } catch {
      source = '';
    }
    owns = source.includes('hasPinnedSection') || source.includes('section-pinned');
    pinnedStateOwners.set(type, owns);
  }
  return owns;
}

function findPinnedStateOwner(fiber) {
  for (let curr = fiber; curr; curr = curr.return) {
    if (ownsPinnedState(curr.type)) return curr;
  }
  return null;
}

function updateProjectMapFromFiber(fiber) {
  const owner = findPinnedStateOwner(fiber);
  if (!owner) return;
  readProjectMap(owner);
  // React keeps two fibers per component and renders them alternately, so the
  // one this was reached from can be a render behind. Reading both costs a
  // second walk over the same hooks and cannot go stale.
  if (owner.alternate) readProjectMap(owner.alternate);
}

function readProjectMap(cJb) {
  let h = cJb.memoizedState;
  while (h) {
    const val = h.memoizedState;
    const fn = typeof val === 'function' ? val : (Array.isArray(val) && typeof val[0] === 'function' ? val[0] : null);
    if (isNewConversationCallback(fn)) {
      activeGoToNewConversation = fn;
    }
    if (Array.isArray(val)) {
      if (val.length > 0 && val[0]?.cascadeId) {
        for (const c of val) {
          const ws = c.summary?.workspaces?.[0];
          const uri = ws?.workspaceFolderAbsoluteUri || ws?.gitRootAbsoluteUri;
          if (c.cascadeId && uri) {
            const name = decodeURIComponent(uri.replace(/\/+$/, '').split('/').pop());
            if (name) conversationProjectMap.set(c.cascadeId, name);
          }
        }
      }
      if (val.length > 0 && val[0] && typeof val[0] === 'object' && (val[0].label || val[0].title) && Array.isArray(val[0].items)) {
        for (const g of val) {
          const projName = g.label || g.title;
          const projId = g.id;
          if (projId && !firstDiscoveredProjectId) {
            firstDiscoveredProjectId = projId;
          }
          if (Array.isArray(g.items)) {
            for (const it of g.items) {
              const id = typeof it === 'string' ? it : (it?.cascadeId || it?.id);
              if (id) {
                if (projName) conversationProjectMap.set(id, projName);
                if (projId) conversationProjectMap.set(id + ':groupId', projId);
              }
            }
          }
        }
      }
    }
    h = h.next;
  }
}

let listRerenderDispatcher = null;

function triggerListRerender() {
  if (typeof listRerenderDispatcher === 'function') {
    listRerenderDispatcher();
    return;
  }
  const scroller = document.querySelector(LIST_SELECTOR);
  if (!scroller) return;
  reorganizePinnedItems(scroller);
  if (typeof listRerenderDispatcher === 'function') {
    listRerenderDispatcher();
    return;
  }
  scroller.dispatchEvent(new Event('scroll'));
}

function transformItems(items, fiber) {
  if (!Array.isArray(items) || items.length === 0) return items;

  if (fiber) updateProjectMapFromFiber(fiber);

  const exp = getStoredExperience();

  if (exp === 'chat') {
    // Chat mode: Show "Conversations" (standalone) and any standalone pinned chats.
    // Exclude Projects section header, project headers, project rows, project show-mores.
    const pinnedRows = [];
    const chatItems = [];

    for (const it of items) {
      if (!it) continue;
      if (it.id === 'section-pinned' || it.id === 'spacer-section-pinned' || it.id === 'spacer-pinned-header') continue;
      if (it.id === 'main-section-header' || it.id === 'spacer-section-standalone') continue;
      if (it.type === 'header' && it.id?.startsWith('header-')) continue;

      if (it.type === 'row') {
        const cid = it.cascadeId || it.id;
        const isProjectChat = conversationProjectMap.has(cid) || conversationProjectMap.has(cid + ':groupId');
        if (it.groupId === 'pinned') {
          if (!isProjectChat) pinnedRows.push(it);
          continue;
        }
        if (it.groupId === 'standalone' && !isProjectChat) {
          chatItems.push(it);
          continue;
        }
        // Project chat -> skip in chat mode
        continue;
      }

      if (it.type === 'show-more') {
        if (it.groupId === 'standalone') chatItems.push(it);
        continue;
      }

      if (it.id === 'section-standalone') {
        chatItems.push({
          ...it,
          title: 'Recents'
        });
        continue;
      }
    }

    const result = [];
    if (pinnedRows.length > 0) {
      result.push({
        type: 'section-header',
        id: 'section-pinned',
        title: 'Pinned Conversations',
        isCollapsible: true,
        isCollapsed: false,
        collapseId: 'pinned'
      });
      result.push(...pinnedRows);
      result.push({
        type: 'spacer',
        id: 'spacer-section-pinned',
        height: 16
      });
    } else {
      result.push({
        type: 'spacer',
        id: 'spacer-section-standalone',
        height: 14
      });
    }
    result.push(...chatItems);
    return result;
  }

  // Work mode: Show "Projects" and all project headers, project rows, and project show-mores.
  // Exclude "Conversations" (standalone) and standalone rows.
  const pinnedRows = [];
  const workItems = [];

  for (const it of items) {
    if (!it) continue;
    if (it.id === 'section-pinned' || it.id === 'spacer-section-pinned' || it.id === 'spacer-pinned-header') continue;
    if (it.id === 'section-standalone' || it.id === 'spacer-section-standalone') continue;

    if (it.type === 'header') {
      const pid = (it.id || '').replace(/^header-/, '');
      if (pid && !firstDiscoveredProjectId) firstDiscoveredProjectId = pid;
    }

    if (it.type === 'row') {
      const cid = it.cascadeId || it.id;
      const isProjectChat = conversationProjectMap.has(cid) || conversationProjectMap.has(cid + ':groupId');
      if (it.groupId === 'pinned') {
        if (isProjectChat) pinnedRows.push(it);
        continue;
      }
      if (it.groupId === 'standalone') {
        continue; // Exclude standalone row in work mode
      }
      workItems.push(it);
      continue;
    }

    if (it.type === 'show-more') {
      if (it.groupId === 'standalone') continue;
      workItems.push(it);
      continue;
    }

    workItems.push(it);
  }

  // If any project chats were pinned, insert them under their respective project headers
  if (pinnedRows.length > 0) {
    const projectHeaders = new Map();
    for (let i = 0; i < workItems.length; i++) {
      const it = workItems[i];
      if (it && it.type === 'header') {
        const projId = (it.id || '').replace(/^header-/, '');
        if (it.label) projectHeaders.set(it.label.toLowerCase(), { index: i, header: it, projId });
        if (projId) projectHeaders.set(projId.toLowerCase(), { index: i, header: it, projId });
      }
    }

    const pinnedByHeaderIndex = new Map();
    const unassignedPinned = [];

    for (const pRow of pinnedRows) {
      const cid = pRow.cascadeId || pRow.id;
      const projName = conversationProjectMap.get(cid);
      const directGroupId = conversationProjectMap.get(cid + ':groupId');

      let matched = null;
      if (directGroupId && projectHeaders.has(directGroupId.toLowerCase())) {
        matched = projectHeaders.get(directGroupId.toLowerCase());
      } else if (projName && projectHeaders.has(projName.toLowerCase())) {
        matched = projectHeaders.get(projName.toLowerCase());
      } else if (projName) {
        for (const [key, entry] of projectHeaders) {
          if (key.includes(projName.toLowerCase()) || projName.toLowerCase().includes(key)) {
            matched = entry;
            break;
          }
        }
      }

      if (matched) {
        if (!pinnedByHeaderIndex.has(matched.index)) {
          pinnedByHeaderIndex.set(matched.index, []);
        }
        pinnedByHeaderIndex.get(matched.index).push({
          ...pRow,
          groupId: matched.projId,
          isIndented: false
        });
      } else {
        unassignedPinned.push(pRow);
      }
    }

    const result = [];
    if (unassignedPinned.length > 0) {
      result.push({
        type: 'section-header',
        id: 'section-pinned',
        title: 'Pinned Conversations',
        isCollapsible: true,
        isCollapsed: false,
        collapseId: 'pinned'
      });
      result.push(...unassignedPinned);
      result.push({
        type: 'spacer',
        id: 'spacer-section-pinned',
        height: 16
      });
    }

    for (let i = 0; i < workItems.length; i++) {
      const it = workItems[i];
      result.push(it);
      if (pinnedByHeaderIndex.has(i)) {
        if (!it.isCollapsed) {
          result.push(...pinnedByHeaderIndex.get(i));
        }
      }
    }
    return result;
  }

  return workItems;
}

/**
 * The array lives on a component above the scroller. Which one is not fixed —
 * the compiler decides how many wrappers sit in between — so the nearest
 * function component whose props carry an `items` array is taken, a few levels
 * up at most.
 */
function listFiberFor(scroller) {
  let fiber = plugin.react.getFiber(scroller);
  for (let depth = 0; fiber && depth < 6; depth += 1, fiber = fiber.return) {
    if (typeof fiber.type === 'function' && Array.isArray(fiber.memoizedProps?.items)) return fiber;
  }
  return null;
}

/** Keep live wrappers restorable without retaining unmounted React trees. */
const wrappedFibers = new Set();
const ORIGINAL = '__geminiOriginal';

function wrapItems(fiber) {
  const original = fiber.type;
  if (typeof original !== 'function' || original[ORIGINAL]) return;

  const wrapper = function (props, secondArg) {
    if (typeof props?.onHoverGroupId === 'function') {
      listRerenderDispatcher = () => {
        try {
          props.onHoverGroupId('__gemini_refresh__');
          setTimeout(() => {
            try { props.onHoverGroupId(null); } catch {}
          }, 0);
        } catch {}
      };
    }
    const items = props && Array.isArray(props.items) ? transformItems(props.items, fiber) : null;
    // transformItems hands back the array it was given when nothing is pinned,
    // and then the component is called with the props object it would have had.
    const next = items && items !== props.items ? { ...props, items } : props;
    return original.call(this, next, secondArg);
  };
  wrapper[ORIGINAL] = original;
  wrapper.displayName = original.displayName || original.name;

  // type is what React calls; elementType is what it reconciles on. Rule 2.
  fiber.type = wrapper;
  if (fiber.alternate) fiber.alternate.type = wrapper;
  wrappedFibers.add(new WeakRef(fiber));
  if (wrappedFibers.size >= 512) {
    for (const ref of wrappedFibers) if (!ref.deref()) wrappedFibers.delete(ref);
  }
}

function unwrapItems() {
  for (const ref of wrappedFibers) {
    const fiber = ref.deref();
    if (!fiber) continue;
    for (const target of [fiber, fiber.alternate]) {
      const original = target?.type?.[ORIGINAL];
      if (original) target.type = original;
    }
  }
  wrappedFibers.clear();
}

/**
 * Installing the wrapper is the whole of it. The reordered list appears on the
 * host's next render of that component — pinning, unpinning, selecting a
 * conversation and scrolling all cause one — and asking for a render from here
 * is what made this a loop. Rule 1.
 */
function reorganizePinnedItems(scroller) {
  if (!scroller?.isConnected) return;
  const fiber = listFiberFor(scroller);
  if (fiber) wrapItems(fiber);
}

/*
 * One pass per frame at most. A pass writes only styles and attributes, never a
 * child of the scroller, which is all the observer below watches — so a pass
 * cannot schedule the next one.
 */
let sidebarPassScheduled = null;

function sidebarPass(scroller) {
  reorganizePinnedItems(scroller);
  // Scoped to the sidebar rather than the document: every heading and row below
  // lives inside it, and the substring class match in HEADERBTN_SELECTOR is a
  // walk over every element it is handed — which on a scroll was the whole
  // document, once a frame.
  const root = scroller.closest('[role="navigation"][aria-label="Sidebar"]') || scroller;
  if (root && root.getAttribute('role') === 'navigation') {
    ensureExperienceSwitch(root);
  }
  const buttons = [...root.querySelectorAll(HEADERBTN_SELECTOR)];
  headingPass(buttons, false);
  for (const row of root.querySelectorAll('[data-testid="conversation-row-sidebar"]')) hideConversationTime(row);
  checkUrlForProjectSwitch();
}

function scheduleSidebarPass(scroller) {
  if (sidebarPassScheduled !== null) return;
  sidebarPassScheduled = requestAnimationFrame(() => {
    sidebarPassScheduled = null;
    if (scroller.isConnected) sidebarPass(scroller);
  });
}

plugin.dom.observe('[data-testid="conversation-list-sidebar"]', (scroller) => {
  const onUpdate = () => scheduleSidebarPass(scroller);
  scroller.addEventListener('scroll', onUpdate, { passive: true });
  const scrollerObs = new MutationObserver(onUpdate);
  scrollerObs.observe(scroller, { childList: true });
  remember(scroller, {
    disconnect: () => {
      scroller.removeEventListener('scroll', onUpdate);
      scrollerObs.disconnect();
    }
  });

  sidebarPass(scroller);
});

listenToPage(document, 'click', (e) => {
  const projCard = e.target.closest('button[data-project-card="true"], .group\\/headerbtn');
  if (projCard) {
    const fiber = plugin.react.getFiber(projCard);
    let curr = fiber;
    while (curr) {
      const pid = curr.memoizedProps?.sectionId || curr.memoizedProps?.projectId || curr.memoizedProps?.item?.id;
      if (pid) {
        const cleanId = String(pid).replace(/^header-/, '');
        setLastSelectedProjectId(cleanId);
        if (getStoredExperience() === 'chat') {
          const pill = document.querySelector('#gemini-experience-switch');
          if (pill) markExperience(pill, 'work', true);
        }
        break;
      }
      curr = curr.return;
    }
  }

  const convRow = e.target.closest('[data-testid="conversation-row-sidebar"]');
  if (convRow) {
    const fiber = plugin.react.getFiber(convRow);
    let curr = fiber;
    while (curr) {
      const cid = curr.memoizedProps?.conversation?.cascadeId || curr.memoizedProps?.cascadeId || curr.memoizedProps?.id;
      if (cid) {
        const gid = conversationProjectMap.get(cid + ':groupId');
        if (gid) {
          setLastSelectedProjectId(gid);
          if (getStoredExperience() === 'chat') {
            const pill = document.querySelector('#gemini-experience-switch');
            if (pill) markExperience(pill, 'work', true);
          }
        }
        break;
      }
      curr = curr.return;
    }
  }
}, true);

listenToPage(window, 'keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'O' || e.key === 'o')) {
    handleNewConversationActivation(e);
  }
}, true);

listenToPage(window, 'popstate', checkUrlForProjectSwitch);
listenToPage(window, 'hashchange', checkUrlForProjectSwitch);

let lastCheckedUrl = '';
const urlTicker = window.setInterval(() => {
  if (window.location.href !== lastCheckedUrl) {
    lastCheckedUrl = window.location.href;
    checkUrlForProjectSwitch();
  }
}, 300);

function hideConversationTime(row) {
  if (!row) return;
  const resting = row.querySelector('.pointer-events-auto > div > div:last-child, [class*="group-hover:opacity-0"]');
  if (resting && resting.style.display) {
    resting.style.removeProperty('display');
  }

  const pinBtn = row.querySelector('[data-testid="conversation-pin-button"]');
  const isPinBtnPinned = pinBtn ? !!pinBtn.getAttribute('aria-label')?.toLowerCase()?.includes('unpin') : null;
  const isPinned = isPinBtnPinned !== null
    ? isPinBtnPinned
    : (row.getAttribute('data-pinned') === 'true' || row.closest('[data-title="Pinned Conversations"]') !== null);

  if (isPinned) {
    if (row.getAttribute('data-pinned') !== 'true') {
      row.setAttribute('data-pinned', 'true');
    }
  } else {
    if (row.getAttribute('data-pinned') === 'true') {
      row.removeAttribute('data-pinned');
    }
  }

  if (resting) {
    for (const node of Array.from(resting.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
        node.textContent = '';
      }
    }
  }
}

plugin.dom.observe('[data-testid="conversation-row-sidebar"]', (row) => {
  hideConversationTime(row);
  const obs = new MutationObserver(() => hideConversationTime(row));
  obs.observe(row, { childList: true, subtree: true });
  remember(row, obs);
});

plugin.dom.observe('[data-testid="conversation-kebab"]', (kebab) => {
  const wrapper = kebab.parentElement;
  if (wrapper && wrapper.style) {
    wrapper.style.setProperty('background', 'transparent', 'important');
    wrapper.style.setProperty('background-image', 'none', 'important');
    wrapper.style.setProperty('box-shadow', 'none', 'important');
  }
});

/* ---------------------------------------------------------------------------
 * Conversation row kebab menu enhancer: adds Willow Pin & Archive actions
 * ------------------------------------------------------------------------- */
let activeConversationRow = null;

// Track the row whose kebab, context menu, or mouseover was activated
function updateActiveConversationRow(e) {
  const target = e.target;
  if (!target || !target.closest) return;
  if (e.type === 'mouseover' && !target.closest('[role="navigation"]') && !target.closest('[data-testid="conversation-row-history"]')) return;
  const kebab = target.closest('[data-testid="conversation-kebab"]');
  if (kebab) {
    activeConversationRow = kebab.closest('[data-testid="conversation-row-sidebar"], [data-testid="conversation-row-history"]');
    if (e.type === 'click' || e.type === 'pointerdown') {
      requestAnimationFrame(() => {
        const menu = document.querySelector('[role="menu"]');
        if (menu) enhanceConversationMenu(menu);
      });
      setTimeout(() => {
        const menu = document.querySelector('[role="menu"]');
        if (menu) enhanceConversationMenu(menu);
      }, 50);
    }
    return;
  }
  const row = target.closest('[data-testid="conversation-row-sidebar"], [data-testid="conversation-row-history"]');
  if (row) {
    activeConversationRow = row;
  }
}

document.addEventListener('pointerdown', updateActiveConversationRow, true);
document.addEventListener('click', updateActiveConversationRow, true);
document.addEventListener('mouseover', updateActiveConversationRow, { passive: true, capture: true });
document.addEventListener('contextmenu', updateActiveConversationRow, true);

function closeActiveMenu(menu) {
  activeConversationRow = null;
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
  setTimeout(() => {
    if (menu?.isConnected) {
      document.body.click();
    }
  }, 20);
}

const PIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 -960 960 960" fill="currentColor" class="shrink-0"><path d="m640-480 80 80v40H520v240l-40 40-40-40v-240H240v-40l80-80v-280h-40v-40h400v40h-40v280Zm-286 80h252l-46-46v-314H400v314l-46 46Zm126 0Z"/></svg>`;

const UNPIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 -960 960 960" fill="currentColor" class="shrink-0"><path d="M660-820v60H620v307l-60-60V-760H400v87l-64.31-64.31l-20.31-43H300V-820H660ZM480-90l-30-30V-340H268.46v-60L340-471.54v-62.92l-254.77-256l42.15-42.15L817.23-142.77l-43.38,42.15L534.46-340H510v220L480-90ZM354-400H475.23l-74-73.23L400-446l-46,46ZM480-593ZM401.23-473.23Z"/></svg>`;

const ARCHIVE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 -960 960 960" fill="currentColor" class="shrink-0"><path d="M480-256.16L626.15-402.31L584-444.46l-74,74v-178H450v178l-74-74l-42.15,42.15L480-256.16ZM200-643.85v431.54q0,5.39 3.46,8.85t8.85,3.46H747.69q5.39,0 8.85-3.46t3.46-8.85V-643.85H200ZM215.39-140q-29.92,0-52.65-22.73T140-215.39V-679.77q0-12.85 4.12-24.5t12.35-21.5l56.15-67.92q9.85-12.85 24.62-19.58T268.46-820h422.3q16.46,0 31.42,6.73T747-793.69L803.54-725q8.23,9.85 12.35,21.69T820-678.61v463.23q0,29.92-22.73,52.65T744.61-140H215.39Zm0.23-563.84H744l-43.62-51.92q-1.92-1.92-4.42-3.08T690.77-760H268.85q-2.69,0-5.19,1.15t-4.42,3.08l-43.62,51.92ZM480-421.92Z"/></svg>`;

const TERMINAL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" class="shrink-0"><path fill-rule="evenodd" clip-rule="evenodd" d="M4.02975 19.9703C4.38308 20.3234 4.80908 20.5 5.30775 20.5H18.6923C19.1909 20.5 19.6169 20.3234 19.9703 19.9703C20.3234 19.6169 20.5 19.1909 20.5 18.6923V5.30775C20.5 4.80908 20.3234 4.38308 19.9703 4.02975C19.6169 3.67658 19.1909 3.5 18.6923 3.5H5.30775C4.80908 3.5 4.38308 3.67658 4.02975 4.02975C3.67658 4.38308 3.5 4.80908 3.5 5.30775V18.6923C3.5 19.1909 3.67658 19.6169 4.02975 19.9703ZM5.09625 5.09625C5.16025 5.03208 5.23075 5 5.30775 5H18.6923C18.7693 5 18.8398 5.03208 18.9038 5.09625C18.9679 5.16025 19 5.23075 19 5.30775V18.6923C19 18.7693 18.9679 18.8398 18.9038 18.9038C18.8398 18.9679 18.7693 19 18.6923 19H5.30775C5.23075 19 5.16025 18.9679 5.09625 18.9038C5.03208 18.8398 5 18.7693 5 18.6923V5.30775C5 5.23075 5.03208 5.16025 5.09625 5.09625Z" fill="currentColor"></path><path d="M11.25 15.8122C11.0375 15.8122 10.8594 15.7403 10.7158 15.5965C10.5719 15.4526 10.5 15.2745 10.5 15.062C10.5 14.8493 10.5719 14.6712 10.7158 14.5277C10.8594 14.384 11.0375 14.3122 11.25 14.3122H15.25C15.4625 14.3122 15.6406 14.3841 15.7842 14.528C15.9281 14.6718 16 14.85 16 15.0625C16 15.2751 15.9281 15.4532 15.7842 15.5967C15.6406 15.7404 15.4625 15.8122 15.25 15.8122H11.25Z" fill="currentColor"></path><path d="M7.223 8.49222L8.72689 9.99995L7.22795 11.4915C7.07928 11.6401 7.00495 11.8167 7.00495 12.0212C7.00495 12.2257 7.07928 12.4023 7.22795 12.551C7.37661 12.6996 7.5517 12.774 7.7532 12.774C7.95453 12.774 8.1307 12.6996 8.2817 12.551L10.2076 10.6327C10.3883 10.4519 10.4786 10.2409 10.4786 9.99995C10.4786 9.75895 10.3883 9.54803 10.2076 9.3672L8.27675 7.43272C8.12575 7.28405 7.94959 7.20972 7.74825 7.20972C7.54675 7.20972 7.37166 7.28405 7.223 7.43272C7.07433 7.58138 7 7.75797 7 7.96247C7 8.16697 7.07433 8.34355 7.223 8.49222Z" fill="currentColor"></path></svg>`;

function createConvMenuItem(id, iconSvg, text, onClick) {
  const item = document.createElement('div');
  item.id = id;
  item.setAttribute('role', 'menuitem');
  item.setAttribute('tabindex', '-1');
  item.className = 'gemini-menu-item';
  item.innerHTML = `
    <span class="gemini-menu-item-slot">${iconSvg}</span>
    <span class="gemini-menu-item-label">${text}</span>
    <span aria-hidden="true" class="gemini-menu-item-trailing"></span>
  `;
  item.addEventListener('click', onClick);
  return item;
}

/** The first thing in the menu the host put there, rather than one of ours. */
function firstHostMenuItem(menu) {
  for (let node = menu.firstElementChild; node; node = node.nextElementSibling) {
    if (node.id !== 'gemini-menu-item-pin' && node.id !== 'gemini-menu-item-archive') return node;
  }
  return null;
}

/**
 * Puts one of our actions in the menu, and leaves the menu alone when it is
 * already right.
 *
 * The menu is watched for changes, because the host fills it in a moment after
 * it opens, so this runs again on every change. Taking the item out and
 * building it again each time would itself be a change, which wakes the
 * watcher, which builds it again - a loop with no end, which is a window that
 * never comes back. So every write below first asks whether it would change
 * anything at all.
 *
 * `anchor` is the item to sit in front of, or null to sit last.
 */
function syncConvMenuItem(menu, id, label, iconSvg, action, anchor) {
  let item = menu.querySelector('#' + id);
  // The label picks the icon, so a different label is a different item.
  if (item && item.getAttribute('data-gemini-item-label') !== label) {
    item.remove();
    item = null;
  }
  if (!item) {
    const made = createConvMenuItem(id, iconSvg, label, (event) => made.geminiAction?.(event));
    made.setAttribute('data-gemini-item-label', label);
    item = made;
  }
  // What the click does depends on the row, and a menu can outlive a row.
  item.geminiAction = action;
  const placed = anchor ? item.nextElementSibling === anchor : item === menu.lastElementChild;
  if (!placed) menu.insertBefore(item, anchor ?? null);
  return item;
}

function enhanceConversationMenu(menu) {
  // Ignore model selector, plus menu, or nested submenus that are not conversation actions
  if (menu.hasAttribute('data-gemini-plus-menu') || 
      menu.querySelector('[data-gemini-tools]') ||
      menu.querySelector('[data-gemini-row]') ||
      menu.querySelector('[data-gemini-label]') ||
      isPlusMenu(menu) ||
      menu.querySelector('[data-testid="model-selector-panel"]') || 
      menu.hasAttribute('data-nested')) {
    return;
  }

  const isConvTrigger = document.querySelector('[data-testid="conversation-kebab"][aria-expanded="true"], [data-testid="conversation-kebab"][data-popup-open]');
  const isTitlebarTrigger = document.querySelector('[data-testid="titlebar-more-actions"][aria-expanded="true"], [data-testid="titlebar-more-actions"][data-popup-open]');
  const hasConvItems = !!menu.querySelector('[data-testid*="conversation-"]') ||
                       Array.from(menu.querySelectorAll('[role="menuitem"]')).some(el => {
                         const t = (el.textContent || '').trim().toLowerCase();
                         return t === 'rename' || t === 'delete' || t.startsWith('pin') || t.startsWith('unpin') || t.includes('unread') || t.includes('read') || t.includes('fork') || t === 'terminal';
                       });

  if (!hasConvItems && !isConvTrigger && !isTitlebarTrigger) return;

  const triggerId = menu.getAttribute('aria-labelledby');
  const triggerFromLabel = triggerId ? document.getElementById(triggerId) : null;

  const row = triggerFromLabel?.closest('[data-testid="conversation-row-sidebar"], [data-testid="conversation-row-history"]') ||
              isConvTrigger?.closest('[data-testid="conversation-row-sidebar"], [data-testid="conversation-row-history"]') ||
              activeConversationRow ||
              document.querySelector('[data-testid="conversation-row-sidebar"]:hover, [data-testid="conversation-row-history"]:hover');

  if (!row && !isTitlebarTrigger && !hasConvItems) return;

  menu.setAttribute('data-gemini-conversation-menu', 'true');
  menu.classList.remove('animate-slideIn');

  // Ensure Terminal menu item has an unmasked, reliable icon
  const termItem = Array.from(menu.querySelectorAll('[role="menuitem"]')).find(el =>
    el.textContent?.trim().toLowerCase() === 'terminal'
  );
  if (termItem) {
    const svg = termItem.querySelector('svg');
    if (!svg) {
      termItem.insertAdjacentHTML('afterbegin', TERMINAL_SVG);
    } else {
      const mask = svg.querySelector('mask');
      if (mask) mask.remove();
      const g = svg.querySelector('g[mask]');
      if (g) g.removeAttribute('mask');
    }
  }

  // Ensure Fork conversation menu item icon is valid (both in row kebab and titlebar menu)
  const forkItem = Array.from(menu.querySelectorAll('[role="menuitem"]')).find(el =>
    el.textContent?.trim().toLowerCase().includes('fork conversation')
  );
  if (forkItem) {
    const brokenPath = forkItem.querySelector('svg path[d*="<svg"]');
    if (brokenPath) {
      const match = brokenPath.getAttribute('d').match(/d=["']([^"']+)["']/);
      if (match) {
        brokenPath.setAttribute('d', match[1]);
      }
    }
  }

  if (!row) return;

  const pinBtn = row.querySelector('[data-testid="conversation-pin-button"]');
  const archiveBtn = row.querySelector('[data-testid="conversation-archive-button"], [data-testid="conversation-restore-button"]');

  const isPinned = row.getAttribute('data-pinned') === 'true' || 
                   pinBtn?.getAttribute('aria-label')?.toLowerCase()?.includes('unpin') ||
                   row.closest('[data-title="Pinned Conversations"]') !== null;

  // 1. Injected Pin item
  if (pinBtn) {
    const label = isPinned ? 'Unpin' : 'Pin';
    const renameItem = Array.from(menu.querySelectorAll('[role="menuitem"]')).find(el =>
      el.id !== 'gemini-menu-item-pin' && el.id !== 'gemini-menu-item-archive' && el.textContent?.toLowerCase()?.includes('rename')
    );
    syncConvMenuItem(
      menu,
      'gemini-menu-item-pin',
      label,
      isPinned ? UNPIN_SVG : PIN_SVG,
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        pinBtn.click();
        closeActiveMenu(menu);
      },
      renameItem ?? firstHostMenuItem(menu) ?? menu.querySelector('#gemini-menu-item-archive')
    );
  } else {
    menu.querySelector('#gemini-menu-item-pin')?.remove();
  }

  // 2. Injected Archive item
  if (archiveBtn) {
    const isRestore = archiveBtn.getAttribute('data-testid') === 'conversation-restore-button' ||
                      archiveBtn.getAttribute('aria-label')?.toLowerCase()?.includes('restore') ||
                      archiveBtn.getAttribute('aria-label')?.toLowerCase()?.includes('unarchive');
    const label = isRestore ? 'Unarchive' : 'Archive';
    const deleteItem = Array.from(menu.querySelectorAll('[role="menuitem"]')).find(el =>
      el.id !== 'gemini-menu-item-pin' && el.id !== 'gemini-menu-item-archive' && el.textContent?.toLowerCase()?.includes('delete')
    );
    syncConvMenuItem(
      menu,
      'gemini-menu-item-archive',
      label,
      ARCHIVE_SVG,
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        archiveBtn.click();
        closeActiveMenu(menu);
      },
      deleteItem ?? null
    );
  } else {
    menu.querySelector('#gemini-menu-item-archive')?.remove();
  }
}

plugin.dom.observe('[role="menu"]', (menu) => {
  /*
   * The pass reads the whole menu as it stands, so the changes it just made
   * need no second look - and dropping them is what stops a change from asking
   * for another one for as long as the menu is open.
   */
  const observer = new MutationObserver(() => {
    enhanceConversationMenu(menu);
    observer.takeRecords();
  });
  enhanceConversationMenu(menu);
  observer.observe(menu, { childList: true });
  remember(menu, {
    disconnect: () => {
      observer.disconnect();
      activeConversationRow = null;
    }
  });
});

function onGlobalKeyDown(e) {
  const isModifier = isMac ? e.metaKey : e.ctrlKey;
  if (isModifier && e.shiftKey && e.key.toLowerCase() === "o") {
    const btn = document.querySelector(NEW_CONV_SELECTOR);
    if (btn) {
      e.preventDefault();
      btn.click();
    }
  }
}

window.addEventListener("keydown", onGlobalKeyDown);

plugin.onDispose(() => {
  window.removeEventListener("keydown", onGlobalKeyDown);
  if (sidebarPassScheduled !== null) {
    cancelAnimationFrame(sidebarPassScheduled);
    sidebarPassScheduled = null;
  }
  document.removeEventListener('pointerdown', updateActiveConversationRow, true);
  document.removeEventListener('click', updateActiveConversationRow, true);
  document.removeEventListener('mouseover', updateActiveConversationRow, { capture: true });
  document.removeEventListener('contextmenu', updateActiveConversationRow, true);
  activeConversationRow = null;

  // The three rows and the block that holds them inside the conversation list,
  // and the fade drawn over the top of it.
  document.getElementById("gemini-new-project-button")?.remove();
  document.getElementById("gemini-display-options-button")?.remove();
  document.getElementById("gemini-skills-button")?.remove();
  closeSkillsView();
  document.getElementById("gemini-scheduled-tasks-button")?.remove();
  const scrollNav = document.getElementById("gemini-scroll-nav");
  if (scrollNav) {
    const topNav = document.querySelector('[role="navigation"][aria-label="Sidebar"] > .px-2 > div.flex-col') ||
                   document.querySelector('[role="navigation"][aria-label="Sidebar"] > div.px-2 > div.flex-col');
    if (topNav) {
      const adopted = Array.from(scrollNav.children).filter((c) => {
        return c.id !== 'gemini-skills-button' &&
               c.id !== 'gemini-scheduled-tasks-button' &&
               c.id !== 'gemini-new-project-button' &&
               c.id !== 'gemini-display-options-button';
      });
      for (const btn of adopted) {
        topNav.appendChild(btn);
      }
    }
    scrollNav.remove();
  }
  document.getElementById("gemini-top-fade")?.remove();
  document.querySelectorAll(".gemini-logo-btn, .willow-sidenav-text, .gemini-sidebar-expand-rail, #gemini-experience-switch").forEach((el) => el.remove());
  document.querySelectorAll('[role="navigation"][aria-label="Sidebar"]').forEach((el) => el.removeAttribute("data-collapsed"));
  document.documentElement.removeAttribute("data-sidebar-collapsed");
  if (settingsObserver) {
    settingsObserver.disconnect();
    settingsObserver = null;
  }
  if (settingsRafId) {
    cancelAnimationFrame(settingsRafId);
    settingsRafId = null;
  }
  if (typeof hostStoreUnsubscribe === 'function') {
    hostStoreUnsubscribe();
    hostStoreUnsubscribe = null;
  }
  hostReduxStore = null;

  for (const [element, observer] of rememberedObservers()) {
    observer.disconnect();
    if (element.matches && element.matches(NEW_CONV_SELECTOR)) {
      element.removeAttribute("data-shortcut");
      /* Older builds of this plugin marked the route here; clear it so a
       * left-over attribute cannot outlive them on a React element that has
       * never heard of it. */
      element.removeAttribute("data-active");
    } else if (element.matches && element.matches(PILL_SELECTOR)) {
      const node = nameNode(element);
      const full = element.dataset.fullModelName;
      if (node && full) node.data = full;
      delete element.dataset.fullModelName;
    }
  }
  observed.clear();
  unwrapItems();
});

/* ---------------------------------------------------------------------------
 * The prompt box's plus menu
 * ---------------------------------------------------------------------------
 * Antigravity's plus menu holds the places context comes from — Media,
 * Mentions, Actions, and, when they are switched on, Browser and Screen
 * Recording. Its tools are not in there at all: they are reached by typing a
 * slash in the prompt box, which opens a typeahead over Goal, Boost, and the
 * rest. Willow's plus menu (features/chat/src/composer/PlusDropdownMenu.tsx)
 * keeps its tools in the menu — four on the card, the remainder behind "More
 * tools" — so this puts Antigravity's there too.
 *
 * Which tools those are is not something a plugin can know. The language
 * server assembles the set out of the workspace's workflows, its MCP servers'
 * prompts, and the built-in commands, so it differs per workspace and changes
 * without the app being rebuilt. It is therefore read from the component that
 * already has it: Antigravity's composer is handed a `getSlashCommandItems`
 * prop. Nothing below invents a command. All it decides is the order, the
 * glyph, and which four are promoted to the card.
 *
 * Picking a tool types its command into the prompt box and chooses it from
 * Antigravity's own typeahead, because that is what turns "/goal" from four
 * characters into the command the agent is actually sent. Building that node
 * directly means reaching four private Lexical helpers and a protobuf schema,
 * and getting any of it subtly wrong sends a message that looks right and does
 * nothing.
 *
 * styles/plus-menu.css draws all of it. Everything here either marks an element
 * for that stylesheet or is a row the stylesheet cannot invent.
 * ------------------------------------------------------------------------- */

const PLUS_TRIGGER = 'button[aria-label="Add context"]';
/* Antigravity's slash and mention typeahead, and the label span inside a row. */
const TYPEAHEAD = "[data-mention-menu]";
const OPTION = '[role="option"]';
const OPTION_LABEL = '[data-testid="menu-option-label"]';

/**
 * The glyphs Willow draws from Google Symbols rather than Luminous Symbols.
 * The two faces are subsets and neither is a superset of the other, so which
 * face a name belongs to is a property of the name, not of the row it is on.
 * Every ligature below is one Willow itself asks for; a name absent from the
 * subset would render as its own letters rather than fall through to a
 * fallback icon, which is why the list is not extended by guesswork.
 */
const GOOGLE_SYMBOLS = new Set([
  "more_horiz",
  "computer",
  "school",
  "drive",
  "photos",
  "web",
  "edit_note",
  "terminal"
]);

/** Willow's glyph for each of Antigravity's own context rows, by label. */
const CONTEXT_GLYPHS = {
  "Media": "attach_file",
  "Mentions": "docs",
  "Files": "docs",
  "Docs": "docs",
  "Actions": "extension",
  "Browser": "chrome",
  "Screen Recording": "computer",
  "Terminal": "terminal"
};

/**
 * Glyphs for the tools. Keyed by command name reduced to its letters, longest
 * and most specific first, since a name is matched by prefix as well as whole:
 * a workspace's own "boost-review" workflow should draw Boost's glyph rather
 * than the fallback.
 */
const TOOL_GLYPHS = {
  "deepresearch": "deep_research",
  "guidedlearning": "guided_learning",
  "computeruse": "computer",
  "notebook": "notebook",
  "research": "deep_research",
  "schedule": "assignment",
  "canvas": "canvas",
  "search": "search_activity",
  "boost": "group",
  "goal": "flag",
  "plan": "edit_note",
  "learn": "guided_learning",
  "image": "image_create",
  "video": "movie",
  "music": "music",
  "skill": "school",
  "browser": "chrome"
};

/** Anything the map above does not name. Willow's own generic tool glyph. */
const FALLBACK_GLYPH = "extension";

/**
 * Willow's card carries exactly four tool rows and hides the rest behind "More
 * tools". These four are preferred for those places when the workspace offers
 * them; whatever is missing is made up from the front of the remaining list.
 */
const FEATURED = ["goal", "boost", "plan", "schedule"];
const FEATURED_COUNT = 4;

const DEFAULT_TOOLS = [
  { name: "goal", label: "Goal", description: "Long-running tasks with subagents", glyph: "flag" },
  { name: "boost", label: "Boost", description: "Deep reasoning and multi-perspective thinking", glyph: "group" },
  { name: "plan", label: "Plan", description: "Implementation plan mode", glyph: "edit_note" },
  { name: "schedule", label: "Schedule", description: "Schedule recurring or timer tasks", glyph: "assignment" }
];

/** Letters only, so "computer-use", "computer_use", and "Computer Use" agree. */
function glyphKey(name) {
  return name.toLowerCase().replace(/[^a-z]/g, "");
}

function isSkillsName(name) {
  if (!name || typeof name !== "string") return false;
  const k = glyphKey(name);
  return k === "skill" || k === "skills" || k.startsWith("skill");
}

function glyphFor(name) {
  const key = glyphKey(name);
  if (!key) return FALLBACK_GLYPH;
  for (const [candidate, glyph] of Object.entries(TOOL_GLYPHS)) {
    if (key.startsWith(candidate) || `${key}s` === candidate) return glyph;
  }
  return FALLBACK_GLYPH;
}

/**
 * Which popup this is. Base UI portals a menu far from its trigger and links
 * the two with `aria-controls`, pointing at an id on the popup or on one of the
 * positioner elements above it — so the popup is named by walking up and asking
 * who controls each id on the way. This is the runtime's own way of doing it
 * (packages/runtime/src/world/ui/menu.ts).
 */
function triggerFor(popup) {
  for (let node = popup; node; node = node.parentElement) {
    if (!node.id) continue;
    const byControls = document.querySelector(`[aria-controls="${CSS.escape(node.id)}"]`);
    if (byControls) return byControls;
  }
  return null;
}

function isPlusMenu(popup) {
  const trigger = triggerFor(popup);
  return !!trigger && trigger.matches(PLUS_TRIGGER);
}

/**
 * The composer's props. Antigravity's bundle is Closure-compiled, so the
 * component's name is a mangled two letters and searching for it is worthless —
 * but prop names survive, and the composer is the one component inside the
 * prompt box holding both `getSlashCommandItems` and `lexicalRef`. The editor
 * component is handed the first of those too, hence asking for both.
 */
function composerProps() {
  const box = document.querySelector(INPUT_BOX);
  if (!box) return undefined;
  const fiber = plugin.react.findChild(
    box,
    (candidate) =>
      typeof candidate.memoizedProps?.getSlashCommandItems === "function" && !!candidate.memoizedProps?.lexicalRef,
    40
  );
  return fiber?.memoizedProps ?? undefined;
}

/**
 * One tool, as this file needs it: the text to show, the text to type, and the
 * glyph to draw.
 *
 * `getSlashCommandItems` returns three kinds of thing concatenated, and the
 * types that would tell them apart are compiled away, so they are told apart by
 * shape. A built-in slash command carries an `info` with the name the agent is
 * sent and a `title` for display; an MCP prompt carries a `serverName`; a
 * workflow carries a `path`. The last two are named by `name` alone.
 */
function toolFrom(item) {
  if (!item || typeof item !== "object") return undefined;
  const name = typeof item.info?.name === "string" ? item.info.name : item.name;
  if (typeof name !== "string" || !name.trim()) return undefined;
  const label = typeof item.title === "string" && item.title.trim() ? item.title.trim() : name.trim();
  const description = typeof item.description === "string" ? item.description.trim() : "";
  return { name: name.trim(), label, description, glyph: glyphFor(name) };
}

/* The resolved list, and the fetch in flight. `getSlashCommandItems` asks the
 * language server, so it is asked once and the answer kept: the menu opens and
 * closes far more often than a workspace's workflows change, and a card that
 * fills a frame late reads as a bug. A failed fetch leaves the cache cold so
 * the next open tries again. */
let tools;
let fetching;

function ensureTools(props) {
  if (tools) return Promise.resolve(tools);
  if (!fetching) {
    fetching = Promise.resolve()
      .then(() => props.getSlashCommandItems())
      .then((items) => {
        const seen = new Set();
        tools = [];
        for (const item of Array.isArray(items) ? items : []) {
          const tool = toolFrom(item);
          if (!tool || isSkillsName(tool.name) || isSkillsName(tool.label) || seen.has(tool.label.toLowerCase())) continue;
          seen.add(tool.label.toLowerCase());
          tools.push(tool);
        }
        return tools;
      })
      .catch(() => [])
      .finally(() => {
        fetching = undefined;
      });
  }
  return fetching;
}

/**
 * What to type to reach a tool. Antigravity matches a typeahead query against
 * the label it renders, lowercased with whitespace and a little punctuation
 * removed, and the regex that opens the typeahead at all refuses whitespace and
 * the characters stripped below. So the query is the label's own first word —
 * not the command's name, which is allowed to differ from it: "computer_use"
 * would never match a row labelled "Computer Use".
 */
function queryFor(tool) {
  const clean = (text) => text.split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9_.-]/g, "");
  return clean(tool.label) || clean(tool.name);
}

const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

/** Base UI closes on Escape, which is also how the runtime's own menus close. */
function closeMenu(popup) {
  popup.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
}

/** Base UI hands focus back to the trigger as the popup unmounts, so wait it out. */
async function untilClosed(popup) {
  for (let step = 0; step < 24 && popup.isConnected; step += 1) await wait(16);
  await wait(16);
}

function caretToEnd(root) {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(root);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

/**
 * The prompt box's editable root. Nothing marks it — no test id, no role — but
 * Lexical stamps `__lexicalEditor` on whichever element it owns, so that is what
 * identifies it, and it hands over the editor itself at the same time. Anything
 * else editable inside the prompt box is not the prompt.
 */
function editorRoot() {
  const box = document.querySelector(INPUT_BOX);
  if (!box) return undefined;
  let fallback;
  for (const node of box.querySelectorAll("[contenteditable]")) {
    if (!node.isContentEditable) continue;
    if (node.__lexicalEditor) return node;
    fallback = fallback ?? node;
  }
  return fallback;
}

/**
 * Type the command. `execCommand` is deprecated and used deliberately: it
 * produces the `beforeinput` event Lexical builds its own edit from, which is
 * the difference between text Antigravity's typeahead reacts to and text
 * written straight into the DOM, which it never sees.
 *
 * Whether a space comes first is Antigravity's own rule: its typeahead opens on
 * a slash only at the start of the prompt or after whitespace, and its own plus
 * menu prefixes a space for the same reason. Antigravity reads that off an
 * `isConvoInputEmpty` prop; this asks the prompt itself, which cannot be a
 * render behind.
 */
function insert(props, text) {
  const root = editorRoot();
  if (!root) return false;
  const editor = props?.lexicalRef?.current ?? root.__lexicalEditor;
  if (editor && typeof editor.focus === "function") editor.focus();
  else root.focus();
  if (!root.contains(window.getSelection()?.anchorNode ?? null)) caretToEnd(root);
  const before = root.textContent ?? "";
  document.execCommand("insertText", false, before.trim() ? ` ${text}` : text);
  return (root.textContent ?? "") !== before;
}

/** Antigravity's own normaliser, so a row that matched the query matches here. */
const normalise = (text) => text.replace(/[*…\s"]/g, "").toLowerCase();

/**
 * Choose the tool out of Antigravity's typeahead. The rows handle
 * `onClickCapture`, so a click dispatched at one is enough — React runs the
 * capture phase down the path to the target either way. Enter would do it too
 * and is not used: if the typeahead has closed by then, Enter sends the
 * message.
 */
async function choose(label) {
  const wanted = normalise(label);
  for (let step = 0; step < 150; step += 1) {
    for (const option of document.querySelectorAll(`${TYPEAHEAD} ${OPTION}`)) {
      const text = option.querySelector(OPTION_LABEL)?.textContent ?? "";
      if (normalise(text) !== wanted) continue;
      option.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      return true;
    }
    await wait(16);
  }
  // The typeahead never offered it. The command is typed and its menu is open,
  // so the prompt box is left exactly as it would be had the user typed it.
  return false;
}

async function pick(popup, tool) {
  const props = composerProps();
  const query = queryFor(tool);
  if (!query) return;
  closeMenu(popup);
  await untilClosed(popup);
  // The editor may still be handing focus back and forth with the trigger, so
  // typing is attempted until the text actually lands rather than once.
  let typed = false;
  for (let step = 0; step < 8 && !typed; step += 1) {
    typed = insert(props, `/${query}`);
    if (!typed) await wait(16);
  }
  if (typed) await choose(tool.label);
}

/**
 * A row. The host's own menu-item classes come along so that a row still reads
 * as a row if this plugin's stylesheet is ever missing, and because that is what
 * the runtime's own injected menu entries wear. Everything the Gemini look needs
 * on top is in styles/plus-menu.css, addressed through these marks.
 */
function row(kind, glyph, label, extra) {
  return plugin.ui.element(
    "div",
    {
      role: "menuitem",
      tabindex: "-1",
      class: plugin.ui.classes.menuItem,
      "data-gemini-row": kind,
      "data-gemini-glyph": glyph,
      "data-gemini-glyph-family": GOOGLE_SYMBOLS.has(glyph) ? "google-symbols" : undefined,
      ...extra
    },
    [plugin.ui.element("span", { "data-gemini-label": "", text: label })]
  );
}

/* ---------------------------------------------------------------------------
 * Prompt Box Multiline Expansion & Willow ToolChip State
 * ------------------------------------------------------------------------- */
let selectedToolState = null;

function getSelectedTool() {
  return selectedToolState || window.__bettergravity_selected_tool || null;
}

function setSelectedTool(tool) {
  selectedToolState = tool;
  window.__bettergravity_selected_tool = tool;
}

const TOOL_CHIP_LABELS = {
  images: "Images",
  image: "Images",
  createimage: "Images",
  video: "Videos",
  videos: "Videos",
  createvideo: "Videos",
  music: "Music",
  createmusic: "Music",
  canvas: "Canvas",
  research: "Deep research",
  deepresearch: "Deep research",
  learn: "Learn",
  guidedlearning: "Learn",
  plan: "Plan",
  goal: "Goal",
  computeruse: "Computer Use",
  "computer-use": "Computer Use",
  createpet: "Create pet",
  "create-pet": "Create pet",
  createskill: "Create skill",
  "create-skill": "Create skill",
  subagents: "Sub-agents",
  "sub-agents": "Sub-agents",
  personalintelligence: "Personal Intelligence",
  "personal-intelligence": "Personal Intelligence",
  schedule: "Schedule",
  boost: "Boost",
  browser: "Browser"
};

const TOOL_CHIP_GLYPHS = {
  images: "image_create",
  image: "image_create",
  createimage: "image_create",
  video: "movie",
  videos: "movie",
  createvideo: "movie",
  music: "music",
  createmusic: "music",
  canvas: "canvas",
  research: "deep_research",
  deepresearch: "deep_research",
  learn: "guided_learning",
  guidedlearning: "guided_learning",
  plan: "edit_note",
  goal: "flag",
  computeruse: "computer",
  "computer-use": "computer",
  createpet: "pets",
  "create-pet": "pets",
  createskill: "school",
  "create-skill": "school",
  subagents: "group",
  "sub-agents": "group",
  personalintelligence: "person",
  "personal-intelligence": "person",
  schedule: "assignment",
  boost: "group",
  browser: "chrome"
};

function chipLabelFor(tool) {
  const key = glyphKey(tool.name || tool.label || "");
  if (TOOL_CHIP_LABELS[key]) return TOOL_CHIP_LABELS[key];
  if (tool.chipLabel) return tool.chipLabel;
  return tool.label || tool.name;
}

function chipGlyphFor(tool) {
  const key = glyphKey(tool.name || tool.label || "");
  if (TOOL_CHIP_GLYPHS[key]) return TOOL_CHIP_GLYPHS[key];
  return tool.glyph || glyphFor(tool.name || tool.label);
}

function createToolChipElement(tool) {
  const chipLabel = chipLabelFor(tool);
  const glyph = chipGlyphFor(tool);
  const isGoogleSymbols = GOOGLE_SYMBOLS.has(glyph);

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "gemini-tool-chip";
  btn.setAttribute("data-gemini-tool-chip", "");
  btn.setAttribute("aria-label", `Deselect ${chipLabel}`);

  const inner = document.createElement("span");
  inner.className = "gemini-tool-chip-inner";

  const icon = document.createElement("span");
  icon.className = `gemini-tool-chip-icon${isGoogleSymbols ? " gemini-symbols-font" : ""}`;
  icon.setAttribute("data-gemini-glyph", glyph);
  icon.textContent = glyph;

  const label = document.createElement("span");
  label.className = "gemini-tool-chip-label";
  label.textContent = chipLabel;

  const close = document.createElement("span");
  close.className = "gemini-tool-chip-close";
  close.textContent = "close";

  inner.appendChild(icon);
  inner.appendChild(label);
  inner.appendChild(close);
  btn.appendChild(inner);

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    deselectTool();
  });

  return btn;
}

function mountToolChip(box, tool) {
  if (!box) box = document.querySelector(INPUT_BOX);
  if (!box) return;
  const card = box.querySelector(".bg-card");
  if (!card) return;

  const targetLabel = chipLabelFor(tool);
  const targetGlyph = chipGlyphFor(tool);

  const chips = box.querySelectorAll("[data-gemini-tool-chip]");
  if (chips.length > 0) {
    const existing = chips[0];
    for (let i = 1; i < chips.length; i++) chips[i].remove();

    if (existing.parentElement === card) {
      const curLabel = existing.querySelector(".gemini-tool-chip-label")?.textContent;
      const curGlyph = existing.querySelector(".gemini-tool-chip-icon")?.textContent;
      if (curLabel === targetLabel && curGlyph === targetGlyph) {
        return;
      }
      existing.replaceWith(createToolChipElement(tool));
      return;
    }
    existing.remove();
  }

  card.appendChild(createToolChipElement(tool));
}

function removeToolChip(box) {
  if (!box) box = document.querySelector(INPUT_BOX);
  if (!box) return;
  for (const chip of box.querySelectorAll("[data-gemini-tool-chip]")) {
    chip.remove();
  }
}

let scheduledExpansionCheck = null;

function hasAttachments(box) {
  if (!box) return false;
  // Strictly check for user attachments (images, PDFs, videos) inside the prompt box
  return !!(
    box.querySelector('[data-testid="input-attachment"]') ||
    box.querySelector('.relative.w-full img[alt*="attachment" i], .relative.w-full img[alt*="Image" i], .relative.w-full [alt*="PDF attachment" i], .relative.w-full [alt*="Video attachment" i]') ||
    box.querySelector('[data-testid="attachment-item"]')
  );
}

function getEditorTextRange(editor) {
  if (!editor) return null;
  const spans = editor.querySelectorAll('[data-lexical-text="true"]');
  if (spans.length > 0) {
    const range = document.createRange();
    range.setStartBefore(spans[0]);
    range.setEndAfter(spans[spans.length - 1]);
    return range;
  }
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  const firstText = walker.nextNode();
  if (!firstText) return null;
  let lastText = firstText;
  let next;
  while ((next = walker.nextNode())) {
    lastText = next;
  }
  const range = document.createRange();
  range.setStart(firstText, 0);
  range.setEnd(lastText, lastText.length);
  return range;
}

function setBoxExpanded(box, expanded) {
  const isExpanded = box.getAttribute("data-expanded") === "true";
  if (isExpanded !== expanded) {
    if (expanded) {
      box.setAttribute("data-expanded", "true");
    } else {
      box.removeAttribute("data-expanded");
    }
  }
}

function checkPromptExpansion(box) {
  if (!box || !box.isConnected) return;

  const currentTool = getSelectedTool();
  // 1. If a tool is selected, always expand and mount tool chip
  if (currentTool) {
    setBoxExpanded(box, true);
    mountToolChip(box, currentTool);
    return;
  } else {
    removeToolChip(box);
  }

  // 2. If an image or media attachment is present, always expand
  if (hasAttachments(box)) {
    setBoxExpanded(box, true);
    return;
  }

  // 3. Check editor and draft text
  const editor = box.querySelector('[role="combobox"][contenteditable]');
  if (!editor) {
    setBoxExpanded(box, false);
    return;
  }

  const text = (editor.textContent || "").replace(/[\uFEFF\u200B]/g, "");
  if (!text.trim()) {
    setBoxExpanded(box, false);
    return;
  }

  const isAlreadyExpanded = box.getAttribute("data-expanded") === "true";

  // Fast exit: short single-line draft cannot wrap or collide with right-side controls
  if (!isAlreadyExpanded && text.length < 20 && !text.includes("\n")) {
    setBoxExpanded(box, false);
    return;
  }

  // Explicit multiline (newlines or multiple paragraphs or non-only-child br)
  if (text.includes("\n") || editor.querySelector("p + p, div + div, p > br:not(:only-child)")) {
    setBoxExpanded(box, true);
    return;
  }

  // If editor content height has already wrapped past single-row threshold (~24px)
  if (!isAlreadyExpanded && editor.scrollHeight > 28) {
    setBoxExpanded(box, true);
    return;
  }

  const range = getEditorTextRange(editor);
  if (!range) {
    setBoxExpanded(box, false);
    return;
  }

  const card = box.querySelector(".bg-card");

  if (!isAlreadyExpanded) {
    // In single-row mode:
    // Check if text line wrapped onto a second line
    let hasWrapped = false;
    let rangeRect = null;
    try {
      rangeRect = range.getBoundingClientRect();
      const rects = range.getClientRects();
      if (rects.length > 1) {
        const firstTop = rects[0].top;
        for (let i = 1; i < rects.length; i++) {
          if (Math.abs(rects[i].top - firstTop) > 6) {
            hasWrapped = true;
            break;
          }
        }
      }
    } catch (_) {}

    if (hasWrapped) {
      setBoxExpanded(box, true);
      return;
    }

    // Check if the single text line reaches the point before the model selector and couldn't fit there
    if (rangeRect && card) {
      const pill = card.querySelector('[data-testid="model-selector-trigger"]');
      if (pill) {
        const pillRect = pill.getBoundingClientRect();
        if (pillRect.left > 0 && rangeRect.right >= pillRect.left - 6) {
          setBoxExpanded(box, true);
          return;
        }
      }
    }

    setBoxExpanded(box, false);
  } else {
    // In 2-row mode:
    // If text is clearly multiline by height, stay expanded without measuring rects
    if (editor.scrollHeight > 36) {
      setBoxExpanded(box, true);
      return;
    }

    let hasWrapped = false;
    let textWidth = 0;
    try {
      const rangeRect = range.getBoundingClientRect();
      textWidth = rangeRect.width;
      const rects = range.getClientRects();
      if (rects.length > 1) {
        const firstTop = rects[0].top;
        for (let i = 1; i < rects.length; i++) {
          if (Math.abs(rects[i].top - firstTop) > 6) {
            hasWrapped = true;
            break;
          }
        }
      }
    } catch (_) {}

    if (hasWrapped) {
      setBoxExpanded(box, true);
      return;
    }

    if (card && card.clientWidth > 100) {
      const cardWidth = card.clientWidth;
      const pill = card.querySelector('[data-testid="model-selector-trigger"]');
      const pillWidth = pill ? pill.offsetWidth : 85;
      const plusWidth = 32;
      const micWidth = 32;
      const sendWidth = 32;

      const leftSpace = 20 + plusWidth + 4 + 4;
      const rightSpace = 8 + 4 + pillWidth + 4 + micWidth + 4 + sendWidth + 15;
      const availableSingleRowWidth = Math.max(100, cardWidth - leftSpace - rightSpace);

      // Collapse back to single row only when text width easily fits before model selector
      if (textWidth <= availableSingleRowWidth - 8) {
        setBoxExpanded(box, false);
        return;
      }
    }

    setBoxExpanded(box, true);
  }
}

function requestPromptExpansionCheck() {
  if (scheduledExpansionCheck) return;
  scheduledExpansionCheck = requestAnimationFrame(() => {
    scheduledExpansionCheck = null;
    const box = document.querySelector(INPUT_BOX);
    if (box) checkPromptExpansion(box);
  });
}

function selectTool(tool) {
  setSelectedTool(tool);
  const box = document.querySelector(INPUT_BOX);
  if (box) {
    box.setAttribute("data-expanded", "true");
    mountToolChip(box, tool);
    checkPromptExpansion(box);
  }

  const root = editorRoot();
  if (root) {
    const text = (root.textContent || "").trim();
    const cmd = `/${tool.name.toLowerCase()}`;
    if (
      text === tool.name ||
      text.toLowerCase() === cmd ||
      text.toLowerCase() === (tool.label || "").toLowerCase() ||
      (text.toLowerCase().startsWith(cmd + " ") && text.slice(cmd.length + 1).trim() === "")
    ) {
      try {
        root.textContent = "";
        const sel = window.getSelection();
        if (sel) sel.removeAllRanges();
      } catch (_) {}
    }
    root.focus();
  }
  requestAnimationFrame(() => {
    const b = document.querySelector(INPUT_BOX);
    const active = getSelectedTool();
    if (b && active) {
      mountToolChip(b, active);
      checkPromptExpansion(b);
    }
  });
}

function deselectTool() {
  setSelectedTool(null);
  const box = document.querySelector(INPUT_BOX);
  if (box) {
    removeToolChip(box);
    checkPromptExpansion(box);
  }
  const root = editorRoot();
  if (root) root.focus();
}

function toolRow(popup, tool) {
  const currentTool = getSelectedTool();
  const isSelected = currentTool && (glyphKey(currentTool.name || currentTool.label) === glyphKey(tool.name || tool.label));
  const node = row("tool", tool.glyph, tool.label, {
    ...(tool.description ? { title: tool.description } : {}),
    ...(isSelected ? { "data-selected": "true" } : {})
  });

  const onSelect = (event) => {
    event.preventDefault();
    event.stopPropagation();
    selectTool(tool);
    closeMenu(popup);
  };

  node.addEventListener("pointerdown", onSelect, { capture: true });
  node.addEventListener("mousedown", onSelect, { capture: true });
  node.addEventListener("click", onSelect, { capture: true });
  return node;
}

/**
 * The "More tools" row and the card it opens. The card is a sibling of the row
 * rather than a child of it: rows are positioned, so a card inside one would
 * measure its offset against the row's content width instead of the menu's, and
 * land 16px short. It carries no role, which keeps the runtime's own scans for
 * `[role="menu"]` — including this file's — from taking it for a host menu.
 */
function moreRow(popup, rest) {
  const node = row("tool", "more_horiz", "More tools", { "aria-haspopup": "menu", "aria-expanded": "false" });
  const card = plugin.ui.element("div", { "data-gemini-submenu": "" });
  for (const tool of rest) card.append(toolRow(popup, tool));

  let timer;
  const close = () => {
    window.clearTimeout(timer);
    card.remove();
    node.setAttribute("aria-expanded", "false");
  };
  const open = () => {
    window.clearTimeout(timer);
    node.setAttribute("aria-expanded", "true");
    if (!card.isConnected) node.parentElement?.append(card);

    // Willow default: land the card's content edge on the parent's, which is 8px
    // above the row that opened it.
    const defaultTop = node.offsetTop - 8;
    let top = defaultTop;
    const cardHeight = card.offsetHeight || (rest.length * 36 + 16);

    // If opening downwards would hang below the parent menu, align its bottom
    // edge with the parent menu's bottom edge.
    if (top + cardHeight > popup.clientHeight) {
      top = popup.clientHeight - cardHeight;
    }

    // Viewport collision detection: ensure the submenu never extends past the
    // bottom of the window / screen.
    const popupRect = popup.getBoundingClientRect();
    const idealBottomInViewport = popupRect.top + top + cardHeight;
    const maxBottom = window.innerHeight - 8;
    if (idealBottomInViewport > maxBottom) {
      top -= (idealBottomInViewport - maxBottom);
    }

    // Ensure it doesn't extend above the top of the viewport
    const minTop = 8 - popupRect.top;
    if (top < minTop) {
      top = minTop;
      card.style.maxHeight = `${window.innerHeight - 16}px`;
      card.style.overflowY = "auto";
    } else {
      card.style.maxHeight = "";
      card.style.overflowY = "";
    }

    card.style.top = `${top}px`;
    card.style.transformOrigin = top < defaultTop ? "0 100%" : "0 0";
  };
  const closeSoon = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(close, 140);
  };

  node.addEventListener("pointerenter", open);
  node.addEventListener("pointerleave", closeSoon);
  node.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (card.isConnected) close();
    else open();
  });
  card.addEventListener("pointerenter", () => window.clearTimeout(timer));
  card.addEventListener("pointerleave", closeSoon);
  return node;
}

/**
 * Mark one of Antigravity's own rows. Its label is the last element in the row —
 * safe, because these rows are an icon and a label and nothing else — and it is
 * marked rather than matched as `> span`, since the icon beside it is a ligature
 * span on three of the rows and an `svg` on the other two.
 *
 * A row whose label is not one this file knows keeps the fallback glyph rather
 * than none, so a row Antigravity adds later still draws in the icon column.
 */
function markContextRow(item) {
  if (item.getAttribute("data-gemini-row") === "tool") return;
  // React rebuilds a row's children on some updates, taking the mark with them.
  if (item.querySelector("[data-gemini-label]")) return;
  const label = item.lastElementChild;
  const text = (label?.textContent ?? "").trim();
  if (!label || !text) return;
  if (isSkillsName(text)) {
    item.remove();
    return;
  }
  const matchedKey = Object.keys(CONTEXT_GLYPHS).find((k) => k.toLowerCase() === text.toLowerCase());
  const glyph = matchedKey ? CONTEXT_GLYPHS[matchedKey] : (glyphFor(text) || FALLBACK_GLYPH);
  label.setAttribute("data-gemini-label", "");
  item.setAttribute("data-gemini-row", "context");
  item.setAttribute("data-gemini-glyph", glyph);
  if (GOOGLE_SYMBOLS.has(glyph)) item.setAttribute("data-gemini-glyph-family", "google-symbols");
  else item.removeAttribute("data-gemini-glyph-family");

  if (text.toLowerCase() === "browser" && !item.hasAttribute("data-gemini-browser-hooked")) {
    item.setAttribute("data-gemini-browser-hooked", "true");
    const onBrowserSelect = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const browserTool = { name: "browser", label: "Browser", glyph: "chrome" };
      selectTool(browserTool);
      const popup = item.closest('[role="menu"]');
      if (popup) closeMenu(popup);
    };
    item.addEventListener("pointerdown", onBrowserSelect, { capture: true });
    item.addEventListener("mousedown", onBrowserSelect, { capture: true });
    item.addEventListener("click", onBrowserSelect, { capture: true });
    item.addEventListener("mouseup", onBrowserSelect, { capture: true });
  }
}

/**
 * Add the tools below Antigravity's own rows: a divider, four on the card, and
 * the rest behind "More tools", which is the shape of Willow's menu.
 *
 * The rows go in a wrapper of no box of its own, so that one gap and one row
 * rhythm run down the whole card — and so that finding the wrapper is all it
 * takes to know this menu has been done already, however many times the host
 * re-renders inside it.
 */
function addTools(popup) {
  if (popup.querySelector("[data-gemini-tools]")) return;
  const props = composerProps();
  if (props && !tools) {
    void ensureTools(props).then(() => {
      if (tools && popup.isConnected) {
        const existing = popup.querySelector("[data-gemini-tools]");
        if (existing) existing.remove();
        addTools(popup);
      }
    });
  }

  const pool = (tools && tools.length > 0) ? tools : DEFAULT_TOOLS;
  const wrapper = plugin.ui.element("div", { "data-gemini-tools": "" });
  wrapper.style.display = "contents";
  popup.append(wrapper);

  // A command that is already a row up above — "browser" is one — is dropped,
  // by comparing the labels rather than by naming it here.
  const above = new Set();
  for (const label of popup.querySelectorAll('[data-gemini-row="context"] [data-gemini-label]')) {
    above.add((label.textContent ?? "").trim().toLowerCase());
  }
  const offer = pool.filter((tool) => 
    !above.has(tool.label.toLowerCase()) && 
    !above.has(tool.name.toLowerCase()) &&
    !isSkillsName(tool.name) &&
    !isSkillsName(tool.label)
  );
  if (offer.length === 0) return;

  const featured = [];
  for (const name of FEATURED) {
    const found = offer.find((tool) => tool.name.toLowerCase() === name);
    if (found) featured.push(found);
  }
  for (const tool of offer) {
    if (featured.length >= FEATURED_COUNT) break;
    if (!featured.includes(tool)) featured.push(tool);
  }
  const rest = offer.filter((tool) => !featured.includes(tool));

  wrapper.append(plugin.ui.element("div", { role: "separator", "aria-orientation": "horizontal" }));
  for (const tool of featured) wrapper.append(toolRow(popup, tool));
  if (rest.length > 0) wrapper.append(moreRow(popup, rest));
}

function decorate(popup) {
  if (!isPlusMenu(popup)) return;
  popup.setAttribute("data-gemini-plus-menu", "");
  popup.querySelector('#gemini-menu-item-pin')?.remove();
  popup.querySelector('#gemini-menu-item-archive')?.remove();

  for (const item of popup.querySelectorAll('[role="menuitem"]')) {
    const text = (item.textContent ?? "").trim();
    if (isSkillsName(text) || item.id === 'gemini-menu-item-pin' || item.id === 'gemini-menu-item-archive') {
      item.remove();
      continue;
    }
    markContextRow(item);
  }
  addTools(popup);
  const currentTool = getSelectedTool();
  if (currentTool) {
    const activeKey = glyphKey(currentTool.name || currentTool.label);
    for (const item of popup.querySelectorAll('[data-gemini-row="tool"]')) {
      const label = (item.querySelector('[data-gemini-label]')?.textContent ?? "").trim();
      if (glyphKey(label) === activeKey) {
        item.setAttribute("data-selected", "true");
      } else {
        item.removeAttribute("data-selected");
      }
    }
  } else {
    for (const item of popup.querySelectorAll('[data-gemini-row="tool"][data-selected]')) {
      item.removeAttribute("data-selected");
    }
  }
}

/* Watched separately from the model pill and the sidebar above: those restore a
 * label on dispose, and a menu popup is a different thing to put back. */
const stopMenus = plugin.dom.observe('[role="menu"]', (popup) => {
  // Every menu in the app arrives here. One whose trigger is known and is not
  // the plus button is dropped at once; one whose trigger is not linked yet is
  // kept, since `decorate` asks again on each pass.
  const trigger = triggerFor(popup);
  if (trigger && !trigger.matches(PLUS_TRIGGER)) return;
  decorate(popup);
  // Antigravity fills the card after mounting it, and refills it as the
  // conversation changes which context is on offer, so the popup is watched for
  // as long as it lives. Every pass finds its own work already done, which is
  // what stops the writes above from feeding back into this.
  const watcher = new MutationObserver(() => {
    if (!popup.isConnected) {
      watcher.disconnect();
      return;
    }
    decorate(popup);
  });
  watcher.observe(popup, { childList: true, subtree: true });
  remember(popup, watcher);
});

/* ---------------------------------------------------------------------------
 * Prompt Box Multiline & Tool Expansion Observer
 * ------------------------------------------------------------------------- */
const DISCLAIMER_TEXT = "Antigravity is AI and can make mistakes.";

function ensureAiDisclaimer(box) {
  if (!box || !box.isConnected) return;

  // Defensively remove any stray disclaimers attached to persistent dock wrappers
  const strays = document.querySelectorAll(
    '.relative.w-full.px-4.pb-2 > .gemini-ai-disclaimer, .relative.w-full.px-4.pb-2 > div > .gemini-ai-disclaimer'
  );
  for (const s of strays) {
    if (s.parentElement !== box) {
      s.remove();
    }
  }

  // Ensure this container has at most one disclaimer as its direct child
  const directDisclaimers = box.querySelectorAll(':scope > .gemini-ai-disclaimer');
  if (directDisclaimers.length > 1) {
    for (let i = 1; i < directDisclaimers.length; i++) {
      directDisclaimers[i].remove();
    }
  }

  let disclaimer = directDisclaimers[0];
  if (!disclaimer) {
    disclaimer = document.createElement("p");
    disclaimer.className = "gemini-ai-disclaimer";
    disclaimer.textContent = DISCLAIMER_TEXT;
    box.appendChild(disclaimer);
  } else {
    if (disclaimer.textContent !== DISCLAIMER_TEXT) {
      disclaimer.textContent = DISCLAIMER_TEXT;
    }
    if (box.lastElementChild !== disclaimer) {
      box.appendChild(disclaimer);
    }
  }
}

plugin.dom.observe('[data-testid="interaction-continue-button"], [data-testid="interaction-skip-button"]', (button) => {
  const card = button.closest('.relative.flex.flex-col.p-px.rounded-2xl.bg-card-border.w-full') ||
               button.closest('.bg-card')?.parentElement;
  const questionBox = card?.parentElement;
  if (questionBox && questionBox.isConnected) {
    ensureAiDisclaimer(questionBox);
  }
});

plugin.dom.observe(INPUT_BOX, (box) => {
  refreshLiveAntigravitySkills();
  ensureAiDisclaimer(box);
  checkPromptExpansion(box);

  const onInput = () => requestPromptExpansionCheck();
  box.addEventListener("input", onInput);

  const onPasteOrDrop = () => {
    requestAnimationFrame(() => requestPromptExpansionCheck());
    setTimeout(() => requestPromptExpansionCheck(), 50);
  };
  box.addEventListener("paste", onPasteOrDrop);
  box.addEventListener("drop", onPasteOrDrop);

  const editor = box.querySelector('[role="combobox"][contenteditable]');
  let ro = null;
  let mo = null;
  if (editor) {
    ro = new ResizeObserver(() => requestPromptExpansionCheck());
    ro.observe(editor);

    mo = new MutationObserver(() => requestPromptExpansionCheck());
    mo.observe(editor, { childList: true, subtree: true, characterData: true });
  }

  const boxRo = new ResizeObserver(() => requestPromptExpansionCheck());
  boxRo.observe(box);

  const boxMo = new MutationObserver(() => {
    ensureAiDisclaimer(box);
    requestPromptExpansionCheck();
  });
  boxMo.observe(box, { childList: true });

  remember(box, {
    disconnect: () => {
      box.removeEventListener("input", onInput);
      box.removeEventListener("paste", onPasteOrDrop);
      box.removeEventListener("drop", onPasteOrDrop);
      if (ro) ro.disconnect();
      if (mo) mo.disconnect();
      boxRo.disconnect();
      boxMo.disconnect();
    }
  });
});


/* ---------------------------------------------------------------------------
 * Global Tooltips: Willow's Gemini-style native tooltip engine
 * ------------------------------------------------------------------------- */
const TOOLTIP_STASH_ATTR = 'data-willow-tooltip';
const TOOLTIP_OWNED_LABEL_ATTR = 'data-willow-tooltip-label';
const TOOLTIP_POSITION_ATTR = 'data-tooltip-position';
const TOOLTIP_POSITIONS = ['above', 'below', 'left', 'right'];
const TOOLTIP_PANE_CLASSES = TOOLTIP_POSITIONS.map((p) => `willow-tooltip-pane--${p}`);
const TOOLTIP_TRANSFORM_ORIGIN = {
  left: 'right center',
  right: 'left center',
  below: 'center top',
  above: 'center bottom',
};
const TOOLTIP_OPPOSITE = {
  left: 'right',
  right: 'left',
  below: 'above',
  above: 'below',
};
const TOOLTIP_OFFSET = 8;
const TOOLTIP_MARGIN_NEAR = 8;
const TOOLTIP_MARGIN_FAR = 15;
const TOOLTIP_HIDE_DURATION_MS = 75;

const tooltipClamp = (value, min, max) => (max < min ? min : Math.min(Math.max(value, min), max));

function isTooltipMultiline(surface) {
  const box = surface.getBoundingClientRect();
  return box.height > 24 && box.width >= 195;
}

function readTooltipPosition(el) {
  const raw = el.getAttribute(TOOLTIP_POSITION_ATTR);
  return TOOLTIP_POSITIONS.includes(raw) ? raw : 'below';
}

let tooltipOverlayContainer = null;
function getTooltipOverlayContainer() {
  if (tooltipOverlayContainer && tooltipOverlayContainer.isConnected) return tooltipOverlayContainer;
  const existing = document.querySelector('.willow-tooltip-container');
  if (existing) {
    tooltipOverlayContainer = existing;
    return existing;
  }
  const el = document.createElement('div');
  el.className = 'willow-tooltip-container';
  document.body.appendChild(el);
  tooltipOverlayContainer = el;
  return el;
}

let activeTooltipAnchor = null;
let activeTooltipPane = null;
let activeTooltipWrapper = null;
let activeTooltipSurface = null;
let activeTooltipPosition = 'below';
let activeTooltipHideTimer = null;

function repositionTooltip() {
  if (!activeTooltipAnchor || !activeTooltipAnchor.isConnected || !activeTooltipPane || !activeTooltipWrapper) return;

  activeTooltipPane.style.top = '0px';
  activeTooltipPane.style.left = '0px';
  activeTooltipPane.style.right = '';
  activeTooltipPane.style.bottom = '';

  const a = activeTooltipAnchor.getBoundingClientRect();
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  const w = activeTooltipPane.offsetWidth;
  const h = activeTooltipPane.offsetHeight;

  const fits = {
    below: a.bottom + TOOLTIP_OFFSET + h <= vh,
    above: a.top - TOOLTIP_OFFSET - h >= 0,
    right: a.right + TOOLTIP_OFFSET + w <= vw,
    left: a.left - TOOLTIP_OFFSET - w >= 0,
  };
  const placement = fits[activeTooltipPosition] || !fits[TOOLTIP_OPPOSITE[activeTooltipPosition]] ? activeTooltipPosition : TOOLTIP_OPPOSITE[activeTooltipPosition];

  activeTooltipPane.classList.remove(...TOOLTIP_PANE_CLASSES);
  activeTooltipPane.classList.add(`willow-tooltip-pane--${placement}`);
  activeTooltipPane.style.top = '';
  activeTooltipPane.style.right = '';
  activeTooltipPane.style.bottom = '';
  activeTooltipPane.style.left = '';

  const centredLeft = tooltipClamp(a.left + a.width / 2 - w / 2, TOOLTIP_MARGIN_NEAR, vw - TOOLTIP_MARGIN_FAR - w);
  const centredTop = tooltipClamp(a.top + a.height / 2 - h / 2, TOOLTIP_MARGIN_NEAR, vh - TOOLTIP_MARGIN_FAR - h);

  switch (placement) {
    case 'below':
      activeTooltipPane.style.top = `${a.bottom}px`;
      activeTooltipPane.style.left = `${centredLeft}px`;
      break;
    case 'above':
      activeTooltipPane.style.bottom = `${vh - a.top}px`;
      activeTooltipPane.style.left = `${centredLeft}px`;
      break;
    case 'right':
      activeTooltipPane.style.left = `${a.right}px`;
      activeTooltipPane.style.top = `${centredTop}px`;
      break;
    case 'left':
      activeTooltipPane.style.right = `${vw - a.left}px`;
      activeTooltipPane.style.top = `${centredTop}px`;
      break;
  }

  activeTooltipWrapper.style.transformOrigin = TOOLTIP_TRANSFORM_ORIGIN[placement];

  if (activeTooltipSurface) {
    activeTooltipSurface.classList.toggle('willow-tooltip-surface--multiline', isTooltipMultiline(activeTooltipSurface));
  }
}

function restoreTooltipAnchor(el) {
  if (!el) return;
  const stashed = el.getAttribute(TOOLTIP_STASH_ATTR);
  if (stashed !== null) {
    if (!el.hasAttribute('title')) el.setAttribute('title', stashed);
    el.removeAttribute(TOOLTIP_STASH_ATTR);
  }
  if (el.hasAttribute(TOOLTIP_OWNED_LABEL_ATTR)) {
    el.removeAttribute('aria-label');
    el.removeAttribute(TOOLTIP_OWNED_LABEL_ATTR);
  }
}

function closeTooltipImmediate() {
  clearTimeout(activeTooltipHideTimer);
  if (activeTooltipAnchor) {
    restoreTooltipAnchor(activeTooltipAnchor);
    activeTooltipAnchor = null;
  }
  if (activeTooltipPane) {
    activeTooltipPane.remove();
    activeTooltipPane = null;
    activeTooltipWrapper = null;
    activeTooltipSurface = null;
  }
}

function closeTooltip() {
  if (!activeTooltipAnchor) return;
  restoreTooltipAnchor(activeTooltipAnchor);
  activeTooltipAnchor = null;

  if (activeTooltipWrapper && activeTooltipPane) {
    const pane = activeTooltipPane;
    const wrapper = activeTooltipWrapper;
    wrapper.classList.remove('willow-tooltip--show');
    wrapper.classList.add('willow-tooltip--hide');

    const done = () => {
      pane.remove();
      if (activeTooltipPane === pane) {
        activeTooltipPane = null;
        activeTooltipWrapper = null;
        activeTooltipSurface = null;
      }
    };
    wrapper.addEventListener('animationend', done, { once: true });
    activeTooltipHideTimer = setTimeout(done, TOOLTIP_HIDE_DURATION_MS + 50);
  }
}

function showTooltipOverlay(anchor, text, position) {
  clearTimeout(activeTooltipHideTimer);
  if (activeTooltipPane) {
    activeTooltipPane.remove();
    activeTooltipPane = null;
  }

  const container = getTooltipOverlayContainer();

  const pane = document.createElement('div');
  pane.className = `willow-tooltip-pane willow-tooltip-pane--${position}`;

  const wrapper = document.createElement('div');
  wrapper.className = 'willow-tooltip willow-tooltip--show';
  wrapper.setAttribute('aria-hidden', 'true');

  const surface = document.createElement('div');
  surface.className = 'willow-tooltip-surface';
  surface.textContent = text;

  wrapper.appendChild(surface);
  pane.appendChild(wrapper);
  container.appendChild(pane);

  activeTooltipAnchor = anchor;
  activeTooltipPane = pane;
  activeTooltipWrapper = wrapper;
  activeTooltipSurface = surface;
  activeTooltipPosition = position;

  repositionTooltip();
}

function openTooltipFor(el) {
  if (activeTooltipAnchor === el) return;
  closeTooltipImmediate();

  const title = el.getAttribute('title');
  if (title && title.trim()) {
    el.setAttribute(TOOLTIP_STASH_ATTR, title);
    el.removeAttribute('title');
    if (!el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby') && !el.textContent?.trim()) {
      el.setAttribute('aria-label', title);
      el.setAttribute(TOOLTIP_OWNED_LABEL_ATTR, '');
    }
  }

  // If this element already has Base UI tooltip trigger, Base UI will render its own styled popup
  if (el.hasAttribute('data-base-ui-tooltip-trigger') || el.closest('[data-base-ui-tooltip-trigger]')) {
    return;
  }

  const text = title || el.getAttribute(TOOLTIP_STASH_ATTR);
  if (!text || !text.trim()) return;

  showTooltipOverlay(el, text.trim(), readTooltipPosition(el));
}

function setupGlobalTooltips() {
  const onOver = (e) => {
    const target = e.target;
    if (!target || !(target instanceof Element)) return;
    const el = target.closest('[title]');
    if (el) openTooltipFor(el);
    else if (activeTooltipAnchor && !activeTooltipAnchor.contains(target)) closeTooltip();
  };

  const onOut = (e) => {
    if (!activeTooltipAnchor) return;
    const next = e.relatedTarget;
    if (!next || !activeTooltipAnchor.contains(next)) closeTooltip();
  };

  const onFocusIn = (e) => {
    const el = e.target?.closest?.('[title]');
    if (el && el.matches(':focus-visible')) openTooltipFor(el);
  };

  const onKey = (e) => {
    if (e.key === 'Escape') closeTooltip();
  };

  const onClick = (e) => {
    const el = activeTooltipAnchor;
    if (!el || !el.contains(e.target)) {
      closeTooltip();
      return;
    }
    requestAnimationFrame(() => {
      if (activeTooltipAnchor !== el || !el.isConnected) {
        closeTooltip();
        return;
      }
      const next = el.getAttribute('title');
      if (next && next.trim()) {
        el.setAttribute(TOOLTIP_STASH_ATTR, next);
        el.removeAttribute('title');
        if (activeTooltipSurface) activeTooltipSurface.textContent = next.trim();
        repositionTooltip();
      }
    });
  };

  let tooltipRafId = null;
  const onScrollOrResize = () => {
    if (!activeTooltipAnchor) return;
    if (tooltipRafId !== null) return;
    tooltipRafId = requestAnimationFrame(() => {
      tooltipRafId = null;
      if (activeTooltipAnchor) repositionTooltip();
    });
  };

  document.addEventListener('mouseover', onOver, true);
  document.addEventListener('mouseout', onOut, true);
  document.addEventListener('focusin', onFocusIn, true);
  document.addEventListener('focusout', closeTooltip, true);
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('click', onClick, true);
  window.addEventListener('scroll', onScrollOrResize, true);
  window.addEventListener('resize', onScrollOrResize);
  window.addEventListener('blur', closeTooltip);

  return () => {
    if (tooltipRafId !== null) {
      cancelAnimationFrame(tooltipRafId);
      tooltipRafId = null;
    }
    document.removeEventListener('mouseover', onOver, true);
    document.removeEventListener('mouseout', onOut, true);
    document.removeEventListener('focusin', onFocusIn, true);
    document.removeEventListener('focusout', closeTooltip, true);
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('click', onClick, true);
    window.removeEventListener('scroll', onScrollOrResize, true);
    window.removeEventListener('resize', onScrollOrResize);
    window.removeEventListener('blur', closeTooltip);
    closeTooltipImmediate();
    if (tooltipOverlayContainer) {
      tooltipOverlayContainer.remove();
      tooltipOverlayContainer = null;
    }
  };
}

const stopGlobalTooltips = setupGlobalTooltips();

// Also observe host Base UI / react-tooltip popups to ensure multiline left-align and arrow hiding
plugin.dom.observe('[role="tooltip"]', (tooltip) => {
  if (tooltip.classList.contains('willow-tooltip-description') || tooltip.closest('.willow-tooltip-container')) {
    return;
  }
  const checkMultiline = () => {
    const box = tooltip.getBoundingClientRect();
    if (box.height > 24 && box.width >= 195) {
      tooltip.classList.add('willow-tooltip-surface--multiline');
    } else {
      tooltip.classList.remove('willow-tooltip-surface--multiline');
    }
  };
  checkMultiline();
  const arrow = tooltip.querySelector('[data-base-ui-tooltip-arrow], [class*="arrow"], svg');
  if (arrow) arrow.style.setProperty('display', 'none', 'important');

  const obs = new MutationObserver(checkMultiline);
  obs.observe(tooltip, { childList: true, subtree: true, characterData: true });
  remember(tooltip, {
    disconnect: () => obs.disconnect()
  });
});

/* ---------------------------------------------------------------------------
 * Streaming reply reveal
 * ------------------------------------------------------------------------- */

// Willow's platform/ui/src/streaming-text-reveal.ts and
// streaming-markdown-styles.ts: sentence/word promotions and a 610ms opacity
// fade. A run shares one animation instead of allocating a component per word.
// Only the native markdown parser's fresh AST is decorated; never edit React's
// text nodes or observe the conversation on every arriving token.
function nextGeminiRevealLength(source, visibleLength) {
  const from = Math.max(0, Math.min(visibleLength, source.length));
  const suffix = source.slice(from);
  const paragraph = /\n{2,}/.exec(suffix);
  const sentence = /[.!?](?:["')\]]+)?(?=\s|$)/.exec(suffix);
  let end = Math.min(
    paragraph ? paragraph.index + paragraph[0].length : Infinity,
    sentence ? sentence.index + sentence[0].length : Infinity
  );
  if (Number.isFinite(end)) {
    while (end < suffix.length && /\s/.test(suffix[end])) end++;
  } else {
    const budget = suffix.length <= 36 ? 2 : suffix.length <= 96 ? 4 :
      suffix.length <= 240 ? 8 : suffix.length <= 520 ? 12 : suffix.length <= 1200 ? 18 : 28;
    const words = /\S+\s*/g;
    end = 0;
    for (let count = 0, match; count < budget && (match = words.exec(suffix)); count++) {
      end = match.index + match[0].length;
    }
  }
  return Math.min(source.length, from + (end || suffix.length));
}

function createGeminiRevealSession(initialSource, initialStreaming, quiet, clock) {
  const FADE_MS = 610;
  const MAX_RUNS = 96;
  let source = initialSource;
  let streaming = initialStreaming;
  let muted = quiet;
  // A long reply first encountered during navigation is already history. Do
  // not replay its accumulated text when entering a running conversation.
  let seed = quiet || !streaming || source.length > 256;
  let shown = seed ? source : source.slice(0, nextGeminiRevealLength(source, 0));
  let normalized = "";
  let decoratedShown = "";
  let runs = [];
  let mounted = false;
  let promotion = null;
  let cleanup = null;
  let cleanupAt = 0;
  let snapshot = { shown, active: streaming && !muted, revealing: !seed && source.length > 0 };
  const listeners = new Set();

  function cancelTimers() {
    if (promotion !== null) clock.clearTimeout(promotion);
    if (cleanup !== null) clock.clearTimeout(cleanup);
    promotion = cleanup = null;
    cleanupAt = 0;
  }

  function publish(force = false) {
    const revealing = !muted && (shown !== source || runs.length > 0 || shown !== decoratedShown);
    const active = !muted && (streaming || revealing);
    if (!force && snapshot.shown === shown && snapshot.active === active && snapshot.revealing === revealing) return;
    snapshot = { shown, active, revealing };
    for (const listener of listeners) listener();
  }

  function schedule() {
    if (!mounted || muted) return;
    if (shown === source && shown === decoratedShown && !runs.length) publish();
    if (shown !== source && promotion === null) {
      const length = nextGeminiRevealLength(source, shown.length) - shown.length;
      const delay = Math.max(50, Math.min(320, Math.round(36 + length * 1.6)));
      // Never cancel this timer just because another provider token arrived.
      promotion = clock.setTimeout(() => {
        promotion = null;
        shown = source.slice(0, nextGeminiRevealLength(source, shown.length));
        publish();
        schedule();
      }, delay);
    }
    const deadline = runs.reduce((last, run) => Math.max(last, run.at + FADE_MS), 0);
    if (!deadline && cleanup !== null) {
      clock.clearTimeout(cleanup);
      cleanup = null;
      cleanupAt = 0;
    }
    if (deadline && deadline !== cleanupAt) {
      if (cleanup !== null) clock.clearTimeout(cleanup);
      cleanupAt = deadline;
      cleanup = clock.setTimeout(() => {
        cleanup = null;
        cleanupAt = 0;
        runs = runs.filter(run => run.at + FADE_MS > clock.now());
        // A pending promotion will retire these spans in its existing parse.
        // Otherwise one final render restores the native plain text runs.
        if (promotion === null) publish(true);
        schedule();
      }, Math.max(0, deadline - clock.now()));
    }
  }

  function update(nextSource, nextStreaming, nextQuiet = muted) {
    const previous = source;
    const wasActive = snapshot.active;
    source = nextSource;
    streaming = nextStreaming;
    if (nextQuiet || (!wasActive && !streaming)) {
      muted = nextQuiet;
      shown = source;
      runs = [];
      normalized = "";
      decoratedShown = shown;
      seed = true;
      cancelTimers();
      publish();
      return;
    }
    if (muted !== nextQuiet) {
      muted = nextQuiet;
      seed = true;
    }
    if (!source.startsWith(previous)) {
      // Contractions take effect immediately; a replacement starts a new
      // reveal. Neither may retain a timer/range belonging to the old answer.
      cancelTimers();
      runs = [];
      normalized = "";
      decoratedShown = "";
      seed = previous.startsWith(source) || source.length > 256;
      shown = seed ? source : source.slice(0, nextGeminiRevealLength(source, 0));
    }
    publish();
    schedule();
  }

  function decorate(tree, text) {
    if (!snapshot.active) return;
    decoratedShown = shown;
    const now = clock.now();
    const value = String(text);
    let from = normalized.length;
    if (seed || !value.startsWith(normalized)) {
      // Native URL/math normalization can change earlier source offsets.
      // Keep that already visible text steady instead of guessing its identity.
      from = value.length;
      runs = [];
      seed = false;
    }
    normalized = value;
    runs = runs.filter(run => run.at + FADE_MS > now && run.start < value.length);
    let firstActive = Math.min(from, ...runs.map(run => run.start));
    let order = 0;
    let emitted = 0;
    const fresh = new Map();
    const atFor = unit => {
      if (!fresh.has(unit)) {
        // Stagger within this promotion, bounded to four steps. The waiting
        // time must not grow with the length of a response or conversation.
        fresh.set(unit, now + 150 + Math.min(order++, 4) * 120);
      }
      return fresh.get(unit);
    };
    const add = (start, end, unit) => {
      if (end <= start || runs.length >= MAX_RUNS) return;
      const at = atFor(unit);
      const last = runs[runs.length - 1];
      if (last && last.end === start && last.at === at) last.end = end;
      else runs.push({ start, end, at });
      firstActive = Math.min(firstActive, start);
    };
    const containing = offset => runs.find(run => run.start <= offset && offset < run.end);
    const wrap = (children, at) => ({
      type: "element", tagName: "bg-gemini-reveal", properties: { "data-reveal-at": at }, children
    });

    function visit(node, unit = node) {
      const start = node.position?.start?.offset;
      const end = node.position?.end?.offset;
      const tag = node.tagName;
      if (Number.isFinite(end) && end <= firstActive) return [node];
      if (tag === "img" || tag === "input" || tag === "script" || tag === "style") return [node];
      if (tag === "li" || /^h[1-6]$/.test(tag || "") || tag === "table" || tag === "pre" ||
          tag === "p" && unit.tagName !== "li") unit = node;

      // Native code and link renderers inspect their original string children.
      // Fade those units without changing their children or event handlers.
      if (tag === "code" || tag === "a" || tag === "pre") {
        if (Number.isFinite(start) && Number.isFinite(end)) {
          if (start >= from) add(start, end, unit);
          const run = containing(start);
          if (run && emitted++ < MAX_RUNS) {
            if (tag === "pre") {
              node.properties = { ...node.properties, "data-gemini-reveal-block": run.at };
            } else return [wrap([node], run.at)];
          }
        }
        return [node];
      }
      if (tag === "li" && Number.isFinite(start)) {
        if (start >= from) add(start, start + 1, unit);
        const marker = containing(start);
        if (marker) node.properties = { ...node.properties, "data-gemini-reveal-marker": marker.at };
      }
      if (node.type === "text") {
        if (!Number.isFinite(start) || !Number.isFinite(end)) return [node];
        if (end > from) add(Math.max(start, from), end, unit);
        const relevant = runs.filter(run => run.start < end && run.end > start);
        if (!relevant.length) return [node];
        // Positions describe markdown, whereas values have decoded entities
        // and escapes. Only split a suffix that can be mapped exactly. Ambiguous
        // old characters stay visible; fresh whole nodes can fade as one run.
        let base = Math.max(start, Math.min(...relevant.map(run => run.start)));
        let suffix = value.slice(base, end);
        let prefixLength = node.value.length - suffix.length;
        if (!node.value.endsWith(suffix)) {
          if (base === start && start >= from) {
            return emitted++ < MAX_RUNS ? [wrap([node], relevant[0].at)] : [node];
          }
          let count = 0;
          while (count < suffix.length && count < node.value.length &&
              suffix[suffix.length - 1 - count] === node.value[node.value.length - 1 - count]) count++;
          base = end - count;
          suffix = suffix.slice(suffix.length - count);
          prefixLength = node.value.length - count;
        }
        // Whb, Antigravity's task renderer, must see its raw leading token.
        const taskPrefix = unit.tagName === "li" ? /^\[\/\]\s*/.exec(node.value)?.[0].length || 0 : 0;
        if (prefixLength < taskPrefix) {
          base += taskPrefix - prefixLength;
          prefixLength = taskPrefix;
        }
        const result = [];
        let cursor = base;
        if (prefixLength) result.push({ type: "text", value: node.value.slice(0, prefixLength) });
        for (const run of relevant) {
          const left = Math.max(cursor, run.start), right = Math.min(end, run.end);
          if (right <= left) continue;
          if (left > cursor) result.push({ type: "text", value: value.slice(cursor, left) });
          const part = { type: "text", value: value.slice(left, right) };
          result.push(emitted++ < MAX_RUNS ? wrap([part], run.at) : part);
          cursor = right;
        }
        if (cursor < end) result.push({ type: "text", value: value.slice(cursor, end) });
        return result;
      }
      if (node.children) node.children = node.children.flatMap(child => visit(child, unit));
      return [node];
    }
    visit(tree);
  }

  return {
    update, decorate, schedule,
    getSnapshot: () => snapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    resume() { mounted = true; schedule(); },
    suspend() { mounted = false; cancelTimers(); },
    finish() { update(source, false, true); }
  };
}

function sameGeminiCodeProps(previous, next) {
  if (typeof previous.children !== "string" || typeof next.children !== "string") return false;
  const keys = Object.keys(previous);
  if (keys.length !== Object.keys(next).length) return false;
  for (const key of keys) {
    if (!Object.hasOwn(next, key)) return false;
    if (Object.is(previous[key], next[key])) continue;
    if (key !== "node") return false;
    // Rehype makes a fresh, plain HAST node on each parse. Check all its data,
    // including positions and attributes, before reusing a code renderer.
    try {
      if (JSON.stringify(previous.node) !== JSON.stringify(next.node)) return false;
    } catch { return false; }
  }
  return true;
}

function createGeminiTurnRevealGate() {
  const turns = new Map();
  let owners = new WeakMap();
  let disposed = false;

  function update(owner, element, active) {
    // The footer is a sibling of the response article. Resolve just this
    // markdown's turn on mount/state changes; never scan the conversation.
    const response = !disposed && active ? element?.closest('[data-testid="planner-response-text"]') : null;
    const turn = response?.closest('[role="article"][aria-label="Agent response"]')?.parentElement || null;
    const previous = owners.get(owner) || null;
    if (previous === turn) return;
    if (previous) {
      const pending = turns.get(previous);
      pending.delete(owner);
      if (!pending.size) {
        previous.removeAttribute("data-gemini-revealing");
        turns.delete(previous);
      }
      owners.delete(owner);
    }
    if (turn) {
      let pending = turns.get(turn);
      if (!pending) {
        turns.set(turn, pending = new Set());
        turn.setAttribute("data-gemini-revealing", "true");
      }
      pending.add(owner);
      owners.set(owner, turn);
    }
  }

  return {
    update,
    dispose() {
      disposed = true;
      for (const turn of turns.keys()) turn.removeAttribute("data-gemini-revealing");
      turns.clear();
      owners = new WeakMap();
    }
  };
}

function createGeminiStreamingReveal(environment) {
  const clock = {
    now: () => environment.performance.now(),
    setTimeout: (callback, delay) => environment.setTimeout(callback, delay),
    clearTimeout: timer => environment.clearTimeout(timer)
  };
  const motion = environment.matchMedia?.("(prefers-reduced-motion: reduce)");
  const sessions = new Set();
  const renderers = new WeakMap();
  const turnGate = createGeminiTurnRevealGate();
  let disposed = false;
  const quiet = () => disposed || !!motion?.matches || environment.document?.visibilityState === "hidden";
  const updateMotion = () => {
    for (const entry of sessions) entry.session.update(entry.props.markdown, !!entry.props.animate, quiet());
  };
  motion?.addEventListener("change", updateMotion);
  environment.document?.addEventListener("visibilitychange", updateMotion);

  function rendererFor(React, Native, nativeComponents) {
    let Renderer = renderers.get(Native);
    if (Renderer) return Renderer;
    const delayStyle = at => ({ animationDelay: `${at - clock.now()}ms` });
    function Fade({ children, "data-reveal-at": timestamp }) {
      const at = Number(timestamp);
      const style = React.useMemo(() => delayStyle(at), [at]);
      return React.createElement("span", { key: at, className: "gemini-reveal-run", style }, children);
    }
    const components = { ...nativeComponents, "bg-gemini-reveal": Fade };
    // Promoting text reparses native markdown. Unchanged code cards should
    // keep their rendered lines instead of repeating syntax/virtualizer work.
    // Context updates still reach the original component through React.memo.
    if (nativeComponents.code) components.code = React.memo(nativeComponents.code, sameGeminiCodeProps);
    for (const [tag, property, className] of [
      ["li", "data-gemini-reveal-marker", "gemini-reveal-marker"],
      ["pre", "data-gemini-reveal-block", "gemini-reveal-block"]
    ]) {
      components[tag] = function RevealUnit(props) {
        const { [property]: timestamp, node, ...rest } = props;
        const at = timestamp === undefined ? null : Number(timestamp);
        const style = React.useMemo(() => at === null ? null :
          { "--gemini-reveal-delay": `${at - clock.now()}ms` }, [at]);
        if (style) {
          rest.style = { ...rest.style, ...style };
          rest.className = `${rest.className || ""} ${className}`.trim();
        }
        const original = nativeComponents[tag];
        return React.createElement(original || tag, original ? { ...rest, node } : rest);
      };
    }
    function Streaming(props) {
      const [entry] = React.useState(() => ({
        props, root: null, session: createGeminiRevealSession(props.markdown, !!props.animate, quiet(), clock)
      }));
      const session = entry.session;
      const snapshot = React.useSyncExternalStore(session.subscribe, session.getSnapshot);
      const attach = React.useCallback(element => {
        entry.root = element;
        turnGate.update(entry, element, session.getSnapshot().revealing);
      }, [entry]);
      React.useLayoutEffect(() => {
        entry.props = props;
        session.update(props.markdown, !!props.animate, quiet());
      }, [props.markdown, props.animate]);
      React.useLayoutEffect(() => { session.schedule(); }, [snapshot]);
      // Gate only queued text and the last fade. Native animate can remain
      // true after cancellation. Multiple segments share their turn's gate. This
      // effect runs only when that boolean changes, never for each token.
      React.useLayoutEffect(() => {
        turnGate.update(entry, entry.root, snapshot.revealing);
        return () => turnGate.update(entry, null, false);
      }, [snapshot.revealing]);
      React.useEffect(() => {
        sessions.add(entry);
        session.resume();
        return () => { sessions.delete(entry); session.suspend(); };
      }, []);
      // Keep the component types stable after the tail settles. Switching back
      // to the native map would remount every list/code block at completion,
      // discarding selection, local controls, and the code virtualizer's state.
      const frame = React.useMemo(() => ({
        components, ref: attach,
        rehype: () => (tree, file) => session.decorate(tree, file.value)
      }), [snapshot, attach]);
      return React.createElement(Native, {
        ...props, markdown: snapshot.shown, animate: false, bgGeminiReveal: frame
      });
    }
    Renderer = function GeminiMarkdown(props) {
      const armed = React.useRef(false);
      if (props.animate && typeof props.markdown === "string") armed.current = true;
      // Completed/history replies allocate no session, listeners, or timers.
      return React.createElement(armed.current ? Streaming : Native, props);
    };
    renderers.set(Native, Renderer);
    return Renderer;
  }
  return {
    render(React, Native, components, props) {
      if (disposed) return React.createElement(Native, props);
      return React.createElement(rendererFor(React, Native, components), props);
    },
    dispose() {
      disposed = true;
      motion?.removeEventListener("change", updateMotion);
      environment.document?.removeEventListener("visibilitychange", updateMotion);
      for (const { session } of sessions) session.finish();
      sessions.clear();
      turnGate.dispose();
    }
  };
}

const geminiStreamingReveal = createGeminiStreamingReveal(window);
window.__bettergravityGeminiReveal = geminiStreamingReveal;
plugin.onDispose(() => {
  geminiStreamingReveal.dispose();
  if (window.__bettergravityGeminiReveal === geminiStreamingReveal) delete window.__bettergravityGeminiReveal;
});
// End streaming reply reveal.

// The native follow-output hook reads this policy before requesting a scroll.
// It keeps initial positioning and explicit jumps, then leaves growing replies
// and step output where the user is reading. No scroll interception is needed.
const geminiManualScroll = {};
window.__bettergravityGeminiManualScroll = geminiManualScroll;
plugin.onDispose(() => {
  if (window.__bettergravityGeminiManualScroll === geminiManualScroll) delete window.__bettergravityGeminiManualScroll;
});

/* ---------------------------------------------------------------------------
 * Conversation session scrollbar: Willow's gemini-chat-scrollbar
 * ------------------------------------------------------------------------- */
const CONV_VIEW_SELECTOR = '[data-testid="conversation-view"]';

function applyConversationScrollbar(view) {
  if (!view || !view.isConnected) return;

  const innerScrollers = view.querySelectorAll('.overflow-y-auto');
  if (innerScrollers.length > 0) {
    for (let i = 0; i < innerScrollers.length; i++) {
      const scroller = innerScrollers[i];
      if (scroller.closest('[data-mention-menu]')) continue;
      if (!scroller.classList.contains('gemini-chat-scrollbar')) {
        scroller.classList.add('gemini-chat-scrollbar');
      }
    }
  } else {
    if (!view.classList.contains('gemini-chat-scrollbar')) {
      view.classList.add('gemini-chat-scrollbar');
    }
  }
}

function updateTurnFooters(view) {
  if (!view || !view.isConnected) return;
  const articles = view.querySelectorAll('[role="article"][aria-label="Agent response"]');
  if (articles.length === 0) return;

  const latestArticle = articles[articles.length - 1];
  const latestTurn = latestArticle ? latestArticle.closest('.flex.items-start') : null;
  if (!latestTurn) return;

  const prev = view.querySelector('[data-gemini-latest-turn="true"]');
  if (prev && prev !== latestTurn) {
    prev.setAttribute("data-gemini-latest-turn", "false");
  }
  if (latestTurn.getAttribute("data-gemini-latest-turn") !== "true") {
    latestTurn.setAttribute("data-gemini-latest-turn", "true");
  }
}

/*
 * The row that carries the feedback buttons.
 *
 * conversation.css used to find it 23 times over with
 * `:has(button[aria-label="Good response"], button[aria-label="Copy"])`. That
 * reads as a cheap question but Chromium does not charge it at match time: it
 * charges it at invalidation time, document-wide, so every class change anywhere
 * in Antigravity re-asked all 23. Measured, the sheet's `:has()` rules turned a
 * 0.6 ms style recalculation into 122 ms. So the question is asked here once,
 * and `data-gemini-turn-actions` is the answer the stylesheet reads.
 *
 * `closest` is the exact inverse of the selector it replaces, checked live on a
 * five-turn conversation: the selector matched three rows, walking up from all
 * eight buttons produced the same three, and none of them nested inside another
 * (which would have made the two sets differ). Marks are set synchronously, in
 * the same task as the mutation that brought the buttons in, never from a frame
 * callback - a mark that stands in for a selector cannot be one frame late or
 * the row paints unstyled first.
 */
const TURN_ACTION_BUTTONS = 'button[aria-label="Good response"], button[aria-label="Copy"]';
const TURN_ACTION_BAR = '.flex.w-full.items-start';

function markTurnActionBar(button) {
  const bar = button.closest(TURN_ACTION_BAR);
  if (bar && bar.getAttribute("data-gemini-turn-actions") !== "true") {
    bar.setAttribute("data-gemini-turn-actions", "true");
  }
}

function markTurnActions(root) {
  if (!root || root.nodeType !== Node.ELEMENT_NODE) return;
  if (root.matches(TURN_ACTION_BUTTONS)) markTurnActionBar(root);
  const buttons = root.querySelectorAll(TURN_ACTION_BUTTONS);
  for (let i = 0; i < buttons.length; i++) markTurnActionBar(buttons[i]);
}

const SEARCH_ROW_SELECTOR = '.flex.items-center.gap-1.overflow-hidden.text-sm.group';

function sanitizeSearchWildcardRow(row) {
  if (!row) return;
  const label = row.firstElementChild;
  if (!label || !label.classList?.contains('text-secondary-foreground')) return;
  const text = label.textContent?.trim();
  if (text !== 'Searched' && text !== 'Searching') return;
  const querySpan = label.nextElementSibling;
  if (!querySpan || !querySpan.classList?.contains('overflow-hidden')) return;
  const query = querySpan.textContent?.trim();
  if (query === '*' || query === '**/*' || query === '"*"' || query === "'*'") {
    if (querySpan.getAttribute('data-gemini-wildcard') !== 'true') {
      querySpan.setAttribute('data-gemini-wildcard', 'true');
    }
  } else if (querySpan.hasAttribute('data-gemini-wildcard')) {
    querySpan.removeAttribute('data-gemini-wildcard');
  }
}

function sanitizeSearchWildcards(root) {
  if (!root || root.nodeType !== Node.ELEMENT_NODE) return;
  if (root.matches?.(SEARCH_ROW_SELECTOR)) sanitizeSearchWildcardRow(root);
  const rows = root.querySelectorAll(SEARCH_ROW_SELECTOR);
  for (let i = 0; i < rows.length; i++) sanitizeSearchWildcardRow(rows[i]);
}

plugin.dom.observe(SEARCH_ROW_SELECTOR, (row) => {
  sanitizeSearchWildcardRow(row);
  const obs = new MutationObserver(() => sanitizeSearchWildcardRow(row));
  obs.observe(row, { childList: true, characterData: true, subtree: true });
  remember(row, { disconnect: () => obs.disconnect() });
});

/*
 * What the two passes above actually read: a turn, one of the view's scrollers,
 * and the action bar that lands when a turn finishes.
 */
const TURN_LANDMARKS = '[role="article"], [data-testid="user-input-step"], .overflow-y-auto, button[aria-label="Good response"], button[aria-label="Copy"], .flex.items-center.gap-1.overflow-hidden.text-sm.group';

/*
 * A streaming reply changes this subtree continuously — every word arriving is a
 * mutation — and both passes walk the whole conversation. So a batch only earns
 * a pass when it brings in or takes away something they read; text landing
 * inside a turn that is already marked does not. The caller still forces a pass
 * once a second, so a landmark that appears some other way is not missed.
 *
 * The same walk sets the action-bar marks, because those cannot wait for the
 * frame callback. It cannot stop at the first landmark the way it used to: an
 * early return would leave a later row in the same batch unmarked.
 */
function scanTurnMutations(records) {
  let touched = false;
  for (const record of records) {
    for (const node of record.addedNodes) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      markTurnActions(node);
      sanitizeSearchWildcards(node);
      if (!touched && (node.matches(TURN_LANDMARKS) || node.querySelector(TURN_LANDMARKS))) touched = true;
    }
    if (touched) continue;
    for (const node of record.removedNodes) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      if (node.matches(TURN_LANDMARKS) || node.querySelector(TURN_LANDMARKS)) {
        touched = true;
        break;
      }
    }
  }
  return touched;
}

plugin.dom.observe(CONV_VIEW_SELECTOR, (view) => {
  if (view.style.display === 'block') {
    view.style.display = '';
  }
  applyConversationScrollbar(view);
  updateTurnFooters(view);
  markTurnActions(view);
  sanitizeSearchWildcards(view);
  let convRafId = null;
  let lastPass = performance.now();
  const scheduleUpdate = () => {
    if (convRafId !== null) return;
    convRafId = requestAnimationFrame(() => {
      convRafId = null;
      if (!view.isConnected) return;
      if (view.style.display === 'block') {
        view.style.display = '';
      }
      lastPass = performance.now();
      applyConversationScrollbar(view);
      updateTurnFooters(view);
      markTurnActions(view);
      sanitizeSearchWildcards(view);
    });
  };
  const obs = new MutationObserver((records) => {
    if (scanTurnMutations(records) || performance.now() - lastPass > 1000) scheduleUpdate();
  });
  obs.observe(view, { childList: true, subtree: true });
  remember(view, {
    disconnect: () => {
      if (convRafId !== null) {
        cancelAnimationFrame(convRafId);
        convRafId = null;
      }
      obs.disconnect();
    }
  });
});

/* ---------------------------------------------------------------------------
 * Sent user message bubble: Willow Expand/Collapse Control
 * (features/chat/src/UserMessageBubble.tsx:14-122)
 *
 * Willow clips a user message taller than four lines (96px at 24px line-height).
 * When taller than 96px, it displays a fade gradient and a floating toggle button
 * with a down arrow (expand_more) inside a dark pill. Clicking it expands the
 * bubble with a smooth 300ms transition to show the full text, swapping the icon
 * to an up arrow (expand_less). Clicking again contracts it back to 96px.
 * ------------------------------------------------------------------------- */
const USER_MSG_COLLAPSED_HEIGHT = 96;
const USER_MSG_EXPANDED_RESERVE = 24;

// Mounting a thread or resizing its column wakes several bubbles together.
// Finish their attachment wrappers, measure every bubble, then update controls.
// A microtask keeps all three passes before paint without interleaving each
// bubble's DOM writes with the next one's forced layout.
const pendingBubbleUpdates = new Set();
const bubbleResizeHandlers = new WeakMap();
const observedBubbleTexts = new WeakSet();
const BUBBLE_SIZE_MARKER = 'data-gemini-bubble-size';
let bubbleUpdatesQueued = false;
let bubbleUpdatesDisposed = false;
let bubbleResizeObserver = null;
let bubbleConnectionObserver = null;

function scheduleBubbleUpdate(prepare) {
  if (bubbleUpdatesDisposed) return;
  pendingBubbleUpdates.add(prepare);
  if (bubbleUpdatesQueued) return;
  bubbleUpdatesQueued = true;
  queueMicrotask(() => {
    bubbleUpdatesQueued = false;
    const updates = [...pendingBubbleUpdates];
    pendingBubbleUpdates.clear();
    if (bubbleUpdatesDisposed) return;
    const measurements = updates.map(update => update()).filter(Boolean);
    const commits = measurements.map(measure => measure()).filter(Boolean);
    for (const commit of commits) commit();
  });
}

function updateBubbleConnection(text) {
  const update = bubbleResizeHandlers.get(text);
  if (!update) return;
  if (text.isConnected) {
    if (observedBubbleTexts.has(text)) return;
    observedBubbleTexts.add(text);
    bubbleResizeObserver.observe(text);
    scheduleBubbleUpdate(update);
  } else {
    observedBubbleTexts.delete(text);
    bubbleResizeObserver.unobserve(text);
    pendingBubbleUpdates.delete(update);
  }
}

function collectBubbleTexts(root, into) {
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  if (root.hasAttribute(BUBBLE_SIZE_MARKER)) into.add(root);
  if (root.firstElementChild) {
    for (const text of root.querySelectorAll(`[${BUBBLE_SIZE_MARKER}]`)) into.add(text);
  }
}

function observeBubbleText(text, update) {
  if (!bubbleResizeObserver) {
    bubbleResizeObserver = new ResizeObserver(entries => {
      for (const { target } of entries) {
        if (!target.isConnected) {
          updateBubbleConnection(target);
          continue;
        }
        const prepare = bubbleResizeHandlers.get(target);
        if (prepare) scheduleBubbleUpdate(prepare);
      }
    });
    // A shared ResizeObserver retains its targets even when their conversation
    // leaves the document. Release removed bubbles without waiting for a frame
    // or a resize (hidden bubbles can already have zero size). Keep only their
    // weak handlers so a reattached native node resumes with the same controls.
    bubbleConnectionObserver = new MutationObserver(records => {
      const changed = new Set();
      for (const record of records) {
        for (const node of record.removedNodes) if (!node.isConnected) collectBubbleTexts(node, changed);
        for (const node of record.addedNodes) if (node.isConnected) collectBubbleTexts(node, changed);
      }
      for (const target of changed) updateBubbleConnection(target);
    });
    bubbleConnectionObserver.observe(document.documentElement, { childList: true, subtree: true });
  }
  bubbleResizeHandlers.set(text, update);
  text.setAttribute(BUBBLE_SIZE_MARKER, '');
  updateBubbleConnection(text);
}

plugin.onDispose(() => {
  bubbleUpdatesDisposed = true;
  pendingBubbleUpdates.clear();
  bubbleConnectionObserver?.disconnect();
  bubbleResizeObserver?.disconnect();
});

function setBubbleStyle(element, name, value, priority = '') {
  const style = element.style;
  if (style.getPropertyValue(name) !== value || style.getPropertyPriority(name) !== priority) {
    style.setProperty(name, value, priority);
  }
}

function setBubbleAttribute(element, name, value) {
  if (element.getAttribute(name) !== value) element.setAttribute(name, value);
}

function setupUserMessageBubble(step) {
  if (!step || !step.isConnected) return;

  const trigger = step.querySelector('[data-testid="lifted-context-menu-trigger"]');
  const bgCard = trigger?.querySelector('.bg-card');
  const flex1 = bgCard?.querySelector('.flex-1');
  const textContent = flex1?.querySelector('.whitespace-pre-wrap');

  if (!bgCard || !flex1 || !textContent) {
    const initObs = new MutationObserver(() => {
      if (step.querySelector('.whitespace-pre-wrap')) {
        initObs.disconnect();
        setupUserMessageBubble(step);
      }
    });
    initObs.observe(step, { childList: true, subtree: true });
    remember(step, initObs);
    return;
  }

  const onFlexClick = (e) => {
    // React delegates attachment actions to its root. Stopping their clicks
    // here would prevent native controls, including image previews, from firing.
    const control = e.target?.closest?.('button, a[href], input, select, textarea, [role="button"], [role="link"], [contenteditable="true"]');
    if (control && flex1.contains(control)) return;
    if (window.getSelection()?.toString()) return;
    e.stopPropagation();
  };
  flex1.addEventListener('click', onFlexClick);

  let boundToggle = null;
  let toggleCurrent = null;
  let active = true;
  const onToggleClick = (event) => toggleCurrent?.(event);

  const updateToggle = () => {
    if (!active || !flex1.isConnected || !textContent.isConnected) return;

    const attachmentStrip = flex1.querySelector('[data-no-scroll-jump], .flex-wrap:has(img), img');
    const hasAttachment = Boolean(attachmentStrip);

    let bubbleContainer;
    let clampTarget;

    if (hasAttachment) {
      bubbleContainer = textContent;
      let clip = textContent.querySelector(':scope > .willow-bubble-clip');
      if (!clip) {
        clip = document.createElement('div');
        clip.className = 'willow-bubble-clip';
        const childrenToMove = [];
        for (const node of Array.from(textContent.childNodes)) {
          if (node.nodeType === 1 && node.classList.contains('willow-bubble-toggle-container')) continue;
          childrenToMove.push(node);
        }
        childrenToMove.forEach(n => clip.appendChild(n));
        textContent.insertBefore(clip, textContent.firstChild);
      } else {
        for (const node of Array.from(textContent.childNodes)) {
          if (node === clip) continue;
          if (node.nodeType === 1 && node.classList.contains('willow-bubble-toggle-container')) continue;
          clip.appendChild(node);
        }
      }
      clampTarget = clip;
    } else {
      bubbleContainer = bgCard;
      clampTarget = flex1;
    }

    let container = bubbleContainer.querySelector(':scope > .willow-bubble-toggle-container');
    const wrongParent = hasAttachment ? bgCard : textContent;
    const existingOther = wrongParent.querySelector(':scope > .willow-bubble-toggle-container');
    if (existingOther && !container) {
      container = existingOther;
      bubbleContainer.appendChild(container);
    }

    let isExpanded = clampTarget.dataset.geminiExpanded === 'true';

    let naturalTextHeight;
    const resetScroll = () => {
      flex1.scrollTop = 0;
      if (clampTarget !== flex1) clampTarget.scrollTop = 0;
    };
    const measure = () => {
      if (!active || !flex1.isConnected || !textContent.isConnected) return;
      resetScroll();
      const height = hasAttachment
        ? clampTarget.scrollHeight
        : (textContent.getBoundingClientRect().height || flex1.scrollHeight);
      naturalTextHeight = Math.ceil(height - (isExpanded ? USER_MSG_EXPANDED_RESERVE : 0));
      return applyMeasurement;
    };

    const applyMeasurement = () => {
      if (!active || !flex1.isConnected || !textContent.isConnected) return;
      const canToggle = naturalTextHeight > USER_MSG_COLLAPSED_HEIGHT;

      if (!canToggle) {
        boundToggle?.removeEventListener('click', onToggleClick);
        boundToggle = null;
        toggleCurrent = null;
        if (container) {
          container.remove();
          container = null;
        }
        delete clampTarget.dataset.geminiExpanded;
        delete clampTarget.dataset.geminiCanToggle;
        delete flex1.dataset.geminiExpanded;
        delete flex1.dataset.geminiCanToggle;
        clampTarget.style.removeProperty('--willow-expanded-height');
        setBubbleStyle(clampTarget, 'padding-bottom', '');
        setBubbleStyle(clampTarget, 'mask-image', 'none', 'important');
        setBubbleStyle(clampTarget, '-webkit-mask-image', 'none', 'important');
        setBubbleStyle(flex1, 'mask-image', 'none', 'important');
        setBubbleStyle(flex1, '-webkit-mask-image', 'none', 'important');
        return;
      }

      setBubbleAttribute(clampTarget, 'data-gemini-can-toggle', 'true');

      if (!container) {
        container = document.createElement('div');
        container.className = 'willow-bubble-toggle-container';

        const fade = document.createElement('div');
        fade.className = 'willow-bubble-fade';
        fade.setAttribute('aria-hidden', 'true');
        container.appendChild(fade);

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'willow-bubble-toggle-btn';

        const pill = document.createElement('span');
        pill.className = 'willow-bubble-toggle-pill';

        const icon = document.createElement('span');
        icon.className = 'willow-bubble-icon';
        pill.appendChild(icon);
        btn.appendChild(pill);
        container.appendChild(btn);

        bubbleContainer.appendChild(container);
      }

      function applyState() {
        // Resizing the rail wakes every visible message's observer. Rewriting
        // an unchanged label or attribute wakes the conversation watchers again.
        setBubbleAttribute(clampTarget, 'data-gemini-can-toggle', 'true');
        setBubbleAttribute(clampTarget, 'data-gemini-expanded', String(isExpanded));
        setBubbleStyle(clampTarget, 'mask-image', 'none', 'important');
        setBubbleStyle(clampTarget, '-webkit-mask-image', 'none', 'important');
        setBubbleStyle(flex1, 'mask-image', 'none', 'important');
        setBubbleStyle(flex1, '-webkit-mask-image', 'none', 'important');

        const btn = container.querySelector('.willow-bubble-toggle-btn');
        const fade = container.querySelector('.willow-bubble-fade');
        const icon = container.querySelector('.willow-bubble-icon');

        if (isExpanded) {
          setBubbleStyle(clampTarget, '--willow-expanded-height', (naturalTextHeight + USER_MSG_EXPANDED_RESERVE) + 'px');
          setBubbleStyle(clampTarget, 'padding-bottom', USER_MSG_EXPANDED_RESERVE + 'px');
          if (fade) setBubbleStyle(fade, 'display', 'none');
          if (icon && icon.textContent !== 'expand_less') icon.textContent = 'expand_less';
          if (btn) {
            setBubbleAttribute(btn, 'aria-label', 'Collapse');
            setBubbleAttribute(btn, 'aria-expanded', 'true');
            setBubbleAttribute(btn, 'title', 'Collapse text');
          }
        } else {
          clampTarget.style.removeProperty('--willow-expanded-height');
          setBubbleStyle(clampTarget, 'padding-bottom', '0px');
          if (fade) setBubbleStyle(fade, 'display', '');
          if (icon && icon.textContent !== 'expand_more') icon.textContent = 'expand_more';
          if (btn) {
            setBubbleAttribute(btn, 'aria-label', 'Expand');
            setBubbleAttribute(btn, 'aria-expanded', 'false');
            setBubbleAttribute(btn, 'title', 'Expand text');
          }
        }
      }

      const toggle = container.querySelector('.willow-bubble-toggle-btn');
      if (boundToggle !== toggle) {
        boundToggle?.removeEventListener('click', onToggleClick);
        boundToggle = toggle;
        boundToggle?.addEventListener('click', onToggleClick);
      }
      // Reuse the button across resize and reload, with the current measurement.
      toggleCurrent = (event) => {
        event.stopPropagation();
        event.preventDefault();
        const scroller = step.closest('.overflow-y-auto') || document.querySelector('[data-testid="conversation-view"] .overflow-y-auto');
        const wasNearBottom = scroller ? (scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop <= 10) : false;
        resetScroll();
        isExpanded = !isExpanded;
        applyState();
        if (scroller && wasNearBottom && !isExpanded) {
          setTimeout(() => {
            scroller.scrollTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
          }, 310);
        }
      };
      applyState();
    };
    return measure;
  };

  scheduleBubbleUpdate(updateToggle);
  observeBubbleText(textContent, updateToggle);

  remember(step, {
    disconnect: () => {
      active = false;
      pendingBubbleUpdates.delete(updateToggle);
      flex1.removeEventListener('click', onFlexClick);
      boundToggle?.removeEventListener('click', onToggleClick);
      boundToggle = null;
      toggleCurrent = null;
      if (bubbleResizeHandlers.get(textContent) === updateToggle) {
        bubbleResizeHandlers.delete(textContent);
        observedBubbleTexts.delete(textContent);
        bubbleResizeObserver?.unobserve(textContent);
        textContent.removeAttribute(BUBBLE_SIZE_MARKER);
      }
    }
  });
}

plugin.dom.observe('[data-testid="user-input-step"]', (step) => {
  setupUserMessageBubble(step);
});

/* ---------------------------------------------------------------------------
 * Changed files review card: Willow Spark style
 * ------------------------------------------------------------------------- */
function getBasename(pathOrUri) {
  if (!pathOrUri) return "";
  const clean = String(pathOrUri).split("?")[0].split("#")[0];
  const parts = clean.split(/[/\\]/).filter(Boolean);
  const name = parts[parts.length - 1] || clean;
  try {
    return decodeURIComponent(name);
  } catch (_) {
    return name;
  }
}

function getTurnDiff(el) {
  try {
    const key = Object.keys(el).find(k => k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$"));
    if (!key) return null;
    let cur = el[key];
    for (let i = 0; i < 30 && cur; i++) {
      if (cur.memoizedProps?.turnDiff) return cur.memoizedProps.turnDiff;
      if (cur.pendingProps?.turnDiff) return cur.pendingProps.turnDiff;
      if (cur.memoizedProps?.diff) return cur.memoizedProps.diff;
      cur = cur.return;
    }
  } catch (_) {}
  return null;
}

function extractFileNames(turnDiff) {
  if (!turnDiff || !turnDiff.fileDiffs) return [];
  const entries = Object.entries(turnDiff.fileDiffs);
  let files = entries
    .filter(([, diff]) => !diff?.isArtifactFile)
    .map(([pathOrUri]) => getBasename(pathOrUri));

  if (files.length === 0 && entries.length > 0) {
    files = entries.map(([pathOrUri]) => getBasename(pathOrUri));
  }
  return files;
}

const attachedFileCards = new WeakSet();

function applyWillowFileCard(header) {
  if (!header || !header.isConnected) return;
  const textCol = header.querySelector(".overflow-hidden");
  if (!textCol) return;

  const turnDiff = getTurnDiff(header);
  const fileNames = extractFileNames(turnDiff);
  const subtitleText = fileNames.length > 0 ? fileNames.join(", ") : "";

  let subtitle = textCol.querySelector(".spark-file-card-subtitle");
  if (!subtitle) {
    subtitle = document.createElement("span");
    subtitle.className = "spark-file-card-subtitle";
    textCol.appendChild(subtitle);
  }

  if (subtitleText && subtitle.textContent !== subtitleText) {
    subtitle.textContent = subtitleText;
    subtitle.title = subtitleText;
  }

  if (!attachedFileCards.has(header)) {
    attachedFileCards.add(header);
    header.dataset.willowCardAttached = "true";
    listenToElement(header, "click", (e) => {
      // If clicking directly on or inside the review button, let its native handler run
      if (e.target.closest(".review-button")) return;
      // Otherwise, prevent default accordion toggle and trigger Review
      e.preventDefault();
      e.stopPropagation();
      const btn = header.querySelector(".review-button");
      if (btn) btn.click();
    }, true);
    remember(header, {
      disconnect: () => {
        attachedFileCards.delete(header);
        delete header.dataset.willowCardAttached;
      }
    });
  }
}

plugin.dom.observe(".files-changed-header", (header) => {
  applyWillowFileCard(header);
  requestAnimationFrame(() => applyWillowFileCard(header));
  setTimeout(() => applyWillowFileCard(header), 150);

  const obs = new MutationObserver(() => applyWillowFileCard(header));
  obs.observe(header, { childList: true, subtree: true, characterData: true });
  remember(header, obs);
});



plugin.onDispose(() => {
  stopMenus();
  stopGlobalTooltips();
  for (const [, obs] of rememberedObservers()) {
    if (typeof obs?.disconnect === 'function') obs.disconnect();
  }
  observed.clear();
  // The added rows go first, so what is left to unmark is only Antigravity's own.
  for (const added of document.querySelectorAll("#gemini-experience-switch, [data-gemini-tools], [data-gemini-submenu], .spark-file-card-subtitle, .gemini-ai-disclaimer")) added.remove();
  for (const popup of document.querySelectorAll("[data-gemini-plus-menu]")) {
    popup.removeAttribute("data-gemini-plus-menu");
    for (const item of popup.querySelectorAll("[data-gemini-row]")) {
      item.removeAttribute("data-gemini-row");
      item.removeAttribute("data-gemini-glyph");
      item.removeAttribute("data-gemini-glyph-family");
    }
    for (const label of popup.querySelectorAll("[data-gemini-label]")) label.removeAttribute("data-gemini-label");
  }
});

/* ---------------------------------------------------------------------------
 * The home screen's greeting, and the composer's slide into a conversation.
 *
 * styles/home-composer.css centres the composer and draws the greeting above
 * it. Two things about them cannot be done in CSS.
 *
 * The greeting's text, because it carries a name. Willow takes the first word of
 * the signed-in profile's display name (features/media/src/MediaHome.tsx:
 * 205-231). That name is nowhere in Antigravity's own state, but it is in the
 * Chromium profile Antigravity signs into Google through, which BetterGravity
 * reads on the page's behalf as `plugin.account`.
 *
 * And the slide, because its distance is not known until it happens.
 * Antigravity renders a different tree for a conversation than for the home
 * screen — measured live, the docked composer has no `z-[1]` group around it and
 * no workspace button above the card — so the composer at the bottom of a new
 * conversation is a different element from the one that was in the middle of the
 * screen, with no position of its own to leave. Where the old one was is
 * recorded on submit, and the new one is animated from there, over Willow's own
 * 250ms on cubic-bezier(0.2, 0, 0, 1) (features/chat/src/ChatView.tsx:4560).
 *
 * Only a submit arms it. Willow plays the same slide when an existing
 * conversation is opened from the sidebar; that one is deliberately left alone,
 * so opening a conversation puts its composer where it belongs without
 * travelling there first.
 * ------------------------------------------------------------------------- */
const HOME_SCROLLER = 'div[class*="pt-[30vh]"]';
const HOME_GROUP = `${HOME_SCROLLER} > div[class*="z-[1]"]`;
const COMPOSER_BOX = '[data-testid="agent-input-box"]';
const SEND_BUTTON = '[data-testid="send-button"]';
const SIDEBAR_NAV = '[role="navigation"][aria-label="Sidebar"]';

/** Willow's own layout transition: `{ duration: 0.25, ease: [0.2, 0, 0, 1] }`. */
const SLIDE_MS = 250;
const SLIDE_EASING = "cubic-bezier(0.2, 0, 0, 1)";

/**
 * How long a submit stays armed. The conversation opens within a frame or two of
 * it; anything slower is a navigation that is no longer the submit's.
 */
const SLIDE_WINDOW_MS = 1500;

/**
 * The greeting, or null while the name is still unknown.
 *
 * Willow shows nothing rather than a nameless version first, because the name is
 * inside the string: building it early does not produce "a greeting without a
 * name", it produces a different greeting that then has to be replaced
 * (MediaHome.tsx:160-191, from a refresh that went `Let's chat` ->
 * `Let's chat, there` -> `Let's chat, <name>`).
 *
 * A runtime too old for `plugin.account` is the other case Willow has, and takes
 * Willow's answer to it: signed out short-circuits the wait, because the nameless
 * greeting is the final text then rather than a placeholder for one.
 */
const DEFAULT_ACCOUNT = {
  fullName: "",
  email: "",
  pictureUrl: ""
};

let userAccountProfile = { ...DEFAULT_ACCOUNT };

function updateAllUserCards(profile) {
  if (!profile) return;
  for (const pill of document.querySelectorAll("#gemini-sidebar-user-pill")) {
    const nameEl = pill.querySelector(".gemini-user-name");
    const emailEl = pill.querySelector(".gemini-user-email");
    const imgEl = pill.querySelector(".gemini-user-avatar");
    const fallbackEl = pill.querySelector(".gemini-user-avatar-fallback");

    const displayName = profile.fullName || (profile.email ? profile.email.split("@")[0] : "Account");
    if (nameEl) nameEl.textContent = displayName;
    if (emailEl) {
      emailEl.textContent = profile.email || "";
      emailEl.style.display = profile.email ? "" : "none";
    }
    if (imgEl) {
      if (profile.pictureUrl) {
        imgEl.src = profile.pictureUrl;
        imgEl.style.display = "";
        if (fallbackEl) fallbackEl.style.display = "none";
      } else {
        imgEl.style.display = "none";
        if (fallbackEl) fallbackEl.style.display = "flex";
      }
    }
    if (fallbackEl) {
      const initial = (profile.fullName || profile.email || "A").charAt(0).toUpperCase();
      fallbackEl.textContent = initial;
    }
    if (profile.fullName || profile.email) {
      pill.title = profile.email
        ? (profile.fullName ? `${profile.fullName} (${profile.email})` : profile.email)
        : profile.fullName || "Account";
    }
  }
}

let greeting = plugin.account ? null : "Hello there";

if (plugin.account) {
  plugin.account
    .read()
    .then((profile) => {
      // `firstName` is Google's own `given_name`, or the first word of the full
      // name when Google did not give one.
      greeting = profile?.firstName ? `Hello there, ${profile.firstName}` : "Hello there";
      if (profile?.fullName) userAccountProfile.fullName = profile.fullName;
      if (profile?.email) userAccountProfile.email = profile.email;
      if (profile?.pictureUrl) userAccountProfile.pictureUrl = profile.pictureUrl;
      updateAllUserCards(userAccountProfile);

      // The home screen may already be up, its observer having been and gone
      // with nothing to show.
      for (const group of document.querySelectorAll(HOME_GROUP)) ensureHomeGreeting(group);
    })
    // `read()` answers `{}` rather than throwing, so this is only reached by a
    // runtime broken enough that no name is ever coming.
    .catch(() => {});
}

/**
 * `Hello there, <name>` above the composer, as Willow's `PinnedChatGreeting`.
 *
 * The stylesheet positions the block absolutely, so where it sits among the
 * group's children changes nothing on screen; it goes first because that is the
 * order it reads in.
 */
function ensureHomeGreeting(group) {
  if (!group.isConnected || greeting === null) return;

  // Antigravity discards this group when a conversation opens rather than
  // restyling it, so a greeting cannot be carried into a docked composer. The
  // check is here in case that ever changes, because the block would then be an
  // unstyled heading pushing the composer down.
  if (!group.matches(HOME_GROUP)) {
    for (const stale of group.querySelectorAll("[data-gemini-greeting]")) stale.remove();
    return;
  }

  const existing = group.querySelector(":scope > [data-gemini-greeting]");
  if (existing) {
    const heading = existing.querySelector("[data-gemini-greeting-text]");
    if (heading && heading.textContent !== greeting) heading.textContent = greeting;
    return;
  }

  const block = document.createElement("div");
  block.dataset.geminiGreeting = "";
  const fade = document.createElement("div");
  fade.dataset.geminiGreetingFade = "";
  const heading = document.createElement("h1");
  heading.dataset.geminiGreetingText = "";
  heading.textContent = greeting;
  fade.append(heading);
  block.append(fade);
  group.prepend(block);
}

plugin.dom.observe(HOME_GROUP, (group) => {
  ensureHomeGreeting(group);
  const obs = new MutationObserver(() => ensureHomeGreeting(group));
  obs.observe(group, { childList: true });
  remember(group, obs);
});

let pendingSlide = null;

function cancelComposerSlide() {
  if (!pendingSlide) return;
  pendingSlide.watcher.disconnect();
  window.clearTimeout(pendingSlide.timer);
  pendingSlide = null;
}

/**
 * Records where the home screen's composer is, and slides the next one up to
 * that spot and back down.
 *
 * A MutationObserver rather than a frame callback: its callback runs at the end
 * of the task that inserted the conversation, before that task's frame is
 * painted, so the new composer is never seen at the bottom before it starts
 * travelling there. It also does not care whether Antigravity reused the box or
 * built a new one, since it measures whatever is there.
 */
function armComposerSlide() {
  // The home screen is the only place the slide starts from.
  if (!document.querySelector(HOME_SCROLLER)) return;
  const box = document.querySelector(COMPOSER_BOX);
  if (!box) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  cancelComposerSlide();
  const from = box.getBoundingClientRect().top;

  const watcher = new MutationObserver(() => {
    // Still on the home screen: the submit has not opened anything yet.
    if (document.querySelector(HOME_SCROLLER)) return;
    const docked = document.querySelector(COMPOSER_BOX);
    if (!docked) return;

    cancelComposerSlide();
    const distance = from - docked.getBoundingClientRect().top;
    if (Math.abs(distance) < 1) return;
    docked.animate(
      [{ transform: `translateY(${distance}px)` }, { transform: "translateY(0px)" }],
      { duration: SLIDE_MS, easing: SLIDE_EASING }
    );
  });

  watcher.observe(document.documentElement, { childList: true, subtree: true });
  pendingSlide = { watcher, timer: window.setTimeout(cancelComposerSlide, SLIDE_WINDOW_MS) };
}

/**
 * Sampler for Willow's emphasised curve, `cubic-bezier(0.2, 0, 0, 1)`.
 * Newton-Raphson to invert x(u), then evaluate y(u) (from features/chat/src/ChatView.tsx).
 */
function sampleEmphasisedEase(t) {
  const axis = (c1, c2, u) => {
    const a = 3 * c1;
    const b = 3 * (c2 - c1) - a;
    const c = 1 - a - b;
    return ((c * u + b) * u + a) * u;
  };
  const axisSlope = (c1, c2, u) => {
    const a = 3 * c1;
    const b = 3 * (c2 - c1) - a;
    const c = 1 - a - b;
    return (3 * c * u + 2 * b) * u + a;
  };
  let u = t;
  for (let i = 0; i < 5; i += 1) {
    const slope = axisSlope(0.2, 0, u);
    if (Math.abs(slope) < 1e-6) break;
    u -= (axis(0.2, 0, u) - t) / slope;
  }
  return axis(0, 1, Math.min(1, Math.max(0, u)));
}

/**
 * Willow's send choreography, using the host's existing last-turn reserve.
 * The first turn rises 200px over 500ms. Later short turns spend one eased
 * timeline on their entrance offset, then scrolling; long replies already
 * provide enough distance for native smooth scrolling. Only the new turn is
 * translated. History moves through scrolling, never artificial transforms.
 *
 * A real submit arms the shared DOM observer. There is no additional subtree
 * observer or token-driven scan. During the short follow-up glide, geometry is
 * read together before writes, and only refreshed after a resize. First-turn
 * and interruption transforms run as compositor animations, without a JS loop.
 */
function createGeminiSendEntrance(environment) {
  const doc = environment.document;
  const VIEW = '[data-testid="conversation-view"]';
  const USER = '[data-testid="user-input-step"]';
  const ARTICLE = '[role="article"][aria-label="User message"]';
  const EASING = "cubic-bezier(0.2, 0, 0, 1)";
  const motion = environment.matchMedia?.("(prefers-reduced-motion: reduce)");
  const now = () => environment.performance.now();
  const quiet = () => !!motion?.matches || doc.visibilityState === "hidden";
  let pending = null;
  let active = null;
  let claim = null;
  let disposed = false;

  function clearPending() {
    if (pending) {
      environment.clearTimeout(pending.timer);
      detachScrollIntent(pending);
    }
    pending = null;
  }

  function mainStep(step) {
    return !step.closest('[data-testid="pending-user-messages"], [role="article"][aria-label="Agent response"]') &&
      step.closest(ARTICLE);
  }

  function stepsIn(view) {
    return view ? Array.from(view.querySelectorAll(USER)).filter(mainStep) : [];
  }

  function matches(view) {
    if (!pending || !view) return false;
    if (pending.view?.isConnected && view !== pending.view) return false;
    if (pending.id && view.dataset.cascadeId !== pending.id) return false;
    if (!pending.first && environment.location?.pathname !== pending.route) return false;
    return !pending.pane?.isConnected || pending.pane.contains(view);
  }

  function attachScrollIntent(state, onInterrupt) {
    if (!state.scroller) return;
    state.interrupt = onInterrupt;
    state.keydown = event => {
      if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key) &&
          !event.target.closest('input, textarea, [contenteditable="true"]')) onInterrupt();
    };
    state.scroller.addEventListener("wheel", state.interrupt, { passive: true });
    state.scroller.addEventListener("touchstart", state.interrupt, { passive: true });
    state.scroller.addEventListener("pointerdown", state.interrupt, { passive: true });
    state.scroller.addEventListener("keydown", state.keydown);
  }

  function detachScrollIntent(state) {
    if (!state.scroller || !state.interrupt) return;
    state.scroller.removeEventListener("wheel", state.interrupt);
    state.scroller.removeEventListener("touchstart", state.interrupt);
    state.scroller.removeEventListener("pointerdown", state.interrupt);
    state.scroller.removeEventListener("keydown", state.keydown);
    state.interrupt = state.keydown = null;
  }

  function interruptPending() {
    if (!pending) return;
    // Keep the submit receipt so its delayed native callback cannot jump after
    // the user has taken over. The eventual turn consumes it without moving.
    pending.interrupted = true;
    detachScrollIntent(pending);
  }

  function watchPendingScroll(view) {
    const scroller = view?.querySelector(".overflow-y-auto");
    if (!pending || pending.interrupted || pending.scroller === scroller) return;
    detachScrollIntent(pending);
    pending.scroller = scroller;
    attachScrollIntent(pending, interruptPending);
  }

  function detach(run) {
    run.resize?.disconnect();
    detachScrollIntent(run);
    run.scroller.removeEventListener("scrollend", run.finishScroll);
  }

  function finish(run) {
    if (active !== run) return;
    active = null;
    detach(run);
    environment.cancelAnimationFrame(run.frame);
    environment.clearTimeout(run.timer);
    if (run.nativeScroll && run.scroller.isConnected) {
      // Stop an in-flight smooth scroll at the position already on screen.
      run.scroller.scrollTo({ top: run.scroller.scrollTop, behavior: "instant" });
    }
    if (run.animation) {
      run.animation.onfinish = run.animation.oncancel = null;
      run.animation.cancel();
    }
    run.group.removeAttribute("data-gemini-send-entering");
  }

  function cancel() {
    clearPending();
    claim = null;
    if (active) finish(active);
  }

  function arm(composer) {
    if (disposed || !composer?.isConnected) return;
    cancel();
    const view = composer.closest(VIEW);
    const before = new Set(stepsIn(view));
    const id = view?.dataset.cascadeId;
    pending = {
      view, before, first: before.size === 0,
      id: id && id !== "conversation" ? id : null,
      pane: composer.closest('.group\\/pane'),
      route: environment.location?.pathname,
      timer: environment.setTimeout(clearPending, 4000)
    };
    watchPendingScroll(view);
  }

  function animate(run, offset, duration) {
    run.offset = offset;
    run.duration = duration;
    run.animation = run.group.animate([
      { transform: `translateY(${offset}px)` }, { transform: "translateY(0px)" }
    ], { duration, easing: EASING });
    run.animation.onfinish = () => finish(run);
    run.animation.oncancel = () => finish(run);
    environment.clearTimeout(run.timer);
    run.timer = environment.setTimeout(() => finish(run), duration + 150);
  }

  function interrupt(run) {
    if (active !== run || !run.ownsScroll) return;
    run.ownsScroll = false;
    detach(run);
    environment.cancelAnimationFrame(run.frame);
    if (run.nativeScroll) {
      finish(run);
      return;
    }
    let offset = run.offset;
    if (!run.frameDriven && run.animation) {
      offset *= 1 - sampleEmphasisedEase(Math.min(1, Number(run.animation.currentTime || 0) / run.duration));
    }
    if (run.animation) {
      run.animation.onfinish = run.animation.oncancel = null;
      run.animation.cancel();
    }
    if (offset < 1 || quiet()) finish(run);
    else animate(run, offset, 120);
  }

  function mount(step) {
    if (disposed || !pending || pending.before.has(step) || !step?.isConnected) return false;
    const article = mainStep(step);
    const view = step.closest(VIEW);
    const group = article?.parentElement;
    const scroller = group?.closest(".overflow-y-auto");
    // Only the latest real turn in the submitting pane may consume the arm.
    // Queued messages, subagents, and history arriving during navigation cannot.
    if (!article || !matches(view) || !scroller || scroller === view || group.parentElement?.nextElementSibling) return false;

    const { first, interrupted } = pending;
    clearPending();
    claim = { step: new WeakRef(step), id: view.dataset.cascadeId, until: now() + 1500 };
    if (interrupted) return true;

    // All initial geometry is read before an animation or scroll is written.
    const viewport = scroller.getBoundingClientRect();
    const rect = group.getBoundingClientRect();
    const startTop = scroller.scrollTop;
    // Preserve Gemini App's existing resting inset; only the motion changes.
    const inset = parseFloat(environment.getComputedStyle(scroller).paddingTop) || 0;
    let destination = Math.max(0, rect.top - viewport.top + startTop - inset);
    if (first) destination = 0;
    if (quiet() || !viewport.height || !rect.height || typeof group.animate !== "function") {
      scroller.scrollTo({ top: destination, behavior: "instant" });
      return true;
    }

    const offset = first ? 200 : Math.max(0, Math.round(viewport.bottom - rect.top));
    const total = offset + Math.max(0, destination - startTop);
    if (!first && total < 1) return true;
    const duration = Math.min(520, Math.max(240, 240 + total * 0.28));
    const run = active = {
      group, scroller, view, id: view.dataset.cascadeId, offset, duration,
      frame: 0, timer: 0, animation: null, resize: null,
      ownsScroll: true, nativeScroll: false, frameDriven: false, dirty: false,
      interrupt: null, keydown: null, finishScroll: null
    };
    run.finishScroll = event => {
      if (event.target !== scroller) return;
      // A page contraction can replace a smooth-scroll target. Ignore the old
      // scroll's completion if the replacement is still travelling to the turn.
      if (Math.abs(scroller.scrollTop - destination) > 2 &&
          scroller.scrollTop + scroller.clientHeight < scroller.scrollHeight - 2) return;
      run.nativeScroll = false;
      finish(run);
    };
    attachScrollIntent(run, () => interrupt(run));
    group.setAttribute("data-gemini-send-entering", "true");

    try {
      if (first) {
        if (startTop !== 0) scroller.scrollTo({ top: 0, behavior: "instant" });
        animate(run, 200, 500);
      } else if (!offset) {
        // After a long response the bubble already begins below the viewport.
        run.nativeScroll = true;
        scroller.addEventListener("scrollend", run.finishScroll);
        // A send from far up the history can take longer than 1200ms. Let the
        // browser finish its glide; the fallback only releases a stopped scroll
        // if scrollend was missed. No per-frame layout reads or retargeting.
        let lastTop = startTop;
        const checkStopped = () => {
          if (active !== run) return;
          const top = scroller.scrollTop;
          if (!group.isConnected || !view.isConnected || quiet() || Math.abs(top - lastTop) < 0.5) finish(run);
          else {
            lastTop = top;
            run.timer = environment.setTimeout(checkStopped, 200);
          }
        };
        run.timer = environment.setTimeout(checkStopped, 1200);
        if (environment.ResizeObserver) {
          run.resize = new environment.ResizeObserver(() => {
            if (active !== run || !group.isConnected || !view.isConnected) return;
            const top = scroller.scrollTop;
            const viewportRect = scroller.getBoundingClientRect();
            const groupRect = group.getBoundingClientRect();
            const next = Math.max(0, groupRect.top - viewportRect.top + top - inset);
            // Native history paging removes content above the viewport. Its
            // anchor shift preserves the picture but changes the turn's scroll
            // coordinate. Growth below the bubble leaves this coordinate alone
            // and must never restart or extend the send scroll.
            if (Math.abs(next - destination) < 1) return;
            destination = next;
            if (destination <= top + 1) { finish(run); return; }
            lastTop = top;
            environment.clearTimeout(run.timer);
            run.timer = environment.setTimeout(checkStopped, 1200);
            scroller.scrollTo({ top: destination, behavior: "smooth" });
          });
          run.resize.observe(scroller);
          run.resize.observe(group);
          run.resize.observe(group.parentElement.parentElement);
        }
        scroller.scrollTo({ top: destination, behavior: "smooth" });
      } else {
        run.frameDriven = true;
        // A paused compositor animation avoids style-attribute mutations on each
        // frame. One timeline controls its playhead and the scroll handoff.
        run.animation = group.animate([
          { transform: `translateY(${offset}px)` }, { transform: "translateY(0px)" }
        ], { duration: 1, fill: "both", easing: "linear" });
        run.animation.pause();
        run.animation.currentTime = 0;
        if (environment.ResizeObserver) {
          run.resize = new environment.ResizeObserver(() => { run.dirty = true; });
          run.resize.observe(scroller);
          run.resize.observe(group);
          run.resize.observe(group.parentElement.parentElement);
        }
        const started = now();
        const frame = time => {
          if (active !== run) return;
          if (!group.isConnected || !view.isConnected || quiet()) { finish(run); return; }
          // Read before changing the playhead/scroll. Text arriving below the
          // bubble cannot restart the timeline or rewind a browser anchor shift.
          const top = scroller.scrollTop;
          if (run.dirty) {
            const viewportRect = scroller.getBoundingClientRect();
            const groupRect = group.getBoundingClientRect();
            destination = Math.max(0, groupRect.top - run.offset - viewportRect.top + top - inset);
            run.dirty = false;
          }
          const progress = Math.min(1, (time - started) / duration);
          const travelled = total * sampleEmphasisedEase(progress);
          const remaining = Math.max(0, offset - travelled);
          const scrollLeg = total - offset;
          const scrollProgress = scrollLeg === 0 ? 1 : Math.min(1, Math.max(0, travelled - offset) / scrollLeg);
          const next = startTop + Math.max(0, destination - startTop) * scrollProgress;
          run.offset = remaining;
          run.animation.currentTime = 1 - remaining / offset;
          if (next > top) scroller.scrollTop = next;
          if (progress < 1) run.frame = environment.requestAnimationFrame(frame);
          else finish(run);
        };
        run.frame = environment.requestAnimationFrame(frame);
        run.timer = environment.setTimeout(() => finish(run), duration + 150);
      }
    } catch (_) {
      // A missing/failed animation must never leave the working row hidden.
      finish(run);
      scroller.scrollTo({ top: destination, behavior: "instant" });
    }
    return true;
  }

  function nativeSend(id) {
    if (disposed) return false;
    if (active?.id === id) {
      if (!active.group.parentElement?.nextElementSibling) return true;
      finish(active);
    }
    // React's send effect can run before the shared observer's microtask. Claim
    // that same newly committed turn here, before native jump-to-bottom runs.
    if (pending) {
      const scope = pending.pane?.isConnected ? pending.pane : doc;
      const view = Array.from(scope.querySelectorAll(VIEW)).find(node => node.dataset.cascadeId === id && matches(node));
      const step = stepsIn(view).at(-1);
      if (step && mount(step)) return true;
      // The step count can arrive before the new turn's DOM. Keep this real
      // submit armed for the shared observer instead of falling through to the
      // native jump, which would both skip the glide and cancel the pending arm.
      if (view) {
        watchPendingScroll(view);
        return true;
      }
    }
    const step = claim?.step.deref();
    return !!(claim?.id === id && now() < claim.until && step?.isConnected &&
      !step.closest(ARTICLE)?.parentElement?.parentElement?.nextElementSibling);
  }

  function ownsViewport(node) {
    if (disposed) return false;
    if (active?.ownsScroll && active.scroller === node) return true;
    // Also suppress the initial follow request between the commit and observer.
    return !!pending && !pending.interrupted && matches(node.closest(VIEW));
  }

  function interruptScroll(node) {
    if (pending && matches(node.closest(VIEW))) interruptPending();
    if (active?.scroller === node) interrupt(active);
  }

  const onMotion = () => {
    if (quiet()) {
      if (active) finish(active);
    }
  };
  motion?.addEventListener("change", onMotion);
  doc.addEventListener("visibilitychange", onMotion);
  return {
    arm, mount, nativeSend, ownsViewport, interruptScroll, cancel,
    dispose() {
      disposed = true;
      cancel();
      motion?.removeEventListener("change", onMotion);
      doc.removeEventListener("visibilitychange", onMotion);
    }
  };
}

const geminiSendEntrance = createGeminiSendEntrance(window);
window.__bettergravityGeminiSendEntrance = geminiSendEntrance;
plugin.dom.observe('[data-testid="user-input-step"]', step => geminiSendEntrance.mount(step));
plugin.onDispose(() => {
  geminiSendEntrance.dispose();
  if (window.__bettergravityGeminiSendEntrance === geminiSendEntrance) delete window.__bettergravityGeminiSendEntrance;
});

function cancelSentPromptGlide() {
  geminiSendEntrance.cancel();
}

function armSentPromptGlide(target) {
  const box = target?.closest(COMPOSER_BOX) || target?.closest(INPUT_BOX) ||
    document.querySelector(COMPOSER_BOX) || document.querySelector(INPUT_BOX);
  const send = box?.querySelector(SEND_BUTTON);
  if (send?.disabled || send?.getAttribute("aria-disabled") === "true") return;
  if (box) geminiSendEntrance.arm(box);
}

function isComposerSubmitButton(target) {
  if (!target || !(target instanceof Element)) return false;
  const btn = target.closest('button');
  if (!btn?.closest(COMPOSER_BOX) || btn.disabled || btn.getAttribute('aria-disabled') === 'true') return false;

  const label = (btn.getAttribute('aria-label') || '').toLowerCase();
  const testId = (btn.getAttribute('data-testid') || '').toLowerCase();

  if (testId === 'send-button' || testId.includes('send') || label.includes('send')) {
    return true;
  }
  if (btn.querySelector('svg.lucide-arrow-up, svg.lucide-send')) {
    return true;
  }
  return false;
}

function onComposerSubmitKey(event) {
  if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
  const target = event.target instanceof Element ? event.target : null;
  if (!target?.closest(COMPOSER_BOX)) return;

  const currentTool = getSelectedTool();
  if (currentTool) {
    const root = editorRoot();
    if (root) {
      const text = (root.textContent || "").trim();
      const cmd = `/${currentTool.name}`;
      if (!text.startsWith(cmd)) {
        try {
          const range = document.createRange();
          range.selectNodeContents(root);
          range.collapse(true);
          const sel = window.getSelection();
          if (sel) {
            sel.removeAllRanges();
            sel.addRange(range);
          }
          document.execCommand("insertText", false, `${cmd} `);
        } catch (_) {}
      }
    }
    setTimeout(() => {
      deselectTool();
    }, 50);
    window.requestAnimationFrame(() => requestPromptExpansionCheck());
  }

  armComposerSlide();
  armSentPromptGlide(target);
}

function onComposerSubmitClick(event) {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;
  if (isComposerSubmitButton(target)) {
    const currentTool = getSelectedTool();
    if (currentTool) {
      const root = editorRoot();
      if (root) {
        const text = (root.textContent || "").trim();
        const cmd = `/${currentTool.name}`;
        if (!text.startsWith(cmd)) {
          try {
            const range = document.createRange();
            range.selectNodeContents(root);
            range.collapse(true);
            const sel = window.getSelection();
            if (sel) {
              sel.removeAllRanges();
              sel.addRange(range);
            }
            document.execCommand("insertText", false, `${cmd} `);
          } catch (_) {}
        }
      }
      setTimeout(() => {
        deselectTool();
      }, 50);
      window.requestAnimationFrame(() => requestPromptExpansionCheck());
    }

    armComposerSlide();
    armSentPromptGlide(target);
    return;
  }
  // Opening a conversation from the sidebar is the one navigation that must not
  // slide. It can only collide with a pending submit if both happen inside the
  // window above, and then the composer that arrives is the sidebar's.
  if (target.closest(SIDEBAR_NAV)) {
    cancelComposerSlide();
    cancelSentPromptGlide();
  }
}

// Capture, so a submit is seen before whatever Antigravity's editor does with
// the key or the click.
document.addEventListener("keydown", onComposerSubmitKey, true);
document.addEventListener("click", onComposerSubmitClick, true);

/* ---------------------------------------------------------------------------
 * Sidebar User Profile Card (Willow's lower-left account card)
 * ------------------------------------------------------------------------- */
const SETTINGS_BTN_SELECTOR = '[role="navigation"][aria-label="Sidebar"] [data-testid="settings-button"]';

function ensureSidebarUserCard(footer) {
  if (!footer || !footer.isConnected) return;
  const settingsBtn = footer.querySelector('[data-testid="settings-button"]');
  if (!settingsBtn) return;

  let pill = footer.querySelector("#gemini-sidebar-user-pill");
  if (!pill) {
    pill = document.createElement("button");
    pill.id = "gemini-sidebar-user-pill";
    pill.className = "gemini-sidebar-user";
    pill.type = "button";
    pill.setAttribute("aria-label", "User profile and settings");

    const avatarUrl = userAccountProfile.pictureUrl || "";
    const name = userAccountProfile.fullName || "";
    const email = userAccountProfile.email || "";
    const displayName = name || (email ? email.split("@")[0] : "Account");
    const initial = (name || email || "A").charAt(0).toUpperCase();

    pill.title = email ? (name ? `${name} (${email})` : email) : displayName;
    if (isSidebarCollapsed()) {
      pill.setAttribute("data-tooltip-position", "right");
    }

    const avatarWrap = document.createElement("div");
    avatarWrap.className = "gemini-user-avatar-wrap";

    const img = document.createElement("img");
    img.className = "gemini-user-avatar";
    if (avatarUrl) {
      img.src = avatarUrl;
      img.alt = "";
    } else {
      img.style.display = "none";
    }

    const fallback = document.createElement("div");
    fallback.className = "gemini-user-avatar-fallback";
    fallback.textContent = initial;
    if (avatarUrl) {
      fallback.style.display = "none";
    } else {
      fallback.style.display = "flex";
    }

    img.addEventListener("error", () => {
      img.style.display = "none";
      fallback.style.display = "flex";
    });

    avatarWrap.appendChild(img);
    avatarWrap.appendChild(fallback);

    const textDiv = document.createElement("div");
    textDiv.className = "gemini-user-text";

    const nameSpan = document.createElement("span");
    nameSpan.className = "gemini-user-name";
    nameSpan.textContent = displayName;

    const emailSpan = document.createElement("span");
    emailSpan.className = "gemini-user-email";
    emailSpan.textContent = email;
    if (!email) {
      emailSpan.style.display = "none";
    }

    textDiv.appendChild(nameSpan);
    textDiv.appendChild(emailSpan);

    pill.appendChild(avatarWrap);
    pill.appendChild(textDiv);

    pill.addEventListener("click", (e) => {
      e.preventDefault();
      settingsBtn.click();
    });

    footer.insertBefore(pill, settingsBtn);
  } else if (pill.nextElementSibling !== settingsBtn) {
    footer.insertBefore(pill, settingsBtn);
  }
  if (isSidebarCollapsed()) {
    if (pill.getAttribute("data-tooltip-position") !== "right") {
      pill.setAttribute("data-tooltip-position", "right");
    }
  } else {
    if (pill.hasAttribute("data-tooltip-position")) {
      pill.removeAttribute("data-tooltip-position");
    }
  }
}

plugin.dom.observe(SETTINGS_BTN_SELECTOR, (btn) => {
  const footer = btn.parentElement;
  if (!footer) return;
  ensureSidebarUserCard(footer);
  const obs = new MutationObserver(() => ensureSidebarUserCard(footer));
  obs.observe(footer, { childList: true });
  remember(footer, obs);
});

/* ---------------------------------------------------------------------------
 * Code blocks: Willow display language labels (CSS, JavaScript, Python, etc.)
 * ------------------------------------------------------------------------- */
const WILLOW_LANGUAGE_LABELS = {
  bash: "Bash",
  c: "C",
  cpp: "C++",
  csharp: "C#",
  css: "CSS",
  go: "Go",
  html: "HTML",
  java: "Java",
  javascript: "JavaScript",
  js: "JavaScript",
  json: "JSON",
  jsx: "JSX",
  kotlin: "Kotlin",
  markdown: "Markdown",
  md: "Markdown",
  php: "PHP",
  plaintext: "Code",
  text: "Code",
  txt: "Code",
  python: "Python",
  py: "Python",
  ruby: "Ruby",
  rust: "Rust",
  sh: "Bash",
  sql: "SQL",
  svg: "SVG",
  swift: "Swift",
  ts: "TypeScript",
  tsx: "TSX",
  typescript: "TypeScript",
  xml: "XML",
  yaml: "YAML",
  yml: "YAML"
};

function formatCodeBlockLanguage(el) {
  const trimmed = el.textContent.trim();
  if (!trimmed) {
    if (el.dataset.geminiFormatted === "Code") return;
    el.textContent = "Code";
    el.dataset.geminiFormatted = "Code";
    return;
  }
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const raw = node.data.trim();
      if (!raw) continue;
      if (el.dataset.geminiFormatted === raw) return;
      const lower = raw.toLowerCase();
      const mapped = WILLOW_LANGUAGE_LABELS[lower] || (raw.length <= 4 ? raw.toUpperCase() : raw.charAt(0).toUpperCase() + raw.slice(1));
      if (node.data !== mapped) {
        node.data = mapped;
      }
      el.dataset.geminiFormatted = mapped;
    }
  }
}

plugin.dom.observe(".min-h-7 > .font-sans", (el) => {
  formatCodeBlockLanguage(el);
  const obs = new MutationObserver(() => formatCodeBlockLanguage(el));
  obs.observe(el, { characterData: true, childList: true });
  remember(el, obs);
});

plugin.onDispose(() => {
  document.removeEventListener("keydown", onComposerSubmitKey, true);
  document.removeEventListener("click", onComposerSubmitClick, true);
  if (typeof cancelComposerSlide === "function") cancelComposerSlide();
  for (const [, obs] of rememberedObservers()) {
    if (typeof obs?.disconnect === "function") obs.disconnect();
  }
  observed.clear();
  for (const added of document.querySelectorAll("[data-gemini-greeting]")) added.remove();
  for (const pill of document.querySelectorAll("#gemini-sidebar-user-pill")) pill.remove();
  if (!window.BetterGravity?.plugins?.isRunning?.("gemini-app")) {
    for (const chip of document.querySelectorAll("[data-gemini-tool-chip]")) chip.remove();
    for (const box of document.querySelectorAll(INPUT_BOX)) box.removeAttribute("data-expanded");
  }
});

/* ---------------------------------------------------------------------------
 * The workspace name and the local/git mode, in the pane's top bar
 *
 * Willow keeps the name of what you are in at the top left of the pane, with one
 * small control beside it (apps/studio/src/shell/TopDropdown.tsx:39-64).
 * Antigravity keeps both of those in the composer instead: the workspace button
 * in a row above the card, the environment button in a collapsible row inside it
 * — the row that made the home screen's card 96px tall where a conversation's is
 * 64px. conversation.css 3f draws the chips and home-composer.css takes the two
 * rows out of the composer's flow; this builds the stand-ins and hands their
 * clicks back to the originals.
 *
 * A stand-in rather than the original moved, for the reason a black screen taught
 * this plugin once already: both triggers are base-ui popovers mounted by React,
 * and a node React later cannot find where it left it takes the renderer down
 * with it. So the original stays in its tree, and a click on the copy parks the
 * original under the copy for as long as its menu is open, then clicks it there.
 * The menu opens under the chip because for that moment the anchor *is* the
 * chip's box: base-ui measures the trigger's `getBoundingClientRect()`, and the
 * trigger has been given the chip's.
 *
 * Parked rather than hidden, both here and in the stylesheet. An element with no
 * box has nothing for floating-ui to measure, and its menu lands in the corner of
 * the window.
 * ------------------------------------------------------------------------- */
const TOP_BAR_MORE = '[data-testid="titlebar-more-actions"]';

/**
 * Each chip, its original, and the row the original arrived in. The rows are
 * marked rather than described in CSS because neither has a name of its own: one
 * is `.no-focus-agent-input`, which is a focus behaviour and not a row, and the
 * other is a grid whose only distinguishing class is the property it animates.
 *
 * Both selectors exclude the chips themselves. A chip carries its original's
 * `aria-label` so a screen reader hears the same control, which makes the second
 * of these selectors match the chip too — and the chip comes first in the
 * document, so every lookup would answer with it. The environment chip would then
 * park itself and click itself, which is a click handler calling itself.
 */
const TOP_CHIPS = [
  { id: "workspace", trigger: '[data-testid="project-selector-trigger"]:not([data-gemini-top-chip])', row: ".no-focus-agent-input" },
  { id: "environment", trigger: '[aria-label="Select Environment"]:not([data-gemini-top-chip])', row: 'div[class*="transition-[grid-template-rows]"]' }
];

/**
 * The home route, and the box the chips are in while the app is on it.
 *
 * Together they are the tick's bail-out below: both originals belong to the home
 * screen's composer, so anywhere else there is nothing to build, and the only
 * reason to look at the document at all is to take away what the last screen
 * left behind.
 */
const HOME_ROUTE = "/";
let topChipHostEl = null;

/** The half of the pane's top bar the ⋮ button is not in. */
function topBarSlot() {
  const more = document.querySelector(TOP_BAR_MORE);
  const bar = more?.closest("div.justify-between");
  if (!bar) return null;
  for (const slot of bar.children) {
    if (!slot.contains(more)) return slot;
  }
  return null;
}

/**
 * The box the chips live in, appended to that slot.
 *
 * Appended, never inserted among React's own children: the slot holds
 * Antigravity's breadcrumb inside a conversation, and appending is the one edit
 * to a React parent that its next render can undo without noticing.
 */
function topChipHost() {
  const slot = topBarSlot();
  if (!slot) return null;
  let host = slot.querySelector(":scope > [data-gemini-top-chips]");
  if (!host) {
    host = document.createElement("div");
    host.dataset.geminiTopChips = "";
    // The top bar is a window drag region. Antigravity marks its own controls
    // inside it this way, and the property behind the attribute is in the CSS.
    host.setAttribute("data-no-drag", "");
    slot.appendChild(host);
  }
  return host;
}

/** The label Antigravity shows in the trigger: the folder name, or "Local". */
function topChipLabel(trigger) {
  return (trigger.querySelector("span")?.textContent || trigger.textContent || "").trim();
}

/**
 * One chip, kept in step with its original.
 *
 * The contents are the original's own children, cloned — Antigravity's folder
 * glyph, its label, its caret — so the chip says what the trigger says and the
 * stylesheet decides which of those to draw. Cloned rather than serialised
 * through `innerHTML`, so a folder name is never text that gets parsed again.
 *
 * Rebuilt only when the label changes, because a rebuild throws away the nodes
 * the pointer may be over, and React rewrites this trigger on far more than a
 * change of folder.
 */
function ensureTopChip(spec, host) {
  const trigger = document.querySelector(spec.trigger);
  const existing = host.querySelector(`:scope > [data-gemini-top-chip="${spec.id}"]:not([data-gemini-top-static])`);
  if (!trigger) {
    existing?.remove();
    return;
  }

  // The row goes out of the composer's flow only once there is a chip standing in
  // for it. The guard is for a class that ever grows to cover the card itself:
  // a row with the editor or the send button in it is not a row.
  const row = trigger.closest(spec.row);
  if (row && !("geminiParkedRow" in row.dataset) && !row.querySelector('[contenteditable="true"], [data-testid="send-button"]')) {
    row.dataset.geminiParkedRow = "";
  }

  // In Chat mode, the workspace/project chip is completely omitted so that chat mode
  // only creates standalone conversations without any workspace/project selection.
  if (spec.id === "workspace" && getStoredExperience() === "chat") {
    if (parkedTrigger && parkedTrigger.chip === existing) releaseParkedTrigger();
    existing?.remove();
    return;
  }

  const label = topChipLabel(trigger);
  let chip = existing;
  if (!chip) {
    chip = document.createElement("button");
    chip.type = "button";
    chip.dataset.geminiTopChip = spec.id;
    chip.setAttribute("data-no-drag", "");
    chip.setAttribute("aria-expanded", "false");
    // Whether the press that is about to become a click found the menu open.
    // base-ui closes a popup on any pointer press outside it, and a chip is
    // outside its own menu, so by the time the click arrives the menu is already
    // gone and reopening it is what a second click would otherwise do.
    let wasOpen = false;
    chip.addEventListener("pointerdown", () => {
      wasOpen = chip.hasAttribute("data-gemini-open");
    });
    chip.addEventListener("click", (event) => {
      event.preventDefault();
      // Still open here only if base-ui ignored the press, in which case closing
      // is this click's job after all.
      if (wasOpen) closeChipMenu(spec);
      else openChipMenu(spec, chip);
      wasOpen = false;
    });
    host.appendChild(chip);
  }

  if (chip.dataset.geminiTopChipLabel !== label || !chip.firstChild) {
    chip.dataset.geminiTopChipLabel = label;
    chip.replaceChildren(...Array.from(trigger.childNodes, (node) => node.cloneNode(true)));
  }

  // The label as the accessible name, which for the workspace chip is the only
  // place the word "project" survives. No `title`: this plugin's tooltips are
  // drawn for `[title]` alone, and Antigravity's own chips do not carry one.
  const aria = trigger.getAttribute("aria-label");
  if (aria && chip.getAttribute("aria-label") !== aria) chip.setAttribute("aria-label", aria);
  const haspopup = trigger.getAttribute("aria-haspopup");
  if (haspopup && chip.getAttribute("aria-haspopup") !== haspopup) chip.setAttribute("aria-haspopup", haspopup);
}

/**
 * The one trigger currently standing in for a chip, and everything needed to put
 * it back. One, because two menus are never open at once.
 */
let parkedTrigger = null;

function releaseParkedTrigger() {
  if (!parkedTrigger) return;
  const { trigger, chip, style, watcher, timer } = parkedTrigger;
  parkedTrigger = null;
  watcher?.disconnect();
  window.clearTimeout(timer);
  // The whole attribute rather than the properties it set: React writes inline
  // styles on these triggers, and this puts back exactly what was there.
  if (style === null) trigger.removeAttribute("style");
  else trigger.setAttribute("style", style);
  trigger.removeAttribute("data-gemini-parked");
  chip.removeAttribute("data-gemini-open");
  chip.setAttribute("aria-expanded", "false");
}

/** Closes the menu, if this chip's is the one still open. */
function closeChipMenu(spec) {
  const trigger = document.querySelector(spec.trigger);
  if (parkedTrigger && trigger && parkedTrigger.trigger === trigger) trigger.click();
}

function openChipMenu(spec, chip) {
  const trigger = document.querySelector(spec.trigger);
  if (!trigger) return;
  releaseParkedTrigger();

  const entry = { trigger, chip, style: trigger.getAttribute("style"), watcher: null, timer: 0 };
  const target = chip.getBoundingClientRect();
  const s = trigger.style;
  s.position = "fixed";
  s.margin = "0px";
  s.top = "0px";
  s.left = "0px";
  s.width = `${target.width}px`;
  s.height = `${target.height}px`;
  s.opacity = "0";
  s.pointerEvents = "none";
  // `position: fixed` is relative to the nearest transformed ancestor, not the
  // window, and on the home screen the composer's group is transformed
  // (home-composer.css centres it there). So the corner asked for above is not
  // the window's: measure where it landed and move by the difference.
  const landed = trigger.getBoundingClientRect();
  s.top = `${target.top - landed.top}px`;
  s.left = `${target.left - landed.left}px`;

  trigger.setAttribute("data-gemini-parked", "");
  chip.setAttribute("data-gemini-open", "");
  chip.setAttribute("aria-expanded", "true");

  let opened = false;
  const releaseIfCurrent = () => {
    if (parkedTrigger === entry) releaseParkedTrigger();
  };
  // Released on the way down, not on a timer: a trigger unparked while its menu
  // is open drags the menu back to where the trigger really lives, which is the
  // middle of the composer. So it stays parked until the menu has gone.
  entry.watcher = new MutationObserver(() => {
    if (trigger.getAttribute("aria-expanded") === "true") {
      opened = true;
      return;
    }
    if (opened) releaseIfCurrent();
  });
  entry.watcher.observe(trigger, { attributes: true, attributeFilter: ["aria-expanded"] });
  // Nothing opened at all: without this the trigger would stay parked, and its
  // row would stay marked, for the rest of the session.
  entry.timer = window.setTimeout(() => {
    if (!opened) releaseIfCurrent();
  }, 500);

  parkedTrigger = entry;
  trigger.click();
}

/** Both chips against whatever is on screen now. Hidden when inside a session. */
function reconcileTopChips() {
  // React can rebuild a trigger while its menu is open, which closes the menu
  // without ever writing `aria-expanded` on the node that was parked.
  if (parkedTrigger && !parkedTrigger.trigger.isConnected) releaseParkedTrigger();

  // Top chips only appear on screens where live triggers exist (e.g. home screen),
  // and do not appear when already inside a session. In Chat mode, workspace trigger is excluded.
  const isChat = getStoredExperience() === "chat";
  const activeSpecs = TOP_CHIPS.filter((spec) => !(isChat && spec.id === "workspace"));
  const live = activeSpecs.some((spec) => document.querySelector(spec.trigger));
  const host = live ? topChipHost() : null;
  for (const stray of document.querySelectorAll("[data-gemini-top-chips]")) {
    if (stray !== host) stray.remove();
  }
  topChipHostEl = host;
  if (!host) {
    if (isChat) {
      const strayWorkspaceChip = document.querySelector('[data-gemini-top-chip="workspace"]');
      if (strayWorkspaceChip) strayWorkspaceChip.remove();
    }
    return;
  }
  for (const spec of TOP_CHIPS) ensureTopChip(spec, host);
  if (host.children.length === 0) {
    host.remove();
    topChipHostEl = null;
  }
}

/* Arrivals are caught as they happen, by the observer the runtime already runs
 * for every plugin selector. Departures are the ones nothing reports: no
 * element-scoped observer fires for its own element being taken away, and the
 * obvious answer — a `childList, subtree` observer on the document — is the
 * expensive one, because it then allocates a record for every mutation of a
 * streaming response for the rest of the session.
 *
 * So departures are noticed by a tick instead. It costs a handful of selector
 * matches, and it does that on every screen that shows the name, which since the
 * name follows the app into a conversation is every screen. What it never does is
 * grow with the page's own work: a reply arriving is thousands of mutations and
 * none of them reach this.
 *
 * A timer rather than a frame callback because a minimised window never runs a
 * frame, and a plugin that stops reconciling while the window is hidden comes
 * back to a page it no longer agrees with.
 */
topChipsReady = true;
plugin.dom.observe(TOP_BAR_MORE, () => reconcileTopChips());
for (const spec of TOP_CHIPS) plugin.dom.observe(spec.trigger, () => reconcileTopChips());

const topChipsTicker = window.setInterval(() => {
  if (!document.querySelector(HOME_SCROLLER) && !topChipHostEl) return;
  reconcileTopChips();
}, 1000);
reconcileTopChips();

/* ---------------------------------------------------------------------------
 * Willow Rename Dialog ("Rename this chat")
 * Willow (apps/studio/src/shell/sidebar/Sidebar.tsx:2455-2496 &
 * platform/ui/src/GeminiDialog.tsx / GeminiDialog.css):
 * Modal 512px wide, 32px radius, #1f1f1f (#1f1f1f / rgb(31,31,31)),
 * H2 "Rename this chat" (20px/24px 470 in Google Sans Flex),
 * 56px outlined field (at rest 0.8px rgb(142,145,143), focus 1.6px rgb(230,230,230)),
 * Cancel / Rename pills. Rename pill disabled until text differs from current name.
 * ------------------------------------------------------------------------- */
plugin.dom.observe('input[data-testid="inline-edit-input"]', (nativeInput) => {
  if (!nativeInput || !nativeInput.isConnected || nativeInput._willowRenameDialog) return;

  const initialName = (nativeInput.value || '').trim();
  let isClosing = false;

  const host = document.createElement('div');
  host.className = 'willow-gdlg-host';

  const backdrop = document.createElement('div');
  backdrop.className = 'willow-gdlg-backdrop';
  backdrop.setAttribute('aria-hidden', 'true');

  const surface = document.createElement('div');
  surface.className = 'willow-gdlg-surface';
  surface.setAttribute('role', 'dialog');
  surface.setAttribute('aria-modal', 'true');
  surface.setAttribute('aria-label', 'Rename this chat');
  surface.tabIndex = -1;

  const title = document.createElement('h2');
  title.className = 'willow-gdlg-title';
  title.textContent = 'Rename this chat';

  const content = document.createElement('div');
  content.className = 'willow-gdlg-content';
  content.style.paddingTop = '24px';

  const field = document.createElement('div');
  field.className = 'willow-gdlg-field';

  const input = document.createElement('input');
  input.className = 'willow-gdlg-field__input';
  input.setAttribute('aria-label', 'Chat name');
  input.value = initialName;

  const outline = document.createElement('div');
  outline.className = 'willow-gdlg-field__outline';
  outline.setAttribute('aria-hidden', 'true');

  field.appendChild(input);
  field.appendChild(outline);
  content.appendChild(field);

  const actions = document.createElement('div');
  actions.className = 'willow-gdlg-actions';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'willow-gdlg-pill';
  cancelBtn.innerHTML = '<span class="willow-gdlg-pill__label">Cancel</span>';

  const renameBtn = document.createElement('button');
  renameBtn.type = 'button';
  renameBtn.className = 'willow-gdlg-pill';
  renameBtn.disabled = true;
  renameBtn.innerHTML = '<span class="willow-gdlg-pill__label">Rename</span>';

  actions.appendChild(cancelBtn);
  actions.appendChild(renameBtn);

  surface.appendChild(title);
  surface.appendChild(content);
  surface.appendChild(actions);

  host.appendChild(backdrop);
  host.appendChild(surface);
  document.body.appendChild(host);

  nativeInput._willowRenameDialog = host;

  const getReactProps = (el) => {
    if (!el) return null;
    const key = Object.keys(el).find(k => k.startsWith('__reactProps$'));
    return key ? el[key] : null;
  };

  const getReactFiber = (el) => {
    if (!el) return null;
    const key = Object.keys(el).find(k => k.startsWith('__reactFiber$'));
    return key ? el[key] : null;
  };

  let onRenameFn = null;
  let onCancelFn = null;
  let kXProps = null;

  let currFiber = getReactFiber(nativeInput);
  while (currFiber) {
    if (!kXProps && (typeof currFiber.memoizedProps?.setEditValue === 'function' || typeof currFiber.memoizedProps?.handleBlur === 'function')) {
      kXProps = currFiber.memoizedProps;
    }
    if (!onRenameFn && typeof currFiber.memoizedProps?.onRename === 'function') {
      onRenameFn = currFiber.memoizedProps.onRename;
    }
    if (!onCancelFn && typeof currFiber.memoizedProps?.onCancel === 'function') {
      onCancelFn = currFiber.memoizedProps.onCancel;
    }
    currFiber = currFiber.return;
  }

  let isDialogActive = true;

  const blockBlur = (e) => {
    if (isDialogActive) {
      e.stopImmediatePropagation();
      e.stopPropagation();
      e.preventDefault();
    }
  };
  nativeInput.addEventListener('blur', blockBlur, true);
  nativeInput.addEventListener('focusout', blockBlur, true);

  const nativeProps = getReactProps(nativeInput);
  const origOnBlur = nativeProps?.onBlur;
  if (nativeProps && typeof origOnBlur === 'function') {
    nativeProps.onBlur = (e) => {
      if (isDialogActive) return;
      return origOnBlur(e);
    };
  }

  requestAnimationFrame(() => {
    backdrop.classList.add('willow-gdlg-backdrop--shown');
    surface.classList.add('willow-gdlg-surface--shown');
    input.focus();
    input.select();
  });

  const syncToNative = (val) => {
    if (!nativeInput) return;
    try {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      if (setter) {
        setter.call(nativeInput, val);
      } else {
        nativeInput.value = val;
      }
      if (nativeInput._valueTracker) {
        nativeInput._valueTracker.setValue('');
      }
      const props = getReactProps(nativeInput);
      if (typeof props?.onChange === 'function') {
        props.onChange({
          target: { value: val },
          currentTarget: { value: val },
          bubbles: true,
          preventDefault: () => {},
          stopPropagation: () => {}
        });
      }
      if (typeof kXProps?.setEditValue === 'function') {
        kXProps.setEditValue(val);
      }
      nativeInput.dispatchEvent(new Event('input', { bubbles: true }));
    } catch (_) {}
  };

  const updateButtons = () => {
    const trimmed = input.value.trim();
    const isUnchanged = !trimmed || trimmed === initialName;
    renameBtn.disabled = isUnchanged;
    syncToNative(trimmed);
  };

  input.addEventListener('input', updateButtons);

  const closeDialog = (callback) => {
    if (isClosing) return;
    isClosing = true;
    backdrop.classList.add('willow-gdlg-backdrop--closing');
    backdrop.classList.remove('willow-gdlg-backdrop--shown');
    setTimeout(() => {
      host.remove();
      if (nativeInput._willowRenameDialog === host) {
        delete nativeInput._willowRenameDialog;
      }
      if (callback) callback();
    }, 75);
  };

  const commit = async () => {
    const trimmed = input.value.trim();
    if (!trimmed || trimmed === initialName) {
      cancel();
      return;
    }
    isDialogActive = false;
    syncToNative(trimmed);

    // Strategy 1: Direct onRename callback from fiber if available (e.g. header breadcrumb)
    if (typeof onRenameFn === 'function') {
      try {
        await onRenameFn(trimmed);
      } catch (_) {}
      closeDialog(() => {
        if (typeof onCancelFn === 'function') {
          onCancelFn();
        } else {
          const props = getReactProps(nativeInput);
          props?.onKeyDown?.({
            key: 'Escape',
            code: 'Escape',
            keyCode: 27,
            which: 27,
            bubbles: true,
            preventDefault: () => {},
            stopPropagation: () => {}
          });
        }
      });
      return;
    }

    // Strategy 2: Call origOnBlur / kXProps.handleBlur / props.onKeyDown Enter (sidebar items etc.)
    closeDialog(() => {
      setTimeout(() => {
        if (nativeInput && nativeInput.isConnected) {
          const props = getReactProps(nativeInput);
          if (typeof props?.onKeyDown === 'function') {
            props.onKeyDown({
              key: 'Enter',
              code: 'Enter',
              keyCode: 13,
              which: 13,
              bubbles: true,
              preventDefault: () => {},
              stopPropagation: () => {}
            });
          }
          if (typeof origOnBlur === 'function') {
            origOnBlur({ bubbles: true, preventDefault: () => {}, stopPropagation: () => {} });
          } else if (typeof kXProps?.handleBlur === 'function') {
            kXProps.handleBlur();
          } else if (typeof props?.onBlur === 'function') {
            props.onBlur({ bubbles: true, preventDefault: () => {}, stopPropagation: () => {} });
          }
          nativeInput.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true
          }));
          nativeInput.blur();
        }
      }, 50);
    });
  };

  const cancel = () => {
    isDialogActive = false;
    closeDialog(() => {
      if (typeof onCancelFn === 'function') {
        onCancelFn();
      } else if (nativeInput && nativeInput.isConnected) {
        const props = getReactProps(nativeInput);
        if (typeof props?.onKeyDown === 'function') {
          props.onKeyDown({
            key: 'Escape',
            code: 'Escape',
            keyCode: 27,
            which: 27,
            bubbles: true,
            preventDefault: () => {},
            stopPropagation: () => {}
          });
        }
        nativeInput.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Escape',
          code: 'Escape',
          keyCode: 27,
          which: 27,
          bubbles: true
        }));
        nativeInput.blur();
      }
    });
  };

  renameBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    commit();
  });

  cancelBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    cancel();
  });

  backdrop.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    cancel();
  });

  host.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      cancel();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (!renameBtn.disabled) {
        commit();
      }
    }
  });

  remember(nativeInput, {
    disconnect: () => {
      isDialogActive = false;
      nativeInput.removeEventListener('blur', blockBlur, true);
      nativeInput.removeEventListener('focusout', blockBlur, true);
      if (host.isConnected) host.remove();
      if (nativeInput._willowRenameDialog === host) {
        delete nativeInput._willowRenameDialog;
      }
    }
  });
});

/* ---------------------------------------------------------------------------
 * Responsive Toolbar Navigation Arrows ("Go Back" / "Go Forward")
 * ------------------------------------------------------------------------- */
let titleBarObserver = null;
let titleBarResizeObserver = null;

function updateHistoryArrowsPosition() {
  const titleBar = document.querySelector('[data-testid="title-menu-bar"]');
  if (!titleBar) return;

  let rightmost = 0;
  for (const child of titleBar.children) {
    if (titleBarResizeObserver && !child._geminiObserved) {
      child._geminiObserved = true;
      titleBarResizeObserver.observe(child);
    }
    const rect = child.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0 && rect.left < window.innerWidth * 0.75) {
      if (rect.right > rightmost) {
        rightmost = rect.right;
      }
    }
  }

  if (rightmost > 0) {
    const targetLeft = `${Math.round(rightmost + 8)}px`;
    const rootStyle = document.documentElement.style;
    if (rootStyle.getPropertyValue('--gemini-history-arrows-left') !== targetLeft) {
      rootStyle.setProperty('--gemini-history-arrows-left', targetLeft);
    }

    const arrowsContainer = document.querySelector('[data-testid="sidebar-toggle"] + div:has([aria-label="Go Back"])') ||
                            document.querySelector('div:has(> button[aria-label="Go Back"])');
    if (arrowsContainer && (arrowsContainer.style.left !== targetLeft || arrowsContainer.style.getPropertyPriority('left') !== 'important')) {
      arrowsContainer.style.setProperty('left', targetLeft, 'important');
    }
  }
}

plugin.dom.observe('[data-testid="title-menu-bar"]', (titleBar) => {
  updateHistoryArrowsPosition();

  if (titleBarObserver) titleBarObserver.disconnect();
  titleBarObserver = new MutationObserver(() => updateHistoryArrowsPosition());
  titleBarObserver.observe(titleBar, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'hidden'] });

  if (typeof ResizeObserver !== 'undefined') {
    if (titleBarResizeObserver) titleBarResizeObserver.disconnect();
    titleBarResizeObserver = new ResizeObserver(() => updateHistoryArrowsPosition());
    titleBarResizeObserver.observe(titleBar);
    for (const child of titleBar.children) {
      child._geminiObserved = true;
      titleBarResizeObserver.observe(child);
    }
  }

  remember(titleBar, {
    disconnect: () => {
      if (titleBarObserver) titleBarObserver.disconnect();
      if (titleBarResizeObserver) titleBarResizeObserver.disconnect();
    }
  });
});

plugin.dom.observe('[aria-label="Go Back"]', () => {
  updateHistoryArrowsPosition();
});

window.addEventListener('resize', updateHistoryArrowsPosition);
updateHistoryArrowsPosition();

/* ---------------------------------------------------------------------------
 * Conversation History: Willow Search Tab Enhancements
 * ------------------------------------------------------------------------- */
function setupHistorySearch(input) {
  if (input.dataset.geminiHistorySearch === 'true') return;
  input.dataset.geminiHistorySearch = 'true';

  input.placeholder = 'Search chats';

  const pill = input.closest('div.flex.items-center');
  if (!pill) return;

  let clearBtn = pill.querySelector('.willow-search-clear-btn');
  if (!clearBtn) {
    clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'willow-search-clear-btn';
    clearBtn.setAttribute('aria-label', 'Clear search');
    clearBtn.title = 'Clear search';
    clearBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 -960 960 960" fill="currentColor"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/></svg>';
    clearBtn.dataset.visible = input.value ? 'true' : 'false';

    clearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      clearBtn.dataset.visible = 'false';
      input.focus();
    });

    pill.appendChild(clearBtn);
  }

  const onInput = () => {
    if (clearBtn) {
      clearBtn.dataset.visible = input.value ? 'true' : 'false';
    }
  };

  input.addEventListener('input', onInput);

  remember(input, {
    disconnect: () => {
      input.removeEventListener('input', onInput);
      if (clearBtn) clearBtn.remove();
      delete input.dataset.geminiHistorySearch;
    }
  });
}

plugin.dom.observe('[data-testid="history-search-input"]', (input) => {
  setupHistorySearch(input);
});

/* ---------------------------------------------------------------------------
 * Scheduled Tasks (Willow Schedules Tab Parity)
 * ------------------------------------------------------------------------- */
const SPARK_SCHEDULE_WEEKDAYS = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];
const DAY_LABELS = {
  Sunday: 'S', Monday: 'M', Tuesday: 'T', Wednesday: 'W', Thursday: 'T', Friday: 'F', Saturday: 'S'
};
const TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const hour = Math.floor(index / 2).toString().padStart(2, '0');
  const minutes = index % 2 === 0 ? '00' : '30';
  const h = Math.floor(index / 2);
  const suffix = h < 12 ? 'am' : 'pm';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return {
    value: `${hour}:${minutes}`,
    label: `${displayH}:${minutes} ${suffix}`
  };
});

function getAvailableWorkspaces() {
  const list = [];
  const seen = new Set();
  const headers = document.querySelectorAll('.group\\/header');
  for (const header of headers) {
    const link = header.querySelector('a[href*="section="]');
    const match = link?.getAttribute('href')?.match(/section=([^&]+)/);
    const cardBtn = header.querySelector('[data-project-card="true"]') || header.querySelector('button');
    const id = match ? decodeURIComponent(match[1]) : null;
    const name = cardBtn ? cardBtn.textContent.trim() : header.textContent.trim();
    if (id && name && !seen.has(id)) {
      seen.add(id);
      list.push({ id, name });
    }
  }
  if (list.length === 0) {
    for (const a of document.querySelectorAll('a[href*="section="]')) {
      const match = a.getAttribute('href')?.match(/section=([^&]+)/);
      const id = match ? decodeURIComponent(match[1]) : null;
      const name = a.closest('.group\\/header')?.textContent?.trim() || a.textContent?.trim();
      if (id && name && !seen.has(id)) {
        seen.add(id);
        list.push({ id, name });
      }
    }
  }
  return list;
}

const MATERIAL_FOLDER_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 -960 960 960" fill="currentColor" class="spark-schedule-folder-icon" aria-hidden="true"><path d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h240l80 80h320q33 0 56.5 23.5T880-640v400q0 33-23.5 56.5T800-160H160Zm0-80h640v-400H447l-80-80H160v480Zm0 0v-480 480Z"/></svg>`;

const scheduleDropdownClosers = new WeakMap();

function createScheduleDropdown({ initialValue, options, isTime, isWorkspace, icon, onChange }) {
  const root = document.createElement('div');
  root.className = `spark-schedule-custom-select ${isTime ? 'spark-schedule-custom-select--time' : ''} ${isWorkspace ? 'spark-schedule-custom-select--workspace' : ''}`;

  let val = initialValue;

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'spark-schedule-custom-select__trigger';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');

  const leftSpan = document.createElement('span');
  leftSpan.className = 'spark-schedule-custom-select__left';

  if (icon === 'folder') {
    const iconWrapper = document.createElement('span');
    iconWrapper.className = 'spark-schedule-custom-select__icon';
    iconWrapper.innerHTML = MATERIAL_FOLDER_ICON;
    leftSpan.appendChild(iconWrapper);
  } else if (icon) {
    const iconSpan = document.createElement('span');
    iconSpan.className = 'luminous-symbols';
    iconSpan.setAttribute('aria-hidden', 'true');
    iconSpan.textContent = icon;
    iconSpan.style.fontSize = '18px';
    iconSpan.style.color = '#a8c7fa';
    leftSpan.appendChild(iconSpan);
  }

  const valSpan = document.createElement('span');
  valSpan.className = 'spark-schedule-custom-select__value';
  const optMatch = options.find(o => o.value === val) || options[0];
  valSpan.textContent = optMatch ? optMatch.label : '';
  leftSpan.appendChild(valSpan);

  const arrowSpan = document.createElement('span');
  arrowSpan.className = 'spark-schedule-custom-select__arrow';
  arrowSpan.setAttribute('aria-hidden', 'true');
  arrowSpan.textContent = 'expand_more';

  trigger.appendChild(leftSpan);
  trigger.appendChild(arrowSpan);
  root.appendChild(trigger);

  const menu = document.createElement('div');
  menu.className = 'spark-schedule-custom-select__menu';
  menu.setAttribute('role', 'listbox');
  menu.style.display = 'none';

  function renderItems() {
    menu.innerHTML = '';
    for (const opt of options) {
      const isSelected = opt.value === val;
      const item = document.createElement('div');
      item.className = `spark-schedule-custom-select__item ${isSelected ? 'is-selected' : ''}`;
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      item.setAttribute('data-value', opt.value);

      if (isWorkspace) {
        const itemIcon = document.createElement('span');
        itemIcon.className = 'spark-schedule-custom-select__item-icon';
        itemIcon.innerHTML = MATERIAL_FOLDER_ICON;
        item.appendChild(itemIcon);
      }

      const itemText = document.createElement('span');
      itemText.textContent = opt.label;
      item.appendChild(itemText);

      if (isSelected) {
        const check = document.createElement('span');
        check.className = 'spark-schedule-custom-select__check';
        check.setAttribute('aria-hidden', 'true');
        check.textContent = 'check';
        item.appendChild(check);
      }

      item.addEventListener('click', (e) => {
        e.stopPropagation();
        val = opt.value;
        valSpan.textContent = opt.label;
        renderItems();
        close();
        if (onChange) onChange(val);
      });

      menu.appendChild(item);
    }
  }

  renderItems();
  root.appendChild(menu);

  function open() {
    const allCustomSelects = document.querySelectorAll('.spark-schedule-custom-select.is-open');
    for (const s of allCustomSelects) {
      if (s !== root) {
        const closeOther = scheduleDropdownClosers.get(s);
        if (closeOther) {
          closeOther();
          continue;
        }
        s.classList.remove('is-open');
        const trig = s.querySelector('.spark-schedule-custom-select__trigger');
        if (trig) trig.setAttribute('aria-expanded', 'false');
        const m = s.querySelector('.spark-schedule-custom-select__menu');
        if (m) m.style.display = 'none';
      }
    }

    root.classList.add('is-open');
    trigger.setAttribute('aria-expanded', 'true');
    menu.style.display = 'block';
    document.addEventListener('click', docClickListener);
    document.addEventListener('keydown', keyListener);

    const sel = menu.querySelector('.spark-schedule-custom-select__item.is-selected');
    if (sel) sel.scrollIntoView({ block: 'nearest' });
  }

  function close() {
    document.removeEventListener('click', docClickListener);
    document.removeEventListener('keydown', keyListener);
    root.classList.remove('is-open');
    trigger.setAttribute('aria-expanded', 'false');
    menu.style.display = 'none';
  }

  const docClickListener = (e) => {
    if (!root.contains(e.target)) close();
  };
  const keyListener = (e) => {
    if (e.key === 'Escape' && root.classList.contains('is-open')) {
      e.stopPropagation();
      close();
      trigger.focus();
    }
  };

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    if (root.classList.contains('is-open')) close();
    else open();
  });

  scheduleDropdownClosers.set(root, close);

  return {
    element: root,
    getValue: () => val,
    setValue: (newVal) => {
      val = newVal;
      const m = options.find(o => o.value === val);
      if (m) valSpan.textContent = m.label;
      renderItems();
    },
    open,
    close,
    destroy: () => {
      close();
      scheduleDropdownClosers.delete(root);
      root.remove();
    }
  };
}

function setupScheduledTasksView(view) {
  if (view.dataset.geminiSchedulesEnhanced === 'true') return;
  view.dataset.geminiSchedulesEnhanced = 'true';

  const container = view.querySelector('.w-full.max-w-2xl');
  if (!container) return;

  // 1. Hide original header container
  const originalHeader = container.querySelector('.flex.items-center.justify-between');
  if (originalHeader) {
    originalHeader.classList.add('gemini-schedules-original-header');
  }

  // 2. Willow Page Header
  let willowHeader = container.querySelector('.spark-customise-header');
  if (!willowHeader) {
    willowHeader = document.createElement('header');
    willowHeader.className = 'spark-customise-header';
    willowHeader.innerHTML = `
      <h1>Schedules</h1>
      <p>
        Get proactive help with tasks scheduled to run on repeat, respond to events or continuously monitor and react.
        <a href="https://support.google.com/gemini?p=lm_schedules" target="_blank" rel="noopener" class="spark-inline-link">Learn more</a>
      </p>
    `;
    container.insertBefore(willowHeader, container.firstChild);
  }

  // 3. Willow Action Buttons (using edit_rectangle and edit_note glyphs)
  let willowActions = container.querySelector('.spark-page-actions');
  if (!willowActions) {
    willowActions = document.createElement('div');
    willowActions.className = 'spark-page-actions';
    willowActions.setAttribute('aria-label', 'Create a schedule');
    willowActions.innerHTML = `
      <button type="button" class="spark-page-action spark-page-action--primary" data-gemini-action="create-with-gemini">
        <span class="luminous-symbols" aria-hidden="true">edit_rectangle</span>
        <span>Create with Gemini</span>
      </button>
      <button type="button" class="spark-page-action" data-gemini-action="create-manually">
        <span class="google-symbols" aria-hidden="true">edit_note</span>
        <span>Create manually</span>
      </button>
    `;

    const createWithGeminiBtn = willowActions.querySelector('[data-gemini-action="create-with-gemini"]');
    if (createWithGeminiBtn) {
      createWithGeminiBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        navigateToExperienceNewConversation('chat');
        setTimeout(() => {
          const composer = document.querySelector('[data-testid="composer-input"]') || document.querySelector('textarea.antigravity-prompt-input');
          if (composer) {
            composer.value = '/schedule ';
            composer.focus();
            composer.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }, 150);
      });
    }

    const createManuallyBtn = willowActions.querySelector('[data-gemini-action="create-manually"]');
    if (createManuallyBtn) {
      createManuallyBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openScheduleEditor();
      });
    }

    willowHeader.insertAdjacentElement('afterend', willowActions);
  }

  // 4. Skeleton Loader on route entry (Willow SparkListSkeleton Parity)
  function hasScheduleContentSettled() {
    const list = container.querySelector('[data-testid="sidecar-list"]');
    const empty = container.querySelector('[data-testid="sidecar-list-empty"]');
    if (list && list.children.length > 0) return true;
    if (empty) return true;
    return false;
  }

  let isLoading = false;
  let isCancelled = false;
  let skeleton = null;
  let dataLoadObserver = null;
  let safetyTimer = null;
  let editorEl = null;
  let isEditorOpen = false;
  let activeDropdowns = [];

  function endLoading() {
    isLoading = false;
    container.classList.remove('is-loading');
    view.classList.remove('is-loading');
    if (skeleton) {
      skeleton.remove();
      skeleton = null;
    }
    updateScheduleChildren();
  }

  if (hasScheduleContentSettled()) {
    // If schedules are already loaded in the DOM, do not display a skeleton animation at all
    endLoading();
  } else {
    // Only display the skeleton if the schedule content has not loaded yet
    isLoading = true;
    container.classList.add('is-loading');
    view.classList.add('is-loading');

    skeleton = document.createElement('section');
    skeleton.className = 'spark-customise-loading-section spark-customise-loading-section--schedules';
    skeleton.setAttribute('aria-busy', 'true');
    skeleton.innerHTML = `
      <h2>Ongoing</h2>
      <div class="spark-customise-loading-list" aria-hidden="true">
        <span class="spark-customise-loading-row">
          <span class="spark-customise-loading-row-content">
            <span class="spark-customise-loading-bar spark-customise-loading-bar--short">
              <span class="spark-customise-loading-bar-fill"></span>
            </span>
            <span class="spark-customise-loading-bar">
              <span class="spark-customise-loading-bar-fill"></span>
            </span>
          </span>
        </span>
        <span class="spark-customise-loading-row">
          <span class="spark-customise-loading-row-content">
            <span class="spark-customise-loading-bar spark-customise-loading-bar--short">
              <span class="spark-customise-loading-bar-fill"></span>
            </span>
            <span class="spark-customise-loading-bar">
              <span class="spark-customise-loading-bar-fill"></span>
            </span>
          </span>
        </span>
        <span class="spark-customise-loading-row">
          <span class="spark-customise-loading-row-content">
            <span class="spark-customise-loading-bar spark-customise-loading-bar--short">
              <span class="spark-customise-loading-bar-fill"></span>
            </span>
            <span class="spark-customise-loading-bar">
              <span class="spark-customise-loading-bar-fill"></span>
            </span>
          </span>
        </span>
      </div>
    `;
    willowActions.insertAdjacentElement('afterend', skeleton);

    dataLoadObserver = new MutationObserver(() => {
      if (hasScheduleContentSettled()) {
        if (dataLoadObserver) {
          dataLoadObserver.disconnect();
          dataLoadObserver = null;
        }
        if (safetyTimer) {
          clearTimeout(safetyTimer);
          safetyTimer = null;
        }
        if (!isCancelled) endLoading();
      }
    });
    dataLoadObserver.observe(container, { childList: true, subtree: true });

    safetyTimer = setTimeout(() => {
      if (dataLoadObserver) {
        dataLoadObserver.disconnect();
        dataLoadObserver = null;
      }
      if (!isCancelled) endLoading();
    }, 10000);
  }

  // 5. In-Place Schedule Editor (Willow SparkScheduleEditor Parity)
  function openScheduleEditor() {
    for (const dropdown of activeDropdowns) dropdown.destroy();
    activeDropdowns = [];
    if (editorEl) editorEl.remove();
    isEditorOpen = true;
    container.classList.add('is-editor-open');

    if (willowHeader) willowHeader.style.display = 'none';
    if (willowActions) willowActions.style.display = 'none';
    if (skeleton) skeleton.style.display = 'none';
    updateScheduleChildren();

    editorEl = document.createElement('div');
    editorEl.className = 'spark-schedule-editor';

    const workspaces = getAvailableWorkspaces();
    let draftWorkspaceId = workspaces[0]?.id || null;
    let draftTitle = '';
    let draftFrequency = 'Weekly';
    let draftWeekdays = new Set(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
    let draftTime = '09:00';
    let draftInstructions = '';

    editorEl.innerHTML = `
      <form class="spark-schedule-editor__content">
        <header class="spark-schedule-editor__header">
          <button type="button" class="spark-schedule-editor__back">
            <span class="luminous-symbols" aria-hidden="true">arrow_back</span>
            <span>Schedules</span>
          </button>
          <div class="spark-schedule-editor__header-actions">
            <button type="submit" class="spark-schedule-editor__create" disabled>
              Create
            </button>
          </div>
        </header>

        <section class="spark-schedule-editor__panel" aria-label="Schedule details">
          ${workspaces.length > 0 ? `
            <div class="spark-schedule-editor__field spark-schedule-editor__field--workspace">
              <label class="spark-schedule-editor__field-label">Workspace</label>
            </div>
          ` : ''}

          <div class="spark-schedule-editor__field">
            <input type="text" placeholder="Name your schedule" aria-label="Schedule title" autocomplete="off" />
          </div>

          <fieldset class="spark-schedule-editor__when">
            <legend>When to run</legend>

            <div class="spark-schedule-editor__run-grid">
              <span class="spark-schedule-editor__inline-word spark-schedule-editor__on-word">on</span>

              <div class="spark-schedule-editor__weekdays" aria-label="Days of the week">
                ${SPARK_SCHEDULE_WEEKDAYS.map(w => `
                  <button type="button" data-weekday="${w}" class="${draftWeekdays.has(w) ? 'is-selected' : ''}" title="${w}" aria-label="${w}">
                    ${DAY_LABELS[w]}
                  </button>
                `).join('')}
              </div>

              <span class="spark-schedule-editor__inline-word spark-schedule-editor__around-word">around</span>
            </div>

            <p class="spark-schedule-editor__ask-note">
              <button type="button" class="spark-schedule-editor__ask-link">Ask Gemini</button>
              to create and edit event-based schedules and monitors
            </p>
          </fieldset>

          <div class="spark-schedule-editor__instructions-heading">
            <label>Instructions</label>
          </div>

          <textarea placeholder="Give your schedule some instructions"></textarea>

          <p class="spark-schedule-editor__disclaimer">
            Schedules run at approximate times and use more of your limit at peak hours. They won't run if you reach your limit.
            <a href="https://support.google.com/gemini?p=lm_schedules" target="_blank" rel="noopener">Learn more</a>
          </p>
        </section>
      </form>
    `;

    const form = editorEl.querySelector('form');
    const backBtn = editorEl.querySelector('.spark-schedule-editor__back');
    const createBtn = editorEl.querySelector('.spark-schedule-editor__create');
    const titleInput = editorEl.querySelector('.spark-schedule-editor__field input');
    const runGrid = editorEl.querySelector('.spark-schedule-editor__run-grid');
    const onWord = editorEl.querySelector('.spark-schedule-editor__on-word');
    const weekdaysContainer = editorEl.querySelector('.spark-schedule-editor__weekdays');
    const weekdayBtns = editorEl.querySelectorAll('.spark-schedule-editor__weekdays button');
    const aroundWord = editorEl.querySelector('.spark-schedule-editor__around-word');
    const askGeminiBtn = editorEl.querySelector('.spark-schedule-editor__ask-link');
    const instructionsTextarea = editorEl.querySelector('textarea');

    if (workspaces.length > 0) {
      const wsDropdown = createScheduleDropdown({
        initialValue: draftWorkspaceId,
        options: workspaces.map(w => ({ value: w.id, label: w.name })),
        isWorkspace: true,
        icon: 'folder',
        onChange: (val) => {
          draftWorkspaceId = val;
        }
      });
      const wsField = editorEl.querySelector('.spark-schedule-editor__field--workspace');
      if (wsField) wsField.appendChild(wsDropdown.element);
      activeDropdowns.push(wsDropdown);
    }

    const freqDropdown = createScheduleDropdown({
      initialValue: draftFrequency,
      options: [
        { value: 'Daily', label: 'Daily' },
        { value: 'Weekly', label: 'Weekly' }
      ],
      onChange: (val) => {
        draftFrequency = val;
        syncState();
      }
    });

    const timeDropdown = createScheduleDropdown({
      initialValue: draftTime,
      options: TIME_OPTIONS,
      isTime: true,
      onChange: (val) => {
        draftTime = val;
        syncState();
      }
    });

    if (runGrid) {
      runGrid.insertBefore(freqDropdown.element, onWord);
      runGrid.appendChild(timeDropdown.element);
    }

    activeDropdowns.push(freqDropdown, timeDropdown);

    function syncState() {
      const canSubmit = draftTitle.trim().length > 0 &&
        draftInstructions.trim().length > 0 &&
        (draftFrequency !== 'Weekly' || draftWeekdays.size > 0);
      createBtn.disabled = !canSubmit;

      if (draftFrequency === 'Weekly') {
        if (onWord) onWord.style.display = '';
        if (weekdaysContainer) weekdaysContainer.style.display = '';
      } else {
        if (onWord) onWord.style.display = 'none';
        if (weekdaysContainer) weekdaysContainer.style.display = 'none';
      }
    }

    backBtn.addEventListener('click', (e) => {
      e.preventDefault();
      closeScheduleEditor();
    });

    titleInput.addEventListener('input', () => {
      draftTitle = titleInput.value;
      syncState();
    });

    instructionsTextarea.addEventListener('input', () => {
      draftInstructions = instructionsTextarea.value;
      syncState();
    });

    for (const btn of weekdayBtns) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const day = btn.getAttribute('data-weekday');
        if (draftWeekdays.has(day)) {
          draftWeekdays.delete(day);
          btn.classList.remove('is-selected');
        } else {
          draftWeekdays.add(day);
          btn.classList.add('is-selected');
        }
        syncState();
      });
    }

    if (askGeminiBtn) {
      askGeminiBtn.addEventListener('click', (e) => {
        e.preventDefault();
        navigateToExperienceNewConversation('chat');
        setTimeout(() => {
          const composer = document.querySelector('[data-testid="composer-input"]') || document.querySelector('textarea.antigravity-prompt-input');
          if (composer) {
            composer.value = '/schedule ';
            composer.focus();
            composer.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }, 150);
      });
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (createBtn.disabled) return;
      createBtn.disabled = true;
      createBtn.textContent = 'Creating…';

      submitScheduleDraft({
        workspaceId: draftWorkspaceId,
        title: draftTitle.trim(),
        frequency: draftFrequency,
        weekdays: Array.from(draftWeekdays),
        time: draftTime,
        instructions: draftInstructions.trim()
      });
    });

    container.appendChild(editorEl);
    titleInput.focus();
    syncState();
  }

  function closeScheduleEditor() {
    isEditorOpen = false;
    container.classList.remove('is-editor-open');
    for (const d of activeDropdowns) {
      if (d && typeof d.destroy === 'function') d.destroy();
    }
    activeDropdowns = [];
    if (editorEl) {
      editorEl.remove();
      editorEl = null;
    }
    if (willowHeader) willowHeader.style.display = '';
    if (willowActions) willowActions.style.display = '';
    updateScheduleChildren();
  }

  function submitScheduleDraft(draft) {
    const headlessObserver = new MutationObserver(() => {
      const dlg = document.querySelector('[role="dialog"]:has([data-testid="new-sidecar-modal"])');
      if (dlg) dlg.classList.add('gemini-schedule-modal-headless');
    });
    headlessObserver.observe(document.body, { childList: true, subtree: true });

    const rawNewBtn = view.querySelector('[data-testid="sidecar-new-button"]');
    if (rawNewBtn) rawNewBtn.click();

    setTimeout(() => {
      const modal = document.querySelector('[data-testid="new-sidecar-modal"]');
      if (!modal) {
        headlessObserver.disconnect();
        closeScheduleEditor();
        return;
      }

      const nameInput = modal.querySelector('input[data-testid="new-sidecar-name"]');
      const promptInput = modal.querySelector('textarea[data-testid="new-sidecar-prompt"]');
      const submitBtn = modal.querySelector('button[data-testid="new-sidecar-submit"]');

      const setReactValue = (el, val) => {
        const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const set = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (set) set.call(el, val);
        else el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };

      if (nameInput) setReactValue(nameInput, draft.title);
      if (promptInput) setReactValue(promptInput, draft.instructions);

      if (draft.workspaceId) {
        const projectCombobox = modal.querySelector('[role="combobox"]');
        if (projectCombobox) {
          const fiberKey = Object.keys(projectCombobox).find(k => k.startsWith('__reactFiber'));
          let fiber = fiberKey ? projectCombobox[fiberKey] : null;
          while (fiber) {
            if (fiber.memoizedProps?.onValueChange) {
              fiber.memoizedProps.onValueChange(draft.workspaceId);
              break;
            }
            fiber = fiber.return;
          }
        }
      }

      const freqTrigger = modal.querySelector('[data-testid="schedule-frequency-trigger"]');
      if (freqTrigger) {
        const freqKey = Object.keys(freqTrigger).find(k => k.startsWith('__reactFiber'));
        let fiber = freqKey ? freqTrigger[freqKey] : null;
        while (fiber) {
          if (fiber.memoizedProps?.onValueChange) {
            fiber.memoizedProps.onValueChange(draft.frequency.toLowerCase());
            break;
          }
          fiber = fiber.return;
        }
      }

      setTimeout(() => {
        if (submitBtn && !submitBtn.disabled) {
          submitBtn.click();
        }
        setTimeout(() => {
          headlessObserver.disconnect();
          closeScheduleEditor();
        }, 150);
      }, 80);
    }, 80);
  }

  // 6. Update dynamic children: empty state card and schedule list rows
  function updateScheduleChildren() {
    const emptyList = container.querySelector('[data-testid="sidecar-list-empty"]');
    const sidecarList = container.querySelector('[data-testid="sidecar-list"]');
    let ongoingTitle = container.querySelector('.spark-schedules-heading');

    if (isEditorOpen || isLoading) {
      if (emptyList) emptyList.style.display = 'none';
      if (sidecarList) sidecarList.style.display = 'none';
      if (ongoingTitle) ongoingTitle.style.display = 'none';
      return;
    }

    if (emptyList) emptyList.style.display = '';
    if (sidecarList) sidecarList.style.display = '';

    // If schedules exist, show "Ongoing" heading; if empty, omit it (Willow behavior)
    if (sidecarList && !emptyList) {
      if (!ongoingTitle) {
        ongoingTitle = document.createElement('h2');
        ongoingTitle.className = 'spark-schedules-heading';
        ongoingTitle.textContent = 'Ongoing';
        sidecarList.insertAdjacentElement('beforebegin', ongoingTitle);
      }
      ongoingTitle.style.display = '';
    } else {
      if (ongoingTitle) ongoingTitle.remove();
    }

    // Willow empty state: transparent 28px outline, centered title & subtitle, no icon
    if (emptyList && !emptyList.querySelector('.spark-schedules-empty')) {
      emptyList.innerHTML = `
        <div class="spark-schedules-empty">
          <h2 class="spark-schedules-empty__title">Add your first schedule</h2>
          <p class="spark-schedules-empty__subtitle">
            Schedules created from your tasks appear automatically
          </p>
        </div>
      `;
    }

    // Willow schedule rows: chat_bubble luminous icon
    if (sidecarList) {
      const rows = sidecarList.querySelectorAll('[data-testid="sidecar-row"]');
      for (const row of rows) {
        if (!row.querySelector('.spark-schedule-row__icon')) {
          const iconBox = document.createElement('span');
          iconBox.className = 'spark-schedule-row__icon';
          iconBox.innerHTML = '<span class="luminous-symbols" aria-hidden="true">chat_bubble</span>';
          row.insertBefore(iconBox, row.firstChild);
        }
      }
    }
  }

  updateScheduleChildren();

  const observer = new MutationObserver((records) => {
    // Typing in the editor or choosing one of its options does not change the
    // schedule list. Its own icons and headings are already reconciled below.
    if (editorEl && records.every(record => editorEl.contains(record.target))) return;
    updateScheduleChildren();
    observer.takeRecords();
  });
  observer.observe(container, { childList: true, subtree: true });

  remember(view, {
    disconnect: () => {
      isCancelled = true;
      if (safetyTimer) clearTimeout(safetyTimer);
      if (dataLoadObserver) {
        dataLoadObserver.disconnect();
        dataLoadObserver = null;
      }
      container.classList.remove('is-loading');
      view.classList.remove('is-loading');
      observer.disconnect();
      delete view.dataset.geminiSchedulesEnhanced;
      if (willowHeader) willowHeader.remove();
      if (willowActions) willowActions.remove();
      if (skeleton) skeleton.remove();
      for (const d of activeDropdowns) {
        if (d && typeof d.destroy === 'function') d.destroy();
      }
      activeDropdowns = [];
      if (editorEl) editorEl.remove();
      const title = container.querySelector('.spark-schedules-heading');
      if (title) title.remove();
      if (originalHeader) originalHeader.classList.remove('gemini-schedules-original-header');
    }
  });
}

/* ---------------------------------------------------------------------------
 * Existing Schedule Detail View (Willow SparkScheduleEditor Edit Mode Parity)
 * ------------------------------------------------------------------------- */
function setupScheduleDetailView(view) {
  if (view.dataset.geminiScheduleDetailEnhanced === 'true') return;
  view.dataset.geminiScheduleDetailEnhanced = 'true';

  let initialized = false;
  let detailObserver = null;
  let activeDropdowns = [];
  let deleteModal = null;
  let editorEl = null;

  function init() {
    if (initialized) return;
    const rawContainer = view.querySelector('.w-full.max-w-2xl');
    const promptArea = view.querySelector('textarea[data-testid="schedule-editor-prompt"]');
    if (!rawContainer || !promptArea) return;

    initialized = true;
    if (detailObserver) {
      detailObserver.disconnect();
      detailObserver = null;
    }

    rawContainer.classList.add('spark-sidecar-detail-raw-hidden');

    const initialTitle = view.querySelector('span.text-lg')?.textContent?.trim() ||
      view.querySelector('input[data-testid="inline-edit-input"]')?.value ||
      'Scheduled Task';
    const initialPrompt = promptArea.value || '';
    const initialWorkspace = view.querySelector('[data-testid="sidecar-project-link"]')?.textContent?.trim() || 'Workspace';
    const freqTrigger = view.querySelector('[data-testid="schedule-frequency-trigger"]');
    const initialFreqText = freqTrigger?.textContent?.trim() || 'Weekly';
    const initialFrequency = /daily/i.test(initialFreqText) ? 'Daily' : 'Weekly';

    const rawComboboxes = Array.from(rawContainer.querySelectorAll('[role="combobox"]'));
    let initialWeekday = 'Monday';
    let initialTime = '09:00';
    if (rawComboboxes.length >= 3) {
      initialWeekday = rawComboboxes[1].textContent.trim() || 'Monday';
      const rawTimeText = rawComboboxes[2].textContent.trim() || '9:00 AM';
      const matchedTime = TIME_OPTIONS.find(t => t.label.toLowerCase() === rawTimeText.toLowerCase());
      if (matchedTime) initialTime = matchedTime.value;
    } else if (rawComboboxes.length === 2) {
      const rawTimeText = rawComboboxes[1].textContent.trim() || '9:00 AM';
      const matchedTime = TIME_OPTIONS.find(t => t.label.toLowerCase() === rawTimeText.toLowerCase());
      if (matchedTime) initialTime = matchedTime.value;
    }

    const isRunning = Boolean(view.querySelector('.bg-green-500') || /running/i.test(view.textContent));

    let draftTitle = initialTitle;
    let draftFrequency = initialFrequency;
    let draftWeekdays = new Set([initialWeekday]);
    let draftTime = initialTime;
    let draftInstructions = initialPrompt;
    let draftEnabled = isRunning;

    editorEl = document.createElement('div');
    editorEl.className = 'spark-schedule-editor';
    editorEl.innerHTML = `
      <form class="spark-schedule-editor__content">
        <header class="spark-schedule-editor__header">
          <button type="button" class="spark-schedule-editor__back">
            <span class="luminous-symbols" aria-hidden="true">arrow_back</span>
            <span>Schedules</span>
          </button>
          <div class="spark-schedule-editor__header-actions">
            <button type="button" class="spark-schedule-editor__delete" aria-label="Delete schedule" title="Delete schedule">
              <span class="luminous-symbols" aria-hidden="true">delete</span>
            </button>
            <button type="submit" class="spark-schedule-editor__create">
              Save
            </button>
          </div>
        </header>

        <section class="spark-schedule-editor__panel" aria-label="Schedule details">
          <div class="spark-schedule-editor__field spark-schedule-editor__field--workspace">
            <label class="spark-schedule-editor__field-label">Workspace</label>
            <div class="spark-schedule-custom-select spark-schedule-custom-select--workspace">
              <div class="spark-schedule-custom-select__trigger" style="cursor: default;">
                <span class="spark-schedule-custom-select__left">
                  <span class="spark-schedule-custom-select__icon">${MATERIAL_FOLDER_ICON}</span>
                  <span class="spark-schedule-custom-select__value">${initialWorkspace}</span>
                </span>
              </div>
            </div>
          </div>

          <div class="spark-schedule-editor__field">
            <input type="text" placeholder="Name your schedule" aria-label="Schedule title" autocomplete="off" />
          </div>

          <div class="spark-schedule-editor__enabled-row">
            <span class="spark-schedule-editor__enabled-copy">
              <strong>Enabled</strong>
              <span>Run this schedule automatically</span>
            </span>
            <button type="button" role="switch" aria-checked="${draftEnabled}" class="spark-schedule-editor__toggle ${draftEnabled ? 'is-checked' : ''}">
              <span></span>
            </button>
          </div>

          <fieldset class="spark-schedule-editor__when">
            <legend>When to run</legend>

            <div class="spark-schedule-editor__run-grid">
              <span class="spark-schedule-editor__inline-word spark-schedule-editor__on-word">on</span>

              <div class="spark-schedule-editor__weekdays" aria-label="Days of the week">
                ${SPARK_SCHEDULE_WEEKDAYS.map(w => `
                  <button type="button" data-weekday="${w}" class="${draftWeekdays.has(w) ? 'is-selected' : ''}" title="${w}" aria-label="${w}">
                    ${DAY_LABELS[w]}
                  </button>
                `).join('')}
              </div>

              <span class="spark-schedule-editor__inline-word spark-schedule-editor__around-word">around</span>
            </div>

            <p class="spark-schedule-editor__ask-note">
              <button type="button" class="spark-schedule-editor__ask-link">Ask Gemini</button>
              to create and edit event-based schedules and monitors
            </p>
          </fieldset>

          <div class="spark-schedule-editor__instructions-heading">
            <label>Instructions</label>
          </div>

          <textarea placeholder="Give your schedule some instructions"></textarea>

          <p class="spark-schedule-editor__disclaimer">
            Schedules run at approximate times and use more of your limit at peak hours. They won't run if you reach your limit.
            <a href="https://support.google.com/gemini?p=lm_schedules" target="_blank" rel="noopener">Learn more</a>
          </p>
        </section>
      </form>
    `;

    const form = editorEl.querySelector('form');
    const backBtn = editorEl.querySelector('.spark-schedule-editor__back');
    const deleteBtn = editorEl.querySelector('.spark-schedule-editor__delete');
    const saveBtn = editorEl.querySelector('.spark-schedule-editor__create');
    const titleInput = editorEl.querySelector('.spark-schedule-editor__field input');
    const toggleBtn = editorEl.querySelector('.spark-schedule-editor__toggle');
    const runGrid = editorEl.querySelector('.spark-schedule-editor__run-grid');
    const onWord = editorEl.querySelector('.spark-schedule-editor__on-word');
    const weekdaysContainer = editorEl.querySelector('.spark-schedule-editor__weekdays');
    const weekdayBtns = editorEl.querySelectorAll('.spark-schedule-editor__weekdays button');
    const aroundWord = editorEl.querySelector('.spark-schedule-editor__around-word');
    const askGeminiBtn = editorEl.querySelector('.spark-schedule-editor__ask-link');
    const instructionsTextarea = editorEl.querySelector('textarea');

    titleInput.value = draftTitle;
    instructionsTextarea.value = draftInstructions;

    const freqDropdown = createScheduleDropdown({
      initialValue: draftFrequency,
      options: [
        { value: 'Daily', label: 'Daily' },
        { value: 'Weekly', label: 'Weekly' }
      ],
      onChange: (val) => {
        draftFrequency = val;
        syncState();
      }
    });

    const timeDropdown = createScheduleDropdown({
      initialValue: draftTime,
      options: TIME_OPTIONS,
      isTime: true,
      onChange: (val) => {
        draftTime = val;
        syncState();
      }
    });

    if (runGrid) {
      runGrid.insertBefore(freqDropdown.element, onWord);
      runGrid.appendChild(timeDropdown.element);
    }

    activeDropdowns = [freqDropdown, timeDropdown];

    function syncState() {
      const canSubmit = draftTitle.trim().length > 0 &&
        draftInstructions.trim().length > 0 &&
        (draftFrequency !== 'Weekly' || draftWeekdays.size > 0);
      saveBtn.disabled = !canSubmit;

      if (draftFrequency === 'Weekly') {
        if (onWord) onWord.style.display = '';
        if (weekdaysContainer) weekdaysContainer.style.display = '';
      } else {
        if (onWord) onWord.style.display = 'none';
        if (weekdaysContainer) weekdaysContainer.style.display = 'none';
      }
    }

    syncState();

    backBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const automationsBtn = document.querySelector('[data-testid="automations-button"]') ||
        document.querySelector('#gemini-scheduled-tasks-button');
      if (automationsBtn) automationsBtn.click();
      else window.history.back();
    });

    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      draftEnabled = !draftEnabled;
      toggleBtn.setAttribute('aria-checked', String(draftEnabled));
      toggleBtn.classList.toggle('is-checked', draftEnabled);
      syncState();
    });

    titleInput.addEventListener('input', () => {
      draftTitle = titleInput.value;
      syncState();
    });

    instructionsTextarea.addEventListener('input', () => {
      draftInstructions = instructionsTextarea.value;
      syncState();
    });

    for (const btn of weekdayBtns) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const day = btn.getAttribute('data-weekday');
        if (draftWeekdays.has(day)) {
          draftWeekdays.delete(day);
          btn.classList.remove('is-selected');
        } else {
          draftWeekdays.add(day);
          btn.classList.add('is-selected');
        }
        syncState();
      });
    }

    if (askGeminiBtn) {
      askGeminiBtn.addEventListener('click', (e) => {
        e.preventDefault();
        navigateToExperienceNewConversation('chat');
        setTimeout(() => {
          const composer = document.querySelector('[data-testid="composer-input"]') || document.querySelector('textarea.antigravity-prompt-input');
          if (composer) {
            composer.value = '/schedule ';
            composer.focus();
            composer.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }, 150);
      });
    }

    // Delete confirmation flow
    deleteBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (deleteModal) deleteModal.remove();

      deleteModal = document.createElement('div');
      deleteModal.className = 'spark-schedule-editor__dialog-backdrop';
      deleteModal.innerHTML = `
        <div class="spark-schedule-editor__delete-dialog" role="dialog" aria-modal="true">
          <h2>Delete schedule?</h2>
          <p>This schedule will be permanently removed.</p>
          <div>
            <button type="button" class="btn-cancel">Cancel</button>
            <button type="button" class="is-danger btn-delete">Delete</button>
          </div>
        </div>
      `;

      const cancelBtn = deleteModal.querySelector('.btn-cancel');
      const confirmDeleteBtn = deleteModal.querySelector('.btn-delete');

      cancelBtn.addEventListener('click', () => {
        deleteModal.remove();
        deleteModal = null;
      });

      deleteModal.addEventListener('mousedown', (evt) => {
        if (evt.target === deleteModal) {
          deleteModal.remove();
          deleteModal = null;
        }
      });

      confirmDeleteBtn.addEventListener('click', () => {
        deleteModal.remove();
        deleteModal = null;

        const kebab = rawContainer.querySelector('[data-testid="sidecar-detail-kebab"]');
        if (kebab) kebab.click();
        setTimeout(() => {
          const delItem = document.querySelector('[data-testid="sidecar-action-delete"]');
          if (delItem) {
            delItem.click();
            setTimeout(() => {
              const dlg = document.querySelector('[role="dialog"], [role="alertdialog"]');
              const deleteActionBtn = Array.from(dlg?.querySelectorAll('button') || []).find(b => b.textContent.trim() === 'Delete');
              if (deleteActionBtn) deleteActionBtn.click();
            }, 150);
          }
        }, 100);
      });

      document.body.appendChild(deleteModal);
    });

    // Save flow
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (saveBtn.disabled) return;
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving…';

      const setReactValue = (el, val) => {
        const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const set = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (set) set.call(el, val);
        else el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };

      // 1. Update Title if changed
      if (draftTitle.trim() !== initialTitle.trim()) {
        const editTitleBtn = rawContainer.querySelector('button[aria-label="Edit task title"]');
        if (editTitleBtn) {
          editTitleBtn.click();
          setTimeout(() => {
            const inlineInput = rawContainer.querySelector('input[data-testid="inline-edit-input"]');
            if (inlineInput) {
              setReactValue(inlineInput, draftTitle.trim());
              inlineInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
              inlineInput.blur();
            }
          }, 50);
        }
      }

      // 2. Update Prompt
      const rawPrompt = rawContainer.querySelector('textarea[data-testid="schedule-editor-prompt"]');
      if (rawPrompt) setReactValue(rawPrompt, draftInstructions.trim());

      // 3. Update Frequency / Weekday / Time
      const comboboxes = Array.from(rawContainer.querySelectorAll('[role="combobox"]'));
      const callFiberValueChange = (el, val) => {
        if (!el) return;
        const fiberKey = Object.keys(el).find(k => k.startsWith('__reactFiber'));
        let fiber = fiberKey ? el[fiberKey] : null;
        while (fiber) {
          if (fiber.memoizedProps?.onValueChange) {
            fiber.memoizedProps.onValueChange(val);
            break;
          }
          fiber = fiber.return;
        }
      };

      if (comboboxes[0]) callFiberValueChange(comboboxes[0], draftFrequency.toLowerCase());
      if (draftFrequency === 'Weekly' && comboboxes[1]) {
        const chosenDay = Array.from(draftWeekdays)[0] || 'Monday';
        callFiberValueChange(comboboxes[1], chosenDay);
      }
      const timeCombobox = comboboxes.length >= 3 ? comboboxes[2] : comboboxes[1];
      if (timeCombobox) {
        const matchedTime = TIME_OPTIONS.find(t => t.value === draftTime);
        if (matchedTime) callFiberValueChange(timeCombobox, matchedTime.label);
      }

      // 4. Click raw save button
      setTimeout(() => {
        const rawSaveBtn = rawContainer.querySelector('button[data-testid="schedule-editor-save"]');
        if (rawSaveBtn && !rawSaveBtn.disabled && !rawSaveBtn.classList.contains('pointer-events-none')) {
          rawSaveBtn.click();
        }
        setTimeout(() => {
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save';
          const automationsBtn = document.querySelector('[data-testid="automations-button"]') ||
            document.querySelector('#gemini-scheduled-tasks-button');
          if (automationsBtn) automationsBtn.click();
          else window.history.back();
        }, 300);
      }, 150);
    });

    view.appendChild(editorEl);
  }

  init();

  if (!initialized) {
    detailObserver = new MutationObserver(() => {
      init();
    });
    detailObserver.observe(view, { childList: true, subtree: true });
  }

  remember(view, {
    disconnect: () => {
      if (detailObserver) {
        detailObserver.disconnect();
        detailObserver = null;
      }
      delete view.dataset.geminiScheduleDetailEnhanced;
      if (deleteModal) {
        deleteModal.remove();
        deleteModal = null;
      }
      for (const d of activeDropdowns) {
        if (d && typeof d.destroy === 'function') d.destroy();
      }
      activeDropdowns = [];
      if (editorEl) editorEl.remove();
      const rawContainer = view.querySelector('.w-full.max-w-2xl');
      if (rawContainer) rawContainer.classList.remove('spark-sidecar-detail-raw-hidden');
    }
  });
}

plugin.dom.observe('[data-testid="sidecars-view"][data-sidecar-type="schedule"]', (view) => {
  setupScheduledTasksView(view);
});

plugin.dom.observe('[data-testid="sidecar-detail"]', (view) => {
  setupScheduleDetailView(view);
});

plugin.onDispose(() => {
  for (const btn of document.querySelectorAll('.willow-search-clear-btn')) btn.remove();
  for (const el of document.querySelectorAll('.spark-customise-header, .spark-page-actions, .spark-schedules-heading, .spark-customise-loading-section, .spark-schedule-editor, .spark-schedule-editor__dialog-backdrop')) el.remove();
  for (const el of document.querySelectorAll('.spark-sidecar-detail-raw-hidden')) el.classList.remove('spark-sidecar-detail-raw-hidden');
  window.removeEventListener('resize', updateHistoryArrowsPosition);
  if (titleBarObserver) titleBarObserver.disconnect();
  if (titleBarResizeObserver) titleBarResizeObserver.disconnect();
  document.documentElement.style.removeProperty('--gemini-history-arrows-left');
  document.documentElement.style.removeProperty('--gemini-theme-accent');
  document.documentElement.style.removeProperty('--gemini-unread-dot-color');
  window.clearInterval(topChipsTicker);
  window.clearInterval(urlTicker);
  releaseParkedTrigger();
  for (const host of document.querySelectorAll("[data-gemini-top-chips]")) host.remove();
  for (const row of document.querySelectorAll("[data-gemini-parked-row]")) row.removeAttribute("data-gemini-parked-row");
  for (const dlg of document.querySelectorAll(".willow-gdlg-host")) dlg.remove();
  closeSkillsView();
  cancelSentPromptGlide();
  document.getElementById("gemini-skills-button")?.remove();
  const s = document.getElementById("gemini-theme-dynamic-styles");
  if (s) s.remove();
});
