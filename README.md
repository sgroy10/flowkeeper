<p align="center">
  <img src="https://img.shields.io/badge/🔒-SpecLock-000000?style=for-the-badge&labelColor=000000&color=4F46E5" alt="SpecLock" height="40" />
</p>

<h3 align="center">Your AI keeps breaking things you told it not to touch.<br/>SpecLock makes it stop.</h3>

<p align="center">
  <a href="https://www.npmjs.com/package/speclock"><img src="https://img.shields.io/npm/v/speclock.svg?style=flat-square&color=4F46E5" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/speclock"><img src="https://img.shields.io/npm/dm/speclock.svg?style=flat-square&color=22C55E" alt="npm downloads" /></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="MIT License" /></a>
  <a href="https://modelcontextprotocol.io"><img src="https://img.shields.io/badge/MCP-31_tools-green.svg?style=flat-square" alt="MCP 31 tools" /></a>
</p>

<p align="center">
  <a href="https://sgroy10.github.io/speclock/">Website</a> · <a href="https://www.npmjs.com/package/speclock">npm</a> · <a href="https://smithery.ai/servers/sgroy10/speclock">Smithery</a> · <a href="https://github.com/sgroy10/speclock">GitHub</a>
</p>

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

**60 test suites. 100% detection. 0% false positives. Gemini Flash hybrid for universal domain coverage.**

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
| **Semantic conflict detection** | No | No | No | **100% detection, 0% FP** |
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
<tr><td>Payment brand names</td><td>100%</td><td>"Add Razorpay" vs "Never change payment gateway"</td></tr>
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

## 31 MCP Tools

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
   MCP Protocol (31 tools)    npm File-Based
             │              (SPECLOCK.md + CLI)
             │                  │
┌────────────▼──────────────────▼──────────────────┐
│            SpecLock Core Engine                    │
│                                                    │
│  Semantic Engine ─── 55 synonym groups             │
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

## Test Results

| Suite | Tests | Pass Rate |
|-------|------:|----------:|
| Direct Mode (heuristic) | 17 | 100% |
| Payment/Salary Domain | 18 | 100% |
| Gemini Hybrid (8 domains) | 16 | 100% |
| Proxy API Endpoint | 9 | 100% |
| **Total** | **60** | **100%** |

Tested across: fintech, e-commerce, IoT, healthcare, SaaS, gaming, biotech, aerospace, music, legal, payments, payroll. Zero false positives on UI/cosmetic actions.

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

<p align="center"><i>v4.4.2 — 60 tests, 31 MCP tools, 0 false positives, Gemini hybrid. Because remembering isn't enough.</i></p>
