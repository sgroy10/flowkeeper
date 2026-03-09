// ===================================================================
// SpecLock Diff Analyzer — Signal Extraction & Scoring
// Takes parsed diff + project context → scored signals for each
// risk dimension (interface break, protected symbol, dependency
// drift, schema change, public API impact).
//
// Developed by Sandeep Roy (https://github.com/sgroy10)
// ===================================================================

import { readBrain } from "./storage.js";
import { mapLocksToFiles, getBlastRadius, getOrBuildGraph } from "./code-graph.js";
import { analyzeConflict } from "./semantics.js";

// --- Signal score caps (from ChatGPT spec) ---

const CAPS = {
  semanticConflict: 45,
  lockFileOverlap: 20,
  blastRadius: 15,
  typedConstraintRelevance: 10,
  llmConflict: 10,
  interfaceBreak: 15,
  protectedSymbolEdit: 15,
  dependencyDrift: 8,
  schemaChange: 12,
  publicApiImpact: 15,
};

// --- Critical dependency keywords ---
const CRITICAL_DEPS = new Set([
  "express", "fastify", "koa", "hapi",
  "react", "vue", "angular", "svelte",
  "mongoose", "sequelize", "prisma", "typeorm", "knex", "drizzle",
  "stripe", "razorpay", "paypal",
  "jsonwebtoken", "jwt", "passport", "bcrypt", "argon2",
  "firebase", "supabase", "aws-sdk", "@aws-sdk",
  "pg", "mysql", "sqlite3", "redis", "mongodb",
]);

/**
 * Analyze a parsed diff against project constraints.
 *
 * @param {string} root - Project root
 * @param {object} parsedDiff - Output from parseDiff()
 * @param {string} description - Change description
 * @param {object} options - Analysis options
 * @returns {object} Scored signals and reasons
 */
export function analyzeDiff(root, parsedDiff, description, options = {}) {
  const {
    includeSymbolAnalysis = true,
    includeDependencyAnalysis = true,
    includeSchemaAnalysis = true,
    includeApiAnalysis = true,
  } = options;

  const brain = readBrain(root);
  const activeLocks = (brain?.specLock?.items || []).filter(l => l.active !== false);
  const textLocks = activeLocks.filter(l => !l.constraintType);
  const typedLocks = activeLocks.filter(l => l.constraintType);

  const signals = {};
  const reasons = [];

  // --- 1. Semantic Conflict (reuse v5.1 logic) ---
  signals.semanticConflict = scoreSemanticConflict(description, textLocks);
  for (const r of signals.semanticConflict.reasons) reasons.push(r);

  // --- 2. Lock-File Overlap ---
  const filePaths = parsedDiff.files.map(f => f.path);
  signals.lockFileOverlap = scoreLockFileOverlap(root, filePaths);
  for (const r of signals.lockFileOverlap.reasons) reasons.push(r);

  // --- 3. Blast Radius ---
  signals.blastRadius = scoreBlastRadius(root, filePaths);
  for (const r of signals.blastRadius.reasons) reasons.push(r);

  // --- 4. Interface Break ---
  if (includeSymbolAnalysis) {
    signals.interfaceBreak = scoreInterfaceBreak(parsedDiff);
    for (const r of signals.interfaceBreak.reasons) reasons.push(r);
  } else {
    signals.interfaceBreak = { score: 0, changes: [], reasons: [] };
  }

  // --- 5. Protected Symbol Edit ---
  if (includeSymbolAnalysis) {
    signals.protectedSymbolEdit = scoreProtectedSymbolEdit(root, parsedDiff);
    for (const r of signals.protectedSymbolEdit.reasons) reasons.push(r);
  } else {
    signals.protectedSymbolEdit = { score: 0, changes: [], reasons: [] };
  }

  // --- 6. Dependency Drift ---
  if (includeDependencyAnalysis) {
    signals.dependencyDrift = scoreDependencyDrift(parsedDiff);
    for (const r of signals.dependencyDrift.reasons) reasons.push(r);
  } else {
    signals.dependencyDrift = { score: 0, changes: [], reasons: [] };
  }

  // --- 7. Schema Change ---
  if (includeSchemaAnalysis) {
    signals.schemaChange = scoreSchemaChange(parsedDiff);
    for (const r of signals.schemaChange.reasons) reasons.push(r);
  } else {
    signals.schemaChange = { score: 0, changes: [], reasons: [] };
  }

  // --- 8. Public API Impact ---
  if (includeApiAnalysis) {
    signals.publicApiImpact = scorePublicApiImpact(parsedDiff);
    for (const r of signals.publicApiImpact.reasons) reasons.push(r);
  } else {
    signals.publicApiImpact = { score: 0, changes: [], reasons: [] };
  }

  // --- 9. Typed Constraint Relevance ---
  signals.typedConstraintRelevance = scoreTypedConstraintRelevance(description, typedLocks);

  // --- 10. LLM Conflict (placeholder — filled async) ---
  signals.llmConflict = { score: 0, used: false, reasons: [] };

  return { signals, reasons };
}

