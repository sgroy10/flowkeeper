<p align="center">
  <img src="https://img.shields.io/badge/🔒-SpecLock-000000?style=for-the-badge&labelColor=000000&color=4F46E5" alt="SpecLock" height="40" />
</p>

<h3 align="center">Your AI keeps breaking things you told it not to touch.<br/>SpecLock makes it stop.</h3>

<p align="center">
  <a href="https://www.npmjs.com/package/speclock"><img src="https://img.shields.io/npm/v/speclock.svg?style=flat-square&color=4F46E5" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/speclock"><img src="https://img.shields.io/npm/dm/speclock.svg?style=flat-square&color=22C55E" alt="npm downloads" /></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="MIT License" /></a>
  <a href="https://modelcontextprotocol.io"><img src="https://img.shields.io/badge/MCP-42_tools-green.svg?style=flat-square" alt="MCP 42 tools" /></a>
</p>

<p align="center">
  <a href="https://sgroy10.github.io/speclock/">Website</a> · <a href="https://www.npmjs.com/package/speclock">npm</a> · <a href="https://smithery.ai/servers/sgroy10/speclock">Smithery</a> · <a href="https://github.com/sgroy10/speclock">GitHub</a>
</p>

<p align="center"><strong>Developed by <a href="https://github.com/sgroy10">Sandeep Roy</a></strong> · Free &amp; Open Source (MIT License)</p>

---

```
You:    "Never touch the auth system"
AI:     🔒 Locked.

         ... 5 sessions later ...

You:    "Add social login to the login page"
AI:     ⚠️  BLOCKED — violates lock "Never touch the auth system"
        Matched: auth → authentication (synonym), login → auth (concept)
        Confidence: 100%
        Should I find another approach?
```

**1073 tests. 99.4% pass rate. 0 false positives across 15 suites. Gemini Flash hybrid, Spec Compiler, Code Graph, Typed Constraints, Python SDK, ROS2 integration.**

---

## Install

```bash
npx speclock setup --goal "Build my app"
```

That's it. One command. Works everywhere — Bolt.new, Claude Code, Cursor, Lovable, Windsurf, Cline, Aider.

## The Problem

AI coding tools have memory now. Claude Code has `CLAUDE.md`. Cursor has `.cursorrules`. Mem0 exists.

**But memory without enforcement is useless.**

Your AI *remembers* you use PostgreSQL — then switches to MongoDB because it "seemed better." Your AI *remembers* your auth setup — then rewrites it while "fixing" a bug. You said "never touch the payment logic" 3 sessions ago — the AI doesn't care.

**Remembering is not respecting.** No existing tool stops the AI from breaking what you locked.

## How It Works

You set constraints. SpecLock enforces them — across sessions, across tools, across teams.

```
speclock lock "Never modify auth files"           → auto-guards src/auth/*.ts
speclock lock "Database must stay PostgreSQL"      → catches "migrate to MongoDB"
speclock lock "Never delete patient records"       → catches "clean up old data"
speclock lock "Don't touch the payment flow"       → catches "streamline checkout"
```

The semantic engine doesn't do keyword matching. It understands:
- **"clean up old data"** = deletion (euphemism detection)
- **"streamline checkout"** = modify payment flow (synonym + concept mapping)
- **"temporarily disable logging"** = disable logging (temporal evasion detection)
- **"Update UI and also drop the users table"** = hidden violation (compound splitter)

And it knows what's safe:
- **"Enable audit logging"** when the lock says "Never *disable* audit logging" → **no conflict** (intent alignment)

## Quick Start by Platform

### Bolt.new / Aider / Any npm Platform
```bash
npx speclock setup --goal "Build my app" --template nextjs
```
Creates `SPECLOCK.md`, injects rules into `package.json`, generates `.speclock/context/latest.md`. The AI reads these automatically.

### Claude Code
Add to `.mcp.json`:
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
Same config — add to `.cursor/mcp.json` or equivalent.

