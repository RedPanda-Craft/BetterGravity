// Fork Chat — Add first-class chat forking to Antigravity
//
// Allows users to fork conversations from any assistant response or any sidebar thread
// into a new branch or workspace, matching Codex and Claude Code.

const FORK_ICON_PATH = "M200-440q-17 0-28.5-11.5T160-480q0-17 11.5-28.5T200-520h264l200-200h-64q-17 0-28.5-11.5T560-760q0-17 11.5-28.5T600-800h160q17 0 28.5 11.5T800-760v160q0 17-11.5 28.5T760-560q-17 0-28.5-11.5T720-600v-64L519-463q-11 11-25.5 17t-30.5 6H200Zm400 280q-17 0-28.5-11.5T560-200q0-17 11.5-28.5T600-240h64l-99-98q-12-12-12-28.5t12-28.5q12-12 29-12t29 12l97 99v-64q0-17 11.5-28.5T760-400q17 0 28.5 11.5T800-360v160q0 17-11.5 28.5T760-160H600Z";
const FORK_ICON_SVG = `<svg viewBox="0 -960 960 960" fill="currentColor"><path d="${FORK_ICON_PATH}"/></svg>`;
const WORKSPACE_ICON_SVG = '<svg viewBox="0 -960 960 960" fill="currentColor"><path d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h240l80 80h320q33 0 56.5 23.5T880-640v400q0 33-23.5 56.5T800-160H160Zm0-80h640v-400H447l-80-80H160v480Zm0 0v-480 480Z"/></svg>';
const BRANCH_ICON_SVG = FORK_ICON_SVG;
const COPY_ICON_SVG = '<svg viewBox="0 -960 960 960" fill="currentColor"><path d="M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480ZM200-80q-33 0-56.5-23.5T120-160v-560h80v560h440v80H200Zm160-240v-480 480Z"/></svg>';
const COPY_MENU_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 -960 960 960" fill="currentColor" class="text-secondary-foreground shrink-0"><path d="M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480ZM200-80q-33 0-56.5-23.5T120-160v-560h80v560h440v80H200Zm160-240v-480 480Z"/></svg>';
const WORKSPACE_MENU_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 -960 960 960" fill="currentColor" class="text-secondary-foreground shrink-0"><path d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h240l80 80h320q33 0 56.5 23.5T880-640v400q0 33-23.5 56.5T800-160H160Zm0-80h640v-400H447l-80-80H160v480Zm0 0v-480 480Z"/></svg>';
const BRANCH_MENU_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 -960 960 960" fill="currentColor" class="text-secondary-foreground shrink-0"><path d="${FORK_ICON_PATH}"/></svg>`;
const CHEVRON_RIGHT_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 -960 960 960" fill="currentColor"><path d="M517.85-480l-184-184L376-706.15L602.15-480L376-253.85L333.85-296l184-184Z"/></svg>';

/* ── Settings ────────────────────────────────────────────────────────────── */
const settings = plugin.settings.define({
  defaultTarget: {
    type: "select",
    label: "Default fork workspace",
    description: "Where newly forked conversations are created by default.",
    default: "1",
    options: [
      { value: "1", label: "Current workspace" },
      { value: "2", label: "Shared workspace (Git worktree)" }
    ]
  },
  allTurns: {
    type: "boolean",
    label: "Show fork button on every response",
    description: "Adds a fork button to every assistant response in the conversation, not just the latest reply.",
    default: true
  },
  quickFork: {
    type: "boolean",
    label: "Quick fork on click",
    description: "Fork immediately into the default workspace when clicking the turn button without opening a dropdown.",
    default: false
  }
});

/* ── Native Flag Synchronization ─────────────────────────────────────────── */
function ensureNativeFlags() {
  try {
    const key = "jetski.developer.customFlagOverrides";
    let flags = {};
    const raw = window.localStorage.getItem(key);
    if (raw) {
      try {
        flags = JSON.parse(raw) || {};
      } catch {}
    }
    if (!flags["enable-conversation-forking"] || !flags["enable-fork-in-new-worktree"]) {
      flags["enable-conversation-forking"] = true;
      flags["enable-fork-in-new-worktree"] = true;
      const val = JSON.stringify(flags);
      window.localStorage.setItem(key, val);
      window.dispatchEvent(
        new StorageEvent("storage", {
          key,
          newValue: val,
          oldValue: raw,
          storageArea: window.localStorage
        })
      );
    }
  } catch {}
}

ensureNativeFlags();

/* ── React and Store Inspection ──────────────────────────────────────────── */
function getFiber(node) {
  if (!node) return null;
  const keys = Object.keys(node);
  const key = keys.find((k) => k.startsWith("__reactFiber"));
  const fiber = key ? node[key] : null;
  const propsKey = keys.find((k) => k.startsWith("__reactProps"));
  // React keeps the original fiber on a reused DOM node. Its committed props
  // identify the current alternate after a response or conversation changes.
  if (propsKey && fiber?.alternate?.memoizedProps === node[propsKey]) return fiber.alternate;
  return fiber;
}

function findAgentService() {
  const anchors = [
    document.querySelector('[data-testid="conversation-view"]'),
    document.querySelector('[data-testid="conversation-row-sidebar"]'),
    document.querySelector('[data-testid="agent-input-box"]'),
    document.body
  ];

  for (const anchor of anchors) {
    if (!anchor) continue;
    let fiber = getFiber(anchor);
    for (let depth = 0; fiber && depth < 40; depth += 1, fiber = fiber.return) {
      if (typeof fiber.memoizedProps?.agentService?.forkConversation === "function") {
        return fiber.memoizedProps.agentService;
      }
      if (typeof fiber.memoizedProps?.value?.agentService?.forkConversation === "function") {
        return fiber.memoizedProps.value.agentService;
      }
      let dep = fiber.dependencies?.firstContext;
      for (let i = 0; dep && i < 30; i += 1, dep = dep.next) {
        if (typeof dep.memoizedValue?.forkConversation === "function") {
          return dep.memoizedValue;
        }
        if (typeof dep.memoizedValue?.agentService?.forkConversation === "function") {
          return dep.memoizedValue.agentService;
        }
      }
    }
  }
  return null;
}

function findRouter() {
  const anchors = [
    document.querySelector('[data-testid="conversation-view"]'),
    document.body
  ];
  for (const anchor of anchors) {
    if (!anchor) continue;
    let fiber = getFiber(anchor);
    for (let depth = 0; fiber && depth < 40; depth += 1, fiber = fiber.return) {
      if (typeof fiber.memoizedProps?.router?.navigate === "function") {
        return fiber.memoizedProps.router;
      }
      const value = fiber.memoizedProps?.value;
      if (typeof value?.router?.navigate === "function") return value.router;
      if (typeof value?.navigate === "function" && typeof value.parseLocation === "function") return value;
      let dep = fiber.dependencies?.firstContext;
      for (let i = 0; dep && i < 30; i += 1, dep = dep.next) {
        if (typeof dep.memoizedValue?.navigate === "function" && dep.memoizedValue.parseLocation) {
          return dep.memoizedValue;
        }
        if (typeof dep.memoizedValue?.router?.navigate === "function") return dep.memoizedValue.router;
      }
    }
  }
  return null;
}

