/**
 * SpecLock Incident Replay — Session activity log
 * Shows exactly what AI agents tried and what SpecLock caught.
 *
 * Developed by Sandeep Roy (https://github.com/sgroy10)
 */

import { readBrain, readEvents } from "./storage.js";
import { ensureInit } from "./memory.js";

/**
 * Get a formatted replay of a session's events.
 *
 * @param {string} root - Project root
 * @param {Object} options
 * @param {string} [options.sessionId] - Specific session ID to replay. If omitted, replays last session.
 * @param {number} [options.limit] - Max events to show (default: 50)
 * @returns {Object} Replay data with events, stats, and formatted output
 */
export function getReplay(root, options = {}) {
  const brain = ensureInit(root);
  const allSessions = [
    ...(brain.sessions.current ? [brain.sessions.current] : []),
    ...brain.sessions.history,
  ];

  if (allSessions.length === 0) {
    return {
      found: false,
      error: "No sessions recorded yet. Start a session with speclock_session_briefing.",
      events: [],
      stats: { total: 0, allowed: 0, warned: 0, blocked: 0 },
    };
  }

  // Find the target session
  let session;
  if (options.sessionId) {
    session = allSessions.find((s) => s.id === options.sessionId);
    if (!session) {
      return {
        found: false,
        error: `Session ${options.sessionId} not found. Available: ${allSessions.slice(0, 5).map((s) => s.id).join(", ")}`,
        events: [],
        stats: { total: 0, allowed: 0, warned: 0, blocked: 0 },
      };
    }
  } else {
    // Default to current or most recent
    session = allSessions[0];
  }

  // Get events for this session
  const sinceTime = session.startedAt;
  const untilTime = session.endedAt || new Date().toISOString();
  const limit = options.limit || 50;

  let events = readEvents(root, { since: sinceTime });

  // Filter to events within this session's time window
  if (session.endedAt) {
    events = events.filter((e) => e.at <= session.endedAt);
  }

  // Reverse to chronological order
  events = events.reverse().slice(0, limit);

  // Categorize events
  const stats = {
    total: events.length,
    allowed: 0,
    warned: 0,
    blocked: 0,
    changes: 0,
    locks_added: 0,
    locks_removed: 0,
    decisions: 0,
  };

  const categorized = events.map((evt) => {
    const entry = {
      time: evt.at.substring(11, 19),
      fullTime: evt.at,
      type: evt.type,
      summary: evt.summary || "",
      files: evt.files || [],
      icon: "  ",
      level: "INFO",
    };

    switch (evt.type) {
      case "conflict_blocked":
        entry.icon = "BLOCK";
        entry.level = "BLOCK";
        stats.blocked++;
        break;
      case "conflict_warned":
        entry.icon = "WARN";
        entry.level = "WARN";
        stats.warned++;
        break;
      case "conflict_checked":
        entry.icon = "ALLOW";
        entry.level = "ALLOW";
        stats.allowed++;
        break;
      case "lock_added":
        entry.icon = "LOCK";
        entry.level = "LOCK";
        stats.locks_added++;
        break;
      case "lock_removed":
        entry.icon = "UNLOCK";
        entry.level = "UNLOCK";
        stats.locks_removed++;
        break;
      case "change_logged":
        entry.icon = "CHANGE";
        entry.level = "CHANGE";
        stats.changes++;
        break;
      case "decision_added":
        entry.icon = "DEC";
        entry.level = "DECISION";
        stats.decisions++;
        break;
      case "session_started":
        entry.icon = "START";
        entry.level = "SESSION";
        break;
      case "session_ended":
        entry.icon = "END";
        entry.level = "SESSION";
        break;
      case "revert_detected":
        entry.icon = "REVERT";
        entry.level = "REVERT";
        break;
      case "override_applied":
        entry.icon = "OVERRIDE";
        entry.level = "OVERRIDE";
        break;
      case "context_generated":
        entry.icon = "CTX";
        entry.level = "INFO";
        break;
      default:
        entry.icon = "INFO";
        entry.level = "INFO";
    }

    return entry;
  });

  // Duration
  const startMs = new Date(session.startedAt).getTime();
  const endMs = session.endedAt
    ? new Date(session.endedAt).getTime()
    : Date.now();
  const durationMin = Math.round((endMs - startMs) / 60000);

  return {
    found: true,
    session: {
      id: session.id,
      tool: session.toolUsed,
      startedAt: session.startedAt,
      endedAt: session.endedAt || "(active)",
      duration: `${durationMin} min`,
      summary: session.summary || "(in progress)",
    },
    events: categorized,
    stats,
  };
}

/**
 * List available sessions for replay.
 */
export function listSessions(root, limit = 10) {
  const brain = ensureInit(root);
  const sessions = [
    ...(brain.sessions.current ? [{ ...brain.sessions.current, isCurrent: true }] : []),
    ...brain.sessions.history.slice(0, limit),
  ];

  return {
    total: (brain.sessions.history?.length || 0) + (brain.sessions.current ? 1 : 0),
    sessions: sessions.map((s) => ({
      id: s.id,
      tool: s.toolUsed,
      startedAt: s.startedAt,
      endedAt: s.endedAt || "(active)",
      summary: s.summary || "(no summary)",
      events: s.eventsInSession || 0,
      isCurrent: s.isCurrent || false,
    })),
  };
}

/**
 * Format replay data as a readable string for CLI output.
 */
export function formatReplay(replay) {
  if (!replay.found) {
    return replay.error;
  }

  const lines = [];
  const s = replay.session;

  lines.push(`Session: ${s.id} (${s.tool}, ${s.duration})`);
  lines.push(`Started: ${s.startedAt.substring(0, 19).replace("T", " ")}`);
  lines.push(`Ended:   ${typeof s.endedAt === "string" && s.endedAt !== "(active)" ? s.endedAt.substring(0, 19).replace("T", " ") : s.endedAt}`);
  lines.push("-".repeat(60));

  for (const evt of replay.events) {
    const fileStr = evt.files.length > 0 ? ` (${evt.files.slice(0, 3).join(", ")})` : "";
    const pad = evt.icon.length < 6 ? " ".repeat(6 - evt.icon.length) : " ";
    lines.push(`${evt.time}  [${evt.icon}]${pad}${evt.summary}${fileStr}`);
  }

  lines.push("");
  lines.push("-".repeat(60));
  const st = replay.stats;
  const parts = [];
  if (st.allowed > 0) parts.push(`${st.allowed} allowed`);
  if (st.warned > 0) parts.push(`${st.warned} warned`);
  if (st.blocked > 0) parts.push(`${st.blocked} BLOCKED`);
  if (st.changes > 0) parts.push(`${st.changes} changes`);
  if (st.locks_added > 0) parts.push(`${st.locks_added} locks added`);

  lines.push(`Score: ${st.total} events | ${parts.join(" | ") || "no activity"}`);

  return lines.join("\n");
}
