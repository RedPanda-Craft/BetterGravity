import type { InstallOperation, InstallationState, OperationProgress, PatchState } from "@bettergravity/patcher";

export interface InstallerViewState {
  readonly installation: InstallationState;
  readonly runningOperation?: InstallOperation;
  readonly progress?: OperationProgress;
}

export interface OperationCopy {
  /** Imperative, shown on the button. */
  readonly label: string;
  readonly hint: string;
  readonly icon: string;
  /** Present progressive, shown while the operation runs. */
  readonly running: string;
  /** Destructive actions are styled and confirmed differently. */
  readonly destructive?: boolean;
}

export const operations: Record<InstallOperation, OperationCopy> = {
  install: {
    label: "Install SuperGravity",
    hint: "Back up the original bundle, then patch Antigravity.",
    icon: "↓",
    running: "Installing SuperGravity"
  },
  update: {
    label: "Reapply SuperGravity",
    hint: "Antigravity changed. Patch the new version.",
    icon: "↻",
    running: "Reapplying SuperGravity"
  },
  reinstall: {
    label: "Reinstall SuperGravity",
    hint: "Rebuild the patch from the original bundle.",
    icon: "⟳",
    running: "Reinstalling SuperGravity"
  },
  repair: {
    label: "Repair SuperGravity",
    hint: "Restore the original bundle and rebuild the patch.",
    icon: "◇",
    running: "Repairing SuperGravity"
  },
  uninstall: {
    label: "Uninstall SuperGravity",
    hint: "Restore Antigravity exactly as it was. Your themes and plugins are kept.",
    icon: "×",
    running: "Removing SuperGravity",
    destructive: true
  }
};

export interface StateCopy {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly tone: "neutral" | "good" | "bad";
}

export const states: Record<PatchState, StateCopy> = {
  unpatched: {
    eyebrow: "AUTOMATIC CHECK COMPLETE",
    title: "Antigravity is ready.",
    description: "A supported Antigravity installation was found. SuperGravity is not installed yet.",
    tone: "neutral"
  },
  patched: {
    eyebrow: "EVERYTHING LOOKS RIGHT",
    title: "SuperGravity is installed.",
    description: "Open Antigravity, then find SuperGravity in Settings to add themes and plugins.",
    tone: "good"
  },
  "needs-repatch": {
    eyebrow: "ACTION AVAILABLE",
    title: "Antigravity changed.",
    description: "An update replaced the patched bundle. Reapply SuperGravity to get it back.",
    tone: "neutral"
  },
  corrupted: {
    eyebrow: "NEEDS ATTENTION",
    title: "The installation is incomplete.",
    description: "Part of the patch is missing. Repairing restores Antigravity from its backup.",
    tone: "bad"
  },
  unknown: {
    eyebrow: "READY FOR A LOCATION",
    title: "Antigravity was not found.",
    description: "Choose the folder Antigravity is installed in to continue.",
    tone: "neutral"
  }
};

export function patchStateOf(installation: InstallationState): PatchState {
  if (installation.patchState) return installation.patchState;
  return installation.kind === "detected" ? "unpatched" : "unknown";
}
