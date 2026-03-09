// ===================================================================
// SpecLock Patch Gateway — Change Decision Engine
// Combines semantic conflict detection, lock-to-file mapping, blast
// radius analysis, and typed constraints into a single ALLOW/WARN/BLOCK
// verdict for any proposed change.
//
// Developed by Sandeep Roy (https://github.com/sgroy10)
// ===================================================================

import { readBrain } from "./storage.js";
import { ensureInit } from "./memory.js";
import { analyzeConflict } from "./semantics.js";
import { checkAllTypedConstraints } from "./typed-constraints.js";
import { getOrBuildGraph, getBlastRadius, mapLocksToFiles } from "./code-graph.js";

// --- Thresholds ---

const BLOCK_CONFIDENCE = 70;   // Semantic confidence >= 70 → BLOCK
const WARN_CONFIDENCE = 40;    // Semantic confidence >= 40 → WARN
const HIGH_BLAST_RADIUS = 20;  // > 20% impact → adds to risk
const MED_BLAST_RADIUS = 10;   // > 10% impact → moderate risk

// --- Main Gateway ---

/**
 * Review a proposed change against all active constraints.
 *
 * @param {string} root - Project root
 * @param {object} opts
 * @param {string} opts.description - What the change does (natural language)
 * @param {string[]} [opts.files] - Files being changed (project-relative paths)
 * @param {boolean} [opts.includeGraph=true] - Whether to run blast radius analysis
 * @returns {object} Verdict with risk score, reasons, and summary
 */