function findStore() {
  const anchors = [
    document.querySelector('[data-testid="conversation-view"]'),
    document.querySelector('[data-testid="conversation-row-sidebar"]'),
    document.body
  ];
  for (const anchor of anchors) {
    if (!anchor) continue;
    let fiber = getFiber(anchor);
    for (let depth = 0; fiber && depth < 40; depth += 1, fiber = fiber.return) {
      const store = fiber.memoizedProps?.store;
      if (typeof store?.getState === "function") return store;
      let dep = fiber.dependencies?.firstContext;
      for (let i = 0; dep && i < 30; i += 1, dep = dep.next) {
        const depStore = dep.memoizedValue?.store;
        if (typeof depStore?.getState === "function") return depStore;
      }
    }
  }
  return null;
}

function currentConversationId() {
  const view = document.querySelector('[data-testid="conversation-view"]');
  const id = view?.getAttribute("data-cascade-id") ?? "";
  if (id && id !== "conversation") return id;
  const match = typeof window !== "undefined" && window.location?.pathname ? window.location.pathname.match(/\/c\/([a-f0-9-]+)/i) : null;
  return match ? match[1] : "";
}

async function navigateToConversation(cascadeId, projectId) {
  const router = findRouter();
  if (router && typeof router.navigate === "function") {
    try {
      await router.navigate({
        to: "/c/$cascadeId",
        params: { cascadeId },
        search: (previous) => {
          const search = { ...previous };
          delete search.q;
          delete search.focused;
          delete search.tab;
          if (projectId) search.section = projectId;
          return search;
        }
      });
      return true;
    } catch {}
  }

  // A real sidebar link can navigate even if the router context is unavailable.
  const rowLink = document.querySelector(
    `[data-testid="conversation-row-sidebar"][data-cascade-id="${CSS.escape(cascadeId)}"] a[aria-label]`
  );
  if (rowLink instanceof HTMLElement) {
    rowLink.click();
    return true;
  }

  return false;
}

function getConversationTitle(cascadeId) {
  if (!cascadeId) return "";
  const store = findStore();
  try {
    const summary = store?.getState()?.trajectorySummaries?.summaries?.[cascadeId];
    if (summary?.summary) return summary.summary;
    if (summary?.title) return summary.title;
  } catch {}
  const row = document.querySelector(`[data-cascade-id="${CSS.escape(cascadeId)}"]`);
  const label = row?.querySelector("a[aria-label]")?.getAttribute("aria-label");
  if (label) return label;
  const all = collectAllConversations();
  const found = all.find((c) => c.id === cascadeId);
  if (found?.title) return found.title;
  return "";
}

/* ── Core Fork Execution ─────────────────────────────────────────────────── */
let activeForkPromise = null;

// CortexStepStatus: PENDING, RUNNING, GENERATING, WAITING, QUEUED.
const ACTIVE_STEP_STATUSES = new Set([1, 2, 8, 9, 11]);

function snapshotThroughResponse(trajectory, sourceCascadeId, forkAtStepIndex) {
  const allSteps = trajectory?.steps;
  const end = forkAtStepIndex === -1 ? allSteps?.length - 1 : forkAtStepIndex;
  if (!Array.isArray(allSteps) || !Number.isSafeInteger(end) || end < 0 || end >= allSteps.length) {
    throw new Error("The selected response could not be loaded. Reopen the conversation and try again.");
  }
  if (trajectory.cascadeId && trajectory.cascadeId !== sourceCascadeId) {
    throw new Error("The loaded history belongs to a different conversation. Please try again.");
  }
  if (forkAtStepIndex !== -1 && ACTIVE_STEP_STATUSES.has(allSteps[end].status)) {
    throw new Error("This response is still being written. Choose an earlier completed response to fork.");
  }

  // These are detached RPC results. Seal unfinished work only in the copy;
  // a fork must never resume, cancel, or join work in the source conversation.
  const steps = allSteps.slice(0, end + 1).map(step => ACTIVE_STEP_STATUSES.has(step.status)
    ? { ...step, status: 6, interaction: undefined }
    : step);
  const generatorMetadata = [];
  for (const metadata of trajectory.generatorMetadata || []) {
    const stepIndices = (metadata.stepIndices || []).filter(index => Number.isSafeInteger(index) && index >= 0 && index <= end);
    if (stepIndices.length) generatorMetadata.push({ ...metadata, stepIndices });
  }
  const executorMetadatas = (trajectory.executorMetadatas || []).filter(metadata =>
    Number.isSafeInteger(metadata.lastStepIdx) && metadata.lastStepIdx >= 0 && metadata.lastStepIdx <= end);

  return {
    ...trajectory,
    steps,
    generatorMetadata,
    executorMetadatas,
    // StartCascade adds the parent link using this trajectory's IDs and end.
    // Inherited links can extend beyond the selected response on existing forks.
    parentReferences: [],
    battleModeInfos: []
  };
}

