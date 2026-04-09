# SpecLock Launch Posts — Ready to Copy-Paste
## By Sandeep Roy | February-March 2026 | v5.0.0

---

## 1. REDDIT: r/ClaudeAI (POST FIRST)

**Title:** I built an MCP server that stops Claude from violating your project constraints after compaction. Live demo inside.

**Body:**

I was building a landing page for a client. Set clear rules: specific brand colors (gold + black), a locked tagline, WeChat/WhatsApp contacts required, USD pricing only.

Three hours in, context compacted. The next prompt from the client said "make it more colorful, add blue gradient, change the tagline, remove WeChat."

Without any guardrails, Claude would have happily destroyed everything I set up.

So I built **SpecLock** — an MCP server with 51 tools that enforces non-negotiable constraints across sessions.

**Here's what happened in my live test:**

| Client Request | Lock It Violated | SpecLock Result |
|---|---|---|
| "Add blue gradient + neon green" | NO bright colors, NO neon, NO blue/green | BLOCKED (HIGH confidence) |
| "Change the tagline" | Do NOT change this tagline | BLOCKED (100% + synonym detection caught "change/modify/alter") |
| "Remove WeChat" | Must include WeChat QR code | BLOCKED (destructive action detected) |
| "Convert prices to CNY" | All prices in USD | BLOCKED (HIGH confidence) |

**4/4 violations caught. Zero damage to the codebase.**

The key difference from CLAUDE.md or .cursorrules: those are passive text files. SpecLock actively checks every proposed action against your locked constraints using semantic analysis (synonyms, negation detection, confidence scoring).

**How it works:**
1. `npx speclock init` in your project
2. Add locks: "Never use raw SQL queries", "All endpoints require auth", etc.
3. SpecLock checks every action against locks before execution
4. Session briefings restore full context on cold start — survives compaction

**Links:**
- npm: `npm install -g speclock`
- GitHub: github.com/sgroy10/speclock
- Smithery: smithery.ai/servers/sgroy10/speclock (51 tools, works with Claude Code, Cursor, Windsurf, Cline, Codex)

Free, open-source, fully offline. No cloud, no API keys, no accounts.

I'd genuinely love feedback. What constraints do you wish Claude would respect?

---

## 2. REDDIT: r/cursor

**Title:** This MCP server turns .cursorrules from suggestions into enforced contracts

**Body:**

`.cursorrules` is great for telling Cursor what to do. But it can't stop Cursor from contradicting those rules after a long session.

I built **SpecLock** — an MCP server that adds active constraint enforcement to your coding workflow.

**Real example:** I set 4 locks on a client project (brand colors, tagline, required contacts, USD pricing). Then simulated a "new session" where someone asked to violate all 4. SpecLock caught every single violation before any code was changed.

The secret sauce is **semantic conflict detection** — it doesn't just match keywords. It understands synonyms ("change" = "modify" = "alter" = "rewrite") and negation ("Do NOT change" + "change the tagline" = conflict).

**Setup with Cursor:**
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

51 tools across 5 categories: Memory, Tracking, Protection, Git, Intelligence.

- npm: `npm install -g speclock`
- Smithery: smithery.ai/servers/sgroy10/speclock

Free & open-source. Built by Sandeep Roy.

---

## 3. REDDIT: r/programming

**Title:** Memory tools remember what your AI said. Nothing enforces what it decided. I tried to fix that.

**Body:**

Everyone's building AI memory tools — Mem0 (41K stars, $24M raised), doobidoo's knowledge graph, Cline Memory Bank. They all solve the same problem: "make AI remember things across sessions."

But I kept hitting a different problem. My AI *remembered* my database schema. Then it generated raw SQL queries against my explicit "no inline SQL" rule. It didn't forget. It contradicted.

That's not a memory problem. That's a governance problem.

So I built **SpecLock** — an MCP server focused specifically on **constraint enforcement**, not general memory.

**The difference:**

