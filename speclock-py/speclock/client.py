"""
SpecLock REST Client — Connect to Railway-hosted SpecLock server

For text-based semantic conflict checking via the Gemini hybrid engine.
Typed constraints are checked locally (no API call needed).

Developed by Sandeep Roy (https://github.com/sgroy10)
"""

import os
from typing import Optional

import requests

DEFAULT_PROXY_URL = "https://speclock-mcp-production.up.railway.app"
TIMEOUT = 5  # seconds


class SpecLockClient:
    """REST client for the Railway-hosted SpecLock server."""

    def __init__(self, base_url: str = None):
        self.base_url = (
            base_url
            or os.environ.get("SPECLOCK_PROXY_URL")
            or DEFAULT_PROXY_URL
        )

    def health(self) -> dict:
        """Check server health."""
        resp = requests.get(f"{self.base_url}/health", timeout=TIMEOUT)
        resp.raise_for_status()
        return resp.json()

    def check_conflict(self, action: str, locks: list) -> dict:
        """Check action text against lock texts using Gemini hybrid engine.

        Args:
            action: Proposed action text (e.g., "Switch to MongoDB")
            locks: List of lock text strings (e.g., ["Database must stay PostgreSQL"])

        Returns:
            {"has_conflict": bool, "conflicts": list, "source": str}
        """
        resp = requests.post(
            f"{self.base_url}/api/check",
            json={"action": action, "locks": locks},
            timeout=TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()

        # Normalize response
        conflicts = []
        for c in data.get("conflicts", []):
            conflicts.append({
                "lock_text": c.get("lockText", ""),
                "confidence": c.get("confidence", 0),
                "level": c.get("level", "MEDIUM"),
                "reasons": c.get("reasons", []),
            })

        return {
            "has_conflict": data.get("hasConflict", False),
            "conflicts": conflicts,
            "source": data.get("source", "unknown"),
        }

    def is_available(self) -> bool:
        """Check if the Railway server is reachable."""
        try:
            h = self.health()
            return h.get("status") == "healthy"
        except Exception:
            return False