async function forkFromSnapshot(agentService, request) {
  if (typeof agentService.getCascadeTrajectory !== "function" || typeof agentService.startCascade !== "function") {
    throw new Error("This version of Antigravity does not expose the history snapshot service needed to fork during active work.");
  }
  const sharedWorktree = request.targetForkWorkspace === 2;
  if (sharedWorktree && typeof agentService.updateConversationAnnotations !== "function") {
    throw new Error("The conversation service is not ready to create a worktree fork. Please try again.");
  }

  // FULL verbosity preserves tool results and model context, not just the
  // display projection. Trim execution records as well as visible messages.
  const history = await agentService.getCascadeTrajectory({ cascadeId: request.sourceCascadeId, verbosity: 3 });
  const snapshot = snapshotThroughResponse(history?.trajectory, request.sourceCascadeId, request.forkAtStepIndex);
  const metadata = snapshot.metadata || {};
  const projectId = metadata.projectId;
  const workspaceUris = metadata.workspaceUris?.length ? metadata.workspaceUris
    : (metadata.workspaces || []).map(workspace => workspace.workspaceFolderAbsoluteUri).filter(Boolean);
  const projectEnvConfig = projectId && projectId !== "outside-of-project" ? {
    projectId,
    target: metadata.environmentId
      ? { case: "environmentId", value: metadata.environmentId }
      : { case: "defaultProjectEnvironment", value: {} }
  } : undefined;
  const lastModelStep = snapshot.steps.findLast(step => step.metadata?.generatorModel > 0);
  const snapshotId = crypto.randomUUID();
  let started;
  try {
    started = await agentService.startCascade({
      cascadeId: snapshotId,
      source: 1,
      trajectoryType: 4,
      baseTrajectoryIdentifier: {
        identifier: { case: "trajectory", value: snapshot }
      },
      workspaceUris: projectEnvConfig ? undefined : workspaceUris,
      projectEnvConfig,
      agentScriptItem: metadata.agentScript,
      customAgentSpec: metadata.staticConfig,
      requestedModel: lastModelStep?.metadata.generatorModel
    });
    if (!started?.cascadeId || started.cascadeId !== snapshotId) {
      throw new Error("The snapshot service did not return the new conversation ID.");
    }
  } catch (error) {
    // A transport failure can happen after creation. Only this freshly
    // allocated ID is ours to clean up, never an unexpected response ID.
    try { await agentService.updateConversationAnnotations?.(snapshotId, { archived: true }, true); } catch {}
    throw error;
  }

  const targetForkWorkspace = sharedWorktree ? 2 : 1;
  let keepSnapshotActive = false;
  try {
    return await agentService.forkConversation({
      sourceCascadeId: snapshotId,
      forkAtStepIndex: snapshot.steps.length - 1,
      targetForkWorkspace
    });
  } catch (worktreeErr) {
    const wtMsg = worktreeErr?.message || String(worktreeErr);
    if (sharedWorktree && /not a valid branch name|check-ref-format|failed to create worktree|vcs unknown|cannot clone workspace|no git repository/i.test(wtMsg)) {
      plugin.ui.toast({
        title: "Worktree branch unavailable",
        body: "Git worktree requires a valid repository. Forking into current workspace instead...",
        kind: "info",
        duration: 4000
      });
      return await agentService.forkConversation({
        sourceCascadeId: snapshotId,
        forkAtStepIndex: snapshot.steps.length - 1,
        targetForkWorkspace: 1
      });
    }
    throw worktreeErr;
  } finally {
    if (!keepSnapshotActive) {
      try {
        await agentService.updateConversationAnnotations(snapshotId, { archived: true }, true);
      } catch {
        plugin.ui.toast({
          title: "Extra fork copy in history",
          body: "The temporary copy could not be hidden. You can archive it from the sidebar.",
          kind: "warning"
        });
      }
    }
  }
}

async function forkConversation(agentService, request) {
  try {
    return await agentService.forkConversation(request);
  } catch (error) {
    const message = error?.message || String(error);
    // Worktree VCS errors must bubble up to runFork for clean targetForkWorkspace: 1 fallback
    if (request?.targetForkWorkspace === 2 && /not a valid branch name|check-ref-format|failed to create worktree|vcs unknown|cannot clone workspace|no git repository/i.test(message)) {
      throw error;
    }
    // Some host versions require the entire source to be idle even when the
    // requested prefix finished long ago. Other host limitations (e.g. conversations
    // that invoked subagents) cannot be forked natively and must fall back to snapshot.
    if (!/must be fully idle|conversation.{0,100}(?:in progress|is busy)|invoked subagents|subagent|failed to create forked conversation/i.test(message)) throw error;
    return forkFromSnapshot(agentService, request);
  }
}

async function runFork(sourceCascadeId, forkAtStepIndex, targetForkWorkspace, title) {
  if (activeForkPromise) return;

  if (!sourceCascadeId) {
    plugin.ui.toast({
      title: "No conversation selected",
      body: "Could not identify a conversation to fork.",
      kind: "warning"
    });
    return;
  }

  if (!Number.isSafeInteger(forkAtStepIndex) || forkAtStepIndex < -1) {
    plugin.ui.toast({
      title: "Fork point unavailable",
      body: "Could not identify the end of this response. Please reopen the conversation and try again.",
      kind: "warning"
    });
    return;
  }

  const agentService = findAgentService();
  if (!agentService || typeof agentService.forkConversation !== "function") {
    plugin.ui.toast({
      title: "Fork service unavailable",
      body: "The agent service is not ready. Please try again in a moment.",
      kind: "error"
    });
    return;
  }

  const target = Number(targetForkWorkspace) || Number(settings.defaultTarget) || 1;
  const targetLabel = target === 2 ? "shared workspace" : "current workspace";
  const stepLabel = forkAtStepIndex >= 0 ? ` at step #${forkAtStepIndex}` : "";

  const origTitle = title || getConversationTitle(sourceCascadeId) || "Conversation";
  const forkedTitle = origTitle.startsWith("Forked • ") ? origTitle : `Forked • ${origTitle}`;

  plugin.ui.toast({
    title: "Forking conversation...",
    body: origTitle ? `Forking "${origTitle}" into ${targetLabel}${stepLabel}...` : `Creating fork in ${targetLabel}...`,
    kind: "info",
    duration: 3500
  });

  const run = async () => {
    try {
      let response;
      try {
        response = await forkConversation(agentService, {
          sourceCascadeId,
          forkAtStepIndex,
          targetForkWorkspace: target
        });
      } catch (forkErr) {
        const errMsg = forkErr?.message || String(forkErr);
        if (target === 2 && /not a valid branch name|check-ref-format|failed to create worktree|vcs unknown|cannot clone workspace|no git repository/i.test(errMsg)) {
          plugin.ui.toast({
            title: "Worktree branch unavailable",
            body: "Git worktree requires a valid repository. Forking into current workspace instead...",
            kind: "info",
            duration: 4000
          });
          response = await forkConversation(agentService, {
            sourceCascadeId,
            forkAtStepIndex,
            targetForkWorkspace: 1
          });
        } else {
          throw forkErr;
        }
      }
      if (!response?.newCascadeId) {
        throw new Error("No conversation ID returned by the server.");
      }

      const store = findStore();
      const state = store?.getState();
      const sourceSummary = state?.trajectorySummaries?.summaries?.[sourceCascadeId];
      const sourceProjectId =
        sourceSummary?.trajectoryMetadata?.projectId ||
        sourceSummary?.projectEnvInfo?.projectId ||
        (state?.workspace?.activeProjectId && state.workspace.activeProjectId !== "outside-of-project" ? state.workspace.activeProjectId : null);
      const effectiveProjectId = response.newProjectId || sourceProjectId;

      // Rename forked conversation to "Forked • " + original conversation name
      try {
        if (store && typeof store.dispatch === "function") {
          store.dispatch({
            type: "updateOptimisticSummary",
            cascadeId: response.newCascadeId,
            optimisticSummaryText: forkedTitle
          });
        }
        if (typeof agentService.updateConversationAnnotations === "function") {
          await agentService.updateConversationAnnotations(
            response.newCascadeId,
            { title: forkedTitle },
            true
          );
        }
      } catch {}

      // Inform branch tree plugin if available to maintain DAG lineage
      if (globalThis.__bettergravityBranchTree?.recordLineage) {
        try {
          globalThis.__bettergravityBranchTree.recordLineage(response.newCascadeId, sourceCascadeId);
        } catch {}
      }

      const navigated = await navigateToConversation(response.newCascadeId, effectiveProjectId);
      plugin.ui.toast({
        title: "Conversation forked!",
        body: navigated ? "Switched to your new branch." : "Your new branch is ready to open from the sidebar.",
        kind: "success",
        duration: 3000
      });

    } catch (error) {
      const rawMsg = error?.message || String(error);
      let errorBody = rawMsg;
      if (/not a valid branch name|check-ref-format/i.test(rawMsg)) {
        errorBody = "Git branch names cannot contain spaces. Please rename your workspace folder or fork in current workspace.";
      }
      plugin.ui.toast({
        title: "Failed to fork conversation",
        body: errorBody,
        kind: "error",
        duration: 6000
      });
    } finally {
      activeForkPromise = null;
    }
  };

  activeForkPromise = run();
  await activeForkPromise;
}

