# SpecLock

**AI Constraint Engine** — Memory + enforcement for AI coding tools. The only solution that makes your AI **respect boundaries**, not just remember things.

> Developed by **Sandeep Roy** ([github.com/sgroy10](https://github.com/sgroy10))

**Website**: [sgroy10.github.io/speclock](https://sgroy10.github.io/speclock/) | **npm**: [npmjs.com/package/speclock](https://www.npmjs.com/package/speclock) | **Smithery**: [smithery.ai/servers/sgroy10/speclock](https://smithery.ai/servers/sgroy10/speclock)

[![npm version](https://img.shields.io/npm/v/speclock.svg)](https://www.npmjs.com/package/speclock)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-green.svg)](https://modelcontextprotocol.io)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)

---

## The Problem

AI tools now have memory. Claude Code has auto-memory. Cursor has Memory Bank. Mem0 exists.

**But memory without enforcement is dangerous.**

- Your AI remembers you use PostgreSQL — then switches to MongoDB because it "seemed better"
- Your AI remembers your auth setup — then rewrites it while "fixing" a bug
- Your AI remembers your constraints — then ignores them when they're inconvenient
- You said "never touch auth files" 3 sessions ago — the AI doesn't care

**Remembering is not the same as respecting.** AI tools need guardrails, not just memory.

## The Solution

SpecLock adds **active constraint enforcement** on top of persistent memory. When your AI tries to break something you locked, SpecLock **stops it before the damage is done**.

```
You:    "Don't ever touch the auth files"
AI:     🔒 Locked: "Never modify auth files"

... 5 sessions later ...

You:    "Add social login to the login page"
AI:     ⚠️ CONFLICT: This violates your lock "Never modify auth files"
        Should I proceed or find another approach?
```

No other tool does this. Not Claude's native memory. Not Mem0. Not CLAUDE.md files.

## How SpecLock Is Different

| Feature | Claude Native Memory | Mem0 | CLAUDE.md / .cursorrules | **SpecLock** |
|---------|---------------------|------|--------------------------|--------------|
| Remembers context | Yes | Yes | Manual | **Yes** |
| **Stops the AI from breaking things** | No | No | No | **Yes — active enforcement** |
| **Semantic conflict detection** | No | No | No | **Yes — synonym + negation analysis** |
| Works on Bolt.new | No | No | No | **Yes — npm file-based mode** |
| Works on Lovable | No | No | No | **Yes — MCP remote** |
| Structured decisions/locks | No | Tags only | Flat text | **Goals, locks, decisions, changes** |
| Git-aware (checkpoints, rollback) | No | No | No | **Yes** |
| Drift detection | No | No | No | **Yes — scans changes against locks** |
| Multi-agent timeline | No | No | No | **Yes** |
| Cross-platform | Claude only | MCP only | Tool-specific | **Universal (MCP + npm)** |

**Other tools remember. SpecLock enforces.**

## Quick Start

### Bolt.new / Aider / Any npm Platform (No MCP Needed)

Just tell the AI:

```
"Install speclock and set up project memory"
```

Or run it yourself:

```bash
npx speclock setup --goal "Build my app"
```

**That's it.** SpecLock creates `SPECLOCK.md`, injects a marker into `package.json`, and generates `.speclock/context/latest.md`. The AI reads these automatically and follows the rules. When the AI returns in a new session, it sees the SpecLock marker in `package.json` and knows to check the rules before making changes.

### Lovable (MCP Remote — No Install)

1. Go to **Settings → Connectors → Personal connectors → New MCP server**
2. Enter URL: `https://speclock-mcp-production.up.railway.app/mcp` — No auth
3. Paste [Project Instructions](#project-instructions) into Knowledge

### Claude Code (MCP Local)

Add to `.claude/settings.json` or `.mcp.json`:

```json
{
  "mcpServers": {
    "speclock": {
      "command": "npx",
      "args": ["-y", "speclock", "serve", "--project", "."]
    }
  }
}
```

### Cursor / Windsurf / Cline

Same MCP config as Claude Code. Add to `.cursor/mcp.json` or equivalent.

### Project Instructions

For MCP platforms, paste these rules into your platform's instruction settings (Lovable Knowledge, .cursorrules, CLAUDE.md, etc.):

```
## SpecLock Rules (MANDATORY — follow on every message)

1. START: Call speclock_session_briefing FIRST. Show: "🔒 Memory loaded — X locks, Y decisions."
2. BEFORE CHANGES: Call speclock_check_conflict. If HIGH conflict, STOP and warn.
3. LOCK: When user says "never/always/don't touch" → call speclock_add_lock immediately.
4. AFTER FEATURES: Call speclock_log_change with summary + files affected.
5. UNLOCK: When user wants to change something locked → warn first, only proceed on confirm.
6. END: Call speclock_session_summary with what was accomplished.
```

See [SPECLOCK-INSTRUCTIONS.md](SPECLOCK-INSTRUCTIONS.md) for platform-specific versions.

## What It Looks Like In Practice

### Bolt.new — Session 1 (Setup)
```
User: "Install speclock and set up memory for my SaaS"

Bolt: ✓ Ran npx speclock setup
      ✓ Set goal: "Build B2B SaaS API"
      ✓ Added 6 locks (auth, security, rate limiting...)
      ✓ Recorded 7 decisions (Supabase, Stripe, Gemini...)
      ✓ Context file generated — project memory active
```

### Bolt.new — Session 2 (Full Memory)
```
User: "Create a plan for the API endpoints"

Bolt: ✓ Read project context (6 locks, 7 decisions)
      ✓ Created 10-phase plan respecting ALL constraints
      ✓ All plans use Supabase (locked), Bearer auth (locked)
      ✓ Logged planning phase back to SpecLock
```

### Any Platform — Constraint Enforcement
```
You:    "Add social login to the login page"
AI:     ⚠️ CONFLICT (HIGH — 100%): Violates lock "Never modify auth files"
        Reasons:
        - Direct keyword match: auth
        - Synonym match: security, authentication
        - Lock prohibits this action (negation detected)

        Should I proceed or find another approach?
```

## Killer Feature: Semantic Conflict Detection

Not just keyword matching. SpecLock uses **synonym expansion** (15 groups), **negation detection**, and **destructive action flagging**:

```
Lock:   "No breaking changes to public API"
Action: "Remove the external endpoints"

Result: [HIGH] Conflict detected (confidence: 85%)
  - synonym match: remove/delete, external/public, endpoints/api
  - lock prohibits this action (negation detected)
  - destructive action against locked constraint
```

## Three Integration Modes

| Mode | Platforms | How It Works |
|------|-----------|--------------|
| **MCP Remote** | Lovable, bolt.diy, Base44 | Connect via URL — no install needed |
| **MCP Local** | Claude Code, Cursor, Windsurf, Cline | `npx speclock serve` — 22 tools via MCP |
| **npm File-Based** | Bolt.new, Aider, Rocket.new | `npx speclock setup` — AI reads SPECLOCK.md + uses CLI |

## 22 MCP Tools

### Memory Management
| Tool | Purpose |
|------|---------|
| `speclock_init` | Initialize SpecLock in project |
| `speclock_get_context` | **THE KEY TOOL** — full context pack |
| `speclock_set_goal` | Set/update project goal |
| `speclock_add_lock` | Add non-negotiable constraint |
| `speclock_remove_lock` | Deactivate a lock by ID |
| `speclock_add_decision` | Record an architectural decision |
| `speclock_add_note` | Add a pinned note |
| `speclock_set_deploy_facts` | Record deploy configuration |

### Change Tracking
| Tool | Purpose |
|------|---------|
| `speclock_log_change` | Log a significant change |
| `speclock_get_changes` | Get recent tracked changes |
| `speclock_get_events` | Get event log (filterable) |

### Enforcement & Protection
| Tool | Purpose |
|------|---------|
| `speclock_check_conflict` | Check action against locks (semantic matching) |
| `speclock_session_briefing` | Start session + full briefing |
| `speclock_session_summary` | End session + record summary |

### Git Integration
| Tool | Purpose |
|------|---------|
| `speclock_checkpoint` | Create named git tag for rollback |
| `speclock_repo_status` | Branch, commit, changed files, diff |

### Intelligence
| Tool | Purpose |
|------|---------|
| `speclock_suggest_locks` | AI-powered lock suggestions from patterns |
| `speclock_detect_drift` | Scan changes for constraint violations |
| `speclock_health` | Health score + multi-agent timeline |

### Templates, Reports & Enforcement (v1.7.0)
| Tool | Purpose |
|------|---------|
| `speclock_apply_template` | Apply pre-built constraint templates (nextjs, react, express, etc.) |
| `speclock_report` | Violation report — blocked change stats |
| `speclock_audit` | Audit staged files against active locks |

## Auto-Guard: Locks That Actually Work

When you add a lock, SpecLock **automatically finds and guards related files**:

```
speclock lock "Never modify auth files"
→ Auto-guarded 2 related file(s):
  🔒 src/components/Auth.tsx
  🔒 src/contexts/AuthContext.tsx

speclock lock "Database must always be Supabase"
→ Auto-guarded 1 related file(s):
  🔒 src/lib/supabase.ts
```

The guard injects a warning **directly inside the file**. When the AI opens the file to edit it, it sees:
```
// ============================================================
// SPECLOCK-GUARD — DO NOT MODIFY THIS FILE
// LOCKED: Never modify auth files
// THIS FILE IS LOCKED. DO NOT EDIT, CHANGE, OR REWRITE ANY PART OF IT.
// The user must say "unlock" before this file can be changed.
// A question is NOT permission. Asking about features is NOT permission.
// ONLY "unlock" or "remove the lock" is permission to edit this file.
// ============================================================
```

Active locks are also embedded in `package.json` — so the AI sees your constraints every time it reads the project config.

## CLI Commands

```bash
# Setup
speclock setup --goal "Build my app" --template nextjs  # One-shot setup + template

# Memory
speclock goal <text>                   # Set project goal
speclock lock <text> [--tags a,b]      # Add constraint + auto-guard files
speclock lock remove <id>              # Remove a lock
speclock decide <text>                 # Record a decision
speclock note <text>                   # Add a note

# Enforcement
speclock check <text>                  # Check for lock conflicts
speclock guard <file> --lock "text"    # Manually guard a specific file
speclock unguard <file>                # Remove guard from file

# Templates (v1.7.0)
speclock template list                 # List available templates
speclock template apply <name>         # Apply: nextjs, react, express, supabase, stripe, security-hardened

# Violation Report (v1.7.0)
speclock report                        # Show violation stats + most tested locks

# Git Pre-commit Hook (v1.7.0)
speclock hook install                  # Install pre-commit hook
speclock hook remove                   # Remove pre-commit hook
speclock audit                         # Audit staged files against locks

# Tracking
speclock log-change <text> --files x   # Log a change
speclock context                       # Regenerate context file

# Other
speclock status                        # Show brain summary
speclock serve [--project <path>]      # Start MCP server
speclock watch                         # Start file watcher
```

## Architecture

```
┌─────────────────────────────────────────────────────┐
│       AI Tool (Bolt.new, Lovable, Claude Code)       │
└──────────────┬──────────────────┬────────────────────┘
               │                  │
     MCP Protocol          File-Based (npm)
    (22 tool calls)      (reads SPECLOCK.md +
                        .speclock/context/latest.md,
                         runs CLI commands)
               │                  │
┌──────────────▼──────────────────▼────────────────────┐
│              SpecLock Core Engine                      │
│   Memory | Tracking | Enforcement | Git | Intelligence│
└──────────────────────┬───────────────────────────────┘
                       │
                .speclock/
                ├── brain.json         (structured memory)
                ├── events.log         (immutable audit trail)
                ├── patches/           (git diffs per event)
                └── context/
                    └── latest.md      (human-readable context)
```

## Contributing

Contributions welcome! Please open an issue or PR on [GitHub](https://github.com/sgroy10/speclock).

## License

MIT License - see [LICENSE](LICENSE) file.

## Author

**Developed by Sandeep Roy**

- GitHub: [github.com/sgroy10](https://github.com/sgroy10)
- Repository: [github.com/sgroy10/speclock](https://github.com/sgroy10/speclock)
- npm: [npmjs.com/package/speclock](https://www.npmjs.com/package/speclock)

---

*SpecLock v1.7.0 — Because remembering isn't enough. AI needs to respect boundaries.*
