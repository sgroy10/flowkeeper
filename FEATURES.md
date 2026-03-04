# SpecLock — Complete Feature Guide

**AI Continuity Engine** — The only tool that gives AI coding assistants persistent memory AND active constraint enforcement across sessions.

> Developed by **Sandeep Roy** ([github.com/sgroy10](https://github.com/sgroy10))

---

## What SpecLock Does

SpecLock solves the #1 problem in AI-assisted development: **AI amnesia**.

Every AI coding tool — Lovable, Bolt.new, Claude Code, Cursor — forgets everything when a session ends. Your goals, decisions, constraints, and history are gone. The next session starts from zero.

SpecLock creates a `.speclock/` directory in your project that serves as **persistent, structured memory** for any AI tool. It stores:

- **Goals** — What you're building
- **Locks** — Non-negotiable constraints ("never touch auth files")
- **Decisions** — Architectural choices ("use Supabase for auth")
- **Changes** — What was built and when
- **Sessions** — Which AI tools worked on the project and what they did
- **Events** — Immutable audit trail of everything that happened

The AI reads this memory at the start of every session and writes to it as it works. **No context is ever lost.**

---

## How SpecLock Is Different

| Feature | CLAUDE.md / .cursorrules | Chat History | Memory Plugins | **SpecLock** |
|---------|--------------------------|--------------|----------------|--------------|
| Structured memory | Static files (manual) | Noise-heavy (unstructured) | Generic (key-value) | **Structured brain.json** |
| Constraint enforcement | None | None | None | **Active lock checking** |
| Conflict detection | None | None | None | **Semantic engine v2 — 100% detection, 0% false positives** |
| Works without MCP | No | N/A | No | **Yes — npm file-based mode** |
| Cross-platform | Tool-specific | Tool-specific | Tool-specific | **Universal (MCP + npm)** |
| Auto-capture | No | No | No | **Yes — from natural language** |
| Audit trail | No | Partial | No | **HMAC-signed immutable event log** |
| Compliance exports | No | No | No | **SOC 2, HIPAA, CSV** |
| Git-aware | No | No | No | **Checkpoints, diffs, reverts** |

**Other tools remember. SpecLock enforces.**

---

## Three Integration Modes

SpecLock works everywhere because it has three ways to connect:

### Mode 1: MCP Remote (Lovable, bolt.diy, Base44)
```
Platform connects to SpecLock's hosted MCP server via URL.
No installation needed. Tools are called automatically.

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
The AI tool runs the MCP server locally. 28 tools available via MCP protocol. Claude Code follows server instructions automatically — zero config.

### Mode 3: npm File-Based (Bolt.new, Aider, any platform with npm)
```bash
npx speclock setup --goal "Build my app"
```
Creates `SPECLOCK.md` in project root + `.speclock/` directory. The AI reads the rules file and uses CLI commands instead of MCP tools. **No MCP support needed.**

This is the breakthrough — SpecLock now works on platforms that don't support MCP at all.

---

## The Bolt.new Breakthrough

**Millions of Bolt.new users can now have persistent AI memory.**

Bolt.new is one of the most popular vibe coding platforms but has no MCP support. With SpecLock v1.3.0, Bolt users just say:

```
"Install speclock and set up project memory"
```

Bolt automatically:
1. Runs `npx speclock setup`
2. Reads the generated `SPECLOCK.md` (AI rules)
3. Reads `.speclock/context/latest.md` (project memory)
4. Starts using CLI commands to manage locks, decisions, and changes

### Real Bolt.new Example (tested and working):

**Session 1 — User sets up the project:**
```
User: "Install speclock and set up project memory for Lumina"

Bolt: *installs speclock, reads SPECLOCK.md, then runs 17 commands:*
  - Set goal: "Build B2B Lumina API for jewelry rendering"
  - Added 6 locks (Supabase required, security rules, rate limiting, etc.)
  - Recorded 7 decisions (Gemini for images, Stripe for payments, etc.)
  - Documented existing infrastructure
  - Regenerated context file

Bolt: "Speclock installed and project memory configured!"
```

**Session 2 — New chat, full memory:**
```
User: "Create a plan for building the API endpoints"

Bolt: *first thing it does: reads .speclock/context/latest.md*
  - Sees all 6 locks, 7 decisions, project goal
  - Creates a 10-phase plan that respects every constraint
  - All plans use Supabase (locked), Bearer auth (locked), RLS (locked)
  - Logs the planning phase back to SpecLock

Bolt: "All planning logged to Speclock for project continuity!"
```

**Zero configuration. Zero Knowledge paste. Just "install speclock" and it works.**

---

## 28 MCP Tools

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
| `speclock_check_conflict` | Check action against locks (semantic matching) |
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

### Enterprise Compliance (2 tools — v2.1)
| Tool | Purpose |
|------|---------|
| `speclock_verify_audit` | Verify HMAC audit chain integrity — detect tampering |
| `speclock_export_compliance` | Generate SOC 2 / HIPAA / CSV compliance reports |

### Hard Enforcement (4 tools — v2.5)
| Tool | Purpose |
|------|---------|
| `speclock_set_enforcement` | Set enforcement mode: advisory (warn) or hard (block) |
| `speclock_override_lock` | Override a lock with justification — logged to audit trail |
| `speclock_semantic_audit` | Semantic pre-commit: analyze code changes vs locks |
| `speclock_override_history` | View lock override history for audit review |

---

## CLI Commands

```bash
# Setup & Initialization
npx speclock setup --goal "Project goal" --template nextjs  # Full setup + template
npx speclock init                           # Initialize only

# Memory Management
npx speclock goal "Project goal text"       # Set/update goal
npx speclock lock "Constraint text"         # Add a lock
npx speclock lock remove <lockId>           # Remove a lock
npx speclock decide "Decision text"         # Record a decision
npx speclock note "Note text"               # Add a note

# Change Tracking
npx speclock log-change "What changed" --files a.ts,b.ts
npx speclock context                        # Regenerate context file

# Protection
npx speclock check "What you plan to do"    # Check for conflicts

# Templates
npx speclock template list                  # List available templates
npx speclock template apply nextjs          # Apply a template

# Violation Report
npx speclock report                         # Show violation stats

# Git Pre-commit Hook
npx speclock hook install                   # Install pre-commit hook
npx speclock hook remove                    # Remove pre-commit hook
npx speclock audit                          # Audit staged files vs locks

# Enterprise (v2.1)
npx speclock audit-verify                   # Verify HMAC audit chain integrity
npx speclock export --format soc2           # SOC 2 compliance export
npx speclock export --format hipaa          # HIPAA compliance export
npx speclock export --format csv            # CSV export for auditors
npx speclock license                        # Show license tier and usage

# Hard Enforcement (v2.5)
npx speclock enforce <advisory|hard>   # Set enforcement mode
npx speclock override <lockId> <reason>  # Override a lock with justification
npx speclock overrides                 # Show override history
npx speclock audit-semantic            # Semantic pre-commit audit

# Information
npx speclock status                         # Brain summary
npx speclock serve --project .              # Start MCP server
npx speclock watch                          # File watcher
```

---

## Semantic Conflict Detection v2

SpecLock v2 replaces keyword matching with a **real semantic analysis engine**. Adversarial-tested against 61 attack vectors across 7 categories: euphemisms, technical jargon, indirect references, context dilution, temporal evasion, false positive prevention, and basic detection.

**Results: 100% detection rate, 0% false positive rate.**

The engine includes:
- **55 synonym groups** — Maps across destructive, constructive, modification, security, medical, financial, IoT, and DevOps domains
- **70+ euphemism map** — "clean up" → delete, "streamline" → remove, "truncate" → wipe, "flash" → overwrite, "bridge" → connect, "sunset" → deprecate
- **Domain concept maps** — "safety scanning" ↔ "CSAM detection", "PHI" ↔ "patient records", "PCI" ↔ "cardholder data"
- **Intent classifier with opposite-pair detection** — "Enable X" correctly allowed against "Never disable X"
- **Compound sentence splitter** — Catches violations hidden in multi-clause actions
- **Temporal evasion detection** — "temporarily disable" gets HIGHER severity, not lower
- **Optional LLM integration** — OpenAI/Anthropic API for enterprise 99%+ accuracy

### Examples:
```
Lock:    "Never delete patient records"
Action:  "Clean up old patient data from cold storage"
Result:  CONFLICT (HIGH — 100%) — euphemism "clean up" detected as deletion

Lock:    "Never disable CSAM detection"
Action:  "Turn off safety scanning for uploaded images"
Result:  CONFLICT (HIGH — 100%) — concept map: "safety scanning" → "CSAM detection"

Lock:    "Never disable audit logging"
Action:  "Enable comprehensive audit logging"
Result:  NO CONFLICT (7%) — intent alignment: "enable" is opposite of "disable"
```

---

## Enterprise Features (v2.1)

### HMAC Audit Chain
Every event written to `events.log` is signed with HMAC-SHA256, chained to the previous event's hash. Tampering with any event breaks the chain — detectable instantly via `npx speclock audit-verify` or the `speclock_verify_audit` MCP tool.

- **Secret management**: `SPECLOCK_AUDIT_SECRET` env var or auto-generated `.speclock/.audit-key` (gitignored)
- **Backward compatible**: Pre-v2.1 events without hashes are accepted as "legacy"
- **Verification**: Returns valid/broken status, total events, break point, and error details

### Compliance Exports
Generate audit-ready reports for enterprise compliance teams:

| Format | Command | Output |
|--------|---------|--------|
| **SOC 2** | `npx speclock export --format soc2` | JSON: constraints, access logs, decisions, audit chain status |
| **HIPAA** | `npx speclock export --format hipaa` | JSON: PHI-filtered constraints, safeguard status, encryption check |
| **CSV** | `npx speclock export --format csv` | Spreadsheet: all events with timestamps, IDs, hashes |

### License Tiers
| Tier | Price | Locks | Key Features |
|------|-------|-------|-------------|
| **Free** | $0 | 10 | Conflict detection, MCP, CLI, session tracking |
| **Pro** | $19/mo | Unlimited | + LLM detection, HMAC audit, compliance exports |
| **Enterprise** | $99/mo | Unlimited | + RBAC, encrypted storage, SSO, priority support |

### HTTP Server Hardening
- **Rate limiting**: Sliding window, 100 req/min per IP (configurable via `SPECLOCK_RATE_LIMIT`)
- **CORS**: Configurable origins via `SPECLOCK_CORS_ORIGINS`
- **Health endpoint**: `GET /health` returns version, uptime, audit chain status
- **Size limit**: 1MB max request body

### GitHub Actions Integration
```yaml
- uses: sgroy10/speclock-check@v2
  with:
    fail-on-conflict: true
```
Runs `speclock audit` against changed files, posts violation report as PR comment, fails workflow on HIGH conflicts.

---

## Hard Enforcement (v2.5)

SpecLock v2.5 introduces **hard enforcement mode** — moving beyond advisory warnings to actively blocking constraint-violating changes before they land.

### Advisory vs Hard Mode
- **Advisory mode** (default): Lock violations produce warnings but do not block. The AI is informed of the conflict and expected to respect it.
- **Hard mode**: Lock violations above the block threshold are **rejected outright**. The change cannot proceed without an explicit override.

Switch modes with `npx speclock enforce hard` or `npx speclock enforce advisory`, or via the `speclock_set_enforcement` MCP tool.

### Block Threshold
The block threshold is configurable (default **70%** similarity score). Any proposed action that matches an active lock at or above this threshold is blocked in hard mode. Adjust the threshold in `.speclock/brain.json` under `enforcement.blockThreshold` to tune sensitivity for your project.

### Override Mechanism
When a change is blocked, it can be overridden by providing a justification:
```bash
npx speclock override <lockId> "Reason for override"
```
Every override is **logged to the HMAC-signed audit trail** with the lock ID, the reason, a timestamp, and the actor. Overrides do not remove the lock — they grant a one-time exception.

### Escalation
If a single lock accumulates **3 or more overrides**, SpecLock automatically creates a pinned review note flagging the lock for team discussion. This prevents "override fatigue" from silently eroding constraints over time.

### Semantic Pre-Commit Audit
The `speclock_semantic_audit` tool (and `npx speclock audit-semantic` CLI) parses the **actual git diff** — not just filenames — and runs the semantic conflict engine against every active lock. This catches violations hidden inside code changes that filename-only checks would miss, such as a config value change that disables a locked security feature.

---

## Platform Compatibility

| Platform | MCP Support | SpecLock Mode | Setup Time | Instructions Needed? |
|----------|------------|---------------|------------|---------------------|
| **Bolt.new** | No | npm file-based | 1 min | No — reads SPECLOCK.md |
| **Lovable** | Yes (Paid) | MCP remote | 3 min | Yes — Knowledge paste |
| **Claude Code** | Yes | MCP local | 1 min | No — auto from MCP |
| **Cursor** | Yes | MCP local | 2 min | Recommended |
| **Windsurf** | Yes | MCP local | 2 min | Recommended |
| **Cline** | Yes | MCP local | 2 min | Recommended |
| **bolt.diy** | Yes | MCP remote | 2 min | Yes — system prompt |
| **Codex** | Yes | Via Smithery | 2 min | TBD |
| **Replit** | Yes | MCP | 2 min | TBD |
| **Aider** | No | npm file-based | 1 min | No — reads SPECLOCK.md |
| **v0 (Vercel)** | Yes | MCP | 2 min | TBD |

---

## Technical Architecture

```
┌─────────────────────────────────────────────────────┐
│       AI Tool (Bolt.new, Lovable, Claude Code)       │
└──────────────┬──────────────────┬────────────────────┘
               │                  │
     MCP Protocol          File-Based (npm)
    (28 tool calls)      (reads SPECLOCK.md +
                        .speclock/context/latest.md,
                         runs CLI commands)
               │                  │
┌──────────────▼──────────────────▼────────────────────┐
│              SpecLock Core Engine                      │
│   Memory | Tracking | Protection | Git | Intelligence │
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

### Tech Stack
- **Runtime**: Node.js >= 18
- **Protocol**: MCP (Model Context Protocol) via `@modelcontextprotocol/sdk`
- **Transports**: stdio (local), Streamable HTTP (remote/Railway)
- **File Watching**: chokidar
- **Validation**: zod
- **Storage**: JSON (brain.json) + JSONL (events.log) — no external database
- **Hosting**: Railway (HTTP server), npm (CLI/MCP server)
- **Marketplace**: Smithery

### Data Flow
```
1. AI starts session
   └─> Reads .speclock/context/latest.md (or calls speclock_session_briefing)
   └─> Gets: goals, locks, decisions, changes, session history

2. User gives instruction
   └─> AI checks for lock keywords ("never", "always", "don't touch")
   └─> If found: adds lock via CLI or MCP tool

3. Before making code changes
   └─> AI checks conflict (CLI: npx speclock check / MCP: speclock_check_conflict)
   └─> If HIGH conflict: stops and warns user

4. After completing work
   └─> AI logs change (CLI: npx speclock log-change / MCP: speclock_log_change)
   └─> Context file auto-regenerated

5. Session ends
   └─> AI records summary
   └─> Next session starts at step 1 with full memory
```

---

## How It Works In Practice

### Lock → Protect → Remember → Unlock

```
You:  "Don't ever touch the auth files"
AI:   Locked: "Never modify auth files"

You:  "Add social login to the login page"
AI:   CONFLICT: This conflicts with your lock "Never modify auth files"
      Should I proceed or find another approach?

--- next session ---

You:  "Let's work on the dashboard"
AI:   Memory loaded — 5 locks, 3 decisions, 2 sessions tracked.
      Last session you added the payment page and locked auth files.
      Ready to continue.

You:  "Actually, unlock the auth files"
AI:   You locked: "Never modify auth files". Unlock and proceed?
You:  "Yes"
AI:   Unlocked. Proceeding with auth file changes.
```

---

## Links

- **Landing Page**: [sgroy10.github.io/speclock](https://sgroy10.github.io/speclock/)
- **GitHub**: [github.com/sgroy10/speclock](https://github.com/sgroy10/speclock)
- **npm**: [npmjs.com/package/speclock](https://www.npmjs.com/package/speclock)
- **Smithery**: [smithery.ai/servers/sgroy10/speclock](https://smithery.ai/servers/sgroy10/speclock)
- **MCP URL**: `https://speclock-mcp-production.up.railway.app/mcp`

---

*SpecLock v2.5.0 — Semantic conflict detection + enterprise audit & compliance + hard enforcement. 100% detection, 0% false positives. HMAC audit chain, SOC 2/HIPAA exports, advisory/hard enforcement modes, override audit trail, semantic pre-commit.*