// --- Individual signal scorers ---

function scoreSemanticConflict(description, textLocks) {
  const result = { score: 0, matchedLocks: 0, reasons: [] };

  for (const lock of textLocks) {
    const analysis = analyzeConflict(description, lock.text);
    if (analysis.isConflict) {
      result.matchedLocks++;
      const confidence = (analysis.confidence || 0) / 100; // normalize to 0-1
      const lockScore = Math.min(CAPS.semanticConflict, Math.round(confidence * CAPS.semanticConflict));
      result.score = Math.max(result.score, lockScore);
      result.reasons.push({
        type: "semantic_conflict",
        severity: confidence >= 0.7 ? "critical" : "high",
        confidence,
        message: `Semantic conflict with lock: "${lock.text}"`,
        details: { lockId: lock.id, lockText: lock.text },
      });
    }
  }

  return result;
}

function scoreLockFileOverlap(root, filePaths) {
  const result = { score: 0, matchedFiles: [], reasons: [] };
  if (filePaths.length === 0) return result;

  try {
    const lockMap = mapLocksToFiles(root);
    const normalizedFiles = filePaths.map(f => f.replace(/\\/g, "/").toLowerCase());

    for (const mapping of lockMap) {
      for (const mf of mapping.matchedFiles) {
        const mfNorm = mf.toLowerCase();
        const overlap = normalizedFiles.find(cf =>
          cf === mfNorm || cf.endsWith("/" + mfNorm) || mfNorm.endsWith("/" + cf)
        );
        if (overlap) {
          result.matchedFiles.push({ file: overlap, lock: mapping.lockText });
          result.reasons.push({
            type: "lock_file_overlap",
            severity: "critical",
            confidence: 0.99,
            message: `Changed file falls inside locked zone.`,
            details: { file: overlap, lock: mapping.lockText, lockId: mapping.lockId },
          });
        }
      }
    }

    result.score = Math.min(CAPS.lockFileOverlap, result.matchedFiles.length * 10);
  } catch (_) {
    // No graph available
  }

  return result;
}

function scoreBlastRadius(root, filePaths) {
  const result = { score: 0, highImpactFiles: [], reasons: [] };
  if (filePaths.length === 0) return result;

  try {
    for (const file of filePaths) {
      const br = getBlastRadius(root, file);
      if (br.found && br.impactPercent > 10) {
        result.highImpactFiles.push({
          file: br.file,
          transitiveDependents: br.blastRadius || 0,
          impactPercent: br.impactPercent || 0,
        });
      }
    }

    if (result.highImpactFiles.length > 0) {
      const maxImpact = Math.max(...result.highImpactFiles.map(f => f.impactPercent));
      result.score = Math.min(CAPS.blastRadius, Math.round(maxImpact / 100 * CAPS.blastRadius * 2));
      result.reasons.push({
        type: "high_blast_radius",
        severity: maxImpact > 25 ? "high" : "medium",
        confidence: 0.85,
        message: `High blast radius: ${maxImpact.toFixed(1)}% of codebase affected.`,
        details: { maxImpactPercent: maxImpact },
      });
    }
  } catch (_) {
    // No graph available
  }

  return result;
}

function scoreInterfaceBreak(parsedDiff) {
  const result = { score: 0, changes: [], reasons: [] };

  for (const file of parsedDiff.files) {
    // Removed exports = definite interface break
    for (const exp of file.exportsRemoved) {
      result.changes.push({
        file: file.path,
        symbol: exp.symbol,
        changeType: "removed",
        severity: "high",
      });
      result.score = Math.min(CAPS.interfaceBreak, result.score + 10);
      result.reasons.push({
        type: "interface_break",
        severity: "high",
        confidence: 0.95,
        message: `Exported ${exp.kind} "${exp.symbol}" was removed.`,
        details: { file: file.path, symbol: exp.symbol },
      });
    }

    // Modified exports = potential interface break
    for (const exp of file.exportsModified) {
      result.changes.push({
        file: file.path,
        symbol: exp.symbol,
        changeType: "signature_changed",
        severity: "high",
      });
      result.score = Math.min(CAPS.interfaceBreak, result.score + 5);
      result.reasons.push({
        type: "interface_break",
        severity: "high",
        confidence: 0.8,
        message: `Exported ${exp.kind || "symbol"} "${exp.symbol}" signature changed.`,
        details: { file: file.path, symbol: exp.symbol },
      });
    }
  }

  return result;
}

