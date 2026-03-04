/**
 * SpecLock Tracking Module
 * Change logging, file event handling, event management.
 * Extracted from engine.js for modularity.
 *
 * Developed by Sandeep Roy (https://github.com/sgroy10)
 */

import fs from "fs";
import path from "path";
import {
  nowIso,
  newId,
  writeBrain,
  appendEvent,
  bumpEvents,
  speclockDir,
  addRecentChange,
  addRevert,
} from "./storage.js";
import { captureDiff } from "./git.js";
import { ensureInit } from "./memory.js";

// --- Internal helpers ---

function recordEvent(root, brain, event) {
  bumpEvents(brain, event.eventId);
  appendEvent(root, event);
  writeBrain(root, brain);
}

function writePatch(root, eventId, content) {
  const patchPath = path.join(
    speclockDir(root),
    "patches",
    `${eventId}.patch`
  );
  fs.writeFileSync(patchPath, content);
  return path.join(".speclock", "patches", `${eventId}.patch`);
}

// --- Core functions ---

export function logChange(root, summary, files = []) {
  const brain = ensureInit(root);
  const eventId = newId("evt");
  let patchPath = "";
  if (brain.facts.repo.hasGit) {
    const diff = captureDiff(root);
    if (diff && diff.trim().length > 0) {
      patchPath = writePatch(root, eventId, diff);
    }
  }
  const event = {
    eventId,
    type: "manual_change",
    at: nowIso(),
    files,
    summary,
    patchPath,
  };
  addRecentChange(brain, {
    eventId,
    summary,
    files,
    at: event.at,
  });
  recordEvent(root, brain, event);
  return { brain, eventId };
}

export function handleFileEvent(root, brain, type, filePath) {
  const eventId = newId("evt");
  const rel = path.relative(root, filePath);
  let patchPath = "";
  if (brain.facts.repo.hasGit) {
    const diff = captureDiff(root);
    const patchContent =
      diff && diff.trim().length > 0 ? diff : "(no diff available)";
    patchPath = writePatch(root, eventId, patchContent);
  }
  const summary = `${type.replace("_", " ")}: ${rel}`;
  const event = {
    eventId,
    type,
    at: nowIso(),
    files: [rel],
    summary,
    patchPath,
  };
  addRecentChange(brain, {
    eventId,
    summary,
    files: [rel],
    at: event.at,
  });
  recordEvent(root, brain, event);
}
