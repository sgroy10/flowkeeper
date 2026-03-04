/**
 * SpecLock Semantic Pre-Commit Engine
 * Replaces filename-only pre-commit with actual code-level semantic analysis.
 *
 * Parses git diff output, extracts code changes per file, and runs
 * analyzeConflict() against each change block + active locks.
 *
 * Developed by Sandeep Roy (https://github.com/sgroy10)
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { readBrain } from "./storage.js";
import { analyzeConflict } from "./semantics.js";
import { getEnforcementConfig } from "./enforcer.js";

const GUARD_TAG = "SPECLOCK-GUARD";
const MAX_LINES_PER_FILE = 500;
const BINARY_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "bmp", "ico", "svg", "webp",
  "mp3", "mp4", "wav", "avi", "mov", "mkv",
  "zip", "tar", "gz", "rar", "7z",
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
  "exe", "dll", "so", "dylib", "bin",
  "woff", "woff2", "ttf", "eot", "otf",
  "lock", "map",
]);

/**
 * Parse a unified diff into per-file change blocks.
 * Returns array of { file, addedLines, removedLines, hunks }.
 */
export function parseDiff(diffText) {
  if (!diffText || !diffText.trim()) return [];

  const files = [];
  const fileSections = diffText.split(/^diff --git /m).filter(Boolean);

  for (const section of fileSections) {
    const lines = section.split("\n");

    // Extract filename from "a/path b/path"
    const headerMatch = lines[0]?.match(/a\/(.+?) b\/(.+)/);
    if (!headerMatch) continue;

    const file = headerMatch[2];
    const ext = path.extname(file).slice(1).toLowerCase();

    // Skip binary files
    if (BINARY_EXTENSIONS.has(ext)) continue;
    if (section.includes("Binary files")) continue;

    const addedLines = [];
    const removedLines = [];
    const hunks = [];
    let currentHunk = null;
    let lineCount = 0;

    for (const line of lines) {
      if (lineCount >= MAX_LINES_PER_FILE) break;

      if (line.startsWith("@@")) {
        // New hunk
        const hunkMatch = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)/);
        if (hunkMatch) {
          currentHunk = {
            oldStart: parseInt(hunkMatch[1]),
            newStart: parseInt(hunkMatch[3]),
            context: hunkMatch[5]?.trim() || "",
            changes: [],
          };
          hunks.push(currentHunk);
        }
        continue;
      }

      if (!currentHunk) continue;

      if (line.startsWith("+") && !line.startsWith("+++")) {
        const content = line.substring(1).trim();
        if (content) {
          addedLines.push(content);
          currentHunk.changes.push({ type: "add", content });
          lineCount++;
        }
      } else if (line.startsWith("-") && !line.startsWith("---")) {
        const content = line.substring(1).trim();
        if (content) {
          removedLines.push(content);
          currentHunk.changes.push({ type: "remove", content });
          lineCount++;
        }
      }
    }

    if (addedLines.length > 0 || removedLines.length > 0) {
      files.push({ file, addedLines, removedLines, hunks });
    }
  }

  return files;
}

/**
 * Get the staged diff from git.
 */
export function getStagedDiff(root) {
  try {
    return execSync("git diff --cached --unified=3", {
      cwd: root,
      encoding: "utf-8",
      maxBuffer: 5 * 1024 * 1024, // 5MB
      timeout: 10000,
    });
  } catch {
    return "";
  }
}

/**
 * Build a semantic summary of changes in a file for conflict checking.
 * Combines added/removed lines into meaningful phrases.
 */
function buildChangeSummary(fileChanges) {
  const summaries = [];

  // Summarize removals (deletions are more dangerous)
  if (fileChanges.removedLines.length > 0) {
    const sample = fileChanges.removedLines.slice(0, 10).join(" ");
    summaries.push(`Removing code: ${sample}`);
  }

  // Summarize additions
  if (fileChanges.addedLines.length > 0) {
    const sample = fileChanges.addedLines.slice(0, 10).join(" ");
    summaries.push(`Adding code: ${sample}`);
  }

  // Add hunk contexts (function names, class names)
  for (const hunk of fileChanges.hunks) {
    if (hunk.context) {
      summaries.push(`In context: ${hunk.context}`);
    }
  }

  return summaries.join(". ");
}

