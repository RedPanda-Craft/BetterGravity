// ============================================================================
// Multi-Theme Dynamic Accent & Flavor Switcher Plugin (catppuccin-accent)
//
// Context-aware dynamic theme manager supporting:
// 1. Catppuccin Provider: 4 Flavors (Mocha, Macchiato, Frappé, Latte) + 14 Accents
// 2. Flexoki Provider: 8 Natural Mineral Accents (Ochre, Malachite, Azurite, etc.)
// 3. Extensible Provider Architecture: Zero mutation of existing themes, hot-pluggable.
// 4. Real-time CSS custom property injection & isolated per-theme persistence.
// 5. Context-aware lifecycle: automatically adapts to the currently active host theme.
// ============================================================================

(function () {
  "use strict";

  // ==========================================================================
  // 1. Official Catppuccin 4 Flavors Palette Definition (Preserved 100%)
  // ==========================================================================
  const CTP_FLAVORS = {
    mocha: {
      id: "mocha",
      name: "Mocha",
      label: "Mocha (Dark)",
      isDark: true,
      colors: {
        base: "#1e1e2e", mantle: "#181825", crust: "#11111b",
        surface0: "#313244", surface1: "#45475a", surface2: "#585b70",
        overlay0: "#6c7086", overlay1: "#7f849c", overlay2: "#9399b2",
        subtext0: "#a6adc8", subtext1: "#bac2de", text: "#cdd6f4",
        rosewater: "#f5e0dc", flamingo: "#f2cdcd", pink: "#f5c2e7",
        mauve: "#cba6f7", red: "#f38ba8", maroon: "#eba0ac",
        peach: "#fab387", yellow: "#f9e2af", green: "#a6e3a1",
        teal: "#94e2d5", sky: "#89dceb", sapphire: "#74c7ec",
        blue: "#89b4fa", lavender: "#b4befe"
      }
    },
    macchiato: {
      id: "macchiato",
      name: "Macchiato",
      label: "Macchiato (Mid)",
      isDark: true,
      colors: {
        base: "#24273a", mantle: "#1e2030", crust: "#181926",
        surface0: "#363a4f", surface1: "#494d64", surface2: "#5b6078",
        overlay0: "#6e738d", overlay1: "#8087a2", overlay2: "#939ab7",
        subtext0: "#a5adcb", subtext1: "#b8c0e0", text: "#cad3f5",
        rosewater: "#f4dbd6", flamingo: "#f0c6c6", pink: "#f5bde6",
        mauve: "#c6a0f6", red: "#ed8796", maroon: "#ee99a0",
        peach: "#f5a97f", yellow: "#eed49f", green: "#a6da95",
        teal: "#8bd5ca", sky: "#91d7e3", sapphire: "#7dc4e4",
        blue: "#8aadf4", lavender: "#b7bdf8"
      }
    },
    frappe: {
      id: "frappe",
      name: "Frappé",
      label: "Frappé (Muted)",
      isDark: true,
      colors: {
        base: "#303446", mantle: "#292c3c", crust: "#232634",
        surface0: "#414559", surface1: "#51576d", surface2: "#626880",
        overlay0: "#737994", overlay1: "#838ba7", overlay2: "#949cbb",
        subtext0: "#a5adce", subtext1: "#b5bfe2", text: "#c6d0f5",
        rosewater: "#f2d5cf", flamingo: "#eebebe", pink: "#f4b8e4",
        mauve: "#ca9ee6", red: "#e78284", maroon: "#ea999c",
        peach: "#ef9f76", yellow: "#e5c890", green: "#a6d189",
        teal: "#81c8be", sky: "#99d1db", sapphire: "#85c1dc",
        blue: "#8caaee", lavender: "#babbf1"
      }
    },
    latte: {
      id: "latte",
      name: "Latte",
      label: "Latte (Light)",
      isDark: false,
      colors: {
        base: "#eff1f5", mantle: "#e6e9ef", crust: "#dce0e8",
        surface0: "#ccd0da", surface1: "#bcc0cc", surface2: "#acb0be",
        overlay0: "#9ca0b0", overlay1: "#8c8fa1", overlay2: "#7c7f93",
        subtext0: "#6c6f85", subtext1: "#5c5f77", text: "#4c4f69",
        rosewater: "#dc8a78", flamingo: "#dd7878", pink: "#ea76cb",
        mauve: "#8839ef", red: "#d20f39", maroon: "#e64553",
        peach: "#fe640b", yellow: "#df8e1d", green: "#40a02b",
        teal: "#179299", sky: "#04a5e5", sapphire: "#209fb5",
        blue: "#1e66f5", lavender: "#7287fd"
      }
    }
  };

  const CTP_ACCENTS = [
    { id: "rosewater", name: "Rosewater" },
    { id: "flamingo",  name: "Flamingo" },
    { id: "pink",      name: "Pink" },
    { id: "mauve",     name: "Mauve" },
    { id: "red",       name: "Red" },
    { id: "maroon",    name: "Maroon" },
    { id: "peach",     name: "Peach" },
    { id: "yellow",    name: "Yellow" },
    { id: "green",     name: "Green" },
    { id: "teal",      name: "Teal" },
    { id: "sky",       name: "Sky" },
    { id: "sapphire",  name: "Sapphire" },
    { id: "blue",      name: "Blue" },
    { id: "lavender",  name: "Lavender" }
  ];

  // ==========================================================================
  // 2. Steph Ango Flexoki 8 Mineral Accent Colors Definition
  // ==========================================================================
  const FLEXOKI_ACCENTS = [
    { id: "orange",  name: "Ochre Orange",    hex: "#DA702C" },
    { id: "green",   name: "Malachite Green",  hex: "#879A39" },
    { id: "blue",    name: "Azurite Blue",     hex: "#4385BE" },
    { id: "purple",  name: "Iolite Purple",    hex: "#8B7EC8" },
    { id: "cyan",    name: "Turquoise Cyan",   hex: "#3AA99F" },
    { id: "yellow",  name: "Orpiment Yellow",  hex: "#D0A215" },
    { id: "red",     name: "Cinnabar Red",     hex: "#D14D41" },
    { id: "magenta", name: "Fluorite Magenta", hex: "#CE5D97" }
  ];

  // ==========================================================================
  // 3. Kanagawa Dragon 8 Traditional Ukiyo-e Ink Accents Definition
  // ==========================================================================
  const KANAGAWA_ACCENTS = [
    { id: "dragonOrange", name: "Autumn Ochre",   hex: "#b6927b" },
    { id: "dragonGreen",  name: "Moss Bamboo",    hex: "#87a987" },
    { id: "dragonBlue",   name: "Deep Indigo",    hex: "#658594" },
    { id: "dragonYellow", name: "Carp Gold",      hex: "#c4b28a" },
    { id: "dragonAqua",   name: "Stream Foam",    hex: "#8ba4b0" },
    { id: "dragonPink",   name: "Faded Plum",     hex: "#a292a3" },
    { id: "dragonRed",    name: "Seal Vermilion", hex: "#c4746e" },
    { id: "dragonViolet", name: "Iris Sumi",      hex: "#8992a7" }
  ];

  // ==========================================================================
  // 4. Everforest Dark 3 Flavors (Medium, Soft, Hard) & 7 Nature Accents
  // ==========================================================================
  const EVERFOREST_FLAVORS = {
    medium: {
      id: "medium",
      name: "Medium",
      label: "Medium (Calibrated Forest)",
      isDark: true,
      colors: {
        bgDim: "#181e21",
        bg0: "#1e2529",
        bg1: "#262e33",
        bg2: "#2f383e",
        bg3: "#38434a",
        bg4: "#414e56",
        bg5: "#4b5860",
        fg: "#d3c6aa"
      }
    },
    soft: {
      id: "soft",
      name: "Soft",
      label: "Soft (Gentle Pine Canopy)",
      isDark: true,
      colors: {
        bgDim: "#1d2428",
        bg0: "#232b30",
        bg1: "#2b343a",
        bg2: "#343e45",
        bg3: "#3d4951",
        bg4: "#46545d",
        bg5: "#505f69",
        fg: "#d3c6aa"
      }
    },
    hard: {
      id: "hard",
      name: "Hard",
      label: "Hard (Deep Mountain Night)",
      isDark: true,
      colors: {
        bgDim: "#14181a",
        bg0: "#1a2024",
        bg1: "#22292d",
        bg2: "#2a3237",
        bg3: "#323c42",
        bg4: "#3a464c",
        bg5: "#434f55",
        fg: "#d3c6aa"
      }
    }
  };

  const EVERFOREST_ACCENTS = [
    { id: "green",  name: "Forest Moss",  hex: "#a7c080" },
    { id: "aqua",   name: "Stream Mist",  hex: "#83c092" },
    { id: "blue",   name: "Pine Needle",  hex: "#7fbbb3" },
    { id: "orange", name: "Autumn Leaf",  hex: "#e69875" },
    { id: "yellow", name: "Ginkgo Gold",  hex: "#dbbc7f" },
    { id: "purple", name: "Wild Heather", hex: "#d699b6" },
    { id: "red",    name: "Maple Berry",  hex: "#e67e80" }
  ];

  // ==========================================================================
  // 5. Melange Dark 8 Earth & Mineral Accents Definition
  // ==========================================================================
  const MELANGE_ACCENTS = [
    { id: "ochreOrange",     name: "Amber Ochre",     hex: "#d4956a" },
    { id: "clayRed",         name: "Terracotta Clay", hex: "#cf6856" },
    { id: "sandstoneYellow", name: "Sandstone Gold",  hex: "#d7a36c" },
    { id: "mossGreen",       name: "Warm Moss",       hex: "#78997a" },
    { id: "slateAqua",       name: "Weathered Slate", hex: "#7b9695" },
    { id: "mineralBlue",     name: "Mineral Indigo",  hex: "#788ca6" },
    { id: "figPurple",       name: "Dried Fig",       hex: "#b38096" },
    { id: "peatBrown",       name: "Peat Bark",       hex: "#a47c65" }
  ];

  // Material Symbols palette icon path
  const PALETTE_ICON = "M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm-180-240q25 0 42.5-17.5T360-460q0-25-17.5-42.5T300-520q-25 0-42.5 17.5T240-460q0 25 17.5 42.5T300-400Zm120-140q25 0 42.5-17.5T480-600q0-25-17.5-42.5T420-660q-25 0-42.5 17.5T360-600q0 25 17.5 42.5T420-540Zm180 40q25 0 42.5-17.5T660-560q0-25-17.5-42.5T600-620q-25 0-42.5 17.5T540-560q0 25 17.5 42.5T600-500Z";

  // ==========================================================================
  // 6. Extensible Theme Provider Registry
  // ==========================================================================
  const THEME_PROVIDERS = {
    catppuccin: {
      id: "catppuccin",
      name: "Catppuccin",
      tooltip: "Catppuccin Flavors & Accent Switcher",
      isActive: () => !!document.querySelector('style[data-bettergravity-theme*="catppuccin"]'),
      hasFlavors: true,
      flavors: CTP_FLAVORS,
      accents: CTP_ACCENTS,
      defaultFlavor: "mocha",
      defaultAccent: "peach",
      storageKeyFlavor: "__bettergravity_ctp_flavor",
      storageKeyAccent: "__bettergravity_ctp_accent",
      pluginStorageFlavor: "flavor",
      pluginStorageAccent: "accent",
      getAccentHex: (flavorId, accentId) => {
        const flavor = CTP_FLAVORS[flavorId] || CTP_FLAVORS.mocha;
        return flavor.colors[accentId] || flavor.colors.peach;
      },
      apply: (flavorId, accentId, save = true) => {
        applyCatppuccinConfig(flavorId, accentId, save);
      },
      removeOverrides: () => {
        removeCatppuccinOverrides();
      }
    },
    flexoki: {
      id: "flexoki",
      name: "Flexoki",
      tooltip: "Flexoki Mineral Accent Switcher",
      isActive: () => !!document.querySelector('style[data-bettergravity-theme*="flexoki"]'),
      hasFlavors: false,
      flavors: {
        dark: { id: "dark", name: "Flexoki Dark", isDark: true }
      },
      accents: FLEXOKI_ACCENTS,
      defaultFlavor: "dark",
      defaultAccent: "orange",
      storageKeyFlavor: "__bettergravity_fx_flavor",
      storageKeyAccent: "__bettergravity_fx_accent",
      pluginStorageFlavor: "flexoki_flavor",
      pluginStorageAccent: "flexoki_accent",
      getAccentHex: (_flavorId, accentId) => {
        const acc = FLEXOKI_ACCENTS.find(a => a.id === accentId) || FLEXOKI_ACCENTS[0];
        return acc.hex;
      },
      apply: (_flavorId, accentId, save = true) => {
        applyFlexokiConfig(accentId, save);
      },
      removeOverrides: () => {
        removeFlexokiOverrides();
      }
    },
    kanagawa: {
      id: "kanagawa",
      name: "Kanagawa",
      tooltip: "Kanagawa Dragon Ukiyo-e Accent Switcher",
      isActive: () => !!document.querySelector('style[data-bettergravity-theme*="kanagawa"]'),
      hasFlavors: false,
      flavors: {
        dragon: { id: "dragon", name: "Dragon (Dark)", isDark: true }
      },
      accents: KANAGAWA_ACCENTS,
      defaultFlavor: "dragon",
      defaultAccent: "dragonOrange",
      storageKeyFlavor: "__bettergravity_kg_flavor",
      storageKeyAccent: "__bettergravity_kg_accent",
      pluginStorageFlavor: "kanagawa_flavor",
      pluginStorageAccent: "kanagawa_accent",
      getAccentHex: (_flavorId, accentId) => {
        const acc = KANAGAWA_ACCENTS.find(a => a.id === accentId) || KANAGAWA_ACCENTS[0];
        return acc.hex;
      },
      apply: (_flavorId, accentId, save = true) => {
        applyKanagawaConfig(accentId, save);
      },
      removeOverrides: () => {
        removeKanagawaOverrides();
      }
    },
    everforest: {
      id: "everforest",
      name: "Everforest",
      tooltip: "Everforest Nature Flavor & Accent Switcher",
      isActive: () => !!document.querySelector('style[data-bettergravity-theme*="everforest"]'),
      hasFlavors: true,
      flavors: EVERFOREST_FLAVORS,
      accents: EVERFOREST_ACCENTS,
      defaultFlavor: "medium",
      defaultAccent: "green",
      storageKeyFlavor: "__bettergravity_ef_flavor",
      storageKeyAccent: "__bettergravity_ef_accent",
      pluginStorageFlavor: "everforest_flavor",
      pluginStorageAccent: "everforest_accent",
      getAccentHex: (_flavorId, accentId) => {
        const acc = EVERFOREST_ACCENTS.find(a => a.id === accentId) || EVERFOREST_ACCENTS[0];
        return acc.hex;
      },
      apply: (flavorId, accentId, save = true) => {
        applyEverforestConfig(flavorId, accentId, save);
      },
      removeOverrides: () => {
        removeEverforestOverrides();
      }
    },
    melange: {
      id: "melange",
      name: "Melange",
      tooltip: "Melange Earth Mineral Accent Switcher",
      isActive: () => !!document.querySelector('style[data-bettergravity-theme*="melange"]'),
      hasFlavors: false,
      flavors: {
        dark: { id: "dark", name: "Melange Dark", isDark: true }
      },
      accents: MELANGE_ACCENTS,
      defaultFlavor: "dark",
      defaultAccent: "ochreOrange",
      storageKeyFlavor: "__bettergravity_ml_flavor",
      storageKeyAccent: "__bettergravity_ml_accent",
      pluginStorageFlavor: "melange_flavor",
      pluginStorageAccent: "melange_accent",
      getAccentHex: (_flavorId, accentId) => {
        const acc = MELANGE_ACCENTS.find(a => a.id === accentId) || MELANGE_ACCENTS[0];
        return acc.hex;
      },
      apply: (_flavorId, accentId, save = true) => {
        applyMelangeConfig(accentId, save);
      },
      removeOverrides: () => {
        removeMelangeOverrides();
      }
    }
  };

  let activeProvider = null;
  let buttonHandle = null;
  let popupEl = null;
  let currentFlavorId = "mocha";
  let currentAccentId = "peach";
  let observer = null;

  function getTriggerButton() {
    return document.querySelector('[data-bettergravity-button="Palette"], [data-bettergravity-button="Accent"]');
  }

  function getActiveProvider() {
    if (THEME_PROVIDERS.catppuccin.isActive()) return THEME_PROVIDERS.catppuccin;
    if (THEME_PROVIDERS.flexoki.isActive()) return THEME_PROVIDERS.flexoki;
    if (THEME_PROVIDERS.kanagawa.isActive()) return THEME_PROVIDERS.kanagawa;
    if (THEME_PROVIDERS.everforest.isActive()) return THEME_PROVIDERS.everforest;
    if (THEME_PROVIDERS.melange.isActive()) return THEME_PROVIDERS.melange;
    return null;
  }

  function getSavedConfig(provider) {
    if (!provider) provider = activeProvider || THEME_PROVIDERS.catppuccin;
    let flavor = provider.defaultFlavor;
    let accent = provider.defaultAccent;
    try {
      const savedFlavor = plugin.storage?.get?.(provider.pluginStorageFlavor) || localStorage.getItem(provider.storageKeyFlavor);
      if (savedFlavor && provider.flavors[savedFlavor]) flavor = savedFlavor;
      const savedAccent = plugin.storage?.get?.(provider.pluginStorageAccent) || localStorage.getItem(provider.storageKeyAccent);
      if (savedAccent && provider.accents.some(a => a.id === savedAccent)) accent = savedAccent;
    } catch (e) {}
    return { flavor, accent };
  }

  // ==========================================================================
  // 4. Catppuccin Implementation Pipeline (Preserved Exact Logic)
  // ==========================================================================
  function applyCatppuccinConfig(flavorId, accentId, save = true) {
    const flavor = CTP_FLAVORS[flavorId] || CTP_FLAVORS.mocha;
    const accentKey = CTP_ACCENTS.some(a => a.id === accentId) ? accentId : "peach";
    const colors = flavor.colors;
    const accentHex = colors[accentKey] || colors.peach;
    const isDark = flavor.isDark;

    currentFlavorId = flavor.id;
    currentAccentId = accentKey;

    const root = document.documentElement;

    // 1. Catppuccin Base Scales
    root.style.setProperty("--ctp-base", colors.base);
    root.style.setProperty("--ctp-mantle", colors.mantle);
    root.style.setProperty("--ctp-crust", colors.crust);
    root.style.setProperty("--ctp-surface0", colors.surface0);
    root.style.setProperty("--ctp-surface1", colors.surface1);
    root.style.setProperty("--ctp-surface2", colors.surface2);
    root.style.setProperty("--ctp-overlay0", colors.overlay0);
    root.style.setProperty("--ctp-overlay1", colors.overlay1);
    root.style.setProperty("--ctp-overlay2", colors.overlay2);
    root.style.setProperty("--ctp-subtext0", colors.subtext0);
    root.style.setProperty("--ctp-subtext1", colors.subtext1);
    root.style.setProperty("--ctp-text", colors.text);

    // 2. All 14 Accents for this Flavor
    CTP_ACCENTS.forEach((acc) => {
      root.style.setProperty(`--ctp-${acc.id}`, colors[acc.id]);
    });

    // 3. Active Accent & Button Variables
    const glowColor = `${accentHex}38`;
    root.style.setProperty("--catppuccin-accent", accentHex);
    root.style.setProperty("--catppuccin-button-accent", accentHex);
    root.style.setProperty("--catppuccin-accent-glow", glowColor);

    // 4. Host Tokens (Crust-as-Base hierarchy shift for dark modes)
    root.style.setProperty("--background", isDark ? colors.crust : colors.base);
    root.style.setProperty("--foreground", colors.text);
    root.style.setProperty("--primary", accentHex);
    root.style.setProperty("--primary-foreground", isDark ? colors.crust : colors.base);
    root.style.setProperty("--secondary", isDark ? colors.mantle : colors.surface0);
    root.style.setProperty("--secondary-foreground", colors.text);
    root.style.setProperty("--muted", isDark ? colors.crust : colors.mantle);
    root.style.setProperty("--muted-foreground", colors.subtext0);
    root.style.setProperty("--border", colors.surface0);
    root.style.setProperty("--card", colors.mantle);
    root.style.setProperty("--card-border", colors.surface0);
    root.style.removeProperty("--sidebar");
    root.style.removeProperty("--sidebar-secondary");
    root.style.removeProperty("--sidebar-muted");
    root.style.setProperty("--placeholder", colors.overlay0);
    root.style.setProperty("--link", colors.blue);
    root.style.setProperty("--focus-ring-color", accentHex);

    // 5. BetterGravity Runtime Shared Tokens
    root.style.setProperty("--bettergravity-accent", accentHex);
    root.style.setProperty("--bettergravity-accent-soft", glowColor);
    root.style.setProperty("--bettergravity-surface", colors.mantle);
    root.style.setProperty("--bettergravity-border", colors.surface0);
    root.style.setProperty("--bettergravity-text", colors.text);
    root.style.setProperty("--bettergravity-row-hover", isDark ? "rgba(205, 214, 244, 0.08)" : "rgba(76, 79, 105, 0.08)");
    root.style.setProperty("--gemini-row-selected", colors.surface0);
    root.style.setProperty("--gemini-row-hover", isDark ? "rgba(205, 214, 244, 0.08)" : "rgba(76, 79, 105, 0.08)");

    // 6. Direct Studio & Gemini Host Runtime Tokens
    root.style.setProperty("--studio-surface", isDark ? colors.crust : colors.base);
    root.style.setProperty("--gemini-surface", isDark ? colors.mantle : colors.surface0);
    root.style.setProperty("--gemini-surface-hover", isDark ? colors.surface0 : colors.surface1);
    root.style.setProperty("--gemini-trigger-hover", isDark ? colors.surface0 : colors.surface1);
    root.style.setProperty("--gemini-control-hover", isDark ? colors.surface0 : colors.surface1);
    root.style.setProperty("--gemini-separator", colors.surface0);
    root.style.setProperty("--gemini-switch-track", colors.crust);
    root.style.setProperty("--gemini-switch-slider", isDark ? colors.mantle : colors.surface0);
    root.style.setProperty("--gemini-body-text", colors.text);
    root.style.setProperty("--gemini-text", colors.text);
    root.style.setProperty("--gemini-text-trigger", colors.subtext0);
    root.style.setProperty("--gemini-text-trigger-hover", colors.text);
    root.style.setProperty("--gemini-text-dim", colors.subtext0);
    root.style.setProperty("--gemini-page-bg", isDark ? colors.crust : colors.base);
    root.style.setProperty("--gemini-bubble-bg", isDark ? colors.mantle : colors.surface0);
    root.style.setProperty("--gemini-composer-bg", isDark ? colors.mantle : colors.surface0);
    root.style.setProperty("--gemini-composer-placeholder", colors.overlay0);
    root.style.setProperty("--gemini-inline-code-bg", isDark ? colors.mantle : colors.surface0);
    root.style.setProperty("--gemini-inline-code-text", colors[accentKey] || colors.peach);
    root.style.setProperty("--gemini-link", colors.blue);
    root.style.setProperty("--gemini-send-bg", accentHex);
    root.style.setProperty("--gemini-send-bg-hover", accentHex);
    root.style.setProperty("--gemini-home-glow-accent", glowColor);

    // 7. Native Window Controls Overlay
    try {
      if (window.electronNative && typeof window.electronNative.setTitleBarOverlay === "function") {
        window.electronNative.setTitleBarOverlay({
          color: isDark ? colors.crust : colors.mantle,
          symbolColor: colors.text,
          height: 30
        });
      }
    } catch (e) {}

    // Light / Dark attribute marker for host components
    document.body.setAttribute("data-catppuccin-flavor", flavor.id);
    document.body.classList.toggle("ctp-latte-mode", !isDark);

    // Sync titlebar button color
    const triggerBtn = getTriggerButton();
    if (triggerBtn) {
      triggerBtn.style.color = accentHex;
    }

    if (save) {
      try {
        plugin.storage?.set?.("flavor", flavor.id);
        plugin.storage?.set?.("accent", accentKey);
        localStorage.setItem("__bettergravity_ctp_flavor", flavor.id);
        localStorage.setItem("__bettergravity_ctp_accent", accentKey);
      } catch (e) {}
    }

    updatePopupActiveState();
  }

  function removeCatppuccinOverrides() {
    const root = document.documentElement;
    const props = [
      "--ctp-base", "--ctp-mantle", "--ctp-crust",
      "--ctp-surface0", "--ctp-surface1", "--ctp-surface2",
      "--ctp-overlay0", "--ctp-overlay1", "--ctp-overlay2",
      "--ctp-subtext0", "--ctp-subtext1", "--ctp-text",
      "--catppuccin-accent", "--catppuccin-button-accent", "--catppuccin-accent-glow",
      "--bettergravity-accent", "--bettergravity-accent-soft",
      "--bettergravity-surface", "--bettergravity-border", "--bettergravity-text",
      "--bettergravity-row-hover", "--primary", "--primary-foreground",
      "--background", "--foreground", "--secondary", "--muted", "--border", "--card",
      "--sidebar", "--sidebar-secondary", "--sidebar-muted",
      "--studio-surface", "--gemini-surface", "--gemini-surface-hover", "--gemini-trigger-hover",
      "--gemini-control-hover", "--gemini-separator", "--gemini-switch-track", "--gemini-switch-slider",
      "--gemini-body-text", "--gemini-text", "--gemini-text-trigger", "--gemini-text-trigger-hover",
      "--gemini-text-dim", "--gemini-page-bg", "--gemini-bubble-bg", "--gemini-composer-bg",
      "--gemini-composer-placeholder", "--gemini-inline-code-bg", "--gemini-inline-code-text",
      "--gemini-link", "--gemini-send-bg", "--gemini-send-bg-hover", "--gemini-home-glow-accent"
    ];
    props.forEach(p => root.style.removeProperty(p));
    CTP_ACCENTS.forEach(acc => root.style.removeProperty(`--ctp-${acc.id}`));
    document.body.removeAttribute("data-catppuccin-flavor");
    document.body.classList.remove("ctp-latte-mode");
  }

  // ==========================================================================
  // 5. Flexoki Mineral Accent Implementation Pipeline
  // ==========================================================================
  function applyFlexokiConfig(accentId, save = true) {
    const acc = FLEXOKI_ACCENTS.find(a => a.id === accentId) || FLEXOKI_ACCENTS[0];
    const hex = acc.hex;
    const glowSoft = `${hex}2a`;
    const glowDense = `${hex}42`;

    currentAccentId = acc.id;
    currentFlavorId = "dark";

    const root = document.documentElement;

    // Flexoki Mineral Accent tokens
    root.style.setProperty("--flexoki-accent", hex);
    root.style.setProperty("--flexoki-accent-soft", glowSoft);
    root.style.setProperty("--flexoki-accent-glow", glowDense);

    // Host & BetterGravity Shared Tokens
    root.style.setProperty("--bettergravity-accent", hex);
    root.style.setProperty("--bettergravity-accent-soft", glowSoft);
    root.style.setProperty("--catppuccin-accent", hex);
    root.style.setProperty("--catppuccin-button-accent", hex);
    root.style.setProperty("--catppuccin-accent-glow", glowSoft);
    root.style.setProperty("--primary", hex);
    root.style.setProperty("--focus-ring-color", hex);
    root.style.setProperty("--code-foreground", hex);

    // Gemini Host Runtime Tokens
    root.style.setProperty("--gemini-send-bg", hex);
    root.style.setProperty("--gemini-send-bg-hover", hex);
    root.style.setProperty("--gemini-inline-code-text", hex);
    root.style.setProperty("--gemini-home-glow-accent", glowSoft);

    // Dynamic TitleBar accent button color
    const triggerBtn = getTriggerButton();
    if (triggerBtn) {
      triggerBtn.style.color = hex;
    }

    if (save) {
      try {
        plugin.storage?.set?.("flexoki_accent", acc.id);
        localStorage.setItem("__bettergravity_fx_accent", acc.id);
      } catch (e) {}
    }

    updatePopupActiveState();
  }

  function removeFlexokiOverrides() {
    const root = document.documentElement;
    const props = [
      "--flexoki-accent", "--flexoki-accent-soft", "--flexoki-accent-glow",
      "--bettergravity-accent", "--bettergravity-accent-soft",
      "--catppuccin-accent", "--catppuccin-button-accent", "--catppuccin-accent-glow",
      "--primary", "--focus-ring-color", "--code-foreground",
      "--gemini-send-bg", "--gemini-send-bg-hover",
      "--gemini-inline-code-text", "--gemini-home-glow-accent"
    ];
    props.forEach(p => root.style.removeProperty(p));
  }

  // ==========================================================================
  // 6. Kanagawa Dragon Ukiyo-e Accent Implementation Pipeline
  // ==========================================================================
  function applyKanagawaConfig(accentId, save = true) {
    const acc = KANAGAWA_ACCENTS.find(a => a.id === accentId) || KANAGAWA_ACCENTS[0];
    const hex = acc.hex;
    const glowSoft = `${hex}2a`;
    const glowDense = `${hex}44`;

    currentAccentId = acc.id;
    currentFlavorId = "dragon";

    const root = document.documentElement;

    // Kanagawa Accent tokens
    root.style.setProperty("--kanagawa-accent", hex);
    root.style.setProperty("--kanagawa-accent-soft", glowSoft);
    root.style.setProperty("--kanagawa-accent-glow", glowDense);

    // Host & BetterGravity Shared Tokens
    root.style.setProperty("--bettergravity-accent", hex);
    root.style.setProperty("--bettergravity-accent-soft", glowSoft);
    root.style.setProperty("--catppuccin-accent", hex);
    root.style.setProperty("--catppuccin-button-accent", hex);
    root.style.setProperty("--catppuccin-accent-glow", glowSoft);
    root.style.setProperty("--primary", hex);
    root.style.setProperty("--focus-ring-color", hex);
    root.style.setProperty("--code-foreground", hex);

    // Gemini Host Runtime Tokens
    root.style.setProperty("--gemini-send-bg", hex);
    root.style.setProperty("--gemini-send-bg-hover", hex);
    root.style.setProperty("--gemini-inline-code-text", hex);
    root.style.setProperty("--gemini-home-glow-accent", glowSoft);

    // Dynamic TitleBar accent button color
    const triggerBtn = getTriggerButton();
    if (triggerBtn) {
      triggerBtn.style.color = hex;
    }

    if (save) {
      try {
        plugin.storage?.set?.("kanagawa_accent", acc.id);
        localStorage.setItem("__bettergravity_kg_accent", acc.id);
      } catch (e) {}
    }

    updatePopupActiveState();
  }

  function removeKanagawaOverrides() {
    const root = document.documentElement;
    const props = [
      "--kanagawa-accent", "--kanagawa-accent-soft", "--kanagawa-accent-glow",
      "--bettergravity-accent", "--bettergravity-accent-soft",
      "--catppuccin-accent", "--catppuccin-button-accent", "--catppuccin-accent-glow",
      "--primary", "--focus-ring-color", "--code-foreground",
      "--gemini-send-bg", "--gemini-send-bg-hover",
      "--gemini-inline-code-text", "--gemini-home-glow-accent"
    ];
    props.forEach(p => root.style.removeProperty(p));
  }

  // ==========================================================================
  // 7. Everforest Dark Nature Accent & Multi-Flavor Pipeline
  // ==========================================================================
  function applyEverforestConfig(flavorId, accentId, save = true) {
    const flavor = EVERFOREST_FLAVORS[flavorId] || EVERFOREST_FLAVORS.medium;
    const acc = EVERFOREST_ACCENTS.find(a => a.id === accentId) || EVERFOREST_ACCENTS[0];
    const hex = acc.hex;
    const glowSoft = `${hex}2a`;
    const glowDense = `${hex}44`;

    currentFlavorId = flavor.id;
    currentAccentId = acc.id;

    const root = document.documentElement;

    // 1. Everforest Dynamic Base Tokens
    root.style.setProperty("--ef-bg-dim", flavor.colors.bgDim);
    root.style.setProperty("--ef-bg0", flavor.colors.bg0);
    root.style.setProperty("--ef-bg1", flavor.colors.bg1);
    root.style.setProperty("--ef-bg2", flavor.colors.bg2);
    root.style.setProperty("--ef-bg3", flavor.colors.bg3);
    root.style.setProperty("--ef-bg4", flavor.colors.bg4);
    root.style.setProperty("--ef-bg5", flavor.colors.bg5);
    root.style.setProperty("--ef-fg", flavor.colors.fg);

    // 2. Everforest Accent tokens
    root.style.setProperty("--everforest-accent", hex);
    root.style.setProperty("--everforest-accent-soft", glowSoft);
    root.style.setProperty("--everforest-accent-glow", glowDense);

    // 3. Host & BetterGravity Shared Tokens
    root.style.setProperty("--background", flavor.colors.bg0);
    root.style.setProperty("--foreground", flavor.colors.fg);
    root.style.setProperty("--primary", hex);
    root.style.setProperty("--primary-foreground", flavor.colors.bgDim);
    root.style.setProperty("--secondary", flavor.colors.bg1);
    root.style.setProperty("--secondary-foreground", flavor.colors.fg);
    root.style.setProperty("--muted", flavor.colors.bgDim);
    root.style.setProperty("--muted-foreground", "#859289");
    root.style.setProperty("--border", flavor.colors.bg3);
    root.style.setProperty("--card", flavor.colors.bg1);
    root.style.setProperty("--card-border", flavor.colors.bg3);
    root.style.setProperty("--sidebar", flavor.colors.bgDim);
    root.style.setProperty("--sidebar-secondary", flavor.colors.bg1);
    root.style.setProperty("--sidebar-muted", "#7a8478");
    root.style.setProperty("--placeholder", "#7a8478");
    root.style.setProperty("--link", "#7fbbb3");
    root.style.setProperty("--focus-ring-color", hex);
    root.style.setProperty("--code-foreground", hex);

    // 4. BetterGravity Shared Runtime
    root.style.setProperty("--bettergravity-accent", hex);
    root.style.setProperty("--bettergravity-accent-soft", glowSoft);
    root.style.setProperty("--bettergravity-surface", flavor.colors.bg1);
    root.style.setProperty("--bettergravity-border", flavor.colors.bg3);
    root.style.setProperty("--bettergravity-text", flavor.colors.fg);
    root.style.setProperty("--bettergravity-row-hover", "rgba(211, 198, 170, 0.07)");

    // 5. Host Compatibility
    root.style.setProperty("--catppuccin-accent", hex);
    root.style.setProperty("--catppuccin-button-accent", hex);
    root.style.setProperty("--catppuccin-accent-glow", glowSoft);

    // 6. Gemini Host Runtime Tokens
    root.style.setProperty("--studio-surface", flavor.colors.bgDim);
    root.style.setProperty("--gemini-page-bg", flavor.colors.bg0);
    root.style.setProperty("--gemini-surface", flavor.colors.bg1);
    root.style.setProperty("--gemini-surface-hover", flavor.colors.bg2);
    root.style.setProperty("--gemini-trigger-hover", flavor.colors.bg2);
    root.style.setProperty("--gemini-control-hover", flavor.colors.bg2);
    root.style.setProperty("--gemini-separator", flavor.colors.bg3);
    root.style.setProperty("--gemini-switch-track", flavor.colors.bgDim);
    root.style.setProperty("--gemini-switch-slider", flavor.colors.bg1);
    root.style.setProperty("--gemini-body-text", flavor.colors.fg);
    root.style.setProperty("--gemini-text", flavor.colors.fg);
    root.style.setProperty("--gemini-text-trigger", "#859289");
    root.style.setProperty("--gemini-text-trigger-hover", flavor.colors.fg);
    root.style.setProperty("--gemini-text-dim", "#859289");
    root.style.setProperty("--gemini-bubble-bg", flavor.colors.bg1);
    root.style.setProperty("--gemini-composer-bg", flavor.colors.bg1);
    root.style.setProperty("--gemini-composer-placeholder", "#7a8478");
    root.style.setProperty("--gemini-inline-code-bg", flavor.colors.bgDim);
    root.style.setProperty("--gemini-inline-code-text", hex);
    root.style.setProperty("--gemini-link", "#7fbbb3");
    root.style.setProperty("--gemini-send-bg", hex);
    root.style.setProperty("--gemini-send-bg-hover", hex);
    root.style.setProperty("--gemini-home-glow-accent", glowSoft);
    root.style.setProperty("--gemini-row-selected", flavor.colors.bg2);
    root.style.setProperty("--gemini-row-hover", "rgba(211, 198, 170, 0.07)");

    // TitleBar accent button color
    const triggerBtn = getTriggerButton();
    if (triggerBtn) {
      triggerBtn.style.color = hex;
    }

    if (save) {
      try {
        plugin.storage?.set?.("everforest_flavor", flavor.id);
        plugin.storage?.set?.("everforest_accent", acc.id);
        localStorage.setItem("__bettergravity_ef_flavor", flavor.id);
        localStorage.setItem("__bettergravity_ef_accent", acc.id);
      } catch (e) {}
    }

    updatePopupActiveState();
  }

  function removeEverforestOverrides() {
    const root = document.documentElement;
    const props = [
      "--ef-bg-dim", "--ef-bg0", "--ef-bg1", "--ef-bg2", "--ef-bg3", "--ef-bg4", "--ef-bg5", "--ef-fg",
      "--everforest-accent", "--everforest-accent-soft", "--everforest-accent-glow",
      "--background", "--foreground", "--primary", "--primary-foreground", "--secondary", "--secondary-foreground",
      "--muted", "--muted-foreground", "--border", "--card", "--card-border", "--sidebar", "--sidebar-secondary",
      "--sidebar-muted", "--placeholder", "--link", "--focus-ring-color", "--code-foreground",
      "--bettergravity-accent", "--bettergravity-accent-soft", "--bettergravity-surface", "--bettergravity-border",
      "--bettergravity-text", "--bettergravity-row-hover",
      "--catppuccin-accent", "--catppuccin-button-accent", "--catppuccin-accent-glow",
      "--studio-surface", "--gemini-page-bg", "--gemini-surface", "--gemini-surface-hover", "--gemini-trigger-hover",
      "--gemini-control-hover", "--gemini-separator", "--gemini-switch-track", "--gemini-switch-slider",
      "--gemini-body-text", "--gemini-text", "--gemini-text-trigger", "--gemini-text-trigger-hover",
      "--gemini-text-dim", "--gemini-bubble-bg", "--gemini-composer-bg", "--gemini-composer-placeholder",
      "--gemini-inline-code-bg", "--gemini-inline-code-text", "--gemini-link", "--gemini-send-bg",
      "--gemini-send-bg-hover", "--gemini-home-glow-accent", "--gemini-row-selected", "--gemini-row-hover"
    ];
    props.forEach(p => root.style.removeProperty(p));
  }

  // ==========================================================================
  // 8. Melange Dark Earth Mineral Accent Pipeline
  // ==========================================================================
  function applyMelangeConfig(accentId, save = true) {
    const acc = MELANGE_ACCENTS.find(a => a.id === accentId) || MELANGE_ACCENTS[0];
    const hex = acc.hex;
    const glowSoft = `${hex}2a`;
    const glowDense = `${hex}44`;

    currentAccentId = acc.id;
    currentFlavorId = "dark";

    const root = document.documentElement;

    // Melange Accent tokens
    root.style.setProperty("--melange-accent", hex);
    root.style.setProperty("--melange-accent-soft", glowSoft);
    root.style.setProperty("--melange-accent-glow", glowDense);

    // Host & BetterGravity Shared Tokens
    root.style.setProperty("--bettergravity-accent", hex);
    root.style.setProperty("--bettergravity-accent-soft", glowSoft);
    root.style.setProperty("--catppuccin-accent", hex);
    root.style.setProperty("--catppuccin-button-accent", hex);
    root.style.setProperty("--catppuccin-accent-glow", glowSoft);
    root.style.setProperty("--primary", hex);
    root.style.setProperty("--focus-ring-color", hex);
    root.style.setProperty("--code-foreground", hex);

    // Gemini Host Runtime Tokens
    root.style.setProperty("--gemini-send-bg", hex);
    root.style.setProperty("--gemini-send-bg-hover", hex);
    root.style.setProperty("--gemini-inline-code-text", hex);
    root.style.setProperty("--gemini-home-glow-accent", glowSoft);

    // Dynamic TitleBar accent button color
    const triggerBtn = getTriggerButton();
    if (triggerBtn) {
      triggerBtn.style.color = hex;
    }

    if (save) {
      try {
        plugin.storage?.set?.("melange_accent", acc.id);
        localStorage.setItem("__bettergravity_ml_accent", acc.id);
      } catch (e) {}
    }

    updatePopupActiveState();
  }

  function removeMelangeOverrides() {
    const root = document.documentElement;
    const props = [
      "--melange-accent", "--melange-accent-soft", "--melange-accent-glow",
      "--bettergravity-accent", "--bettergravity-accent-soft",
      "--catppuccin-accent", "--catppuccin-button-accent", "--catppuccin-accent-glow",
      "--primary", "--focus-ring-color", "--code-foreground",
      "--gemini-send-bg", "--gemini-send-bg-hover",
      "--gemini-inline-code-text", "--gemini-home-glow-accent"
    ];
    props.forEach(p => root.style.removeProperty(p));
  }

  // ==========================================================================
  // 9. Adaptive Popup Modal Construction
  // ==========================================================================
  function createPopup() {
    const provider = activeProvider || THEME_PROVIDERS.catppuccin;

    if (popupEl) {
      if (popupEl.getAttribute("data-theme-id") !== provider.id) {
        popupEl.remove();
        popupEl = null;
      } else {
        return popupEl;
      }
    }

    popupEl = document.createElement("div");
    popupEl.className = "ctp-accent-popup";
    popupEl.id = "ctp-accent-popup";
    popupEl.setAttribute("data-theme-id", provider.id);

    // --- Header ---
    const header = document.createElement("div");
    header.className = "ctp-accent-header";

    const title = document.createElement("span");
    title.className = "ctp-accent-title";
    title.textContent = `${provider.name} Palette`;

    const badge = document.createElement("span");
    badge.className = "ctp-accent-current-badge";
    badge.id = "ctp-accent-current-badge";

    header.append(title, badge);
    popupEl.append(header);

    // --- Section 1: Flavor Tabs (Only rendered when provider has multiple flavors) ---
    if (provider.hasFlavors && Object.keys(provider.flavors).length > 1) {
      const flavorSec = document.createElement("div");
      flavorSec.className = "ctp-flavor-section";

      const flavorLabel = document.createElement("div");
      flavorLabel.className = "ctp-section-label";
      flavorLabel.textContent = "FLAVOR";

      const flavorTabs = document.createElement("div");
      flavorTabs.className = "ctp-flavor-tabs";

      Object.values(provider.flavors).forEach((flv) => {
        const tab = document.createElement("button");
        tab.type = "button";
        tab.className = `ctp-flavor-tab ${flv.id === currentFlavorId ? "is-active" : ""}`;
        tab.setAttribute("data-flavor-id", flv.id);

        const dot = document.createElement("span");
        dot.className = "ctp-flavor-preview-dot";
        dot.style.backgroundColor = flv.colors?.bg0 || (flv.isDark ? (flv.colors?.crust || "#11111b") : (flv.colors?.base || "#eff1f5"));

        const text = document.createElement("span");
        text.textContent = flv.name;

        tab.append(dot, text);

        tab.addEventListener("click", (e) => {
          e.stopPropagation();
          provider.apply(flv.id, currentAccentId, true);
        });

        flavorTabs.appendChild(tab);
      });

      flavorSec.append(flavorLabel, flavorTabs);
      popupEl.append(flavorSec);
    }

    // --- Section 2: Accent Colors Grid ---
    const accentSec = document.createElement("div");
    accentSec.className = "ctp-accent-section";

    const accentLabel = document.createElement("div");
    accentLabel.className = "ctp-section-label";
    accentLabel.textContent = provider.id === "flexoki" 
      ? "MINERAL ACCENT" 
      : (provider.id === "kanagawa" ? "UKIYO-E ACCENT" : (provider.id === "everforest" ? "FOREST ACCENT" : (provider.id === "melange" ? "EARTH ACCENT" : "ACCENT COLOR")));

    const grid = document.createElement("div");
    grid.className = "ctp-accent-grid";
    grid.id = "ctp-accent-grid";

    renderAccentDots(grid, provider);

    accentSec.append(accentLabel, grid);
    popupEl.append(accentSec);

    document.body.appendChild(popupEl);
    return popupEl;
  }

  function renderAccentDots(container, provider) {
    if (!provider) provider = activeProvider || THEME_PROVIDERS.catppuccin;
    container.innerHTML = "";

    provider.accents.forEach((acc) => {
      const hex = provider.getAccentHex(currentFlavorId, acc.id);
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = `ctp-accent-dot ${acc.id === currentAccentId ? "is-active" : ""}`;
      dot.style.backgroundColor = hex;
      dot.style.setProperty("--dot-glow", `${hex}55`);
      dot.setAttribute("data-color-id", acc.id);
      dot.setAttribute("data-tooltip", acc.name);
      dot.setAttribute("aria-label", acc.name);

      dot.addEventListener("click", (e) => {
        e.stopPropagation();
        provider.apply(currentFlavorId, acc.id, true);
        closePopup();
      });

      container.appendChild(dot);
    });
  }

  function updatePopupActiveState() {
    if (!popupEl) return;
    const provider = activeProvider || THEME_PROVIDERS.catppuccin;
    const currentHex = provider.getAccentHex(currentFlavorId, currentAccentId);
    const accentObj = provider.accents.find(a => a.id === currentAccentId);
    const flavorObj = provider.flavors[currentFlavorId];

    // Update Badge
    const badge = popupEl.querySelector("#ctp-accent-current-badge");
    if (badge) {
      const flavorTitle = flavorObj ? flavorObj.name : "";
      badge.textContent = provider.hasFlavors ? `${flavorTitle} · ${accentObj?.name || currentAccentId}` : (accentObj?.name || currentAccentId);
      badge.style.color = currentHex;
    }

    // Update Flavor Tabs if present
    const tabs = popupEl.querySelectorAll(".ctp-flavor-tab");
    tabs.forEach((tab) => {
      const id = tab.getAttribute("data-flavor-id");
      tab.classList.toggle("is-active", id === currentFlavorId);
    });

    // Update Accent Dots
    const dots = popupEl.querySelectorAll(".ctp-accent-dot");
    dots.forEach((dot) => {
      const id = dot.getAttribute("data-color-id");
      dot.classList.toggle("is-active", id === currentAccentId);
    });
  }

  function openPopup() {
    const triggerBtn = getTriggerButton();
    if (!triggerBtn) return;

    const popup = createPopup();
    updatePopupActiveState();

    const rect = triggerBtn.getBoundingClientRect();
    const popupWidth = 280;
    let left = rect.right - popupWidth;
    if (left < 10) left = 10;
    if (left + popupWidth > window.innerWidth - 10) left = window.innerWidth - popupWidth - 10;

    popup.style.top = `${rect.bottom + 6}px`;
    popup.style.left = `${left}px`;

    requestAnimationFrame(() => {
      popup.classList.add("is-open");
    });

    buttonHandle?.setActive?.(true);
  }

  function closePopup() {
    if (!popupEl || !popupEl.classList.contains("is-open")) return;
    popupEl.classList.remove("is-open");
    buttonHandle?.setActive?.(false);
  }

  function togglePopup() {
    if (popupEl && popupEl.classList.contains("is-open")) {
      closePopup();
    } else {
      openPopup();
    }
  }

  function handleOutsideClick(e) {
    if (!popupEl || !popupEl.classList.contains("is-open")) return;
    const triggerBtn = getTriggerButton();
    if (popupEl.contains(e.target) || triggerBtn?.contains(e.target)) return;
    closePopup();
  }

  function handleKeydown(e) {
    if (e.key === "Escape" && popupEl?.classList.contains("is-open")) {
      e.stopPropagation();
      closePopup();
    }
  }

  // ==========================================================================
  // 7. Onboarding & TitleBar Button Lifecycle Management
  // ==========================================================================
  const CATPPUCCIN_ONBOARDING_KEY = "bettergravity:catppuccin:onboarding_v1";
  let activeOnboardingTimer = null;
  let activeOnboardingCallout = null;

  function triggerCatppuccinOnboarding() {
    try {
      let seen = false;
      try {
        seen = plugin?.storage?.get?.("onboarding_seen", false);
      } catch (_) {}
      if (!seen) {
        seen = localStorage.getItem(CATPPUCCIN_ONBOARDING_KEY) === "true";
      }
      if (seen) return;
    } catch (_) {
      return;
    }

    activeOnboardingTimer = setTimeout(() => {
      const btn = getTriggerButton();
      if (!btn) return;

      if (document.querySelector(".bg-onboarding-callout")) {
        activeOnboardingTimer = setTimeout(triggerCatppuccinOnboarding, 3500);
        return;
      }

      try {
        plugin?.storage?.set?.("onboarding_seen", true);
        localStorage.setItem(CATPPUCCIN_ONBOARDING_KEY, "true");
      } catch (_) {}

      const dismiss = () => {
        try {
          plugin?.storage?.set?.("onboarding_seen", true);
          localStorage.setItem(CATPPUCCIN_ONBOARDING_KEY, "true");
        } catch (_) {}
        callout.classList.remove("is-visible");
        activeOnboardingCallout = null;
        setTimeout(() => callout.remove(), 250);
      };

      btn.addEventListener("click", dismiss, { once: true });

      const callout = document.createElement("div");
      callout.className = "bg-onboarding-callout";
      callout.setAttribute("data-no-drag", "true");
      callout.innerHTML = `
        <div class="bg-callout-caret"></div>
        <div class="bg-callout-header">
          <span class="bg-callout-icon">🎨</span>
          <span class="bg-callout-title" style="color: var(--catppuccin-accent, #b4befe)">Theme Palette Ready</span>
        </div>
        <div class="bg-callout-body">
          Theme active. Click here to customize flavor palette, accent colors & styles!
        </div>
        <div class="bg-callout-footer">
          <button type="button" class="bg-callout-btn" data-no-drag="true">Got it</button>
        </div>
      `;

      document.body.appendChild(callout);
      activeOnboardingCallout = callout;

      const rect = btn.getBoundingClientRect();
      const width = 240;
      let left = rect.left + rect.width / 2 - width / 2;
      left = Math.max(12, Math.min(window.innerWidth - width - 12, left));
      callout.style.top = `${rect.bottom + 8}px`;
      callout.style.left = `${left}px`;

      const caret = callout.querySelector(".bg-callout-caret");
      if (caret) {
        const caretLeft = Math.max(8, Math.min(width - 20, rect.left + rect.width / 2 - left - 6));
        caret.style.left = `${caretLeft}px`;
      }

      callout.querySelector(".bg-callout-btn")?.addEventListener("click", dismiss);

      requestAnimationFrame(() => {
        callout.classList.add("is-visible");
      });

      activeOnboardingTimer = setTimeout(() => {
        if (document.body.contains(callout)) {
          dismiss();
        }
      }, 10000);
    }, 800);
  }

  function mountButton(provider) {
    if (buttonHandle) return;
    activeProvider = provider;
    try {
      buttonHandle = plugin.ui.button({
        area: "titleBar",
        label: "Palette",
        icon: PALETTE_ICON,
        tooltip: `${provider.name} Palette Switcher`,
        onClick: togglePopup
      });
      const config = getSavedConfig(provider);
      provider.apply(config.flavor, config.accent, false);
      if (provider.id === "catppuccin") {
        triggerCatppuccinOnboarding();
      }
    } catch (e) {
      plugin.log?.warn?.("Accent button mount failed:", e);
    }
  }

  function unmountButton() {
    closePopup();
    if (popupEl) {
      popupEl.remove();
      popupEl = null;
    }
    if (buttonHandle) {
      buttonHandle.remove();
      buttonHandle = null;
    }
    activeProvider?.removeOverrides?.();
    activeProvider = null;
  }

  function syncLifecycle() {
    const provider = getActiveProvider();
    if (provider) {
      if (!buttonHandle) {
        mountButton(provider);
      } else if (activeProvider !== provider) {
        // Active theme switched at runtime: clean up old theme tokens and mount new provider
        activeProvider?.removeOverrides?.();
        activeProvider = provider;
        if (popupEl) {
          popupEl.remove();
          popupEl = null;
        }
        const cfg = getSavedConfig(provider);
        provider.apply(cfg.flavor, cfg.accent, false);
      }
    } else if (buttonHandle) {
      unmountButton();
    }
  }

  function isUserTyping() {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName?.toLowerCase();
    if (tag === "input" || tag === "textarea") return true;
    if (el.isContentEditable || el.closest?.('[contenteditable="true"]')) return true;
    return false;
  }

  // Initial synchronization
  syncLifecycle();

  // Observer for dynamic theme switching
  observer = new MutationObserver(() => {
    if (isUserTyping()) return;
    syncLifecycle();
  });
  observer.observe(document.head, { childList: true, subtree: true, attributes: true });

  // Event listeners for dismiss
  document.addEventListener("click", handleOutsideClick, true);
  window.addEventListener("keydown", handleKeydown, true);

  // ==========================================================================
  // 8. Composer Focus & Glow Stabilization (Zero Background Click Thrashing)
  // ==========================================================================
  let isComposerFocused = false;
  let composerBlurTimer = null;

  function getComposerCard() {
    return document.querySelector(
      '.bg-chat-composer, [data-testid="chat-input-container"], [data-testid="agent-input-box"] > .rounded-2xl.bg-card-border > .bg-card:not([data-mention-menu]), [data-testid="agent-input-box"] .bg-card:not([data-mention-menu])'
    );
  }

  function triggerComposerBreath(card) {
    if (!card) card = getComposerCard();
    if (!card) return;
    card.classList.remove("bg-composer-breathe-1x", "bg-composer-settled");
    requestAnimationFrame(() => {
      card.classList.add("bg-composer-breathe-1x");
    });
  }

  function handleComposerFocus() {
    if (composerBlurTimer) {
      clearTimeout(composerBlurTimer);
      composerBlurTimer = null;
    }
    if (isComposerFocused) return;
    isComposerFocused = true;
    const card = getComposerCard();
    triggerComposerBreath(card);
  }

  function handleComposerBlur() {
    if (composerBlurTimer) clearTimeout(composerBlurTimer);
    composerBlurTimer = setTimeout(() => {
      const activeEl = document.activeElement;
      const isInside = !!activeEl?.closest?.(
        '[data-testid="agent-input-box"], .bg-chat-composer, [data-testid="chat-input-container"]'
      );
      if (!isInside) {
        isComposerFocused = false;
        const card = getComposerCard();
        if (card) {
          card.classList.remove("bg-composer-breathe-1x");
          card.classList.add("bg-composer-settled");
        }
      }
      composerBlurTimer = null;
    }, 120);
  }

  function handleGlobalPointerDown(e) {
    const isInside = !!e.target?.closest?.(
      '[data-testid="agent-input-box"], .bg-chat-composer, [data-testid="chat-input-container"]'
    );
    if (isInside) {
      if (composerBlurTimer) {
        clearTimeout(composerBlurTimer);
        composerBlurTimer = null;
      }
      isComposerFocused = true;
      const card = getComposerCard();
      triggerComposerBreath(card);
    }
  }

  function handleGlobalFocusIn(e) {
    if (e.target?.closest?.('[data-testid="agent-input-box"], .bg-chat-composer, [data-testid="chat-input-container"]')) {
      handleComposerFocus();
    }
  }

  function handleGlobalFocusOut(e) {
    if (e.target?.closest?.('[data-testid="agent-input-box"], .bg-chat-composer, [data-testid="chat-input-container"]')) {
      handleComposerBlur();
    }
  }

  // Clean any old lingering class on startup
  const initialCard = getComposerCard();
  if (initialCard) {
    initialCard.classList.remove("bg-composer-settled");
  }

  document.addEventListener("pointerdown", handleGlobalPointerDown, true);
  document.addEventListener("focusin", handleGlobalFocusIn, true);
  document.addEventListener("focusout", handleGlobalFocusOut, true);

  // Plugin teardown
  plugin.onDispose(() => {
    observer?.disconnect();
    document.removeEventListener("click", handleOutsideClick, true);
    window.removeEventListener("keydown", handleKeydown, true);
    document.removeEventListener("pointerdown", handleGlobalPointerDown, true);
    document.removeEventListener("focusin", handleGlobalFocusIn, true);
    document.removeEventListener("focusout", handleGlobalFocusOut, true);
    if (composerBlurTimer) clearTimeout(composerBlurTimer);
    if (activeOnboardingTimer) clearTimeout(activeOnboardingTimer);
    if (activeOnboardingCallout) activeOnboardingCallout.remove();
    document.querySelectorAll(".bg-onboarding-callout").forEach((el) => el.remove());
    const card = getComposerCard();
    if (card) {
      card.classList.remove("bg-composer-breathe-1x", "bg-composer-settled");
    }
    unmountButton();
  });
})();