| Feature | CLAUDE.md | Mem0 | SpecLock |
|---|---|---|---|
| Stores context | Yes | Yes | Yes |
| Survives compaction | Partially | Yes | Yes |
| Detects conflicts | No | No | **Yes (semantic)** |
| Immutable locks | No | No | **Yes** |
| Drift detection | No | No | **Yes** |
| Active enforcement | No | No | **Yes** |

I'm not competing with memory tools. I'm filling the gap they leave: "You already remember everything. Now stop contradicting yourself."

Technical details: Semantic conflict detection uses synonym expansion (65+ synonym groups), negation analysis, destructive action detection, and confidence scoring (0-100).

Live tested on a real client project — 4 constraint violations attempted, 4 caught, 0 damage.

- GitHub: github.com/sgroy10/speclock
- npm: speclock (v5.0.0 — with constraint templates, violation reports, pre-commit hooks)
- Works with: Claude Code, Cursor, Windsurf, Cline, Codex, Bolt.new, Lovable

Happy to discuss the approach. What do you think — is active constraint enforcement the missing layer?

---

## 4. HACKER NEWS (Show HN)

**Title:** Show HN: SpecLock – MCP server that prevents AI coding agents from violating architectural decisions

**URL:** https://github.com/sgroy10/speclock

**First comment:**

Hi HN, I'm Sandeep. Solo developer from India.

The problem: AI coding agents (Claude Code, Cursor, etc.) lose context when sessions compact. Existing solutions (CLAUDE.md, Mem0, Memory Bank) remember facts but can't enforce constraints. Your AI remembers your database schema — then generates the raw SQL query you explicitly banned.

SpecLock is an MCP server with 51 tools that:

- **Locks** non-negotiable constraints ("SpecLocks") that cannot be violated
- **Detects** semantic conflicts using synonym matching + negation analysis
- **Tracks** decisions across sessions via an append-only event log
- **Creates** git checkpoints for safe rollback
- **Suggests** new constraints based on project patterns
- **Templates** — pre-built constraint packs (nextjs, react, express, supabase, stripe, security-hardened)
- **Reports** — violation tracking with stats ("SpecLock blocked 12 violations this week")
- **Pre-commit hooks** — git-level enforcement that blocks commits touching locked files

Key differentiator: SpecLock doesn't just remember — it enforces. When you set a lock like "All API endpoints must require authentication" and someone later tries to "make the health check public," SpecLock flags the conflict with confidence scoring and synonym detection.

Technically, it uses 65+ synonym groups, negation word detection, destructive action analysis, and confidence scoring (0-100 with HIGH/MEDIUM/LOW levels).

Free, MIT licensed, fully offline, zero cloud dependencies. Works with Claude Code, Cursor, Windsurf, Cline, and Codex.

Install: `npm install -g speclock`
Smithery: smithery.ai/servers/sgroy10/speclock

I'd love honest feedback. Am I solving a real problem or over-engineering?

---

## 5. X/TWITTER THREAD

**Tweet 1:**
Your AI coding agent has a memory problem nobody talks about.

It doesn't forget. It contradicts.

Claude remembers your database schema. Then generates raw SQL queries against your own "no inline SQL" rule.

Memory isn't the problem. Constraint enforcement is. [1/6]

**Tweet 2:**
I tested this with a real client project.

Set 4 locks:
- Brand colors (gold + black only)
- Locked tagline
- Required WeChat/WhatsApp contacts
- USD pricing only

Then asked the AI to violate all 4.

Result? [2/6]

**Tweet 3:**
SpecLock caught every violation:

"Add blue gradient" → BLOCKED (violates color lock)
"Change tagline" → BLOCKED (synonym detection: change/modify/alter)
"Remove WeChat" → BLOCKED (destructive action detected)
"Convert to CNY" → BLOCKED (pricing lock)

4/4 caught. Zero damage. [3/6]

**Tweet 4:**
How it works:

SpecLock is an MCP server with 51 tools.

Unlike CLAUDE.md (passive text) or Mem0 (memory store), SpecLock actively enforces constraints using:

