"""
SpecLock Brain — Read/write .speclock/brain.json

Fully compatible with the Node.js SpecLock brain.json format (v2).
Both the npm package and Python SDK read/write the same file.

Developed by Sandeep Roy (https://github.com/sgroy10)
"""

import json
import os
import secrets
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id(prefix: str) -> str:
    return f"{prefix}_{secrets.token_hex(6)}"


class Brain:
    """Read/write .speclock/brain.json — the structured memory store."""

    def __init__(self, root: str):
        self.root = os.path.abspath(root)
        self._speclock_dir = os.path.join(self.root, ".speclock")
        self._brain_path = os.path.join(self._speclock_dir, "brain.json")
        self._events_path = os.path.join(self._speclock_dir, "events.log")
        self._data: Optional[dict] = None

    def ensure_dirs(self):
        os.makedirs(self._speclock_dir, exist_ok=True)
        os.makedirs(os.path.join(self._speclock_dir, "patches"), exist_ok=True)
        os.makedirs(os.path.join(self._speclock_dir, "context"), exist_ok=True)

    def exists(self) -> bool:
        return os.path.exists(self._brain_path)

    def read(self) -> dict:
        if self._data is not None:
            return self._data
        if not self.exists():
            return self._make_default()
        with open(self._brain_path, "r", encoding="utf-8") as f:
            self._data = json.load(f)
        # Ensure v2 fields
        self._migrate_v2()
        return self._data

    def write(self):
        if self._data is None:
            return
        self._data["project"]["updatedAt"] = now_iso()
        self.ensure_dirs()
        with open(self._brain_path, "w", encoding="utf-8") as f:
            json.dump(self._data, f, indent=2)

    def _make_default(self) -> dict:
        ts = now_iso()
        folder_name = os.path.basename(self.root)
        self._data = {
            "version": 2,
            "project": {
                "id": new_id("sl"),
                "name": folder_name,
                "root": self.root,
                "createdAt": ts,
                "updatedAt": ts,
            },
            "goal": {"text": "", "updatedAt": ts},
            "specLock": {"items": []},
            "decisions": [],
            "notes": [],
            "facts": {
                "deploy": {
                    "provider": "unknown",
                    "autoDeploy": False,
                    "branch": "",
                    "url": "",
                    "notes": "",
                },
                "repo": {"defaultBranch": "", "hasGit": False},
            },
            "sessions": {"current": None, "history": []},
            "state": {
                "head": {"gitBranch": "", "gitCommit": "", "capturedAt": ts},
                "recentChanges": [],
                "reverts": [],
                "violations": [],
            },
            "events": {"lastEventId": "", "count": 0},
        }
        return self._data

    def _migrate_v2(self):
        d = self._data
        if d.get("version", 1) >= 2:
            return
        d.setdefault("notes", [])
        d.setdefault("sessions", {"current": None, "history": []})
        for lock in d.get("specLock", {}).get("items", []):
            lock.setdefault("active", True)
        d.get("facts", {}).get("deploy", {}).setdefault("url", "")
        d.get("state", {}).setdefault("violations", [])
        d["version"] = 2

    # --- Properties ---

    @property
    def data(self) -> dict:
        return self.read()

    @property
    def goal(self) -> str:
        return self.data.get("goal", {}).get("text", "")

    @property
    def locks(self) -> list:
        return self.data.get("specLock", {}).get("items", [])

    @property
    def active_locks(self) -> list:
        return [l for l in self.locks if l.get("active", True)]

    @property
    def typed_locks(self) -> list:
        return [l for l in self.active_locks if l.get("constraintType")]

    @property
    def text_locks(self) -> list:
        return [l for l in self.active_locks if not l.get("constraintType")]

    @property
    def decisions(self) -> list:
        return self.data.get("decisions", [])

    @property
    def notes(self) -> list:
        return self.data.get("notes", [])

    @property
    def violations(self) -> list:
        return self.data.get("state", {}).get("violations", [])

    # --- Mutations ---

    def set_goal(self, text: str):
        d = self.read()
        d["goal"]["text"] = text
        d["goal"]["updatedAt"] = now_iso()
        self._append_event("goal_updated", f"Goal set: {text[:80]}")
        self.write()

    def add_lock(self, text: str, tags: list = None, source: str = "user") -> str:
        d = self.read()
        lock_id = new_id("lock")
        d["specLock"]["items"].insert(0, {
            "id": lock_id,
            "text": text,
            "createdAt": now_iso(),
            "source": source,
            "tags": tags or [],
            "active": True,
        })
        self._append_event("lock_added", f"Lock added: {text[:80]}")
        self.write()
        return lock_id

    def add_typed_lock(
        self,
        constraint_type: str,
        description: str = None,
        tags: list = None,
        source: str = "user",
        **kwargs,
    ) -> str:
        """Add a typed constraint lock.

        Args:
            constraint_type: "numerical", "range", "state", or "temporal"
            description: Human-readable description (auto-generated if omitted)
            tags: Category tags
            source: "user" or "agent"
            **kwargs: Type-specific fields (metric, operator, value, min, max,
                      unit, entity, forbidden, requireApproval)
        """
        from speclock.constraints import validate_typed_lock, format_typed_lock_text

        lock_def = {"constraintType": constraint_type, **kwargs}
        validation = validate_typed_lock(lock_def)
        if not validation["valid"]:
            raise ValueError(validation["error"])

        d = self.read()
        lock_id = new_id("lock")
        text = description or format_typed_lock_text(lock_def)

        lock_entry = {
            "id": lock_id,
            "text": text,
            "constraintType": constraint_type,
            "createdAt": now_iso(),
            "source": source,
            "tags": tags or [],
            "active": True,
        }
        # Add type-specific fields
        for key in ("metric", "operator", "value", "min", "max", "unit",
                     "entity", "forbidden", "requireApproval"):
            if key in kwargs and kwargs[key] is not None:
                lock_entry[key] = kwargs[key]

        d["specLock"]["items"].insert(0, lock_entry)
        self._append_event("lock_added", f"Typed lock ({constraint_type}): {text[:80]}")
        self.write()
        return lock_id

    def remove_lock(self, lock_id: str) -> bool:
        d = self.read()
        for lock in d["specLock"]["items"]:
            if lock["id"] == lock_id:
                lock["active"] = False
                self._append_event("lock_removed", f"Lock removed: {lock['text'][:80]}")
                self.write()
                return True
        return False

    def update_typed_threshold(self, lock_id: str, **updates) -> dict:
        """Update a typed lock's threshold. Returns old values."""
        d = self.read()
        lock = next((l for l in d["specLock"]["items"] if l["id"] == lock_id), None)
        if not lock:
            raise ValueError(f"Lock not found: {lock_id}")
        if not lock.get("constraintType"):
            raise ValueError(f"Lock {lock_id} is a text lock, not typed")

        from speclock.constraints import format_typed_lock_text

        old_values = {}
        for key, val in updates.items():
            if key in lock and val is not None:
                old_values[key] = lock[key]
                lock[key] = val

        lock["text"] = format_typed_lock_text(lock)
        self._append_event("lock_updated", f"Threshold updated: {lock_id}")
        self.write()
        return old_values

    def add_decision(self, text: str, tags: list = None, source: str = "user") -> str:
        d = self.read()
        dec_id = new_id("dec")
        d["decisions"].insert(0, {
            "id": dec_id,
            "text": text,
            "createdAt": now_iso(),
            "source": source,
            "tags": tags or [],
        })
        self._append_event("decision_added", f"Decision: {text[:80]}")
        self.write()
        return dec_id

    def add_note(self, text: str, pinned: bool = True) -> str:
        d = self.read()
        note_id = new_id("note")
        d["notes"].insert(0, {
            "id": note_id,
            "text": text,
            "createdAt": now_iso(),
            "pinned": pinned,
        })
        self._append_event("note_added", f"Note: {text[:80]}")
        self.write()
        return note_id

    def add_violation(self, action: str, locks: list, top_level: str, top_confidence: int):
        d = self.read()
        violations = d["state"].setdefault("violations", [])
        violations.insert(0, {
            "at": now_iso(),
            "action": action,
            "locks": locks,
            "topLevel": top_level,
            "topConfidence": top_confidence,
        })
        if len(violations) > 100:
            d["state"]["violations"] = violations[:100]
        self.write()

    def log_change(self, summary: str, files: list = None):
        d = self.read()
        event_id = new_id("evt")
        change = {
            "eventId": event_id,
            "at": now_iso(),
            "summary": summary,
            "files": files or [],
        }
        d["state"]["recentChanges"].insert(0, change)
        if len(d["state"]["recentChanges"]) > 20:
            d["state"]["recentChanges"] = d["state"]["recentChanges"][:20]
        self._append_event("manual_change", summary, files)
        self.write()

    # --- Events ---

    def _append_event(self, event_type: str, summary: str, files: list = None):
        d = self.read()
        event_id = new_id("evt")
        event = {
            "eventId": event_id,
            "type": event_type,
            "at": now_iso(),
            "files": files or [],
            "summary": summary,
            "patchPath": "",
        }
        d["events"]["lastEventId"] = event_id
        d["events"]["count"] = d["events"].get("count", 0) + 1

        self.ensure_dirs()
        with open(self._events_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(event) + "\n")

    def read_events(self, event_type: str = None, limit: int = 50) -> list:
        if not os.path.exists(self._events_path):
            return []
        events = []
        with open(self._events_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    event = json.loads(line)
                    if event_type and event.get("type") != event_type:
                        continue
                    events.append(event)
                except json.JSONDecodeError:
                    continue
        events.reverse()
        return events[:limit]
