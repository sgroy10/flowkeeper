"""
SpecLock Core — High-level Python API

The main entry point for using SpecLock in Python applications.
Provides a unified interface for constraint management and checking.

Usage:
    from speclock import SpecLock

    # Initialize
    sl = SpecLock("/path/to/project")

    # Add constraints
    sl.add_typed_lock("numerical", metric="motor_speed", operator="<=", value=3000, unit="RPM")
    sl.add_typed_lock("range", metric="temperature", min=20, max=80, unit="°C")
    sl.add_typed_lock("state", entity="robot_arm",
                      forbidden=[{"from": "EMERGENCY", "to": "IDLE"}],
                      requireApproval=True)
    sl.add_typed_lock("temporal", metric="sensor_interval", operator="<=", value=100, unit="ms")

    # Check constraints (real-time)
    result = sl.check_typed(metric="motor_speed", value=3500)
    if result.has_conflict:
        print(f"VIOLATION: {result.analysis}")
        for lock in result.conflicting_locks:
            print(f"  - {lock['reasons'][0]}")

    # Check text constraints (semantic, via Railway proxy)
    result = sl.check_text("Switch database to MongoDB")
    if result["has_conflict"]:
        print("Semantic conflict detected!")

Developed by Sandeep Roy (https://github.com/sgroy10)
"""

import os
from dataclasses import dataclass, field
from typing import Any, Optional

from speclock.brain import Brain
from speclock.constraints import (
    check_all_typed_constraints,
    check_typed_constraint,
    validate_typed_lock,
    format_typed_lock_text,
    CONSTRAINT_TYPES,
)


@dataclass
class ConstraintResult:
    """Result of a constraint check."""
    has_conflict: bool
    conflicting_locks: list = field(default_factory=list)
    analysis: str = ""

    def __bool__(self):
        return self.has_conflict


