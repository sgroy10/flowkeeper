/**
 * SpecLock Conflict Detection Module
 * Conflict checking, drift detection, lock suggestions, audit.
 * Extracted from engine.js for modularity.
 *
 * Developed by Sandeep Roy (https://github.com/sgroy10)
 */

import fs from "fs";
import path from "path";
import {
  nowIso,
  readBrain,
  writeBrain,
  readEvents,
  addViolation,
} from "./storage.js";
import { getStagedFiles } from "./git.js";
import { analyzeConflict } from "./semantics.js";
import { ensureInit } from "./memory.js";

// --- Legacy helpers (kept for pre-commit audit backward compat) ---

const NEGATION_WORDS = ["no", "not", "never", "without", "dont", "don't", "cannot", "can't", "shouldn't", "mustn't", "avoid", "prevent", "prohibit", "forbid", "disallow"];

function hasNegation(text) {
  const lower = text.toLowerCase();
  return NEGATION_WORDS.some((neg) => lower.includes(neg));
}

const FILE_KEYWORD_PATTERNS = [
  { keywords: ["auth", "authentication", "login", "signup", "signin", "sign-in", "sign-up"], patterns: ["**/Auth*", "**/auth*", "**/Login*", "**/login*", "**/SignUp*", "**/signup*", "**/SignIn*", "**/signin*", "**/*Auth*", "**/*auth*"] },
  { keywords: ["database", "db", "supabase", "firebase", "mongo", "postgres", "sql", "prisma"], patterns: ["**/supabase*", "**/firebase*", "**/database*", "**/db.*", "**/db/**", "**/prisma/**", "**/*Client*", "**/*client*"] },
  { keywords: ["payment", "pay", "stripe", "billing", "checkout", "subscription"], patterns: ["**/payment*", "**/Payment*", "**/pay*", "**/Pay*", "**/stripe*", "**/Stripe*", "**/billing*", "**/Billing*", "**/checkout*", "**/Checkout*"] },
  { keywords: ["api", "endpoint", "route", "routes"], patterns: ["**/api/**", "**/routes/**", "**/endpoints/**"] },
  { keywords: ["config", "configuration", "settings", "env"], patterns: ["**/config*", "**/Config*", "**/settings*", "**/Settings*"] },
];

