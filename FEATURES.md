# SpecLock v5.5.2 — Complete Feature Guide

**AI Constraint Engine** — The only tool that gives AI coding assistants persistent memory AND active constraint enforcement across sessions.

> Developed by **Sandeep Roy** ([github.com/sgroy10](https://github.com/sgroy10))
> Free & Open Source — MIT License — No limits, no paywalls

---

## What SpecLock Does

SpecLock solves the #1 problem in AI-assisted development: **AI amnesia and constraint drift**.

Every AI coding tool — Lovable, Bolt.new, Claude Code, Cursor — forgets everything when a session ends. Worse, even within a session, AI tools silently violate rules you set — switching your database, rewriting auth, changing payment providers.

**Other tools remember. SpecLock enforces.**

SpecLock creates a `.speclock/` directory in your project that serves as **persistent, structured memory** with **active enforcement** for any AI tool. It stores:

- **Goals** — What you're building
- **Locks** — Non-negotiable constraints ("never touch auth files")
- **Decisions** — Architectural choices ("use Supabase for auth")
- **Changes** — What was built and when
- **Sessions** — Which AI tools worked on the project and what they did
- **Events** — Immutable HMAC-signed audit trail of everything that happened

The AI reads this memory at the start of every session and is **blocked from violating constraints** — not just warned.

---

## How SpecLock Is Different

| Feature | CLAUDE.md / .cursorrules | Chat History | Memory Plugins | **SpecLock** |
|---------|--------------------------|--------------|----------------|--------------|
| Structured memory | Static files (manual) | Noise-heavy (unstructured) | Generic (key-value) | **Structured brain.json** |
| Constraint enforcement | None | None | None | **Hard blocking (isError: true)** |
| Conflict detection | None | None | None | **Semantic engine — 98% detection, 0% FP** |
| Works without MCP | No | N/A | No | **Yes — npm file-based mode** |
| Cross-platform | Tool-specific | Tool-specific | Tool-specific | **Universal (MCP + npm)** |
| Auto-capture | No | No | No | **Yes — from natural language** |
| Audit trail | No | Partial | No | **HMAC-SHA256 signed immutable event log** |
| Compliance exports | No | No | No | **SOC 2, HIPAA, CSV** |
| Git-aware | No | No | No | **Checkpoints, diffs, pre-commit hooks** |
| LLM hybrid detection | No | No | No | **Gemini Flash for unknown domains** |

---

## Three Integration Modes

SpecLock works everywhere because it has three ways to connect:

### Mode 1: MCP Remote (Lovable, bolt.diy, Base44)
```
Platform connects to SpecLock's hosted MCP server via URL.
No installation needed. 51 tools available automatically.

URL: https://speclock-mcp-production.up.railway.app/mcp
```

### Mode 2: MCP Local (Claude Code, Cursor, Windsurf, Cline)
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
The AI tool runs the MCP server locally. 51 tools available via MCP protocol. Claude Code follows server instructions automatically — zero config.

### Mode 3: npm File-Based (Bolt.new, Aider, any platform with npm)
```bash
npx speclock setup --goal "Build my app"
```
Creates `SPECLOCK.md` in project root + `.speclock/` directory. The AI reads the rules file and uses CLI commands instead of MCP tools. **No MCP support needed.**

This is the breakthrough — SpecLock works on platforms that don't support MCP at all.

---

## Semantic Conflict Detection Engine v4

Not keyword matching — **real semantic analysis** with Gemini Flash LLM hybrid for universal domain coverage.

**991 tests across 15 suites. 99.4% accuracy. 0 false positives across 15 domains (fintech, e-commerce, IoT, healthcare, SaaS, robotics, autonomous systems, and more).**

The engine includes:
- **65+ synonym groups** — Maps across destructive, constructive, modification, security, medical, financial, IoT, payments, and DevOps domains
- **80+ euphemism mappings** — "clean up" → delete, "streamline" → remove, "sunset" → deprecate, "bridge" → connect
- **Domain concept maps** — "safety scanning" ↔ "CSAM detection", "PHI" ↔ "patient records", Stripe ↔ Razorpay ↔ PayU (11 payment gateways)
- **Intent classifier** — "Enable X" correctly allowed against "Never disable X" (opposite-pair detection)
- **Compound sentence splitter** — Catches violations hidden in multi-clause actions
- **Temporal evasion detection** — "temporarily disable" gets HIGHER severity, not lower
- **Smart Lock Authoring** — Auto-extracts subject and intent from natural language locks
- **Gemini Flash LLM hybrid** — Heuristic handles known domains instantly (free, offline). Gemini covers unknown domains (gaming, biotech, aerospace, legal, music). Grey-zone detection: LLM fires only for 1-70% heuristic confidence. Cost: ~$0.01 per 1000 checks.

### Examples:
```
Lock:    "We use Stripe for payments — never switch provider"
Action:  "Integrate Razorpay for better Indian merchant rates"
Result:  CONFLICT (HIGH — 95%) — Stripe and Razorpay are both payment gateways

Lock:    "Never delete patient records"
Action:  "Clean up old patient data from cold storage"
Result:  CONFLICT (HIGH — 100%) — euphemism "clean up" detected as deletion

Lock:    "Never disable audit logging"
Action:  "Enable comprehensive audit logging"
Result:  NO CONFLICT (7%) — intent alignment: "enable" is opposite of "disable"

Lock:    "Database must stay PostgreSQL"
Action:  "Migrate to MongoDB for better scalability"
Result:  CONFLICT (HIGH — 100%) — PostgreSQL and MongoDB are both databases
```

---

## 51 MCP Tools

### Memory Management (8 tools)
| Tool | Purpose |
|------|---------|
| `speclock_init` | Initialize SpecLock in project |
| `speclock_get_context` | Full structured context pack |
| `speclock_set_goal` | Set/update project goal |
| `speclock_add_lock` | Add non-negotiable constraint |
| `speclock_remove_lock` | Deactivate a lock by ID |
| `speclock_add_decision` | Record an architectural decision |
| `speclock_add_note` | Add a pinned note |
| `speclock_set_deploy_facts` | Record deploy configuration |

### Change Tracking (3 tools)
| Tool | Purpose |
|------|---------|
| `speclock_log_change` | Log a significant change with files |
| `speclock_get_changes` | Get recent tracked changes |
| `speclock_get_events` | Get event log (filterable by type/time) |

### Continuity Protection (3 tools)
| Tool | Purpose |
|------|---------|
| `speclock_check_conflict` | Hybrid heuristic + Gemini LLM conflict detection |
| `speclock_session_briefing` | Start session + full briefing |
| `speclock_session_summary` | End session + record summary |

### Git Integration (2 tools)
| Tool | Purpose |
|------|---------|
| `speclock_checkpoint` | Create named git tag for rollback |
| `speclock_repo_status` | Branch, commit, changed files, diff |

### Intelligence (3 tools)
| Tool | Purpose |
|------|---------|
| `speclock_suggest_locks` | AI-powered lock suggestions from patterns |
| `speclock_detect_drift` | Scan changes for constraint violations |
| `speclock_health` | Health score + multi-agent timeline |

### Templates, Reports & Enforcement (3 tools)
| Tool | Purpose |
|------|---------|
| `speclock_apply_template` | Apply pre-built constraint templates (nextjs, react, express, etc.) |
| `speclock_report` | Violation report — how many times SpecLock blocked changes |
| `speclock_audit` | Audit staged files against active locks (used by pre-commit hook) |

### Enterprise Compliance (2 tools)
| Tool | Purpose |
|------|---------|
| `speclock_verify_audit` | Verify HMAC audit chain integrity — detect tampering |
| `speclock_export_compliance` | Generate SOC 2 / HIPAA / CSV compliance reports |

### Hard Enforcement (4 tools)
| Tool | Purpose |
|------|---------|
| `speclock_set_enforcement` | Set enforcement mode: advisory (warn) or hard (block) |
| `speclock_override_lock` | Override a lock with justification — logged to audit trail |
| `speclock_semantic_audit` | Semantic pre-commit: analyze code changes vs locks |
| `speclock_override_history` | View lock override history for audit review |

### Policy & Security (3 tools)
| Tool | Purpose |
|------|---------|
| `speclock_policy_evaluate` | Evaluate YAML policy-as-code rules |
| `speclock_guard_file` | Add SPECLOCK-GUARD header to lock specific files |
| `speclock_auto_guard` | Auto-guard files related to lock keywords |

### Typed Constraints (4 tools)
| Tool | Purpose |
|------|---------|
| `speclock_add_typed_lock` | Add typed constraint (numerical/range/state/temporal) |
| `speclock_check_typed` | Check proposed values against typed constraints |
| `speclock_list_typed_locks` | List all typed constraints with current thresholds |
| `speclock_update_threshold` | Update typed lock thresholds dynamically |

### Spec Compiler & Code Graph (4 tools)
| Tool | Purpose |
|------|---------|
| `speclock_compile_spec` | Compile natural language (PRDs, READMEs, docs) into structured constraints via Gemini Flash |
| `speclock_build_graph` | Build/refresh code dependency graph from imports (JS/TS/Python) |
| `speclock_blast_radius` | Calculate blast radius — transitive dependents, impact %, depth |
| `speclock_map_locks` | Map active locks to actual code files via the dependency graph |

### Patch Gateway & AI Patch Firewall (3 tools)
| Tool | Purpose |
|------|---------|
| `speclock_review_patch` | ALLOW/WARN/BLOCK verdict — combines semantic conflict + lock-file mapping + blast radius |
| `speclock_review_patch_diff` | Diff-native review — parses actual diffs for interface breaks, protected symbols, dependency drift, schema changes, API impact |
| `speclock_parse_diff` | Parse unified diff into structured changes — imports, exports, symbols, routes, schema detection |

### Guardian Mode (2 tools) — NEW in v5.5.2
| Tool | Purpose |
|------|---------|
| `speclock_protect` | Zero-config: reads existing .cursorrules/CLAUDE.md/AGENTS.md, extracts constraints, installs hook, syncs rules |
| `speclock_discover_rules` | Discover all AI rule files in the project and show which tools have rules configured |

---

## Patch Gateway (v5.1)

One API call to gate every change:

```
Input:  { description: "Add social login", files: ["src/auth/login.js"] }
Output: { verdict: "BLOCK", riskScore: 85, reasons: [...], blastRadius: {...} }
```

Combines: semantic conflict detection + lock-to-file mapping (via Code Graph) + blast radius analysis + typed constraint awareness → single ALLOW/WARN/BLOCK verdict with risk score (0-100).

## AI Patch Firewall (v5.2)

Reviews actual diffs — catches things intent review misses:

**Signal detection (10 scored dimensions):**
| Signal | Max Score | What it detects |
|--------|-----------|-----------------|
| Semantic Conflict | 20 | NL match against active locks |
| Lock-File Overlap | 20 | Changed files in locked zones |
| Blast Radius | 15 | High transitive impact |
| Interface Break | 15 | Removed/changed exports |
| Protected Symbol Edit | 15 | Modifications in locked zones |
| Dependency Drift | 8 | Critical package add/remove |
| Schema Change | 12 | Destructive migration/schema edits |
| Public API Impact | 15 | Route changes/removals |
| Typed Constraint | 10 | Relevant typed constraints |
| LLM Conflict | 10 | Gemini-enhanced detection |

**Hard escalation rules (auto-BLOCK regardless of score):**
- Protected symbol removed/renamed in locked zone
- Destructive schema/migration change
- Public API route removed
- Two or more critical reasons with confidence > 90%

**Unified review:** Intent (35%) + Diff (65%) → takes the stronger verdict. Falls back to intent-only when no diff available.

---

## 7 Layers of Enforcement

SpecLock doesn't rely on the AI choosing to follow rules. It has 7 independent enforcement layers:

| Layer | Mechanism | Can Block? |
|-------|-----------|-----------|
| **MCP Instructions** | MANDATORY workflow injected via MCP protocol | Behavioral |
| **isError Flag** | `isError: true` in MCP response — AI cannot proceed | Yes |
| **Enforcer Module** | Hard/Advisory mode with configurable threshold (70% default) | Yes |
| **Git Pre-Commit Hook** | `npx speclock hook install` — blocks commits at git level | Yes |
| **File Guards** | Physical `SPECLOCK-GUARD` markers in source files | Yes |
| **Semantic Pre-Commit Audit** | Parses actual git diff against all locks | Yes |
| **Policy-as-Code** | YAML rules with `enforce: "block"` directive | Yes |

---

## Hard Enforcement

Two modes:

```
Advisory (default):  AI gets a warning, decides what to do
Hard mode:           AI is BLOCKED — MCP returns isError, AI cannot proceed
```

```bash
npx speclock enforce hard   # Enable hard mode
```

### Block Threshold
Configurable (default **70%** confidence). Any proposed action matching a lock at or above this threshold is blocked in hard mode.

### Override Mechanism
When blocked, changes can be overridden with justification:
```bash
npx speclock override <lockId> "Reason for override"
```
Every override is **logged to the HMAC-signed audit trail**. Overrides do not remove the lock — they grant a one-time exception.

### Escalation
If a lock accumulates **3+ overrides**, SpecLock auto-pins a review note flagging it. Prevents "override fatigue" from silently eroding constraints.

---

## Enterprise Features

### HMAC Audit Chain
Every event in `events.log` is signed with HMAC-SHA256, chained to the previous event's hash. Tampering with any event breaks the chain — detectable instantly.

### Compliance Exports
| Format | Command | Output |
|--------|---------|--------|
| **SOC 2** | `npx speclock export --format soc2` | JSON: constraints, access logs, decisions, audit chain |
| **HIPAA** | `npx speclock export --format hipaa` | JSON: PHI-filtered constraints, safeguard status, encryption |
| **CSV** | `npx speclock export --format csv` | Spreadsheet: all events with timestamps, IDs, hashes |

### Security & Access Control
- **API Key Authentication** — SHA-256 hashed keys, create/rotate/revoke via CLI
- **RBAC with 4 Roles** — viewer, developer, architect, admin
- **AES-256-GCM Encrypted Storage** — Transparent encrypt-on-write / decrypt-on-read for brain.json and events.log
- **Policy-as-Code (YAML)** — Define file-pattern rules with `enforce: "block"`, `"warn"`, or `"log"`

---

## CLI Commands

```bash
# Setup & Initialization
npx speclock setup --goal "Project goal" --template nextjs
npx speclock init

# Memory Management
npx speclock goal "Project goal text"
npx speclock lock "Constraint text"
npx speclock lock remove <lockId>
npx speclock decide "Decision text"
npx speclock note "Note text"

# Change Tracking
npx speclock log-change "What changed" --files a.ts,b.ts
npx speclock context                        # Regenerate context file

# Protection
npx speclock check "What you plan to do"    # Check for conflicts

# Templates
npx speclock template list
npx speclock template apply nextjs

# Git Hooks
npx speclock hook install                   # Install pre-commit hook
npx speclock hook remove
npx speclock audit                          # Audit staged files vs locks

# Enforcement
npx speclock enforce <advisory|hard>
npx speclock override <lockId> <reason>
npx speclock overrides
npx speclock audit-semantic

# Enterprise
npx speclock audit-verify                   # Verify HMAC audit chain
npx speclock export --format soc2|hipaa|csv
npx speclock report

# Auth
npx speclock auth create-key --role admin
npx speclock auth rotate-key
npx speclock auth revoke-key
npx speclock auth list-keys

# Information
npx speclock status
npx speclock serve --project .              # Start MCP server
npx speclock watch                          # File watcher
```

---

## Platform Compatibility

| Platform | MCP Support | SpecLock Mode | Setup Time |
|----------|------------|---------------|------------|
| **Bolt.new** | No | npm file-based | 1 min |
| **Lovable** | Yes | MCP remote | 3 min |
| **Claude Code** | Yes | MCP local | 1 min |
| **Cursor** | Yes | MCP local | 2 min |
| **Windsurf** | Yes | MCP local | 2 min |
| **Cline** | Yes | MCP local | 2 min |
| **bolt.diy** | Yes | MCP remote | 2 min |
| **Aider** | No | npm file-based | 1 min |
| **Codex** | Yes | Via Smithery | 2 min |
| **Replit** | Yes | MCP | 2 min |
| **v0 (Vercel)** | Yes | MCP | 2 min |

---

## Technical Architecture

```
┌─────────────────────────────────────────────────────┐
│       AI Tool (Bolt.new, Lovable, Claude Code)       │
└──────────────┬──────────────────┬────────────────────┘
               │                  │
     MCP Protocol          File-Based (npm)
    (51 tool calls)      (reads SPECLOCK.md +
                        .speclock/context/latest.md,
                         runs CLI commands)
               │                  │
┌──────────────▼──────────────────▼────────────────────┐
│              SpecLock Core Engine v5.5.2               │
│  Semantic Engine | Enforcer | Policy | Audit | Git    │
│  Gemini LLM Hybrid | HMAC Chain | RBAC | Encryption  │
└──────────────────────┬───────────────────────────────┘
                       │
                .speclock/
                ├── brain.json         (structured memory — single source of truth)
                ├── events.log         (HMAC-signed JSONL audit trail)
                ├── .audit-key         (HMAC secret — gitignored)
                ├── patches/           (git diffs per event)
                └── context/
                    └── latest.md      (human-readable context — auto-refreshed)
```

---

## Test Results (v5.5.2)

| Suite | Tests | Pass Rate | Domain |
|-------|------:|----------:|--------|
| Adversarial Conflict | 46 | 100% | Euphemisms, temporal evasion, compound sentences |
| Real-World Testers | 111 | 100% | Multi-domain scenarios |
| Claude Regression | 3 | 100% | Regression tests |
| PII/Export Detection | 8 | 100% | PII and export detection |
| Question Framing | 9 | 100% | Question vs action disambiguation |
| Typed Constraints | 13 | 100% | Numerical, range, state, temporal |
| Patch Gateway | 57 | 100% | Intent review, blast radius, lock mapping |
| Diff-Native Review | 76 | 100% | Diff parsing, signal scoring, hard escalation |
| Audit Chain | 35 | 100% | HMAC-SHA256 chain integrity |
| Code Graph | 33 | 100% | Import parsing, blast radius |
| Spec Compiler | 24 | 100% | NL→constraints parsing |
| Enforcement | 40 | 100% | Hard/advisory mode, overrides |
| REST API v2 | 9 | 100% | Typed constraint endpoints, SSE |
| Compliance Export | 50 | 100% | SOC 2, HIPAA, CSV |
| Phase 4 (Full Stack) | 91 | 100% | Fintech, e-commerce, IoT, healthcare, SaaS |
| Auth & Crypto | 114 | 100% | API keys, RBAC, AES-256 |
| Guardian (Protect) | 47 | 100% | Zero-config rule file extraction |
| John (Indie Dev Journey) | 86 | 100% | 8-session Bolt.new build |
| Sam (Enterprise HIPAA) | 124 | 100% | HIPAA locks, PHI, encryption, RBAC |
| **Total** | **976** | **100%** | **19 suites** |

---

## Links

- **Website**: [sgroy10.github.io/speclock](https://sgroy10.github.io/speclock/)
- **GitHub**: [github.com/sgroy10/speclock](https://github.com/sgroy10/speclock)
- **npm**: [npmjs.com/package/speclock](https://www.npmjs.com/package/speclock)
- **Smithery**: [smithery.ai/servers/sgroy10/speclock](https://smithery.ai/servers/sgroy10/speclock)
- **MCP Endpoint**: `https://speclock-mcp-production.up.railway.app/mcp`

---

*SpecLock v5.5.2 — Your AI has rules. SpecLock makes them unbreakable. Zero-config Guardian Mode, Universal Rules Sync, AI Patch Firewall, Spec Compiler, Code Graph, Drift Score, 51 MCP Tools, 991 tests, 100% accuracy. Free & open source (MIT). Developed by Sandeep Roy (https://github.com/sgroy10).*