function scoreProtectedSymbolEdit(root, parsedDiff) {
  const result = { score: 0, changes: [], reasons: [] };

  // Get lock-file mapping to identify protected zones
  let protectedFiles = new Set();
  let protectedLocks = {};
  try {
    const lockMap = mapLocksToFiles(root);
    for (const m of lockMap) {
      for (const f of m.matchedFiles) {
        protectedFiles.add(f.toLowerCase());
        protectedLocks[f.toLowerCase()] = m.lockText;
      }
    }
  } catch (_) {
    return result;
  }

  for (const file of parsedDiff.files) {
    const fileNorm = file.path.replace(/\\/g, "/").toLowerCase();
    const isProtected = protectedFiles.has(fileNorm) ||
      [...protectedFiles].some(pf => fileNorm.endsWith("/" + pf) || pf.endsWith("/" + fileNorm));

    if (!isProtected) continue;

    const lockText = protectedLocks[fileNorm] || "protected zone";

    for (const sym of file.symbolsTouched) {
      const severity = sym.changeType === "definition_changed" ? "critical" : "high";
      const score = severity === "critical" ? 12 : 8;
      result.score = Math.min(CAPS.protectedSymbolEdit, result.score + score);
      result.changes.push({
        file: file.path,
        symbol: sym.symbol,
        changeType: sym.changeType,
        severity,
      });
      result.reasons.push({
        type: "protected_symbol_edit",
        severity,
        confidence: 0.93,
        message: `Protected symbol "${sym.symbol}" was modified in locked zone.`,
        details: { file: file.path, symbol: sym.symbol, lock: lockText },
      });
    }
  }

  return result;
}