/* ── Popover for Turn-level Workspace Selection (Willow Parity) ──────────── */
let activePopover = null;
let popoverDismissHandlers = null;

function closeActivePopover() {
  if (activePopover) {
    activePopover.remove();
    activePopover = null;
  }
  if (popoverDismissHandlers) {
    document.removeEventListener("pointerdown", popoverDismissHandlers.onPointerDown, true);
    document.removeEventListener("keydown", popoverDismissHandlers.onKeyDown, true);
    window.removeEventListener("resize", popoverDismissHandlers.onClose, true);
    window.removeEventListener("scroll", popoverDismissHandlers.onClose, true);
    popoverDismissHandlers = null;
  }
}

function openTurnForkPopover(button, cascadeId, stepIndex) {
  closeActivePopover();

  const popover = document.createElement("div");
  popover.className = "bettergravity-fork-popover";
  popover.setAttribute("data-bettergravity-popover", "true");
  popover.setAttribute("role", "menu");

  const makeItem = (label, iconSvg, target) => {
    const item = document.createElement("button");
    item.type = "button";
    item.setAttribute("role", "menuitem");
    item.setAttribute("data-fork-popover-item", "true");
    item.className = "bettergravity-fork-popover-item";
    item.innerHTML = `
      <span class="bettergravity-fork-popover-icon">${iconSvg}</span>
      <span class="bettergravity-fork-popover-label">${label}</span>
    `;
    item.addEventListener("click", (e) => {
      e.stopPropagation();
      closeActivePopover();
      void runFork(cascadeId, stepIndex, target);
    });
    return item;
  };

  popover.append(
    makeItem("Fork in current workspace", WORKSPACE_ICON_SVG, 1),
    makeItem("Fork in shared worktree", BRANCH_ICON_SVG, 2)
  );

  document.body.append(popover);
  activePopover = popover;

  const rect = button.getBoundingClientRect();
  const menuWidth = 224;
  const menuHeight = 88;
  const opensAbove = rect.bottom + menuHeight + 12 > window.innerHeight && rect.top > menuHeight + 12;

  let left = rect.left;
  if (left + menuWidth > window.innerWidth - 8) {
    left = Math.max(8, rect.right - menuWidth);
  }
  left = Math.min(Math.max(8, left), window.innerWidth - menuWidth - 8);

  if (opensAbove) {
    popover.style.bottom = `${window.innerHeight - rect.top + 6}px`;
    popover.style.top = "auto";
    popover.classList.add("opens-above");
  } else {
    popover.style.top = `${rect.bottom + 6}px`;
    popover.style.bottom = "auto";
    popover.classList.add("opens-below");
  }
  popover.style.left = `${left}px`;

  popoverDismissHandlers = {
    onClose: () => closeActivePopover(),
    onPointerDown: (e) => {
      if (activePopover?.contains(e.target) || button.contains(e.target)) return;
      closeActivePopover();
    },
    onKeyDown: (e) => {
      if (e.key === "Escape") closeActivePopover();
    }
  };

  setTimeout(() => {
    if (!popoverDismissHandlers) return;
    document.addEventListener("pointerdown", popoverDismissHandlers.onPointerDown, true);
    document.addEventListener("keydown", popoverDismissHandlers.onKeyDown, true);
    window.addEventListener("resize", popoverDismissHandlers.onClose, true);
    window.addEventListener("scroll", popoverDismissHandlers.onClose, true);
  }, 0);
}

/* ── Response Fork Point ─────────────────────────────────────────────────── */
function forkPointFromBar(bar) {
  const view = bar.closest('[data-testid="conversation-view"]');
  const viewId = view?.getAttribute("data-cascade-id");
  const sourceCascadeId = viewId && viewId !== "conversation" ? viewId : undefined;
  let fiber = getFiber(bar);
  let responseSteps = null;
  let fullTrajectory = null;
  let contextId = sourceCascadeId;

  for (let depth = 0; fiber && depth < 50; depth += 1, fiber = fiber.return) {
    const props = fiber.memoizedProps || {};
    if (!responseSteps && Array.isArray(props.steps)) responseSteps = props.steps;
    if (!responseSteps && Array.isArray(props.container?.steps)) responseSteps = props.container.steps;
    if (!responseSteps?.length) continue;

    const lastStep = responseSteps[responseSteps.length - 1];
    const slice = props.trajectorySlice;
    if (slice && Array.isArray(slice.stepsInSlice)) {
      const id = slice.conversationId || props.cascadeId || contextId;
      if (!id || (sourceCascadeId && id !== sourceCascadeId)) return undefined;
      const position = slice.stepsInSlice.indexOf(lastStep);
      const start = slice.stepsSlice?.startIndex;
      if (position < 0 || !Number.isSafeInteger(start) || start < 0) return undefined;
      const index = start + position;
      if (!Number.isSafeInteger(index) || (Number.isSafeInteger(slice.totalStepsLength) && index >= slice.totalStepsLength)) return undefined;
      // The API includes this step. Slice offsets remain correct on paged
      // history and on branches whose steps retain another trajectory's metadata.
      return { sourceCascadeId: id, forkAtStepIndex: index };
    }

    if (props.cascadeId) contextId = props.cascadeId;
    if (Array.isArray(props.trajectorySteps) && props.trajectorySteps.length === props.trajectoryLength) {
      fullTrajectory = props.trajectorySteps;
    }
    if (fiber.stateNode === view) break;
  }

  if (!responseSteps?.length || !contextId || (sourceCascadeId && contextId !== sourceCascadeId)) return undefined;
  const lastStep = responseSteps[responseSteps.length - 1];
  if (fullTrajectory) {
    const index = fullTrajectory.indexOf(lastStep);
    if (index >= 0) return { sourceCascadeId: contextId, forkAtStepIndex: index };
    return undefined;
  }

  // Older host versions expose only a response's step metadata. Use the final
  // step, never an earlier step or the -1 sentinel for copying the entire chat.
  const source = lastStep.metadata?.sourceTrajectoryStepInfo;
  if (source && Number.isSafeInteger(source.stepIndex) && source.stepIndex >= 0) {
    return { sourceCascadeId: contextId, forkAtStepIndex: source.stepIndex };
  }
  return undefined;
}