- Synonym expansion (15 groups)
- Negation detection
- Destructive action analysis
- Confidence scoring (0-100)

[4/6]

**Tweet 5:**
Setup takes 30 seconds:

npx speclock init
# Add a lock
speclock lock "Never use raw SQL queries"

Now your AI is warned before it violates that constraint. Across sessions. After compaction. Forever.

Works with Claude Code, Cursor, Windsurf, Cline, Codex.

[5/6]

**Tweet 6:**
SpecLock is free, open-source, and fully offline.

No cloud. No API keys. No accounts.

npm: speclock
GitHub: github.com/sgroy10/speclock
Smithery: smithery.ai/servers/sgroy10/speclock

Built by @sgroy10

Memory tools remember what you said.
SpecLock enforces what you decided.

[6/6]

---

## 6. DEV.TO ARTICLE

**Title:** Why CLAUDE.md Is Not Enough: The Case for Active Constraint Enforcement

**Tags:** #ai #claudecode #mcp #devtools

**Body:**

### The Problem Nobody Talks About

Every AI coding tool now has a memory file. Claude Code has `CLAUDE.md`. Cursor has `.cursorrules`. Windsurf has `.windsurfrules`.

They all solve the same problem: "Tell the AI what to do at the start of every session."

But here's what they can't do: **stop the AI from contradicting those rules mid-session.**