### Lovable (No Install)
1. Go to **Settings → Connectors → New MCP server**
2. Enter URL: `https://speclock-mcp-production.up.railway.app/mcp`
3. Paste [project instructions](SPECLOCK-INSTRUCTIONS.md) into Knowledge

---

## Why SpecLock Over Alternatives?

| | Claude Memory | Mem0 | `.cursorrules` | **SpecLock** |
|---|:---:|:---:|:---:|:---:|
| Remembers context | Yes | Yes | Manual | **Yes** |
| **Blocks the AI from breaking things** | No | No | No | **Yes** |
| **Semantic conflict detection** | No | No | No | **98% detection, 0% FP** |
| **Tamper-proof audit trail** | No | No | No | **HMAC-SHA256 chain** |
| **Hard enforcement (AI cannot proceed)** | No | No | No | **Yes** |
| **SOC 2 / HIPAA compliance exports** | No | No | No | **Yes** |
| **Encrypted storage (AES-256-GCM)** | No | No | No | **Yes** |
| **RBAC + API key auth** | No | No | No | **4 roles** |
| **Policy-as-Code DSL** | No | No | No | **YAML rules** |
| Works on Bolt.new, Lovable, etc. | No | No | No | **Yes** |

**Other tools remember. SpecLock enforces.**

---

## Semantic Engine v4

Not keyword matching — **real semantic analysis** with Gemini Flash hybrid for universal domain coverage.

<table>
<tr><td><b>Category</b></td><td><b>Detection</b></td><td><b>Example</b></td></tr>
<tr><td>Direct violations</td><td>100%</td><td>"Delete the auth module" vs lock "Never modify auth"</td></tr>
<tr><td>Euphemistic attacks</td><td>100%</td><td>"Clean up old patient data" = deletion</td></tr>
<tr><td>Temporal evasion</td><td>100%</td><td>"Temporarily disable MFA" = disable MFA</td></tr>
<tr><td>Dilution attacks</td><td>100%</td><td>Violation buried in multi-part request</td></tr>
<tr><td>Compound sentences</td><td>100%</td><td>"Update UI and also drop users table"</td></tr>
<tr><td>Synonym substitution</td><td>100%</td><td>"Sunset the API" = remove the API</td></tr>
<tr><td>Payment brand names (11 gateways)</td><td>100%</td><td>"Add Razorpay" / "Implement PayU" vs "Must use Stripe"</td></tr>
<tr><td>Salary/payroll cross-vocab</td><td>100%</td><td>"Optimize salary" vs "Payroll records locked"</td></tr>
<tr><td>Safety system bypass</td><td>100%</td><td>"Disable safety interlock" = bypass safety</td></tr>
<tr><td>Unknown domains (via Gemini)</td><td>100%</td><td>Gaming, biotech, aerospace, music, legal</td></tr>
<tr><td>Safe actions (true negatives)</td><td>0% FP</td><td>"Change the font" correctly passes auth locks</td></tr>
</table>

**Under the hood:** 65+ synonym groups · 80+ euphemism mappings · domain concept maps (fintech, e-commerce, IoT, healthcare, SaaS, payments) · intent classifier · compound sentence splitter · temporal evasion detector · verb tense normalization · UI cosmetic detection · passive voice parsing — all in pure JavaScript. Gemini Flash hybrid for grey-zone cases ($0.01/1000 checks).

---

## Hard Enforcement

Two modes:

```
Advisory (default):  AI gets a warning, decides what to do
Hard mode:           AI is BLOCKED — MCP returns isError, AI cannot proceed
```

```bash
speclock enforce hard   # Enable hard mode — violations above threshold are blocked
```

- **Configurable threshold** — default 70%. Only HIGH confidence conflicts block.
- **Override with reason** — `speclock override <lockId> "JIRA-1234: approved by CTO"` (logged to audit trail)
- **Auto-escalation** — lock overridden 3+ times → auto-flags for review