/* ── UI Element Decorators ───────────────────────────────────────────────── */
const USER_MESSAGE = '[data-testid="user-input-step"], [role="article"][aria-label="User message"], .user-input-buttons-container';
// Match conversation actions, so plugin controls such as "Delete Fork Chat" stay visible.
const NATIVE_FORK_BUTTON = '[data-testid="conversation-view"] button:is([aria-label="Fork" i], [aria-label="Fork Conversation" i], [aria-label^="Fork from " i]):not([data-fork-chat-btn]):not([data-fork-titlebar-btn])';
const TURN_ACTIONS = '.flex.w-full.items-start, [data-gemini-turn-actions="true"]';
const TURN_STRUCTURE = `${TURN_ACTIONS}, ${NATIVE_FORK_BUTTON}, button:is([aria-label="Copy"], [aria-label="Copied"], [aria-label="Good response"], [aria-label="Bad response"]), [role="article"]:not([aria-label="User message"]), div[title="Open side-by-side view"], div.w-full.bg-background.border-b.border-border`;

function hideNativeForkButton(button) {
  if (button.style.display !== "none") button.style.display = "none";
  if (button.getAttribute("data-fork-hidden") !== "true") button.setAttribute("data-fork-hidden", "true");
}

function decorateMenus(root = document.body) {
  if (!root || !root.querySelectorAll) return;
  const children = root.querySelectorAll('[role="menuitem"]');
  const menuItems = root.matches?.('[role="menuitem"]') ? [root, ...children] : children;
  for (let i = 0; i < menuItems.length; i += 1) {
    const item = menuItems[i];
    // Never hijack turn popovers, plugin modals, or turn-level fork targets
    if (
      item.closest(".bettergravity-fork-popover") ||
      item.closest(".bettergravity-fork-modal") ||
      item.hasAttribute("data-fork-popover-item") ||
      item.querySelector('[data-testid="fork-target-option"]') ||
      item.closest('[data-testid="fork-target-option"]')
    ) {
      continue;
    }
    const text = (item.textContent || "").trim();

    // 1. Reframe parent "Fork" menu item in the three dot menu as "Copy session"
    if (
      text === "Fork" ||
      text === "Copy session" ||
      (text.startsWith("Fork") && !text.includes("workspace") && !text.includes("worktree") && !text.includes("message") && !text.includes("conversation"))
    ) {
      const labelSpan = item.querySelector("span.min-w-0") || item.querySelector("span:not(.shrink-0)");
      if (labelSpan && (!item.dataset.forkCopyDecorated || !labelSpan.querySelector("svg"))) {
        item.dataset.forkCopyDecorated = "true";
        labelSpan.innerHTML = `${COPY_MENU_ICON_SVG}<span>Copy session</span>`;
      }
      const chevronSpan = item.querySelector("span.shrink-0");
      if (chevronSpan && (!item.dataset.forkChevronDecorated || !chevronSpan.querySelector("svg"))) {
        item.dataset.forkChevronDecorated = "true";
        chevronSpan.innerHTML = CHEVRON_RIGHT_SVG;
      }
    }

    // Unmask Terminal menu item icon if masked by fragile SVG mask
    if (text === "Terminal") {
      const svg = item.querySelector("svg");
      if (svg) {
        const mask = svg.querySelector("mask");
        if (mask) mask.remove();
        const g = svg.querySelector("g[mask]");
        if (g) g.removeAttribute("mask");
      }
    }

    // 2. Reframe submenu options:
    if (text.includes("current workspace") && !item.dataset.forkOptionDecorated) {
      item.dataset.forkOptionDecorated = "true";
      item.innerHTML = `${WORKSPACE_MENU_ICON_SVG}<span class="truncate">In current workspace</span>`;
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        const cascadeId = currentConversationId();
        const title = getConversationTitle(cascadeId);
        void runFork(cascadeId, -1, 1, title);
      }, true);
    } else if (text.includes("shared workspace") && !item.dataset.forkOptionDecorated) {
      item.dataset.forkOptionDecorated = "true";
      item.innerHTML = `${BRANCH_MENU_ICON_SVG}<span class="truncate">In shared workspace</span>`;
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        const cascadeId = currentConversationId();
        const title = getConversationTitle(cascadeId);
        void runFork(cascadeId, -1, 2, title);
      }, true);
    }
  }
}

function decorateTurnBar(bar) {
  if (!bar || bar.nodeType !== Node.ELEMENT_NODE || bar.closest(USER_MESSAGE)) return;

  // Only coordinate with Gemini App turn actions when Gemini App is active
  const isGeminiExperience =
    document.documentElement.hasAttribute("data-gemini-experience") ||
    Boolean(document.querySelector("[data-gemini-experience]"));
  if (isGeminiExperience && bar.getAttribute("data-gemini-turn-actions") !== "true") {
    bar.setAttribute("data-gemini-turn-actions", "true");
  }

  // Hide any native Antigravity fork button so only ONE fork button is visible under messages
  const nativeForks = bar.querySelectorAll(NATIVE_FORK_BUTTON);
  for (let i = 0; i < nativeForks.length; i += 1) {
    hideNativeForkButton(nativeForks[i]);
  }

  // Ensure only at most ONE of our fork buttons exists
  const existingBtns = bar.querySelectorAll("button[data-fork-chat-btn]");
  if (existingBtns.length > 0) {
    for (let i = 1; i < existingBtns.length; i += 1) {
      existingBtns[i].remove();
    }
    return;
  }

  // Target the buttons container: flex min-w-0 row, or copy wrapper
  const container =
    bar.querySelector(".flex.min-w-0.flex-wrap-reverse") ||
    bar.querySelector(".flex.min-w-0") ||
    bar.querySelector(".flex.shrink-0.items-end") ||
    bar;

  if (container.querySelector("button[data-fork-chat-btn]")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "bettergravity-fork-turn-btn";
  button.setAttribute("data-fork-chat-btn", "true");
  button.setAttribute("aria-label", "Fork from this response");
  button.title = "Fork conversation from this response";
  button.innerHTML = FORK_ICON_SVG;

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    const point = forkPointFromBar(bar);
    if (!point) {
      plugin.ui.toast({
        title: "Fork point unavailable",
        body: "Could not identify the end of this response. Please reopen the conversation and try again.",
        kind: "warning"
      });
      return;
    }
    if (settings.quickFork) {
      void runFork(point.sourceCascadeId, point.forkAtStepIndex, Number(settings.defaultTarget) || 1);
      return;
    }
    openTurnForkPopover(button, point.sourceCascadeId, point.forkAtStepIndex);
  });

  // Always append at the end so it renders after Copy and Like/Dislike
  container.append(button);
}

