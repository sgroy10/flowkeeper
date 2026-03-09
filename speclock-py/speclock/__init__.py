"""
SpecLock — AI Constraint Engine for Autonomous Systems Governance

Enforce safety constraints on robots, vehicles, trading systems, and medical devices.
Works with ROS2, any Python framework, or standalone.

Usage:
    from speclock import SpecLock

    sl = SpecLock("/path/to/project")
    sl.add_typed_lock("numerical", metric="motor_speed", operator="<=", value=3000, unit="RPM")
    result = sl.check_typed(metric="motor_speed", value=3500)
    # result.has_conflict == True

Developed by Sandeep Roy (https://github.com/sgroy10)
"""

__version__ = "5.0.0"
__author__ = "Sandeep Roy"

from speclock.core import SpecLock
from speclock.constraints import (
    CONSTRAINT_TYPES,
    OPERATORS,
    validate_typed_lock,
    check_typed_constraint,
    check_all_typed_constraints,
    format_typed_lock_text,
)
from speclock.brain import Brain

__all__ = [
    "SpecLock",
    "Brain",
    "CONSTRAINT_TYPES",
    "OPERATORS",
    "validate_typed_lock",
    "check_typed_constraint",
    "check_all_typed_constraints",
    "format_typed_lock_text",
]