function patternMatchesFile(pattern, filePath) {
  const clean = pattern.replace(/\\/g, "/");
  const fileLower = filePath.toLowerCase();
  const patternLower = clean.toLowerCase();
  const namePattern = patternLower.replace(/^\*\*\//, "");
  if (!namePattern.includes("/")) {
    const fileName = fileLower.split("/").pop();
    const regex = new RegExp("^" + namePattern.replace(/\*/g, ".*") + "$");
    if (regex.test(fileName)) return true;
    const corePattern = namePattern.replace(/\*/g, "");
    if (corePattern.length > 2 && fileName.includes(corePattern)) return true;
  }
  const regex = new RegExp("^" + patternLower.replace(/\*\*\//g, "(.*/)?").replace(/\*/g, "[^/]*") + "$");
  return regex.test(fileLower);
}

const GUARD_TAG = "SPECLOCK-GUARD";

// --- Core functions ---

export function checkConflict(root, proposedAction) {
  const brain = ensureInit(root);
  const activeLocks = brain.specLock.items.filter((l) => l.active !== false);
  if (activeLocks.length === 0) {
    return {
      hasConflict: false,
      conflictingLocks: [],
      analysis: "No active locks. No constraints to check against.",
    };
  }

  const conflicting = [];
  for (const lock of activeLocks) {
    const result = analyzeConflict(proposedAction, lock.text);
    if (result.isConflict) {
      conflicting.push({
        id: lock.id,
        text: lock.text,
        matchedKeywords: [],
        confidence: result.confidence,
        level: result.level,
        reasons: result.reasons,
      });
    }
  }

  if (conflicting.length === 0) {
    return {
      hasConflict: false,
      conflictingLocks: [],
      analysis: `Checked against ${activeLocks.length} active lock(s). No conflicts detected (semantic analysis v2). Proceed with caution.`,
    };
  }

  conflicting.sort((a, b) => b.confidence - a.confidence);

  const details = conflicting
    .map(
      (c) =>
        `- [${c.level}] "${c.text}" (confidence: ${c.confidence}%)\n  Reasons: ${c.reasons.join("; ")}`
    )
    .join("\n");

  const result = {
    hasConflict: true,
    conflictingLocks: conflicting,
    analysis: `Potential conflict with ${conflicting.length} lock(s):\n${details}\nReview before proceeding.`,
  };

  addViolation(brain, {
    at: nowIso(),
    action: proposedAction,
    locks: conflicting.map((c) => ({ id: c.id, text: c.text, confidence: c.confidence, level: c.level })),
    topLevel: conflicting[0].level,
    topConfidence: conflicting[0].confidence,
  });
  writeBrain(root, brain);

  return result;
}

export async function checkConflictAsync(root, proposedAction) {
  try {
    const { llmCheckConflict } = await import("./llm-checker.js");
    const llmResult = await llmCheckConflict(root, proposedAction);
    if (llmResult) return llmResult;
  } catch (_) {
    // LLM checker not available — fall through
  }
  return checkConflict(root, proposedAction);
}

export function suggestLocks(root) {
  const brain = ensureInit(root);
  const suggestions = [];

  for (const dec of brain.decisions) {
    const lower = dec.text.toLowerCase();
    if (/\b(always|must|only|exclusively|never|required)\b/.test(lower)) {
      suggestions.push({
        text: dec.text,
        source: "decision",
        sourceId: dec.id,
        reason: `Decision contains strong commitment language — consider promoting to a lock`,
      });
    }
  }

  for (const note of brain.notes) {
    const lower = note.text.toLowerCase();
    if (/\b(never|must not|do not|don't|avoid|prohibit|forbidden)\b/.test(lower)) {
      suggestions.push({
        text: note.text,
        source: "note",
        sourceId: note.id,
        reason: `Note contains prohibitive language — consider promoting to a lock`,
      });
    }
  }

  const existingLockTexts = brain.specLock.items
    .filter((l) => l.active)
    .map((l) => l.text.toLowerCase());

  const commonPatterns = [
    { keyword: "api", suggestion: "No breaking changes to public API" },
    { keyword: "database", suggestion: "No destructive database migrations without backup" },
    { keyword: "deploy", suggestion: "All deployments must pass CI checks" },
    { keyword: "security", suggestion: "No secrets or credentials in source code" },
    { keyword: "test", suggestion: "No merging without passing tests" },
  ];

  const allText = [
    brain.goal.text,
    ...brain.decisions.map((d) => d.text),
    ...brain.notes.map((n) => n.text),
  ].join(" ").toLowerCase();

  for (const pattern of commonPatterns) {
    if (allText.includes(pattern.keyword)) {
      const alreadyLocked = existingLockTexts.some((t) =>
        t.includes(pattern.keyword)
      );
      if (!alreadyLocked) {
        suggestions.push({
          text: pattern.suggestion,
          source: "pattern",
          sourceId: null,
          reason: `Project mentions "${pattern.keyword}" but has no lock protecting it`,
        });
      }
    }
  }

  return { suggestions, totalLocks: brain.specLock.items.filter((l) => l.active).length };
}

export function detectDrift(root) {
  const brain = ensureInit(root);
  const activeLocks = brain.specLock.items.filter((l) => l.active !== false);
  if (activeLocks.length === 0) {
    return { drifts: [], status: "no_locks", message: "No active locks to check against." };
  }

  const drifts = [];

  for (const change of brain.state.recentChanges) {
    for (const lock of activeLocks) {
      const result = analyzeConflict(change.summary, lock.text);
      if (result.isConflict) {
        drifts.push({
          lockId: lock.id,
          lockText: lock.text,
          changeEventId: change.eventId,
          changeSummary: change.summary,
          changeAt: change.at,
          matchedTerms: result.reasons,
          severity: result.level === "HIGH" ? "high" : "medium",
        });
      }
    }
  }

  for (const revert of brain.state.reverts) {
    drifts.push({
      lockId: null,
      lockText: "(git revert detected)",
      changeEventId: revert.eventId,
      changeSummary: `Git ${revert.kind} to ${revert.target.substring(0, 12)}`,
      changeAt: revert.at,
      matchedTerms: ["revert"],
      severity: "high",
    });
  }

  const status = drifts.length === 0 ? "clean" : "drift_detected";
  const message = drifts.length === 0
    ? `All clear. ${activeLocks.length} lock(s) checked against ${brain.state.recentChanges.length} recent change(s). No drift detected.`
    : `WARNING: ${drifts.length} potential drift(s) detected. Review immediately.`;

  return { drifts, status, message };
}

export function generateReport(root) {
  const brain = ensureInit(root);
  const violations = brain.state.violations || [];

  if (violations.length === 0) {
    return {
      totalViolations: 0,
      violationsByLock: {},
      mostTestedLocks: [],
      recentViolations: [],
      summary: "No violations recorded yet. SpecLock is watching.",
    };
  }

  const byLock = {};
  for (const v of violations) {
    for (const lock of v.locks) {
      if (!byLock[lock.text]) {
        byLock[lock.text] = { count: 0, lockId: lock.id, text: lock.text };
      }
      byLock[lock.text].count++;
    }
  }

  const mostTested = Object.values(byLock).sort((a, b) => b.count - a.count);
  const recent = violations.slice(0, 10).map((v) => ({
    at: v.at,
    action: v.action,
    topLevel: v.topLevel,
    topConfidence: v.topConfidence,
    lockCount: v.locks.length,
  }));

  const oldest = violations[violations.length - 1];
  const newest = violations[0];

  return {
    totalViolations: violations.length,
    timeRange: { from: oldest.at, to: newest.at },
    violationsByLock: byLock,
    mostTestedLocks: mostTested.slice(0, 5),
    recentViolations: recent,
    summary: `SpecLock blocked ${violations.length} violation(s). Most tested lock: "${mostTested[0].text}" (${mostTested[0].count} blocks).`,
  };
}

export function auditStagedFiles(root) {
  const brain = ensureInit(root);
  const activeLocks = brain.specLock.items.filter((l) => l.active !== false);

  if (activeLocks.length === 0) {
    return { passed: true, violations: [], checkedFiles: 0, activeLocks: 0, message: "No active locks. Audit passed." };
  }

  const stagedFiles = getStagedFiles(root);
  if (stagedFiles.length === 0) {
    return { passed: true, violations: [], checkedFiles: 0, activeLocks: activeLocks.length, message: "No staged files. Audit passed." };
  }

  const violations = [];

  for (const file of stagedFiles) {
    const fullPath = path.join(root, file);
    if (fs.existsSync(fullPath)) {
      try {
        const content = fs.readFileSync(fullPath, "utf-8");
        if (content.includes(GUARD_TAG)) {
          violations.push({
            file,
            reason: "File has SPECLOCK-GUARD header — it is locked and must not be modified",
            lockText: "(file-level guard)",
            severity: "HIGH",
          });
          continue;
        }
      } catch (_) {}
    }

    const fileLower = file.toLowerCase();
    for (const lock of activeLocks) {
      const lockLower = lock.text.toLowerCase();
      const lockHasNegation = hasNegation(lockLower);
      if (!lockHasNegation) continue;

      for (const group of FILE_KEYWORD_PATTERNS) {
        const lockMatchesKeyword = group.keywords.some((kw) => lockLower.includes(kw));
        if (!lockMatchesKeyword) continue;

        const fileMatchesPattern = group.patterns.some((pattern) => patternMatchesFile(pattern, fileLower) || patternMatchesFile(pattern, fileLower.split("/").pop()));
        if (fileMatchesPattern) {
          violations.push({
            file,
            reason: `File matches lock keyword pattern`,
            lockText: lock.text,
            severity: "MEDIUM",
          });
          break;
        }
      }
    }
  }

  const seen = new Set();
  const unique = violations.filter((v) => {
    if (seen.has(v.file)) return false;
    seen.add(v.file);
    return true;
  });

  const passed = unique.length === 0;
  const message = passed
    ? `Audit passed. ${stagedFiles.length} file(s) checked against ${activeLocks.length} lock(s).`
    : `AUDIT FAILED: ${unique.length} violation(s) in ${stagedFiles.length} staged file(s).`;

  return {
    passed,
    violations: unique,
    checkedFiles: stagedFiles.length,
    activeLocks: activeLocks.length,
    message,
  };
}