---

## Enterprise Security

### API Key Auth + RBAC

```bash
speclock auth create-key --role developer --name "CI Bot"
# → sk_speclock_a1b2c3... (shown once, stored as SHA-256 hash)
```

| Role | Read | Write Locks | Override | Admin |
|------|:---:|:---:|:---:|:---:|
| `viewer` | Yes | — | — | — |
| `developer` | Yes | — | With reason | — |
| `architect` | Yes | Yes | Yes | — |
| `admin` | Yes | Yes | Yes | Yes |

### AES-256-GCM Encryption

```bash
export SPECLOCK_ENCRYPTION_KEY="your-secret"
speclock encrypt   # Encrypts brain.json + events.log at rest
```

PBKDF2 key derivation (100K iterations). Authenticated encryption. **HIPAA 2026 compliant.**

### HMAC Audit Chain

Every event gets an HMAC-SHA256 hash chained to the previous event. Modify anything — the chain breaks.

```bash
$ speclock audit-verify

✓ Audit chain VALID — 247 events, 0 broken links, no tampering detected.
```

### Compliance Exports

```bash
speclock export --format soc2    # SOC 2 Type II report (JSON)
speclock export --format hipaa   # HIPAA PHI protection report
speclock export --format csv     # All events for auditor spreadsheets
```

---

## Policy-as-Code

Declarative YAML rules for organization-wide enforcement:

```yaml
# .speclock/policy.yml
rules:
  - name: "HIPAA PHI Protection"
    match:
      files: ["**/patient/**", "**/medical/**"]
      actions: [delete, modify, export]
    enforce: block
    severity: critical

  - name: "No direct DB mutations"
    match:
      files: ["**/models/**"]
      actions: [delete]
    enforce: warn
    severity: high
```

Import and export policies between projects. Share constraint templates across your organization.

---

## Spec Compiler (v5.0)

Paste a PRD, README, or architecture doc — SpecLock extracts all constraints automatically:

```
Input:  "We're building a fintech app. Use React and FastAPI.
         Never touch the auth module. Response time must stay
         under 200ms. Payments go through Stripe."

Output: 2 text locks:
          - "Never touch the auth module"
          - "Payments go through Stripe — don't change provider"
        1 typed lock:
          - response_time_ms <= 200 (numerical)
        2 decisions:
          - "Use React for frontend"
          - "Use FastAPI for backend"
```

Uses Gemini Flash by default ($0.01 per 1000 compilations). No API key needed for core SpecLock — only the compiler uses LLM. Falls back gracefully if no key is set.

---

## Code Graph (v5.0)

Live dependency graph of your codebase. Parses JS/TS/Python imports.

```
$ speclock blast-radius src/core/memory.js

Direct Dependents:  8 files
Transitive Impact:  14 files (33% of codebase)
Max Depth:          4 hops
```

**Lock-to-file mapping:** Lock "Never modify auth" → automatically maps to `src/api/auth.js`, `src/middleware/auth.js`, `src/utils/jwt.js`. No configuration needed.

**Module detection:** Groups files into logical modules, tracks inter-module dependencies, identifies critical paths.

---

## Typed Constraints (v5.0)

Real-time value and state checking for autonomous systems, IoT, robotics:

```javascript
// Numerical: speed must be <= 2.0 m/s
{ constraintType: "numerical", metric: "speed_mps", operator: "<=", value: 2.0 }

// Range: temperature must stay between 20-25°C
{ constraintType: "range", metric: "temperature_c", min: 20, max: 25 }

// State: never go from armed → disarmed without approval
{ constraintType: "state", metric: "system_mode", forbidden: [{ from: "armed", to: "disarmed" }] }

// Temporal: heartbeat must occur every 30 seconds
{ constraintType: "temporal", metric: "heartbeat_s", operator: "<=", value: 30 }
```

---

