import fs from "fs";
import path from "path";
import crypto from "crypto";

export function nowIso() {
  return new Date().toISOString();
}

export function speclockDir(root) {
  return path.join(root, ".speclock");
}

export function ensureSpeclockDirs(root) {
  const base = speclockDir(root);
  fs.mkdirSync(base, { recursive: true });
  fs.mkdirSync(path.join(base, "patches"), { recursive: true });
  fs.mkdirSync(path.join(base, "context"), { recursive: true });
}

export function brainPath(root) {
  return path.join(speclockDir(root), "brain.json");
}

export function eventsPath(root) {
  return path.join(speclockDir(root), "events.log");
}

export function newId(prefix) {
  return `${prefix}_${crypto.randomBytes(6).toString("hex")}`;
}

// Brain v2 factory
export function makeBrain(root, hasGitRepo, defaultBranch) {
  const createdAt = nowIso();
  const folderName = path.basename(root);
  return {
    version: 2,
    project: {
      id: newId("sl"),
      name: folderName,
      root,
      createdAt,
      updatedAt: createdAt,
    },
    goal: { text: "", updatedAt: createdAt },
    specLock: {
      items: [],
    },
    decisions: [],
    notes: [],
    facts: {
      deploy: {
        provider: "unknown",
        autoDeploy: false,
        branch: "",
        url: "",
        notes: "",
      },
      repo: {
        defaultBranch: defaultBranch || "",
        hasGit: !!hasGitRepo,
      },
    },
    sessions: {
      current: null,
      history: [],
    },
    state: {
      head: {
        gitBranch: "",
        gitCommit: "",
        capturedAt: createdAt,
      },
      recentChanges: [],
      reverts: [],
      violations: [],
    },
    events: { lastEventId: "", count: 0 },
  };
}

// Migrate v1 brain to v2
export function migrateBrainV1toV2(brain) {
  if (brain.version >= 2) return brain;

  // Add notes array
  if (!brain.notes) {
    brain.notes = [];
  }

  // Add sessions
  if (!brain.sessions) {
    brain.sessions = { current: null, history: [] };
  }

  // Add active flag to all existing locks
  if (brain.specLock && brain.specLock.items) {
    for (const lock of brain.specLock.items) {
      if (lock.active === undefined) lock.active = true;
    }
  }

  // Add deploy.url
  if (brain.facts && brain.facts.deploy && brain.facts.deploy.url === undefined) {
    brain.facts.deploy.url = "";
  }

  // Add violations array if missing
  if (brain.state && !brain.state.violations) {
    brain.state.violations = [];
  }

  // Remove old importance field
  delete brain.importance;

  brain.version = 2;
  return brain;
}

export function readBrain(root) {
  const p = brainPath(root);
  if (!fs.existsSync(p)) return null;
  const raw = fs.readFileSync(p, "utf8");
  let brain = JSON.parse(raw);
  if (brain.version < 2) {
    brain = migrateBrainV1toV2(brain);
    writeBrain(root, brain);
  }
  // Ensure violations array exists (added in v1.7.0)
  if (brain.state && !brain.state.violations) {
    brain.state.violations = [];
  }
  return brain;
}

export function writeBrain(root, brain) {
  brain.project.updatedAt = nowIso();
  const p = brainPath(root);
  fs.writeFileSync(p, JSON.stringify(brain, null, 2));
}

export function appendEvent(root, event) {
  const line = JSON.stringify(event);
  fs.appendFileSync(eventsPath(root), `${line}\n`);
}

// Read events.log with optional filtering
export function readEvents(root, opts = {}) {
  const p = eventsPath(root);
  if (!fs.existsSync(p)) return [];

  const raw = fs.readFileSync(p, "utf8").trim();
  if (!raw) return [];

  let events = raw.split("\n").map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  }).filter(Boolean);

  // Filter by type
  if (opts.type) {
    events = events.filter((e) => e.type === opts.type);
  }

  // Filter by since (ISO timestamp)
  if (opts.since) {
    events = events.filter((e) => e.at >= opts.since);
  }

  // Return most recent first, apply limit
  events.reverse();
  if (opts.limit && opts.limit > 0) {
    events = events.slice(0, opts.limit);
  }

  return events;
}

export function bumpEvents(brain, eventId) {
  brain.events.lastEventId = eventId;
  brain.events.count += 1;
}

export function addRecentChange(brain, item) {
  brain.state.recentChanges.unshift(item);
  if (brain.state.recentChanges.length > 20) {
    brain.state.recentChanges = brain.state.recentChanges.slice(0, 20);
  }
}

export function addRevert(brain, item) {
  brain.state.reverts.unshift(item);
}

export function addViolation(brain, item) {
  if (!brain.state.violations) brain.state.violations = [];
  brain.state.violations.unshift(item);
  if (brain.state.violations.length > 100) {
    brain.state.violations = brain.state.violations.slice(0, 100);
  }
}
