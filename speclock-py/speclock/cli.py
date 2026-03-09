"""
SpecLock CLI — Python command-line interface

Usage:
    speclock-py init --goal "Build a safe robot"
    speclock-py lock "Never exceed motor speed 3000 RPM"
    speclock-py typed numerical --metric motor_speed --operator "<=" --value 3000 --unit RPM
    speclock-py typed range --metric temperature --min 20 --max 80 --unit "°C"
    speclock-py typed state --entity robot_arm --forbidden "EMERGENCY->IDLE"
    speclock-py check-typed --metric motor_speed --value 3500
    speclock-py check "Switch to MongoDB"
    speclock-py status

Developed by Sandeep Roy (https://github.com/sgroy10)
"""

import argparse
import json
import sys

from speclock.core import SpecLock


def main():
    parser = argparse.ArgumentParser(
        prog="speclock-py",
        description="SpecLock — AI Constraint Engine for Autonomous Systems Governance",
    )
    parser.add_argument("--root", default=".", help="Project root directory")
    sub = parser.add_subparsers(dest="command")

    # init
    init_p = sub.add_parser("init", help="Initialize SpecLock in project")
    init_p.add_argument("--goal", help="Project goal")

    # status
    sub.add_parser("status", help="Show current SpecLock state")

    # lock (text)
    lock_p = sub.add_parser("lock", help="Add a text constraint lock")
    lock_p.add_argument("text", help="Constraint text")
    lock_p.add_argument("--tags", nargs="*", default=[])

    # typed (add typed constraint)
    typed_p = sub.add_parser("typed", help="Add a typed constraint")
    typed_p.add_argument("type", choices=["numerical", "range", "state", "temporal"])
    typed_p.add_argument("--metric", help="Metric name")
    typed_p.add_argument("--operator", help="Comparison operator")
    typed_p.add_argument("--value", type=float, help="Threshold value")
    typed_p.add_argument("--min", type=float, help="Range minimum")
    typed_p.add_argument("--max", type=float, help="Range maximum")
    typed_p.add_argument("--unit", help="Unit of measurement")
    typed_p.add_argument("--entity", help="Entity name (for state)")
    typed_p.add_argument("--forbidden", help="Forbidden transitions (e.g., EMERGENCY->IDLE,SHUTDOWN->*)")
    typed_p.add_argument("--require-approval", action="store_true")
    typed_p.add_argument("--tags", nargs="*", default=[])

    # check-typed
    ct_p = sub.add_parser("check-typed", help="Check a value against typed constraints")
    ct_p.add_argument("--metric", help="Metric to check")
    ct_p.add_argument("--entity", help="Entity to check")
    ct_p.add_argument("--value", type=float, help="Proposed value")
    ct_p.add_argument("--from-state", help="Current state")
    ct_p.add_argument("--to-state", help="Target state")

    # check (text)
    check_p = sub.add_parser("check", help="Check text action against all constraints")
    check_p.add_argument("action", help="Proposed action text")

    # list
    sub.add_parser("list", help="List all constraints")

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        return

    sl = SpecLock(args.root)

    if args.command == "init":
        sl.init(goal=args.goal)
        print(f"SpecLock initialized in {sl.root}")
        if args.goal:
            print(f"Goal: {args.goal}")

    elif args.command == "status":
        s = sl.status()
        print(f"SpecLock Status ({sl.root})")
        print(f"  Goal: {s['goal'] or '(not set)'}")
        print(f"  Text locks: {s['text_locks']}")
        print(f"  Typed locks: {s['typed_locks']}")
        print(f"  Decisions: {s['decisions']}")
        print(f"  Violations blocked: {s['violations']}")
        print(f"  Events: {s['events']}")

    elif args.command == "lock":
        lock_id = sl.add_lock(args.text, tags=args.tags)
        print(f"Lock added: {lock_id}")
        print(f"  {args.text}")

    elif args.command == "typed":
        kwargs = {}
        if args.metric:
            kwargs["metric"] = args.metric
        if args.operator:
            kwargs["operator"] = args.operator
        if args.value is not None:
            kwargs["value"] = args.value
        if args.min is not None:
            kwargs["min"] = args.min
        if args.max is not None:
            kwargs["max"] = args.max
        if args.unit:
            kwargs["unit"] = args.unit
        if args.entity:
            kwargs["entity"] = args.entity
        if args.forbidden:
            # Parse "EMERGENCY->IDLE,SHUTDOWN->*" format
            forbidden = []
            for pair in args.forbidden.split(","):
                parts = pair.strip().split("->")
                if len(parts) == 2:
                    forbidden.append({"from": parts[0].strip(), "to": parts[1].strip()})
            kwargs["forbidden"] = forbidden
        if args.require_approval:
            kwargs["requireApproval"] = True

        lock_id = sl.add_typed_lock(args.type, tags=args.tags, **kwargs)
        print(f"Typed lock added ({args.type}): {lock_id}")

    elif args.command == "check-typed":
        proposed = {}
        if args.metric:
            proposed["metric"] = args.metric
        if args.entity:
            proposed["entity"] = args.entity
        if args.value is not None:
            proposed["value"] = args.value
        if args.from_state:
            proposed["from_state"] = args.from_state
        if args.to_state:
            proposed["to_state"] = args.to_state

        result = sl.check_typed(**proposed)
        if result.has_conflict:
            print(f"VIOLATION DETECTED")
            print(result.analysis)
            sys.exit(1)
        else:
            print(f"OK: {result.analysis}")

    elif args.command == "check":
        result = sl.check(action=args.action)
        if result.has_conflict:
            print(f"CONFLICT DETECTED")
            print(result.analysis)
            sys.exit(1)
        else:
            print(f"OK: {result.analysis}")

    elif args.command == "list":
        locks = sl.active_locks
        if not locks:
            print("No active locks.")
            return
        print(f"Active Locks ({len(locks)}):")
        for l in locks:
            ct = l.get("constraintType", "text")
            print(f"  [{ct}] {l['id']}: {l['text']}")


if __name__ == "__main__":
    main()