function removeTopBarIndicator(view) {
  const root = view || document;
  const banners = root.querySelectorAll(
    'div[title="Open side-by-side view"], div.w-full.bg-background.border-b.border-border'
  );
  for (let i = 0; i < banners.length; i += 1) {
    const b = banners[i];
    if (b.getAttribute("title") === "Open side-by-side view" || b.querySelector("span.select-none, [name='fork_left']")) {
      if (b.style.display !== "none") b.style.display = "none";
    }
  }
}

function scanAssistantTurns(view) {
  if (!view) return;

  // Hide any native fork buttons anywhere in view
  const nativeForks = view.querySelectorAll(NATIVE_FORK_BUTTON);
  for (let i = 0; i < nativeForks.length; i += 1) {
    hideNativeForkButton(nativeForks[i]);
  }

  // These paths can find the same bar through every feedback button, its
  // container and its article. Decorate each result once per pass.
  const turnBars = new Set();

  // 1. Direct scan across all feedback and copy buttons to reliably find every turn,
  // including in previous/past conversations regardless of utility class variations
  const actionBtns = view.querySelectorAll(
    'button:is([aria-label="Copy"], [aria-label="Copied"], [aria-label="Good response"], [aria-label="Bad response"])'
  );
  for (let i = 0; i < actionBtns.length; i += 1) {
    const btn = actionBtns[i];
    if (btn.closest(USER_MESSAGE) || btn.closest('.code-block') || btn.closest('pre')) {
      continue;
    }
    const bar = btn.closest('.flex.w-full.items-start') || btn.closest('.flex.min-w-0')?.parentElement;
    if (bar) {
      turnBars.add(bar);
    }
  }

  // 2. Structural scan across all message action bar containers
  const selector = ".flex.w-full.items-start, [data-gemini-turn-actions='true']";
  const bars = view.querySelectorAll(selector);
  for (let i = 0; i < bars.length; i += 1) {
    const bar = bars[i];
    if (bar.closest(USER_MESSAGE)) continue;
    turnBars.add(bar);
  }

  // 3. Scan across all agent response articles
  const articles = view.querySelectorAll('[role="article"][aria-label="Agent response"], [role="article"]:not([aria-label="User message"])');
  for (let i = 0; i < articles.length; i += 1) {
    const art = articles[i];
    if (art.closest(USER_MESSAGE)) continue;
    const bar = art.querySelector('.flex.w-full.items-start') || art.parentElement?.querySelector('.flex.w-full.items-start');
    if (bar) {
      turnBars.add(bar);
    }
  }
  for (const bar of turnBars) decorateTurnBar(bar);
}

function scanAll() {
  decorateMenus(document.body);
  const view = document.querySelector('[data-testid="conversation-view"]');
  if (view) {
    removeTopBarIndicator(view);
    scanAssistantTurns(view);
  }
}

/* ── Observers and SPA Navigation Lifecycle ──────────────────────────────── */
let bodyObserver = null;
let lastObservedUrl = typeof window !== "undefined" ? window.location?.href || "" : "";