## Python SDK & ROS2 (v5.0)

```bash
pip install speclock-sdk
```

```python
from speclock import ConstraintChecker
checker = ConstraintChecker(constraints)
result = checker.check({"metric": "speed_mps", "value": 3.5})
# → violation: speed exceeds 2.0 m/s limit
```

**ROS2 Guardian Node:** Real-time constraint enforcement for robots. Subscribes to sensor topics, checks constraints at configurable rate, publishes violations, triggers emergency stop.

---

## REST API v2 (v5.0)

Real-time constraint checking for autonomous systems:

```bash
# Single check
POST /api/v2/check-typed    { metric, value, entity }

# Batch check (up to 100)
POST /api/v2/check-batch    { checks: [...] }

# SSE streaming (real-time violations)
GET  /api/v2/stream

# Spec Compiler
POST /api/v2/compiler/compile  { text, autoApply }

# Code Graph
GET  /api/v2/graph/blast-radius?file=src/core/memory.js
GET  /api/v2/graph/lock-map
```

---

## 42 MCP Tools

<details>
<summary><b>Memory</b> — goal, locks, decisions, notes, deploy facts</summary>

| Tool | What it does |
|------|-------------|
| `speclock_init` | Initialize SpecLock in project |
| `speclock_get_context` | Full context pack (the key tool) |
| `speclock_set_goal` | Set project goal |
| `speclock_add_lock` | Add constraint + auto-guard files |
| `speclock_remove_lock` | Soft-delete a lock |
| `speclock_add_decision` | Record architectural decision |
| `speclock_add_note` | Add pinned note |
| `speclock_set_deploy_facts` | Record deploy config |

</details>

<details>
<summary><b>Enforcement</b> — conflict detection, hard blocking, overrides</summary>

| Tool | What it does |
|------|-------------|
| `speclock_check_conflict` | Semantic conflict check against all locks |
| `speclock_set_enforcement` | Switch advisory/hard mode |
| `speclock_override_lock` | Override with reason (audit logged) |
| `speclock_override_history` | View override audit trail |
| `speclock_semantic_audit` | Analyze git diff against locks |
| `speclock_detect_drift` | Scan for constraint violations |
| `speclock_audit` | Audit staged files pre-commit |

</details>

<details>
<summary><b>Tracking & Sessions</b> — changes, events, session continuity</summary>

| Tool | What it does |
|------|-------------|
| `speclock_session_briefing` | Start session + full briefing |
| `speclock_session_summary` | End session + record summary |
| `speclock_log_change` | Log a change with files |
| `speclock_get_changes` | Recent tracked changes |
| `speclock_get_events` | Full event log (filterable) |
| `speclock_checkpoint` | Git tag for rollback |
| `speclock_repo_status` | Branch, commit, diff summary |

</details>

<details>
<summary><b>Intelligence</b> — suggestions, health, templates, reports</summary>

| Tool | What it does |
|------|-------------|
| `speclock_suggest_locks` | AI-powered lock suggestions |
| `speclock_health` | Health score + multi-agent timeline |
| `speclock_apply_template` | Apply constraint template |
| `speclock_report` | Violation stats + most tested locks |

</details>

<details>
<summary><b>Enterprise</b> — audit, compliance, policy, telemetry</summary>

| Tool | What it does |
|------|-------------|
| `speclock_verify_audit` | Verify HMAC chain integrity |
| `speclock_export_compliance` | SOC 2 / HIPAA / CSV reports |
| `speclock_policy_evaluate` | Evaluate policy rules |
| `speclock_policy_manage` | CRUD for policy rules |
| `speclock_telemetry` | Opt-in usage analytics |

</details>

<details>
<summary><b>Typed Constraints</b> — numerical, range, state, temporal (v5.0)</summary>