function scoreDependencyDrift(parsedDiff) {
  const result = { score: 0, changes: [], reasons: [] };

  for (const file of parsedDiff.files) {
    if (file.importsAdded.length === 0 && file.importsRemoved.length === 0) continue;

    const change = {
      file: file.path,
      addedImports: file.importsAdded,
      removedImports: file.importsRemoved,
    };

    // Score based on criticality
    for (const imp of file.importsAdded) {
      const pkg = imp.replace(/^@[^/]+\//, "").split("/")[0];
      if (CRITICAL_DEPS.has(pkg) || CRITICAL_DEPS.has(imp.split("/")[0])) {
        result.score = Math.min(CAPS.dependencyDrift, result.score + 5);
        result.reasons.push({
          type: "dependency_drift",
          severity: "high",
          confidence: 0.85,
          message: `Critical dependency "${imp}" added.`,
          details: { file: file.path, import: imp },
        });
      } else if (!imp.startsWith(".") && !imp.startsWith("/")) {
        // External non-relative import
        result.score = Math.min(CAPS.dependencyDrift, result.score + 2);
      }
    }

    for (const imp of file.importsRemoved) {
      const pkg = imp.replace(/^@[^/]+\//, "").split("/")[0];
      if (CRITICAL_DEPS.has(pkg) || CRITICAL_DEPS.has(imp.split("/")[0])) {
        result.score = Math.min(CAPS.dependencyDrift, result.score + 5);
        result.reasons.push({
          type: "dependency_drift",
          severity: "high",
          confidence: 0.85,
          message: `Critical dependency "${imp}" removed.`,
          details: { file: file.path, import: imp },
        });
      }
    }

    result.changes.push(change);
  }

  return result;
}

function scoreSchemaChange(parsedDiff) {
  const result = { score: 0, changes: [], reasons: [] };

  for (const file of parsedDiff.files) {
    if (!file.isSchemaFile) continue;

    // Schema file was modified
    const hasDestructive = file.deletions > 0;
    const severity = hasDestructive ? "critical" : "medium";
    const score = hasDestructive ? 12 : 4;
    result.score = Math.min(CAPS.schemaChange, result.score + score);

    result.changes.push({
      file: file.path,
      additions: file.additions,
      deletions: file.deletions,
      isDestructive: hasDestructive,
    });

    result.reasons.push({
      type: "schema_change",
      severity,
      confidence: 0.9,
      message: hasDestructive
        ? `Schema/migration file "${file.path}" has destructive changes (${file.deletions} deletions).`
        : `Schema/migration file "${file.path}" modified.`,
      details: { file: file.path, deletions: file.deletions },
    });
  }

  return result;
}

function scorePublicApiImpact(parsedDiff) {
  const result = { score: 0, changes: [], reasons: [] };

  for (const file of parsedDiff.files) {
    if (file.routeChanges.length === 0) continue;

    for (const route of file.routeChanges) {
      let score = 0;
      let severity = "medium";

      if (route.changeType === "removed") {
        score = 15;
        severity = "critical";
      } else if (route.changeType === "modified") {
        score = 10;
        severity = "high";
      } else {
        score = 3; // added — low risk
        severity = "low";
      }

      result.score = Math.min(CAPS.publicApiImpact, result.score + score);
      result.changes.push({
        file: file.path,
        route: route.path,
        method: route.method,
        changeType: route.changeType,
        severity,
      });

      if (severity !== "low") {
        result.reasons.push({
          type: "public_api_impact",
          severity,
          confidence: 0.88,
          message: `API route ${route.method} ${route.path} ${route.changeType}.`,
          details: { file: file.path, route: route.path, method: route.method },
        });
      }
    }
  }

  return result;
}

function scoreTypedConstraintRelevance(description, typedLocks) {
  const result = { score: 0, matchedConstraints: [] };
  const descLower = description.toLowerCase();

  for (const lock of typedLocks) {
    const metric = (lock.metric || lock.description || lock.text || "").toLowerCase();
    if (metric && descLower.includes(metric.split(" ")[0])) {
      result.matchedConstraints.push({
        lockId: lock.id,
        constraintType: lock.constraintType,
        metric: lock.metric || lock.description,
      });
      result.score = Math.min(CAPS.typedConstraintRelevance, result.score + 5);
    }
  }

  return result;
}

/**
 * Calculate final verdict from scored signals.
 *
 * @param {object} signals - All scored signals
 * @param {object[]} reasons - All collected reasons
 * @returns {object} { verdict, riskScore, recommendation }
 */
export function calculateVerdict(signals, reasons) {
  // Sum all signal scores (capped individually)
  let rawScore = 0;
  for (const key of Object.keys(signals)) {
    rawScore += signals[key].score || 0;
  }
  const riskScore = Math.min(100, rawScore);

  // --- Hard escalation rules (override score) ---
  let hardBlock = false;
  let hardBlockReason = "";

  // Protected symbol removed/renamed in locked zone
  const protectedCritical = reasons.filter(r =>
    r.type === "protected_symbol_edit" && r.severity === "critical"
  );
  if (protectedCritical.length > 0) {
    hardBlock = true;
    hardBlockReason = "Protected symbol modified in locked zone.";
  }

  // Schema destructive change
  const destructiveSchema = reasons.filter(r =>
    r.type === "schema_change" && r.severity === "critical"
  );
  if (destructiveSchema.length > 0) {
    hardBlock = true;
    hardBlockReason = "Destructive schema/migration change detected.";
  }

  // Public API route removed
  const apiRemoved = reasons.filter(r =>
    r.type === "public_api_impact" && r.severity === "critical"
  );
  if (apiRemoved.length > 0) {
    hardBlock = true;
    hardBlockReason = "Public API route removed.";
  }

  // Two or more critical reasons with confidence > 0.9
  const highConfCritical = reasons.filter(r =>
    r.severity === "critical" && (r.confidence || 0) > 0.9
  );
  if (highConfCritical.length >= 2) {
    hardBlock = true;
    hardBlockReason = "Multiple critical issues with high confidence.";
  }

  // Semantic conflict at HIGH confidence (>=0.7) should hard-block
  // even if other signals are absent — the engine is certain this
  // action violates a lock.
  const highConfSemantic = reasons.filter(r =>
    r.type === "semantic_conflict" && (r.confidence || 0) >= 0.7
  );
  if (highConfSemantic.length > 0) {
    hardBlock = true;
    hardBlockReason = `High-confidence semantic conflict: ${highConfSemantic[0].message || "action violates active lock"}.`;
  }

  // --- Determine verdict ---
  let verdict;
  if (hardBlock || riskScore >= 50) {
    verdict = "BLOCK";
  } else if (riskScore >= 25) {
    verdict = "WARN";
  } else {
    verdict = "ALLOW";
  }

  // --- Recommendation ---
  let recommendation;
  if (verdict === "BLOCK") {
    recommendation = {
      action: "require_approval",
      why: hardBlockReason || `Risk score ${riskScore}/100 exceeds threshold.`,
    };
  } else if (verdict === "WARN") {
    recommendation = {
      action: "review_recommended",
      why: `Risk score ${riskScore}/100 — review before merging.`,
    };
  } else {
    recommendation = {
      action: "safe_to_proceed",
      why: `Risk score ${riskScore}/100 — no significant issues detected.`,
    };
  }

  return { verdict, riskScore, recommendation };
}