/**
 * Run semantic pre-commit audit.
 * Parses the staged diff, analyzes each file's changes against locks.
 */
export function semanticAudit(root) {
  const brain = readBrain(root);
  if (!brain) {
    return {
      passed: true,
      violations: [],
      filesChecked: 0,
      activeLocks: 0,
      mode: "advisory",
      message: "SpecLock not initialized. Audit skipped.",
    };
  }

  const config = getEnforcementConfig(brain);
  const activeLocks = (brain.specLock?.items || []).filter((l) => l.active !== false);

  if (activeLocks.length === 0) {
    return {
      passed: true,
      violations: [],
      filesChecked: 0,
      activeLocks: 0,
      mode: config.mode,
      message: "No active locks. Semantic audit passed.",
    };
  }

  // Get staged diff
  const diff = getStagedDiff(root);
  if (!diff) {
    return {
      passed: true,
      violations: [],
      filesChecked: 0,
      activeLocks: activeLocks.length,
      mode: config.mode,
      message: "No staged changes. Semantic audit passed.",
    };
  }

  // Parse diff into per-file changes
  const fileChanges = parseDiff(diff);
  const violations = [];

  for (const fc of fileChanges) {
    // Check 1: Guard tag violation
    const fullPath = path.join(root, fc.file);
    if (fs.existsSync(fullPath)) {
      try {
        const content = fs.readFileSync(fullPath, "utf-8");
        if (content.includes(GUARD_TAG)) {
          violations.push({
            file: fc.file,
            lockId: null,
            lockText: "(file-level guard)",
            confidence: 100,
            level: "HIGH",
            reason: "File has SPECLOCK-GUARD header — it is locked and must not be modified",
            source: "guard",
          });
          continue; // Don't double-report guarded files
        }
      } catch { /* file read error, continue */ }
    }

    // Check 2: Semantic analysis of code changes against each lock
    const changeSummary = buildChangeSummary(fc);
    if (!changeSummary) continue;

    // Prepend file path for context
    const fullSummary = `Modifying file ${fc.file}: ${changeSummary}`;

    for (const lock of activeLocks) {
      const result = analyzeConflict(fullSummary, lock.text);

      if (result.isConflict) {
        violations.push({
          file: fc.file,
          lockId: lock.id,
          lockText: lock.text,
          confidence: result.confidence,
          level: result.level,
          reason: result.reasons.join("; "),
          source: "semantic",
          addedLines: fc.addedLines.length,
          removedLines: fc.removedLines.length,
        });
      }
    }
  }

  // Deduplicate: keep highest confidence per file+lock pair
  const dedupKey = (v) => `${v.file}::${v.lockId || v.lockText}`;
  const bestByKey = new Map();
  for (const v of violations) {
    const key = dedupKey(v);
    const existing = bestByKey.get(key);
    if (!existing || v.confidence > existing.confidence) {
      bestByKey.set(key, v);
    }
  }
  const uniqueViolations = [...bestByKey.values()];

  // Sort by confidence descending
  uniqueViolations.sort((a, b) => b.confidence - a.confidence);

  // In hard mode, check if any violation meets the block threshold
  const blocked = config.mode === "hard" &&
    uniqueViolations.some((v) => v.confidence >= config.blockThreshold);

  const passed = uniqueViolations.length === 0;
  let message;
  if (passed) {
    message = `Semantic audit passed. ${fileChanges.length} file(s) analyzed against ${activeLocks.length} lock(s).`;
  } else if (blocked) {
    message = `BLOCKED: ${uniqueViolations.length} violation(s) detected in ${fileChanges.length} file(s). Hard enforcement active — commit rejected.`;
  } else {
    message = `WARNING: ${uniqueViolations.length} violation(s) detected in ${fileChanges.length} file(s). Advisory mode — review before proceeding.`;
  }

  return {
    passed,
    blocked,
    violations: uniqueViolations,
    filesChecked: fileChanges.length,
    activeLocks: activeLocks.length,
    mode: config.mode,
    threshold: config.blockThreshold,
    message,
  };
}