export function reviewPatch(root, { description, files = [], includeGraph = true }) {
  if (!description || typeof description !== "string" || !description.trim()) {
    return {
      verdict: "ERROR",
      riskScore: 0,
      error: "description is required (describe what the change does)",
      reasons: [],
      summary: "No change description provided.",
    };
  }

  const brain = ensureInit(root);
  const activeLocks = (brain.specLock?.items || []).filter(l => l.active !== false);
  const textLocks = activeLocks.filter(l => !l.constraintType);
  const typedLocks = activeLocks.filter(l => l.constraintType);

  const reasons = [];
  let maxConfidence = 0;

  // --- Step 1: Semantic conflict check against all text locks ---
  for (const lock of textLocks) {
    const result = analyzeConflict(description, lock.text);
    if (result.isConflict) {
      const confidence = result.confidence || 0;
      if (confidence > maxConfidence) maxConfidence = confidence;
      reasons.push({
        type: "semantic_conflict",
        severity: confidence >= BLOCK_CONFIDENCE ? "block" : "warn",
        lockId: lock.id,
        lockText: lock.text,
        confidence,
        level: result.level || "MEDIUM",
        details: result.reasons || [],
      });
    }
  }

  // --- Step 2: Lock-to-file mapping (do changed files touch locked zones?) ---
  let lockFileMatches = [];
  if (files.length > 0) {
    try {
      const lockMap = mapLocksToFiles(root);
      const normalizedFiles = files.map(f => f.replace(/\\/g, "/"));

      for (const mapping of lockMap) {
        const overlapping = mapping.matchedFiles.filter(mf =>
          normalizedFiles.some(cf => {
            const cfNorm = cf.toLowerCase();
            const mfNorm = mf.toLowerCase();
            return cfNorm === mfNorm || cfNorm.endsWith("/" + mfNorm) || mfNorm.endsWith("/" + cfNorm);
          })
        );
        if (overlapping.length > 0) {
          lockFileMatches.push({
            lockId: mapping.lockId,
            lockText: mapping.lockText,
            overlappingFiles: overlapping,
          });
          // Find the lock's existing semantic confidence, or default to 60
          const existingSemantic = reasons.find(r => r.lockId === mapping.lockId);
          if (!existingSemantic) {
            // This lock wasn't caught by semantic analysis but the files overlap
            reasons.push({
              type: "lock_file_overlap",
              severity: "warn",
              lockId: mapping.lockId,
              lockText: mapping.lockText,
              confidence: 60,
              level: "MEDIUM",
              details: [`Changed files overlap with locked zone: ${overlapping.join(", ")}`],
            });
            if (60 > maxConfidence) maxConfidence = 60;
          } else {
            // Boost existing semantic match — file evidence confirms it
            existingSemantic.confidence = Math.min(100, existingSemantic.confidence + 15);
            existingSemantic.details.push(`File-level confirmation: ${overlapping.join(", ")}`);
            if (existingSemantic.confidence > maxConfidence) maxConfidence = existingSemantic.confidence;
            if (existingSemantic.confidence >= BLOCK_CONFIDENCE) existingSemantic.severity = "block";
          }
        }
      }
    } catch (_) {
      // Lock mapping failed (no graph), continue without it
    }
  }

  // --- Step 3: Blast radius for each changed file ---
  let blastDetails = [];
  let maxImpactPercent = 0;
  if (includeGraph && files.length > 0) {
    try {
      for (const file of files) {
        const br = getBlastRadius(root, file);
        if (br.found) {
          blastDetails.push({
            file: br.file,
            directDependents: br.directDependents?.length || 0,
            transitiveDependents: br.blastRadius || 0,
            impactPercent: br.impactPercent || 0,
            depth: br.depth || 0,
          });
          if (br.impactPercent > maxImpactPercent) maxImpactPercent = br.impactPercent;
        }
      }

      if (maxImpactPercent > HIGH_BLAST_RADIUS) {
        reasons.push({
          type: "high_blast_radius",
          severity: "warn",
          confidence: Math.min(90, 50 + maxImpactPercent),
          level: "HIGH",
          details: [`Change affects ${maxImpactPercent.toFixed(1)}% of the codebase`],
        });
      } else if (maxImpactPercent > MED_BLAST_RADIUS) {
        reasons.push({
          type: "moderate_blast_radius",
          severity: "info",
          confidence: 30 + maxImpactPercent,
          level: "MEDIUM",
          details: [`Change affects ${maxImpactPercent.toFixed(1)}% of the codebase`],
        });
      }
    } catch (_) {
      // Graph not available, skip blast radius
    }
  }

  // --- Step 4: Typed constraint awareness ---
  let typedWarnings = [];
  if (typedLocks.length > 0) {
    // Check if the description mentions any typed constraint metrics
    const descLower = description.toLowerCase();
    for (const lock of typedLocks) {
      const metric = (lock.metric || lock.description || lock.text || "").toLowerCase();
      if (metric && descLower.includes(metric.split(" ")[0])) {
        typedWarnings.push({
          lockId: lock.id,
          constraintType: lock.constraintType,
          metric: lock.metric || lock.description,
          text: lock.text,
        });
        reasons.push({
          type: "typed_constraint_relevant",
          severity: "info",
          lockId: lock.id,
          lockText: lock.text,
          confidence: 30,
          level: "LOW",
          details: [`Typed constraint (${lock.constraintType}) may be relevant: ${lock.text}`],
        });
      }
    }
  }

  // --- Step 5: Calculate risk score & verdict ---
  let riskScore = 0;

  // Base risk from semantic conflicts
  if (maxConfidence > 0) {
    riskScore = maxConfidence;
  }

  // Boost from lock-file overlaps
  if (lockFileMatches.length > 0) {
    riskScore = Math.max(riskScore, 55);
    riskScore = Math.min(100, riskScore + lockFileMatches.length * 5);
  }

  // Boost from blast radius
  if (maxImpactPercent > HIGH_BLAST_RADIUS) {
    riskScore = Math.min(100, riskScore + 15);
  } else if (maxImpactPercent > MED_BLAST_RADIUS) {
    riskScore = Math.min(100, riskScore + 8);
  }

  // Determine verdict
  let verdict;
  const hasBlockSeverity = reasons.some(r => r.severity === "block");
  if (hasBlockSeverity || riskScore >= BLOCK_CONFIDENCE) {
    verdict = "BLOCK";
  } else if (riskScore >= WARN_CONFIDENCE || reasons.some(r => r.severity === "warn")) {
    verdict = "WARN";
  } else {
    verdict = "ALLOW";
  }

  // --- Step 6: Build human-readable summary ---
  const summary = buildSummary(verdict, riskScore, reasons, files, blastDetails, lockFileMatches);

  return {
    verdict,
    riskScore,
    description,
    fileCount: files.length,
    lockCount: activeLocks.length,
    reasons,
    blastRadius: blastDetails.length > 0 ? {
      files: blastDetails,
      maxImpactPercent,
    } : undefined,
    lockFileOverlaps: lockFileMatches.length > 0 ? lockFileMatches : undefined,
    typedConstraints: typedWarnings.length > 0 ? typedWarnings : undefined,
    summary,
  };
}

