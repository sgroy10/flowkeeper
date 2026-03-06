import fs from "fs";
import path from "path";
import {
  speclockDir,
  readBrain,
  newId,
  nowIso,
  appendEvent,
  bumpEvents,
  writeBrain,
} from "./storage.js";
import { captureStatus } from "./git.js";
import { ensureInit } from "./engine.js";

// Generate structured context pack as a JavaScript object
export function generateContextPack(root) {
  const brain = ensureInit(root);
  const status = brain.facts.repo.hasGit ? captureStatus(root) : null;

  const activeLocks = brain.specLock.items.filter((l) => l.active !== false);

  return {
    project: {
      name: brain.project.name,
      root: brain.project.root,
      branch: status ? status.branch : "",
      commit: status ? status.commit : "",
    },
    goal: brain.goal.text || "",
    locks: activeLocks.slice(0, 15).map((l) => ({
      id: l.id,
      text: l.originalText || l.text,
      engineText: l.originalText ? l.text : undefined,
      createdAt: l.createdAt,
      source: l.source,
    })),
    decisions: brain.decisions.slice(0, 12).map((d) => ({
      id: d.id,
      text: d.text,
      createdAt: d.createdAt,
      source: d.source,
    })),
    deployFacts: { ...brain.facts.deploy },
    recentChanges: brain.state.recentChanges.slice(0, 20),
    reverts: brain.state.reverts.slice(0, 10),
    lastSession:
      brain.sessions.history.length > 0 ? brain.sessions.history[0] : null,
    currentSession: brain.sessions.current || null,
    notes: brain.notes
      .filter((n) => n.pinned)
      .slice(0, 10)
      .map((n) => ({ id: n.id, text: n.text })),
    generatedAt: nowIso(),
  };
}

// Generate markdown context pack + write to file
export function generateContext(root) {
  const brain = ensureInit(root);
  const pack = generateContextPack(root);
  const contextPath = path.join(
    speclockDir(root),
    "context",
    "latest.md"
  );

  const lines = [];

  // Header
  lines.push("# SpecLock Context Pack");
  lines.push(`> Generated: ${pack.generatedAt}`);
  lines.push(`> Project: **${pack.project.name}**`);
  if (pack.project.branch) {
    lines.push(
      `> Repo: branch \`${pack.project.branch}\` @ \`${pack.project.commit}\``
    );
  }
  lines.push("");

  // Goal
  lines.push("## Goal");
  lines.push(pack.goal || "*(No goal set — consider setting one)*");
  lines.push("");

  // SpecLocks — HIGH PRIORITY
  lines.push("## SpecLock (Non-Negotiables)");
  if (pack.locks.length > 0) {
    lines.push(
      "> **These constraints MUST be followed. Do not violate any lock.**"
    );
    for (const lock of pack.locks) {
      lines.push(`- **[LOCK]** ${lock.text} _(${lock.source}, ${lock.createdAt.substring(0, 10)})_`);
      if (lock.engineText) {
        lines.push(`  - _Engine uses: "${lock.engineText}"_`);
      }
    }
  } else {
    lines.push("- *(No locks defined — consider adding constraints)*");
  }
  lines.push("");

  // Decisions
  lines.push("## Key Decisions");
  if (pack.decisions.length > 0) {
    for (const dec of pack.decisions) {
      lines.push(`- **[DEC]** ${dec.text} _(${dec.source}, ${dec.createdAt.substring(0, 10)})_`);
    }
  } else {
    lines.push("- *(No decisions recorded)*");
  }
  lines.push("");

  // Deploy Facts
  if (pack.deployFacts.provider !== "unknown") {
    lines.push("## Deploy Facts");
    lines.push(`- Provider: **${pack.deployFacts.provider}**`);
    if (pack.deployFacts.branch)
      lines.push(`- Branch: \`${pack.deployFacts.branch}\``);
    lines.push(`- Auto-deploy: ${pack.deployFacts.autoDeploy ? "Yes" : "No"}`);
    if (pack.deployFacts.url) lines.push(`- URL: ${pack.deployFacts.url}`);
    if (pack.deployFacts.notes) lines.push(`- Notes: ${pack.deployFacts.notes}`);
    lines.push("");
  }

  // Recent Changes
  lines.push("## Recent Changes");
  if (pack.recentChanges.length > 0) {
    for (const ch of pack.recentChanges.slice(0, 20)) {
      const files =
        ch.files && ch.files.length > 0 ? ` (${ch.files.join(", ")})` : "";
      lines.push(`- [${ch.at.substring(0, 19)}] ${ch.summary}${files}`);
    }
  } else {
    lines.push("- *(No changes tracked yet)*");
  }
  lines.push("");

  // Reverts — CRITICAL
  if (pack.reverts.length > 0) {
    lines.push("## ⚠ Reverts Detected");
    lines.push(
      "> **WARNING: Git reverts/checkouts were detected. Verify current state before proceeding.**"
    );
    for (const rev of pack.reverts) {
      lines.push(
        `- [REVERT] ${rev.kind} to \`${rev.target.substring(0, 12)}\` at ${rev.at.substring(0, 19)}`
      );
    }
    lines.push("");
  }

  // Session History
  if (pack.lastSession) {
    lines.push("## Last Session");
    lines.push(`- Tool: **${pack.lastSession.toolUsed}**`);
    lines.push(`- Ended: ${pack.lastSession.endedAt || "still active"}`);
    if (pack.lastSession.summary)
      lines.push(`- Summary: ${pack.lastSession.summary}`);
    lines.push(
      `- Events in session: ${pack.lastSession.eventsInSession || 0}`
    );
    lines.push("");
  }

  // Pinned Notes
  if (pack.notes.length > 0) {
    lines.push("## Pinned Notes");
    for (const note of pack.notes) {
      lines.push(`- **[NOTE]** ${note.text}`);
    }
    lines.push("");
  }

  // Agent Instructions
  lines.push("## Agent Instructions");
  lines.push("1. Follow ALL SpecLock items strictly — they are non-negotiable.");
  lines.push("2. Do not contradict recorded decisions without explicit user approval.");
  lines.push("3. If you detect drift from constraints, stop and flag it.");
  lines.push("4. Call `speclock_detect_drift` proactively to check for constraint violations.");
  lines.push("5. Call `speclock_get_context` to refresh this context at any time.");
  lines.push("6. Call `speclock_session_summary` before ending your session.");
  lines.push("");
  lines.push("---");
  lines.push("*Powered by [SpecLock](https://github.com/sgroy10/speclock) — Developed by Sandeep Roy*");
  lines.push("");

  const markdown = lines.join("\n");
  fs.writeFileSync(contextPath, markdown);

  // Record the generation event
  const eventId = newId("evt");
  const event = {
    eventId,
    type: "context_generated",
    at: nowIso(),
    files: [".speclock/context/latest.md"],
    summary: "Generated context pack",
    patchPath: "",
  };
  bumpEvents(brain, eventId);
  appendEvent(root, event);
  writeBrain(root, brain);

  return markdown;
}