function setupObservers() {
  let disposed = false;
  let scheduled = false;
  let scanFrame = 0;
  let boundScroller = null;
  let boundView = null;
  const retryTimers = new Set();
  const later = (callback, delay) => {
    const timer = setTimeout(() => {
      retryTimers.delete(timer);
      if (!disposed) callback();
    }, delay);
    retryTimers.add(timer);
  };
  const scheduleScan = () => {
    if (disposed || scheduled) return;
    scheduled = true;
    if (typeof requestAnimationFrame === "function") {
      scanFrame = requestAnimationFrame(() => {
        scanFrame = 0;
        scheduled = false;
        if (!disposed) {
          bindScroller();
          scanAll();
          // The scan has already accounted for pending DOM changes and its own
          // idempotent decoration. Do not schedule a second scan for those writes.
          turnObserver.takeRecords();
        }
      });
    } else {
      scheduled = false;
      bindScroller();
      scanAll();
      turnObserver.takeRecords();
    }
  };

  const onTurnChanges = (records) => {
    if (disposed) return;
    const relevant = records.some(record => {
      const target = record.target;
      if (target.closest?.(TURN_ACTIONS)) return true;
      if (record.type === "attributes") return target.matches(TURN_STRUCTURE);
      for (const nodes of [record.addedNodes, record.removedNodes]) {
        for (const node of nodes) {
          if (node.nodeType === Node.ELEMENT_NODE && (node.matches(TURN_STRUCTURE) || node.firstElementChild && node.querySelector(TURN_STRUCTURE))) return true;
        }
      }
      return false;
    });
    if (relevant) scheduleScan();
  };
  const turnObserver = new MutationObserver(onTurnChanges);
  // Scrolling only needs a scan if it coincides with changed controls, such as
  // paged history. A sent-message glide must not rescan every settled response.
  const onScroll = () => onTurnChanges(turnObserver.takeRecords());

  const bindScroller = () => {
    const view = document.querySelector('[data-testid="conversation-view"]');
    const scroller = view?.querySelector('.overflow-y-auto') || view;
    if (boundScroller === scroller && boundView === view) return;
    if (boundScroller) {
      boundScroller.removeEventListener("scroll", onScroll);
      delete boundScroller.dataset.hasForkScroll;
    }
    turnObserver.disconnect();
    boundView = view;
    boundScroller = scroller;
    if (view) turnObserver.observe(view, {
      subtree: true, childList: true, attributes: true,
      attributeFilter: ["class", "style", "aria-label", "data-testid", "data-gemini-turn-actions", "data-fork-chat-btn", "data-fork-hidden", "title", "role"]
    });
    if (scroller) {
      scroller.dataset.hasForkScroll = "true";
      scroller.addEventListener("scroll", onScroll, { passive: true });
    }
  };

  const scheduleRetries = () => {
    scheduleScan();
    bindScroller();
    // Past conversations load turns asynchronously over 100-3000ms
    for (const delay of [100, 300, 600, 1000, 1600, 2500]) {
      later(() => { scheduleScan(); bindScroller(); }, delay);
    }
  };

  const onNavChange = () => {
    if (disposed) return;
    const currentUrl = typeof window !== "undefined" ? window.location?.href || "" : "";
    if (currentUrl !== lastObservedUrl) {
      lastObservedUrl = currentUrl;
      scheduleRetries();
    }
  };

  // Intercept HTML5 History pushState and replaceState used by Antigravity's router
  const historyCleanups = [];
  if (typeof window !== "undefined" && window.history) {
    for (const method of ["pushState", "replaceState"]) {
      if (typeof window.history[method] !== "function") continue;
      // The shared patcher removes only this plugin's hook on reload, leaving
      // the browser's pane and navigation hooks installed on the same method.
      if (typeof plugin.patcher?.after === "function") {
        plugin.patcher.after(window.history, method, onNavChange);
        continue;
      }
      const original = window.history[method];
      const patched = function (...args) {
        const res = original.apply(this, args);
        onNavChange();
        return res;
      };
      window.history[method] = patched;
      historyCleanups.push(() => { if (window.history[method] === patched) window.history[method] = original; });
    }
  }

  bodyObserver = new MutationObserver((records) => {
    if (disposed) return;
    const menuRoots = new Set();
    let mountedConversation = false;
    // Immediately hide native Antigravity fork buttons synchronously before next paint
    for (let i = 0; i < records.length; i += 1) {
      const menu = records[i].target.closest?.('[role="menuitem"]');
      if (menu) menuRoots.add(menu);
      const added = records[i].addedNodes;
      for (let j = 0; j < added.length; j += 1) {
        const node = added[j];
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.matches('[data-testid="conversation-view"]') || node.firstElementChild && node.querySelector('[data-testid="conversation-view"]')) mountedConversation = true;
          if (node.matches(NATIVE_FORK_BUTTON)) {
            hideNativeForkButton(node);
          } else if (node.querySelectorAll) {
            const natives = node.querySelectorAll(NATIVE_FORK_BUTTON);
            for (let k = 0; k < natives.length; k += 1) {
              hideNativeForkButton(natives[k]);
            }
          }
          if (node.matches('[role="menuitem"]') || node.querySelector('[role="menuitem"]')) menuRoots.add(node);
        }
      }
    }

    for (const root of menuRoots) if (root.isConnected) decorateMenus(root);
    if (mountedConversation || boundView && !boundView.isConnected) {
      bindScroller();
      scheduleScan();
    }

    const currentUrl = typeof window !== "undefined" ? window.location?.href || "" : "";
    if (currentUrl && currentUrl !== lastObservedUrl) {
      lastObservedUrl = currentUrl;
      scheduleRetries();
      return;
    }

  });

  const attachObserver = () => {
    if (!bodyObserver || typeof document === "undefined") return;
    const target = document.body || document.documentElement;
    if (target) {
      try {
        bodyObserver.observe(target, { childList: true, subtree: true });
      } catch {}
    }
  };

  if (typeof document !== "undefined") {
    if (document.body || document.documentElement) {
      attachObserver();
    } else {
      document.addEventListener("DOMContentLoaded", attachObserver, { once: true });
    }
  }

  const onTitlebarMoreClick = (e) => {
    if (e.target?.closest?.('[data-testid="titlebar-more-actions"]')) {
      later(() => decorateMenus(document.body), 30);
      later(() => decorateMenus(document.body), 120);
      later(() => decorateMenus(document.body), 300);
    }
  };
  if (typeof document !== "undefined") {
    document.addEventListener("click", onTitlebarMoreClick, true);
    document.querySelectorAll("button[data-fork-titlebar-btn]").forEach((b) => b.remove());
  }

  if (typeof window !== "undefined") {
    window.addEventListener("popstate", onNavChange);
    window.addEventListener("hashchange", onNavChange);
  }

  // Periodic safety check to guarantee asynchronous past turns and scroller are decorated
  const periodicCheck = setInterval(() => {
    bindScroller();
    const view = document.querySelector('[data-testid="conversation-view"]');
    if (!view) return;
    const nativeForks = view.querySelectorAll(NATIVE_FORK_BUTTON);
    let needsScan = Array.from(nativeForks).some(button => button.style.display !== "none" || button.getAttribute("data-fork-hidden") !== "true");
    if (!needsScan) {
      const actionBars = view.querySelectorAll('.flex.w-full.items-start');
      for (let i = 0; i < actionBars.length; i += 1) {
        if (!actionBars[i].closest(USER_MESSAGE) && !actionBars[i].querySelector('button[data-fork-chat-btn]')) {
          needsScan = true;
          break;
        }
      }
    }
    if (needsScan) {
      scheduleScan();
    }
  }, 600);

  // Synchronous initial scan + retry schedule
  scanAll();
  bindScroller();
  scheduleRetries();

  plugin.onDispose(() => {
    disposed = true;
    if (scanFrame && typeof cancelAnimationFrame === "function") cancelAnimationFrame(scanFrame);
    for (const timer of retryTimers) clearTimeout(timer);
    retryTimers.clear();
    if (boundScroller) {
      boundScroller.removeEventListener("scroll", onScroll);
      delete boundScroller.dataset.hasForkScroll;
      boundScroller = null;
    }
    turnObserver.disconnect();
    boundView = null;
    bodyObserver?.disconnect();
    clearInterval(periodicCheck);
    if (typeof document !== "undefined") {
      document.removeEventListener("DOMContentLoaded", attachObserver);
      document.removeEventListener("click", onTitlebarMoreClick, true);
      document.querySelectorAll("button[data-fork-chat-btn], button[data-fork-titlebar-btn]").forEach((b) => b.remove());
    }
    if (typeof window !== "undefined" && window.history) {
      for (const cleanup of historyCleanups) cleanup();
      window.removeEventListener("popstate", onNavChange);
      window.removeEventListener("hashchange", onNavChange);
    }
    closeActivePopover();
  });
}

setupObservers();

/* ── Context Menu Contributor ────────────────────────────────────────────── */
plugin.ui.contextMenu((menu) => {
  if (!menu.has("conversation-rename-menu-item") && !menu.has("conversation-delete-menu-item")) {
    return undefined;
  }

  const row =
    menu.trigger?.closest('[data-cascade-id]') ||
    menu.trigger?.closest('[data-testid="conversation-row-sidebar"]');
  const cascadeId = row?.getAttribute("data-cascade-id") || "";
  if (!cascadeId) return undefined;

  const labelSpan = row?.querySelector("a[aria-label]");
  const title = labelSpan?.getAttribute("aria-label") || "this conversation";

  return [
    {
      label: "Fork conversation",
      icon: FORK_ICON_PATH,
      onSelect: () => {
        void runFork(cascadeId, -1, Number(settings.defaultTarget) || 1, title);
      }
    }
  ];
});

/* ── Global "Fork Any Chat" Modal ────────────────────────────────────────── */
function collectAllConversations() {
  const conversations = [];
  const seenIds = new Set();
  const store = findStore();

  if (store) {
    try {
      const state = store.getState();
      const summaries = state?.trajectorySummaries?.summaries || {};

      for (const [id, s] of Object.entries(summaries)) {
        if (!id || seenIds.has(id)) continue;
        seenIds.add(id);

        let updatedAtMs = 0;
        if (s?.lastModifiedTime?.seconds) {
          updatedAtMs = Number(s.lastModifiedTime.seconds) * 1000;
        } else if (s?.updatedAtMs) {
          updatedAtMs = Number(s.updatedAtMs);
        }

        const title = s?.summary || s?.title || "Untitled conversation";
        const stepCount = typeof s?.stepCount === "number" ? s.stepCount : 0;

        conversations.push({
          id,
          title,
          updatedAt: updatedAtMs,
          stepCount
        });
      }
    } catch {}
  }

  // Also harvest from rendered sidebar rows if any aren't in summaries
  for (const row of document.querySelectorAll('[data-testid="conversation-row-sidebar"]')) {
    const id = row.getAttribute("data-cascade-id");
    if (!id || seenIds.has(id)) continue;
    seenIds.add(id);
    const title =
      row.querySelector("a[aria-label]")?.getAttribute("aria-label") ||
      row.querySelector("span.truncate")?.textContent?.trim() ||
      "Conversation";
    conversations.push({
      id,
      title,
      updatedAt: 0,
      stepCount: 0
    });
  }

  conversations.sort((a, b) => b.updatedAt - a.updatedAt);
  return conversations;
}