I was building a landing page for a jewelry wholesaler. I set clear rules:
- Brand colors: Gold (#C5A572), Black (#1A1A1A), White (#FAF8F5)
- Tagline: "Crafted in Guangzhou. Trusted Worldwide." — do NOT change
- Contact must include WeChat, WhatsApp, Alibaba
- All prices in USD (B2B wholesale, not retail)

After context compacted, the client asked: "Make it more colorful. Add blue gradient. Change the tagline. Remove WeChat."

A fresh AI session would do all of that. Every constraint violated.

### Memory vs. Enforcement

The market is flooded with memory tools:
- **Mem0** ($24M raised, 41K GitHub stars) — stores preferences
- **doobidoo** — knowledge graph with visualization
- **Memory Bank** — structured markdown files

They all remember things. None of them prevent the AI from contradicting what it remembered.

That's the gap. That's what I built SpecLock to fill.

### How SpecLock Works

SpecLock is an MCP server with 51 tools organized in 6 categories:

**1. Memory** — goal, decisions, notes, session tracking
**2. Tracking** — append-only event log, change tracking
**3. Protection** — immutable locks, semantic conflict detection
**4. Git** — checkpoints, repo status
**5. Intelligence** — auto-lock suggestions, drift detection, health scoring
**6. Enforcement** — constraint templates, violation reports, pre-commit hook auditing

The key feature is **semantic conflict detection**. When you check an action against your locks, SpecLock doesn't just match keywords. It:

- Expands synonyms (65+ groups: "change/modify/alter/update/mutate/transform/rewrite")
- Detects negation ("Do NOT change" + "change the tagline" = conflict)
- Flags destructive actions ("remove", "delete", "drop")
- Returns confidence scores (0-100) with HIGH/MEDIUM/LOW levels

### Live Test Results

I locked 4 constraints on my jewelry wholesaler project, then tried to violate all 4:

| Request | Lock Violated | Result |
|---|---|---|
| "Add blue gradient + neon green" | NO bright colors, NO neon | **BLOCKED** — HIGH |
| "Change the tagline" | Do NOT change this tagline | **BLOCKED** — 100% (synonym match) |
| "Remove WeChat" | Must include WeChat | **BLOCKED** — destructive action |
| "Convert to CNY" | All prices in USD | **BLOCKED** — HIGH |

### Get Started

```bash
npm install -g speclock
cd your-project
npx speclock init
```

Add to Claude Code (`~/.claude.json`):
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

- **npm**: [speclock](https://www.npmjs.com/package/speclock)
- **Smithery**: [sgroy10/speclock](https://smithery.ai/servers/sgroy10/speclock)
- **GitHub**: [sgroy10/speclock](https://github.com/sgroy10/speclock)

Free, open-source, MIT licensed, fully offline. Works with Claude Code, Cursor, Windsurf, Cline, and Codex.

Built by [Sandeep Roy](https://github.com/sgroy10).

---

## 7. PRODUCT HUNT — Maker Comment

Hi Product Hunt! I'm Sandeep, a solo developer who got tired of Claude Code forgetting my architectural decisions mid-session.

The problem: AI coding agents lose context when sessions compact. Existing solutions (CLAUDE.md, memory tools) remember facts but cannot ENFORCE constraints. Your AI remembers your database schema — then generates the raw SQL query you explicitly banned.

SpecLock is an MCP server with 51 tools that:
- Locks non-negotiable constraints ("SpecLocks")
- Detects semantic conflicts (synonym + negation analysis)
- Tracks decisions across sessions with an append-only event log
- Creates git checkpoints for safe rollback
- Applies constraint templates (nextjs, react, express, supabase, stripe)
- Tracks violations with reports ("SpecLock blocked 12 violations")
- Git pre-commit hooks that block commits to locked files
- Works with Claude Code, Cursor, Windsurf, Cline, Codex, Bolt.new, Lovable

It's free, open-source, offline-first, and installs with:
`npx speclock init`

I tested it live on a client project — set 4 brand constraints, then tried to violate all 4. SpecLock caught every single one before any code changed.

I'd love your feedback. What constraints do you wish your AI coding agent would respect?

---

## 8. LOVABLE DISCORD POST (PRIMARY TARGET)

**Channel:** #showcase or #general in discord.com/invite/lovable-dev (156K+ members)

**Post:**

Hey everyone! I built an MCP server that solves the #1 pain point I keep seeing here — **losing project context between Lovable sessions**.

You know the drill: you spend 30 minutes explaining your architecture, constraints, and design decisions to the AI. Next session? Gone. You're re-explaining everything from scratch and burning credits.

**SpecLock** is an MCP server (51 tools) that acts as a **persistent brain** for your Lovable projects:

- **Set locks** — non-negotiable constraints like "never change the auth flow" or "all API routes must be protected"
- **Track decisions** — every architectural choice is logged and survives session resets
- **Detect violations** — if you (or a collaborator) accidentally try to contradict a locked constraint, SpecLock flags it before any damage is done
- **Session briefings** — start every new chat with full context automatically loaded. No more copy-pasting your project spec.

**Setup takes 2 minutes:**
1. Go to **Settings → Connectors → Personal connectors**
2. Click "New MCP server"
3. Enter:
   - Name: `SpecLock`
   - URL: `https://speclock-mcp-production.up.railway.app/mcp`
   - Auth: No authentication
4. In any project, enable SpecLock via the + menu → Connectors

Then just tell Lovable: *"Initialize SpecLock, set a goal for this project, and add locks for my key constraints."*

It's basically the `memory.md` / `docs/` folder approach that many of you already use — but automated, enforced, and conflict-checked.

Free, open-source, MIT licensed.
- Smithery: https://smithery.ai/servers/sgroy10/speclock
- GitHub: https://github.com/sgroy10/speclock
- Landing page: https://sgroy10.github.io/speclock/

What constraints do you wish Lovable would respect across sessions? Would love to hear your use cases.

---

## 9. LOVABLE-SPECIFIC X/TWITTER THREAD

**Tweet 1:**
The #1 complaint from @lovable_dev users:

"My AI forgets everything between sessions."

You spend 30 minutes explaining your architecture. Next session? All gone. Credits burned re-explaining.

I built something to fix this. [1/5]

**Tweet 2:**
SpecLock is an MCP server that gives your Lovable projects a persistent brain.

Set it up in 2 minutes:
Settings → Connectors → New MCP server
URL: https://speclock-mcp-production.up.railway.app/mcp
Auth: None

That's it. 51 tools. Zero config. [2/5]

**Tweet 3:**
What it does:

- Locks constraints: "Never change the auth flow"
- Tracks decisions: Every architectural choice survives
- Session briefings: Full context loaded on every new chat
- Conflict detection: Flags violations before damage

Think memory.md, but automated + enforced. [3/5]

**Tweet 4:**
Real test: Set 4 locks on a project (colors, tagline, contacts, pricing).

Tried to violate all 4 in a new session.

SpecLock caught every one. 4/4 blocked. Zero damage.

Synonym detection caught "change" = "modify" = "alter".
Destructive action detection caught "remove WeChat". [4/5]

**Tweet 5:**
SpecLock works with:
- Lovable (via custom MCP connector)
- Claude Code
- Cursor
- Windsurf
- Cline
- Codex

Free. Open source. No accounts.

Landing page: https://sgroy10.github.io/speclock/
Smithery: https://smithery.ai/servers/sgroy10/speclock

Stop re-explaining. Start building. [5/5]

---

## 10. LOVABLE DEV.TO TUTORIAL

**Title:** Stop Losing Context in Lovable: How SpecLock Gives Your AI Builder Persistent Memory

**Tags:** #lovable #mcp #ai #webdev

**Body:**

### The Problem Every Lovable User Hits

If you've built anything non-trivial with [Lovable](https://lovable.dev), you've hit this wall:

Session 1: You spend 20 minutes explaining your project architecture, design constraints, tech stack decisions, and non-negotiable rules.

Session 2: The AI has no idea what you talked about. You're back to square one.

The popular workaround is creating a `docs/` folder with `memory.md`, `architecture.md`, and `development-notes.md` (if you've read [The Untitled Handbook guide](https://www.theuntitledhandbook.com/p/artificial-ai-memory-system-context), you know what I mean). It works — but it's manual, it's not enforced, and nothing stops the AI from contradicting what's written there.

### SpecLock: The Automated, Enforced Version

SpecLock is an MCP server with 51 tools (including constraint templates, violation reports, and pre-commit hooks) that connects to Lovable as a custom connector. It does three things the manual approach can't:

1. **Persistent memory** — goals, decisions, constraints, and session history are stored in a structured `brain.json` that survives any session reset
2. **Active enforcement** — when someone tries to violate a locked constraint, SpecLock flags the conflict using semantic analysis (synonym matching, negation detection, confidence scoring)
3. **Session continuity** — call `session_briefing` at the start of any new chat to load full project context instantly

### Setup (2 Minutes)

**Requirements:** Lovable paid plan (Pro $25/mo or higher for custom MCP servers)

**Step 1:** In Lovable, go to **Settings → Connectors → Personal connectors**

**Step 2:** Click **"New MCP server"** and enter:
- **Name:** SpecLock
- **URL:** `https://speclock-mcp-production.up.railway.app/mcp`
- **Auth:** No authentication

**Step 3:** In any project, click **+** in the prompt box → **Connectors** → enable SpecLock

**Step 4:** Tell Lovable:
> "Initialize SpecLock for this project. Set the goal to 'Build a customer portal with authentication and file uploads'. Add locks: 'All routes must require authentication', 'Use Supabase for the database — never switch to another DB', 'Design system uses Tailwind with shadcn/ui components only'."

### What Happens Next

Every subsequent session, just tell Lovable:
> "Start a SpecLock session briefing"

The AI gets a full dump of:
- Your project goal
- All locked constraints
- Every architectural decision made so far
- Recent changes and session history
- Deployment facts

No more copy-pasting. No more re-explaining. No more wasted credits.

### Manual memory.md vs. SpecLock

| Feature | Manual docs/ folder | SpecLock |
|---------|-------------------|----------|
| Persists across sessions | Yes (if AI reads it) | Yes (loaded automatically) |
| Enforces constraints | No | Yes (semantic conflict detection) |
| Catches violations | No | Yes (synonym + negation analysis) |
| Tracks session history | No | Yes (append-only event log) |
| Auto-loads on new session | No (must prompt) | Yes (session_briefing) |
| Git checkpoints | Manual | One command |
| Setup time | 15+ minutes | 2 minutes |

### Links

- **Landing page:** [sgroy10.github.io/speclock](https://sgroy10.github.io/speclock/)
- **Smithery:** [smithery.ai/servers/sgroy10/speclock](https://smithery.ai/servers/sgroy10/speclock)
- **GitHub:** [github.com/sgroy10/speclock](https://github.com/sgroy10/speclock)
- **npm:** [speclock](https://www.npmjs.com/package/speclock)

Free, open-source, MIT licensed. Works with Lovable, Claude Code, Cursor, Windsurf, Cline, and Codex.

Built by [Sandeep Roy](https://github.com/sgroy10).

---

## 11. DIRECTORIES TO SUBMIT TO

- [x] Smithery — DONE (smithery.ai/servers/sgroy10/speclock)
- [x] npm — DONE (speclock@1.1.1)
- [x] GitHub Pages — DONE (sgroy10.github.io/speclock)
- [ ] PulseMCP — pulsemcp.com/submit (submit server listing)
- [ ] mcpservers.org — mcpservers.org/submit
- [ ] Glama — glama.ai/mcp/servers (submit)
- [ ] MCP.so — mcp.so (submit)
- [ ] awesome-remote-mcp-servers — GitHub PR to github.com/jaw9c/awesome-remote-mcp-servers
- [ ] remote-mcp.com — Listed from awesome-remote-mcp-servers repo
- [ ] LobeHub MCP Marketplace — lobehub.com/mcp
- [ ] Cline MCP Marketplace — GitHub PR to github.com/cline/mcp-marketplace
- [ ] MCP Server Finder — mcpserverfinder.com
- [ ] MCP Market — mcpmarket.com/server
- [ ] Futurepedia — futurepedia.io (AI tools directory)
- [ ] There's An AI For That — theresanaiforthat.com
- [ ] BetaList — betalist.com/submit
- [ ] Indie Hackers — indiehackers.com (Show IH post)
- [ ] Product Hunt — producthunt.com (schedule for Week 4)
- [ ] Hacker News — news.ycombinator.com/submitlink
- [ ] Lovable Discord — discord.com/invite/lovable-dev (#showcase)
- [ ] Lovable Partner Program — lovable.dev/partners/apply

---

## 12. KEY PEOPLE TO TAG ON X/TWITTER

| Person | Handle | Why |
|--------|--------|-----|
| Swyx | @swyx | Latent Space podcast, covers MCP deeply |
| David Soria Parra | @davidsoriaparra | MCP co-creator at Anthropic |
| Simon Willison | @simonw | Influential dev tools blogger |
| Alex Albert | @alexalbert__ | Anthropic head of DevRel |
| Steve Yegge | @steveyegge | Built Beads (complementary tool) |
| Logan Kilpatrick | @OfficialLoganK | Google DeepMind DevRel |
| Lovable | @lovable_dev | Primary target platform (8M users) |

---

## 13. COMPLETED ACTIONS

- [x] Rename GitHub repo from `flowkeeper` to `speclock` — DONE
- [x] GitHub Pages enabled at sgroy10.github.io/speclock — DONE
- [x] Railway HTTP deployment live at speclock-mcp-production.up.railway.app — DONE
- [x] Smithery listing at smithery.ai/servers/sgroy10/speclock — DONE
- [x] npm published at v5.0.0 — DONE

---

## 14. KEY URLS (REFERENCE)

| Resource | URL |
|----------|-----|
| Landing Page | https://sgroy10.github.io/speclock/ |
| GitHub | https://github.com/sgroy10/speclock |
| npm | https://www.npmjs.com/package/speclock |
| Smithery | https://smithery.ai/servers/sgroy10/speclock |
| Railway (HTTP MCP) | https://speclock-mcp-production.up.railway.app/mcp |
| Lovable MCP URL | https://speclock-mcp-production.up.railway.app/mcp |