/**
 * Async version — adds LLM-powered conflict checking for grey-zone decisions.
 */
export async function reviewPatchAsync(root, opts) {
  // Start with heuristic review
  const result = reviewPatch(root, opts);

  // If verdict is already BLOCK or ALLOW with high confidence, return immediately
  if (result.verdict === "BLOCK" || (result.verdict === "ALLOW" && result.riskScore < 20)) {
    result.source = "heuristic";
    return result;
  }

  // For WARN / uncertain cases, try LLM enhancement
  try {
    const { llmCheckConflict } = await import("./llm-checker.js");
    const brain = readBrain(root);
    const activeLocks = (brain?.specLock?.items || []).filter(l => l.active !== false && !l.constraintType);

    if (activeLocks.length > 0) {
      const llmResult = await llmCheckConflict(root, opts.description, activeLocks);
      if (llmResult && llmResult.hasConflict) {
        for (const lc of (llmResult.conflictingLocks || [])) {
          const confidence = lc.confidence || 50;
          const existing = result.reasons.find(r => r.lockId === lc.id);
          if (existing) {
            // LLM confirms heuristic — boost confidence
            existing.confidence = Math.max(existing.confidence, confidence);
            existing.details.push("LLM confirmed conflict");
            if (existing.confidence >= BLOCK_CONFIDENCE) existing.severity = "block";
          } else {
            // LLM found new conflict heuristic missed
            result.reasons.push({
              type: "llm_conflict",
              severity: confidence >= BLOCK_CONFIDENCE ? "block" : "warn",
              lockId: lc.id,
              lockText: lc.text,
              confidence,
              level: lc.level || "MEDIUM",
              details: lc.reasons || ["LLM-detected conflict"],
            });
          }
          if (confidence > result.riskScore) result.riskScore = confidence;
        }

        // Re-evaluate verdict with LLM data
        const hasBlock = result.reasons.some(r => r.severity === "block");
        if (hasBlock || result.riskScore >= BLOCK_CONFIDENCE) {
          result.verdict = "BLOCK";
        } else if (result.riskScore >= WARN_CONFIDENCE) {
          result.verdict = "WARN";
        }

        result.summary = buildSummary(
          result.verdict, result.riskScore, result.reasons,
          opts.files || [], result.blastRadius?.files || [],
          result.lockFileOverlaps || []
        );
      }
    }
    result.source = "hybrid";
  } catch (_) {
    result.source = "heuristic-only";
  }

  return result;
}

// --- Summary builder ---

function buildSummary(verdict, riskScore, reasons, files, blastDetails, lockFileMatches) {
  const parts = [];

  if (verdict === "BLOCK") {
    parts.push(`BLOCKED (risk: ${riskScore}/100)`);
  } else if (verdict === "WARN") {
    parts.push(`WARNING (risk: ${riskScore}/100)`);
  } else {
    parts.push(`ALLOWED (risk: ${riskScore}/100)`);
  }

  const semanticConflicts = reasons.filter(r => r.type === "semantic_conflict" || r.type === "llm_conflict");
  if (semanticConflicts.length > 0) {
    parts.push(`${semanticConflicts.length} constraint conflict(s): ${semanticConflicts.map(r => `"${r.lockText}"`).join(", ")}`);
  }

  if (lockFileMatches.length > 0) {
    const fileCount = lockFileMatches.reduce((acc, m) => acc + m.overlappingFiles.length, 0);
    parts.push(`${fileCount} file(s) in locked zones`);
  }

  if (blastDetails.length > 0) {
    const maxImpact = Math.max(...blastDetails.map(b => b.impactPercent));
    const totalDeps = blastDetails.reduce((acc, b) => acc + b.transitiveDependents, 0);
    if (maxImpact > 0) {
      parts.push(`blast radius: ${totalDeps} dependent file(s), ${maxImpact.toFixed(1)}% impact`);
    }
  }

  const typedReasons = reasons.filter(r => r.type === "typed_constraint_relevant");
  if (typedReasons.length > 0) {
    parts.push(`${typedReasons.length} typed constraint(s) may be affected`);
  }

  return parts.join(". ") + ".";
}