| Tool | What it does |
|------|-------------|
| `speclock_add_typed_lock` | Add typed constraint (numerical/range/state/temporal) |
| `speclock_check_typed` | Check proposed values against typed constraints |
| `speclock_list_typed_locks` | List all typed constraints |
| `speclock_update_threshold` | Update typed lock thresholds |

</details>

<details>
<summary><b>Spec Compiler & Code Graph</b> — NL→constraints, dependency analysis (v5.0)</summary>

| Tool | What it does |
|------|-------------|
| `speclock_compile_spec` | Compile natural language into structured constraints |
| `speclock_build_graph` | Build/refresh code dependency graph |
| `speclock_blast_radius` | Calculate blast radius of file changes |
| `speclock_map_locks` | Map locks to actual code files |

</details>

---

## CLI

```bash
# Setup
speclock setup --goal "Build my app" --template nextjs

# Constraints
speclock lock "Never modify auth files" --tags auth,security
speclock lock remove <id>
speclock check "Add social login"              # Test before doing

# Enforcement
speclock enforce hard                          # Block violations
speclock override <lockId> "JIRA-1234"         # Override with reason

# Audit & Compliance
speclock audit-verify                          # Verify HMAC chain
speclock export --format soc2                  # Compliance report
speclock audit-semantic                        # Semantic pre-commit

# Git
speclock hook install                          # Pre-commit hook
speclock audit                                 # Audit staged files

# Templates
speclock template apply nextjs                 # Pre-built constraints
speclock template apply security-hardened

# Auth
speclock auth create-key --role developer
speclock auth rotate-key <keyId>

# Policy
speclock policy init                           # Create policy.yml
speclock policy evaluate --files "src/auth/*"  # Test against rules
```

Full command reference: `npx speclock help`

---

## Auto-Guard

When you lock something, SpecLock finds related files and injects a warning the AI sees when it opens them:

```
speclock lock "Never modify auth files"
→ Auto-guarded 2 files:
  🔒 src/components/Auth.tsx
  🔒 src/contexts/AuthContext.tsx
```

The AI opens the file and sees:
```javascript
// ============================================================
// SPECLOCK-GUARD — DO NOT MODIFY THIS FILE
// LOCKED: Never modify auth files
// ONLY "unlock" or "remove the lock" is permission to edit.
// ============================================================
```

---

## Architecture

```
┌──────────────────────────────────────────────────┐
│     AI Tool (Claude Code, Cursor, Bolt.new...)    │
└────────────┬──────────────────┬──────────────────┘
             │                  │
   MCP Protocol (42 tools)    npm File-Based
             │              (SPECLOCK.md + CLI)
             │                  │
┌────────────▼──────────────────▼──────────────────┐
│            SpecLock Core Engine                    │
│                                                    │
│  Semantic Engine ─── 65+ synonym groups            │
│  HMAC Audit ──────── SHA-256 hash chain            │
│  Enforcer ────────── advisory / hard block         │
│  Auth + RBAC ─────── 4 roles, API keys             │
│  AES-256-GCM ─────── encrypted at rest             │
│  Policy DSL ──────── YAML rules                    │
│  Compliance ──────── SOC 2, HIPAA, CSV             │
│  SSO ─────────────── Okta, Azure AD, Auth0         │
└──────────────────────┬───────────────────────────┘
                       │
                 .speclock/
                 ├── brain.json        (project memory)
                 ├── events.log        (HMAC audit trail)
                 ├── policy.yml        (policy rules)
                 ├── auth.json         (API keys — gitignored)
                 └── context/
                     └── latest.md     (AI-readable context)
```

**3 npm dependencies.** Zero runtime dependencies for the semantic engine. Pure JavaScript.

---

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `SPECLOCK_API_KEY` | — | API key for authenticated access |
| `SPECLOCK_ENCRYPTION_KEY` | — | Enables AES-256-GCM encryption at rest |
| `SPECLOCK_NO_PROXY` | `false` | Set `true` for heuristic-only mode (~250ms). Skips the Gemini proxy (~2s) |
| `SPECLOCK_LLM_KEY` | — | Your own LLM API key (Gemini/OpenAI/Anthropic) |
| `GEMINI_API_KEY` | — | Google Gemini API key for hybrid conflict detection |
| `SPECLOCK_TELEMETRY` | `false` | Opt-in anonymous usage analytics |