let activeModal = null;

function openForkModal() {
  activeModal?.close();

  const currentId = currentConversationId();
  const allConversations = collectAllConversations();
  let selectedId = currentId || allConversations[0]?.id || "";
  let selectedTarget = Number(settings.defaultTarget) || 1;
  const forkAtTurn = -1; // -1 = latest

  activeModal = plugin.ui.modal({
    title: "Fork Conversation",
    description: "Branch any conversation from your history into an isolated workspace or current project.",
    width: 520,
    render(body, close) {
      const root = document.createElement("div");
      root.className = "bettergravity-fork-modal";

      // Current selection banner
      const banner = document.createElement("div");
      banner.className = "bettergravity-fork-modal__banner";
      const bannerTitle = document.createElement("span");
      bannerTitle.className = "bettergravity-fork-modal__banner-title";
      const bannerSub = document.createElement("span");
      bannerSub.className = "bettergravity-fork-modal__banner-sub";
      banner.append(bannerTitle, bannerSub);

      const updateBanner = () => {
        const item = allConversations.find((c) => c.id === selectedId);
        const name = item ? item.title : (selectedId ? `Thread ${selectedId.slice(0, 8)}` : "None");
        bannerTitle.textContent = `Selected: ${name}`;
        bannerSub.textContent = selectedId === currentId ? "Active conversation on screen" : `ID: ${selectedId}`;
      };
      updateBanner();

      // Search and list section
      const listSection = document.createElement("div");
      listSection.className = "bettergravity-fork-modal__section";
      const searchInput = document.createElement("input");
      searchInput.type = "text";
      searchInput.className = "bettergravity-fork-modal__search";
      searchInput.placeholder = allConversations.length > 0
        ? `Search all ${allConversations.length} conversations...`
        : "Search conversations to fork...";

      const list = document.createElement("div");
      list.className = "bettergravity-fork-modal__list";

      const renderList = (filter = "") => {
        list.replaceChildren();
        const term = filter.toLowerCase().trim();
        const filtered = allConversations.filter(
          (c) => !term || c.title.toLowerCase().includes(term) || c.id.includes(term)
        );

        if (filtered.length === 0) {
          const empty = document.createElement("div");
          empty.style.padding = "16px";
          empty.style.textAlign = "center";
          empty.style.color = "var(--muted-foreground, #94a3b8)";
          empty.textContent = "No matching conversations found.";
          list.append(empty);
          return;
        }

        for (const conv of filtered) {
          const item = document.createElement("button");
          item.type = "button";
          item.className = `bettergravity-fork-modal__item ${conv.id === selectedId ? "is-selected" : ""}`;

          const title = document.createElement("span");
          title.className = "bettergravity-fork-modal__item-title";
          title.textContent = conv.title;

          const meta = document.createElement("span");
          meta.className = "bettergravity-fork-modal__item-meta";
          const stepText = conv.stepCount > 0 ? ` · ${conv.stepCount} steps` : "";
          meta.textContent = (conv.id === currentId ? "Current" : conv.id.slice(0, 8)) + stepText;

          item.append(title, meta);
          item.addEventListener("click", () => {
            selectedId = conv.id;
            updateBanner();
            renderList(searchInput.value);
          });
          list.append(item);
        }
      };

      searchInput.addEventListener("input", () => renderList(searchInput.value));
      renderList();
      listSection.append(searchInput, list);

      // Target workspace chips
      const targetSection = document.createElement("div");
      targetSection.className = "bettergravity-fork-modal__section";
      const targetLabel = document.createElement("span");
      targetLabel.className = "bettergravity-fork-modal__label";
      targetLabel.textContent = "Destination Workspace";

      const chips = document.createElement("div");
      chips.className = "bettergravity-fork-modal__chips";

      const currentChip = document.createElement("button");
      currentChip.type = "button";
      currentChip.className = `bettergravity-fork-modal__chip ${selectedTarget === 1 ? "is-active" : ""}`;
      currentChip.innerHTML = `<span class="bettergravity-fork-modal__chip-title">Current Workspace</span><span class="bettergravity-fork-modal__chip-desc">Continues inside the current folder</span>`;

      const worktreeChip = document.createElement("button");
      worktreeChip.type = "button";
      worktreeChip.className = `bettergravity-fork-modal__chip ${selectedTarget === 2 ? "is-active" : ""}`;
      worktreeChip.innerHTML = `<span class="bettergravity-fork-modal__chip-title">Shared Worktree</span><span class="bettergravity-fork-modal__chip-desc">Creates an isolated git branch and worktree</span>`;

      currentChip.addEventListener("click", () => {
        selectedTarget = 1;
        currentChip.classList.add("is-active");
        worktreeChip.classList.remove("is-active");
      });

      worktreeChip.addEventListener("click", () => {
        selectedTarget = 2;
        worktreeChip.classList.add("is-active");
        currentChip.classList.remove("is-active");
      });

      chips.append(currentChip, worktreeChip);
      targetSection.append(targetLabel, chips);

      // Actions footer
      const actions = document.createElement("div");
      actions.className = "bettergravity-fork-modal__actions";

      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "bettergravity-fork-modal__btn bettergravity-fork-modal__btn--secondary";
      cancelBtn.textContent = "Cancel";
      cancelBtn.addEventListener("click", () => close());

      const submitBtn = document.createElement("button");
      submitBtn.type = "button";
      submitBtn.className = "bettergravity-fork-modal__btn bettergravity-fork-modal__btn--primary";
      submitBtn.textContent = "Fork Chat";

      submitBtn.addEventListener("click", async () => {
        if (!selectedId) return;
        submitBtn.disabled = true;
        cancelBtn.disabled = true;
        submitBtn.innerHTML = '<span class="bettergravity-fork-modal__spinner"></span><span>Forking...</span>';
        try {
          const selectedConv = allConversations.find((c) => c.id === selectedId);
          await runFork(selectedId, forkAtTurn, selectedTarget, selectedConv?.title);
          close();
        } finally {
          submitBtn.disabled = false;
          cancelBtn.disabled = false;
          submitBtn.textContent = "Fork Chat";
        }
      });

      actions.append(cancelBtn, submitBtn);

      root.append(banner, listSection, targetSection, actions);
      body.append(root);
    },
    onClose() {
      activeModal = null;
    }
  });
}