class SpecLock:
    """High-level SpecLock API for Python applications.

    Works with the same .speclock/brain.json as the Node.js version.
    Both can read/write the same project simultaneously.
    """

    def __init__(self, root: str = None):
        """Initialize SpecLock.

        Args:
            root: Project root directory. Defaults to current directory.
        """
        self.root = os.path.abspath(root or os.getcwd())
        self.brain = Brain(self.root)
        self._client = None

    def init(self, goal: str = None) -> "SpecLock":
        """Initialize SpecLock in the project directory.

        Creates .speclock/ directory and brain.json if they don't exist.
        """
        self.brain.ensure_dirs()
        self.brain.read()  # Creates default if missing
        self.brain.write()
        if goal:
            self.brain.set_goal(goal)
        return self

    # --- Typed Constraints ---

    def add_typed_lock(
        self,
        constraint_type: str,
        description: str = None,
        tags: list = None,
        source: str = "user",
        **kwargs,
    ) -> str:
        """Add a typed constraint lock.

        Examples:
            sl.add_typed_lock("numerical", metric="motor_speed", operator="<=", value=3000, unit="RPM")
            sl.add_typed_lock("range", metric="temperature", min=20, max=80, unit="°C")
            sl.add_typed_lock("state", entity="robot_arm",
                              forbidden=[{"from": "EMERGENCY", "to": "IDLE"}])
            sl.add_typed_lock("temporal", metric="sensor_interval", operator="<=", value=100, unit="ms")

        Returns: lock_id
        """
        return self.brain.add_typed_lock(constraint_type, description, tags, source, **kwargs)

    def check_typed(self, **proposed) -> ConstraintResult:
        """Check a proposed value or state transition against typed constraints.

        Examples:
            result = sl.check_typed(metric="motor_speed", value=3500)
            result = sl.check_typed(metric="temperature", value=95)
            result = sl.check_typed(entity="robot_arm", from_state="EMERGENCY", to_state="IDLE")
            result = sl.check_typed(metric="sensor_interval", value=200)

        Returns: ConstraintResult
        """
        # Normalize from_state/to_state to from/to
        if "from_state" in proposed:
            proposed["from"] = proposed.pop("from_state")
        if "to_state" in proposed:
            proposed["to"] = proposed.pop("to_state")

        locks = self.brain.active_locks
        result = check_all_typed_constraints(locks, proposed)
        return ConstraintResult(
            has_conflict=result["has_conflict"],
            conflicting_locks=result.get("conflicting_locks", []),
            analysis=result.get("analysis", ""),
        )

    def update_threshold(self, lock_id: str, **updates) -> dict:
        """Update a typed lock's threshold.

        Examples:
            sl.update_threshold("lock_abc123", value=4000)
            sl.update_threshold("lock_abc123", min=10, max=90)
        """
        return self.brain.update_typed_threshold(lock_id, **updates)

    def list_typed_locks(self) -> list:
        """List all active typed constraints."""
        return self.brain.typed_locks

    # --- Text Constraints ---

    def add_lock(self, text: str, tags: list = None, source: str = "user") -> str:
        """Add a text-based constraint lock (uses semantic engine)."""
        return self.brain.add_lock(text, tags, source)

    def remove_lock(self, lock_id: str) -> bool:
        """Remove (deactivate) a lock by ID."""
        return self.brain.remove_lock(lock_id)

    def check_text(self, action: str) -> dict:
        """Check an action against text locks using the Railway proxy (Gemini hybrid).

        Falls back gracefully if proxy is unavailable.
        """
        text_locks = [l["text"] for l in self.brain.text_locks]
        if not text_locks:
            return {"has_conflict": False, "conflicts": [], "source": "local"}

        try:
            from speclock.client import SpecLockClient
            if self._client is None:
                self._client = SpecLockClient()
            return self._client.check_conflict(action, text_locks)
        except Exception:
            # Proxy unavailable — return safe (graceful degradation)
            return {"has_conflict": False, "conflicts": [], "source": "offline"}

    # --- Full Check (both typed + text) ---

    def check(self, action: str = None, **proposed) -> ConstraintResult:
        """Check against ALL constraints (typed + text).

        For typed: pass metric/entity/value/from_state/to_state as kwargs.
        For text: pass action as a string.
        For both: pass both.

        Examples:
            # Typed only
            result = sl.check(metric="motor_speed", value=3500)

            # Text only
            result = sl.check(action="Switch to MongoDB")

            # Both
            result = sl.check(action="Increase speed", metric="motor_speed", value=3500)
        """
        all_conflicts = []
        analysis_parts = []

        # Check typed constraints
        if any(k in proposed for k in ("metric", "entity", "value", "from_state", "to_state", "from", "to")):
            typed_result = self.check_typed(**proposed)
            if typed_result.has_conflict:
                all_conflicts.extend(typed_result.conflicting_locks)
                analysis_parts.append(typed_result.analysis)

        # Check text constraints
        if action:
            text_result = self.check_text(action)
            if text_result.get("has_conflict"):
                for c in text_result.get("conflicts", []):
                    all_conflicts.append({
                        "id": "proxy",
                        "text": c.get("lock_text", ""),
                        "constraint_type": "text",
                        "confidence": c.get("confidence", 0),
                        "level": c.get("level", "MEDIUM"),
                        "reasons": c.get("reasons", []),
                    })
                analysis_parts.append(f"Text semantic conflict detected ({text_result.get('source', 'proxy')})")

        if not all_conflicts:
            return ConstraintResult(
                has_conflict=False,
                analysis="All constraints checked. No violations detected.",
            )

        return ConstraintResult(
            has_conflict=True,
            conflicting_locks=all_conflicts,
            analysis="\n".join(analysis_parts) if analysis_parts else f"{len(all_conflicts)} violation(s) detected.",
        )

    # --- Memory ---

    def set_goal(self, text: str):
        self.brain.set_goal(text)

    def add_decision(self, text: str, tags: list = None, source: str = "user") -> str:
        return self.brain.add_decision(text, tags, source)

    def add_note(self, text: str, pinned: bool = True) -> str:
        return self.brain.add_note(text, pinned)

    def log_change(self, summary: str, files: list = None):
        self.brain.log_change(summary, files)

    # --- Info ---

    @property
    def goal(self) -> str:
        return self.brain.goal

    @property
    def active_locks(self) -> list:
        return self.brain.active_locks

    @property
    def decisions(self) -> list:
        return self.brain.decisions

    @property
    def violations(self) -> list:
        return self.brain.violations

    def status(self) -> dict:
        """Get a summary of the current SpecLock state."""
        return {
            "goal": self.brain.goal,
            "text_locks": len(self.brain.text_locks),
            "typed_locks": len(self.brain.typed_locks),
            "total_locks": len(self.brain.active_locks),
            "decisions": len(self.brain.decisions),
            "notes": len(self.brain.notes),
            "violations": len(self.brain.violations),
            "events": self.brain.data.get("events", {}).get("count", 0),
        }

    def __repr__(self):
        s = self.status()
        return f"SpecLock(root={self.root!r}, locks={s['total_locks']}, typed={s['typed_locks']}, violations={s['violations']})"
