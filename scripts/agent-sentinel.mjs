// Deterministic Agent Sentinel & Output Condenser
// Designed for AI Coding Assistants (Antigravity, Claude Code, Cursor) and CI.
// Intercepts and condenses noisy CLI outputs into compact, high-SNR cards.

import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const root = path.dirname(import.meta.dirname);
const args = process.argv.slice(2);
const isFull = args.includes("--full");

function runStep(name, cmd, cmdArgs) {
  const startTime = Date.now();
  const res = spawnSync(cmd, cmdArgs, {
    cwd: root,
    encoding: "utf-8",
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  if (res.status !== 0) {
    const rawOut = (res.stdout || "") + "\n" + (res.stderr || "");
    const errorLines = rawOut
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => /error|fail|exception|invalid|missing/i.test(l) && !l.startsWith("note"))
      .slice(0, 8);

    const displayErrors = errorLines.length > 0 ? errorLines.join("\n  ") : rawOut.trim().slice(-400);

    console.error(`\n[SENTINEL FAIL] Step "${name}" failed (Exit code: ${res.status}) [${duration}s]:\n  ${displayErrors}`);
    process.exit(res.status || 1);
  }

  return { name, duration };
}

console.log(">>> [AGENT SENTINEL] Running deterministic verification pipeline...");

const results = [];
try {
  // 1. Structure integrity
  results.push(runStep("Structure Integrity", "node", ["scripts/verify-structure.mjs"]));

  // 2. Links verification
  results.push(runStep("Links Integrity", "node", ["scripts/verify-links.mjs"]));

  // 3. Community plugins & catalog check
  results.push(runStep("Community Catalog", "node", ["scripts/community.mjs", "check"]));

  // 4. If full mode requested, run typecheck & tests
  if (isFull) {
    results.push(runStep("TypeScript Types", "pnpm", ["typecheck"]));
    results.push(runStep("Unit Tests", "pnpm", ["test"]));
  }

  // Condensed high-SNR success card
  console.log("\n[SENTINEL PASS] All verification targets passed cleanly.");
  for (const r of results) {
    console.log(`  - ${r.name}: OK (${r.duration}s)`);
  }
  process.exit(0);
} catch (err) {
  console.error(`\n[SENTINEL FATAL] Unexpected runner error: ${err.message}`);
  process.exit(1);
}