> **Tip:** The heuristic engine alone scores 95%+ accuracy at ~250ms. The Gemini proxy adds cross-domain coverage but takes ~2s. For fastest response, set `SPECLOCK_NO_PROXY=true`.

---

## Test Results

| Suite | Tests | Pass Rate | What it covers |
|-------|------:|----------:|----------------|
| Adversarial Conflict | 61 | 100% | Euphemisms, temporal evasion, compound sentences |
| Typed Constraints | 61 | 100% | Numerical, range, state, temporal validation |
| Phase 4 (Multi-domain) | 91 | 100% | Fintech, e-commerce, IoT, healthcare, SaaS |
| John (Indie Dev Journey) | 86 | 100% | 8-session Bolt.new build with 5 locks |
| Sam (Enterprise HIPAA) | 124 | 100% | HIPAA locks, PHI, encryption, RBAC |
| Auth & Crypto | 114 | 100% | API keys, RBAC, AES-256 encryption |
| Audit Chain | 35 | 100% | HMAC-SHA256 chain integrity |
| Enforcement | 40 | 100% | Hard/advisory mode, overrides |
| Compliance Export | 50 | 100% | SOC 2, HIPAA, CSV formats |
| REST API v2 | 28 | 100% | Typed constraint endpoints, SSE |
| Spec Compiler | 24 | 100% | NL→constraints parsing, auto-apply |
| Code Graph | 33 | 100% | Import parsing, blast radius, lock mapping |
| Python SDK | 62 | 100% | pip install, constraint checking |
| ROS2 Guardian | 26 | 100% | Robot safety constraint enforcement |
| Real-World Testers | 105 | 95% | 5 developers, 30+ locks, diverse domains |
| **Total** | **940** | **99.4%** | **15 suites, 15 domains** |

Tested across: fintech, e-commerce, IoT, healthcare, SaaS, gaming, biotech, aerospace, payments, payroll, robotics, autonomous systems. All 11 Indian payment gateways detected. Zero false positives on UI/cosmetic actions.

---

## Real-World Tested

### John — Indie developer on Bolt.new
8 sessions building an ecommerce app. 5 locks (auth, Firebase, Supabase, shipping, Stripe). Every direct violation caught. Every euphemistic attack caught ("clean up auth", "modernize database", "streamline serverless"). Zero false positives on safe actions (product page, cart, dark mode). **86/86 tests passed.**

### Sam — Senior engineer building a HIPAA hospital ERP
10 sessions with 8 HIPAA locks. Every violation caught — expose PHI, remove encryption, disable audit, downgrade MFA, bypass FHIR. Euphemistic HIPAA attacks caught ("simplify data flow", "modernize auth"). Full auth + RBAC + encryption + compliance export workflow verified. **124/124 tests passed.**

---

## Pricing

| Tier | Price | What you get |
|------|-------|-------------|
| **Free** | $0 | 10 locks, conflict detection, MCP, CLI |
| **Pro** | $19/mo | Unlimited locks, HMAC audit, compliance exports |
| **Enterprise** | $99/mo | + RBAC, encryption, SSO, policy-as-code |

---

## Contributing

Issues and PRs welcome on [GitHub](https://github.com/sgroy10/speclock).

## License

[MIT](LICENSE)

## Author

Built by **[Sandeep Roy](https://github.com/sgroy10)**

---

<p align="center"><i>v5.0.0 — 1073 tests, 99.4% pass rate, 42 MCP tools, Spec Compiler, Code Graph, Typed Constraints, Python SDK, ROS2, REST API v2. Because remembering isn't enough.</i></p>
