/**
 * SpecLock Compliance Export Engine
 * Generates audit-ready reports for SOC 2, HIPAA, and CSV formats.
 * Designed for enterprise compliance teams and auditors.
 *
 * Developed by Sandeep Roy (https://github.com/sgroy10)
 */

import { readBrain, readEvents } from "./storage.js";
import { verifyAuditChain } from "./audit.js";

const VERSION = "4.5.4";

// PHI-related keywords for HIPAA filtering
const PHI_KEYWORDS = [
  "patient", "phi", "health", "medical", "hipaa", "ehr", "emr",
  "diagnosis", "treatment", "prescription", "clinical", "healthcare",
  "protected health", "health record", "medical record", "patient data",
  "health information", "insurance", "claims", "billing",
];

// Security-related event types
const SECURITY_EVENT_TYPES = [
  "lock_added", "lock_removed", "decision_added",
  "goal_updated", "init", "session_started", "session_ended",
  "checkpoint_created", "revert_detected",
];

/**
 * Check if text matches any PHI keywords (case-insensitive).
 */
function isPHIRelated(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return PHI_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Generate SOC 2 Type II compliance report.
 * Covers: constraint changes, access events, change management, audit integrity.
 */
export function exportSOC2(root) {
  const brain = readBrain(root);
  if (!brain) {
    return { error: "SpecLock not initialized. Run speclock init first." };
  }

  const events = readEvents(root, { limit: 10000 });
  const auditResult = verifyAuditChain(root);
  const activeLocks = (brain.specLock?.items || []).filter((l) => l.active);
  const allLocks = brain.specLock?.items || [];

  // Group events by type for analysis
  const eventsByType = {};
  for (const e of events) {
    if (!eventsByType[e.type]) eventsByType[e.type] = [];
    eventsByType[e.type].push(e);
  }

  // Calculate constraint change history
  const constraintChanges = events
    .filter((e) => ["lock_added", "lock_removed"].includes(e.type))
    .map((e) => ({
      timestamp: e.at || e.ts,
      action: e.type === "lock_added" ? "ADDED" : "REMOVED",
      lockId: e.lockId || e.summary?.match(/\[([^\]]+)\]/)?.[1] || "unknown",
      text: e.lockText || e.summary || "",
      source: e.source || "unknown",
      eventId: e.eventId,
      hash: e.hash || null,
    }));

  // Session history (access log)
  const sessions = (brain.sessions?.history || []).map((s) => ({
    tool: s.tool || "unknown",
    startedAt: s.startedAt,
    endedAt: s.endedAt || null,
    summary: s.summary || "",
  }));

  // Decision audit trail
  const decisions = (brain.decisions || []).map((d) => ({
    id: d.id,
    text: d.text,
    createdAt: d.createdAt,
    source: d.source || "unknown",
    tags: d.tags || [],
  }));

  return {
    report: "SOC 2 Type II — SpecLock Compliance Export",
    version: VERSION,
    generatedAt: new Date().toISOString(),
    project: {
      name: brain.project?.name || "unknown",
      id: brain.project?.id || "unknown",
      createdAt: brain.project?.createdAt,
      goal: brain.goal?.text || "",
    },
    auditChainIntegrity: {
      valid: auditResult.valid,
      totalEvents: auditResult.totalEvents,
      hashedEvents: auditResult.hashedEvents,
      unhashedEvents: auditResult.unhashedEvents,
      brokenAt: auditResult.brokenAt,
      verifiedAt: auditResult.verifiedAt,
    },
    constraintManagement: {
      activeConstraints: activeLocks.length,
      totalConstraints: allLocks.length,
      removedConstraints: allLocks.filter((l) => !l.active).length,
      changeHistory: constraintChanges,
    },
    accessLog: {
      totalSessions: sessions.length,
      sessions,
    },
    decisionAuditTrail: {
      totalDecisions: decisions.length,
      decisions,
    },
    changeManagement: {
      totalEvents: events.length,
      eventBreakdown: Object.fromEntries(
        Object.entries(eventsByType).map(([type, evts]) => [type, evts.length])
      ),
      recentChanges: (brain.state?.recentChanges || []).slice(0, 20),
      reverts: brain.state?.reverts || [],
    },
    violations: {
      total: (brain.state?.violations || []).length,
      items: (brain.state?.violations || []).slice(0, 50),
    },
  };
}

/**
 * Generate HIPAA compliance report.
 * Filtered for PHI-related constraints, access events, and encryption status.
 */
export function exportHIPAA(root) {
  const brain = readBrain(root);
  if (!brain) {
    return { error: "SpecLock not initialized. Run speclock init first." };
  }

  const events = readEvents(root, { limit: 10000 });
  const auditResult = verifyAuditChain(root);
  const allLocks = brain.specLock?.items || [];

  // Filter PHI-related locks
  const phiLocks = allLocks.filter((l) => isPHIRelated(l.text));
  const activePhiLocks = phiLocks.filter((l) => l.active);

  // Filter PHI-related events
  const phiEvents = events.filter(
    (e) => isPHIRelated(e.summary || "") || isPHIRelated(e.lockText || "")
  );

  // PHI-related decisions
  const phiDecisions = (brain.decisions || []).filter((d) =>
    isPHIRelated(d.text)
  );

  // PHI-related violations
  const phiViolations = (brain.state?.violations || []).filter(
    (v) => isPHIRelated(v.lockText || "") || isPHIRelated(v.action || "")
  );

  // Check encryption status
  const encryptionEnabled = !!process.env.SPECLOCK_ENCRYPTION_KEY;

  // Access controls
  const hasAuth = !!process.env.SPECLOCK_API_KEY;
  const hasAuditChain = auditResult.hashedEvents > 0;

  return {
    report: "HIPAA Compliance — SpecLock PHI Protection Report",
    version: VERSION,
    generatedAt: new Date().toISOString(),
    project: {
      name: brain.project?.name || "unknown",
      id: brain.project?.id || "unknown",
    },
    safeguards: {
      technicalSafeguards: {
        auditControls: {
          enabled: hasAuditChain,
          chainValid: auditResult.valid,
          totalAuditedEvents: auditResult.hashedEvents,
          status: hasAuditChain
            ? auditResult.valid
              ? "COMPLIANT"
              : "NON-COMPLIANT — audit chain broken"
            : "PARTIAL — enable HMAC audit chain for full compliance",
        },
        accessControl: {
          authEnabled: hasAuth,
          status: hasAuth
            ? "COMPLIANT"
            : "NON-COMPLIANT — no API key authentication",
        },
        encryption: {
          atRest: encryptionEnabled,
          algorithm: encryptionEnabled ? "AES-256-GCM" : "none",
          status: encryptionEnabled
            ? "COMPLIANT"
            : "NON-COMPLIANT — enable SPECLOCK_ENCRYPTION_KEY",
        },
      },
      administrativeSafeguards: {
        constraintEnforcement: {
          totalPhiConstraints: phiLocks.length,
          activePhiConstraints: activePhiLocks.length,
          constraints: activePhiLocks.map((l) => ({
            id: l.id,
            text: l.text,
            createdAt: l.createdAt,
            source: l.source,
          })),
        },
      },
    },
    phiProtection: {
      constraints: phiLocks.map((l) => ({
        id: l.id,
        text: l.text,
        active: l.active,
        createdAt: l.createdAt,
      })),
      decisions: phiDecisions.map((d) => ({
        id: d.id,
        text: d.text,
        createdAt: d.createdAt,
      })),
      violations: phiViolations,
      relatedEvents: phiEvents.length,
    },
    auditTrail: {
      integrity: auditResult,
      phiEventCount: phiEvents.length,
    },
  };
}

/**
 * Generate CSV export of all events.
 * Returns a CSV string suitable for auditor spreadsheets.
 */
export function exportCSV(root) {
  const events = readEvents(root, { limit: 10000 });

  if (!events.length) {
    return "timestamp,event_id,type,summary,files,hash\n";
  }

  // Reverse back to chronological order (readEvents returns newest first)
  events.reverse();

  const header = "timestamp,event_id,type,summary,files,hash";
  const rows = events.map((e) => {
    const timestamp = e.at || e.ts || "";
    const eventId = e.eventId || "";
    const type = e.type || "";
    const summary = (e.summary || "").replace(/"/g, '""');
    const files = (e.files || []).join("; ");
    const hash = e.hash || "";
    return `"${timestamp}","${eventId}","${type}","${summary}","${files}","${hash}"`;
  });

  return [header, ...rows].join("\n");
}

/**
 * Main export function — dispatches by format.
 */
export function exportCompliance(root, format) {
  switch (format) {
    case "soc2":
      return { format: "soc2", data: exportSOC2(root) };
    case "hipaa":
      return { format: "hipaa", data: exportHIPAA(root) };
    case "csv":
      return { format: "csv", data: exportCSV(root) };
    default:
      return {
        error: `Unknown format: ${format}. Supported: soc2, hipaa, csv`,
        supportedFormats: ["soc2", "hipaa", "csv"],
      };
  }
}
