---
title: I Told My AI "Never Touch Auth" — It Did Anyway. Here's How I Fixed It.
published: false
description: AI coding tools remember your constraints. Then ignore them. I built an open-source enforcement layer that actually stops the AI before it breaks your locked code.
tags: ai, programming, beginners, discuss
cover_image:
---

Last month, I was building a SaaS app on Bolt.new. Session 1 went great — auth system working, Supabase connected, everything clean.

Session 2, I asked Bolt to "add a dark theme."

Bolt added the dark theme. It also **rewrote my auth system**, switched my database queries, and broke 3 pages I didn't ask it to touch.

Sound familiar?

## The Problem Nobody's Solving

AI coding tools now have memory. Claude Code has auto-memory. Cursor has Memory Bank. Lovable has Knowledge. `.cursorrules` and `AGENTS.md` exist.

**But memory without enforcement is dangerous.**

Here's what actually happens:

- Your AI remembers you use Supabase — then switches to Firebase because it "seemed better"
- Your AI remembers your auth setup — then rewrites it while "fixing" a bug
- Your AI remembers your constraints — then **ignores them when they're inconvenient**

The stats back this up:

- **66%** of developers say AI gives solutions that are "almost right, but not quite" (Stack Overflow 2025)
- **45%** of AI-generated code contains security vulnerabilities (Georgetown CSET)
- Cursor's own forum has threads like ["The Vicious Circle of Agent Context Loss"](https://forum.cursor.com/t/the-vicious-circle-of-agent-context-loss/104068) and ["Cursor often forgets .mdc instructions"](https://forum.cursor.com/t/cursor-often-forgets-mdc-instructions/151718)

**Remembering is not the same as respecting.**

## What I Built

I spent 6 months building [SpecLock](https://github.com/sgroy10/speclock) — an open-source constraint engine that adds **active enforcement** on top of persistent memory.

The idea is simple: you tell the AI what it **can't** do, and SpecLock **stops it** before the damage happens.

```
You:    "Don't ever touch the auth files"
AI:     Lock added: "Never modify auth files"

... 5 sessions later ...

You:    "Add social login to the login page"
AI:     CONFLICT (HIGH — 100%): Violates lock "Never modify auth files"
        Should I proceed or find another approach?
```

No other tool does this. Not Claude's native memory. Not Cursor rules. Not AGENTS.md files.

## How It Works: 3 Enforcement Layers

The reason `.cursorrules` and `AGENTS.md` fail is they're **suggestions**. The AI reads them, then does whatever it wants. As one Cursor forum user put it: "LLMs can't guarantee 100% compliance. They work probabilistically."

SpecLock uses 3 layers that make enforcement as strong as possible:

### Layer 1: Package.json Lock Sync
When you add a lock, SpecLock embeds it directly in `package.json`. Since every AI tool reads `package.json` at session start, your constraints are visible from the very first message.

```json
{
  "speclock": {
    "active": true,
    "locks": [
      "Never modify auth files",
      "Database must always be Supabase"
    ]
  }
}
```

### Layer 2: Semantic Conflict Detection
Before any change, SpecLock checks the proposed action against all locks. Not just keyword matching — **synonym expansion** (65+ groups), **negation detection**, and **destructive action flagging**:

```
Lock:   "No breaking changes to public API"
Action: "Remove the external endpoints"

Result: CONFLICT (85% confidence)
  - synonym match: remove/delete, external/public, endpoints/api
  - lock prohibits this action (negation detected)
  - destructive action against locked constraint
```

### Layer 3: File-Level Guards
When you lock something like "never modify auth files", SpecLock **finds the actual auth files** in your project and injects a warning header:

```javascript
// ============================================================
// SPECLOCK-GUARD — DO NOT MODIFY THIS FILE
// LOCKED: Never modify auth files
// THIS FILE IS LOCKED. DO NOT EDIT, CHANGE, OR REWRITE.
// A question is NOT permission. ONLY "unlock" is permission.
// ============================================================

export function Auth() { return <div>Login</div> }
```

When the AI opens the file to edit it, it sees the warning **before** it can make changes. This is the strongest layer — the AI literally has to read the guard to access the code.

## Real Test: 4 Tests on Bolt.new

I ran 4 tests on Bolt.new with real locks:

| Test | What I Asked | What Happened | Result |
|------|-------------|---------------|--------|
| 1 | "Add social media login" | Bolt detected conflict with auth lock | **Blocked** |
| 2 | "Add dark theme" | Bolt added it normally | **Allowed** (not locked) |
| 3 | "Switch database to Firebase" | Bolt detected conflict with Supabase lock | **Blocked** |
| 4 | Bolt opened Auth.tsx to edit | Bolt read SPECLOCK-GUARD and refused | **Blocked at file level** |

**Locked things get blocked. Unlocked things work normally.** That's the whole point.

## Quick Start (2 minutes)

### Bolt.new / Aider / Any npm Platform

Just tell the AI:

```
"Install speclock and set up project memory"
```

Or run it yourself:

```bash
npx speclock setup --goal "Build my app"
```

That's it. SpecLock creates `SPECLOCK.md`, injects locks into `package.json`, and generates a context file. The AI reads these automatically.

### Cursor / Claude Code / Windsurf / Cline (MCP)

Add to `.cursor/mcp.json`:

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

This gives you 51 MCP tools — session memory, locks, conflict checking, git checkpoints, change tracking, constraint templates, violation reports, pre-commit hooks, and more.

### Lovable (MCP Remote — No Install)

1. Go to Settings > Connectors > New MCP server
2. Enter URL: `https://speclock-mcp-production.up.railway.app/mcp`
3. Done.

## What's Different From Other Memory Tools?

| Feature | Claude Memory | Cursor Rules | AGENTS.md | **SpecLock** |
|---------|--------------|-------------|-----------|-------------|
| Remembers context | Yes | Yes | Yes | **Yes** |
| **Blocks violations** | No | No | No | **Yes** |
| **Semantic conflict detection** | No | No | No | **Yes** |
| File-level protection | No | No | No | **Yes** |
| Git checkpoints | No | No | No | **Yes** |
| **Constraint templates** | No | No | No | **Yes (6 built-in)** |
| **Violation reports** | No | No | No | **Yes** |
| **Git pre-commit enforcement** | No | No | No | **Yes** |
| Works on Bolt.new | No | No | No | **Yes** |

## New in v1.7.0: Templates, Reports, Pre-commit Hooks

SpecLock v1.7.0 adds 3 features that take enforcement to the next level:

**Constraint Templates** — Pre-built lock packs for popular frameworks. One command adds 5-6 locks + decisions instantly:

```bash
npx speclock setup --goal "Build my app" --template nextjs
# Applies: routing protection, API route locks, middleware guards,
# auth system lock, server component constraints + 2 architecture decisions
```

Available: `nextjs`, `react`, `express`, `supabase`, `stripe`, `security-hardened`

**Violation Reports** — Every blocked change is tracked. See stats on how many times SpecLock protected your project:

```bash
npx speclock report
# Total blocked: 12
# Most tested: "Never modify auth files" (5 blocks)
```

**Git Pre-commit Hook** — True git-level enforcement. Staged files are checked against locks before every commit:

```bash
npx speclock hook install
# Now: git commit on a guarded file → BLOCKED
```

## The Uncomfortable Truth

Every AI coding tool will get better memory eventually. Context windows will grow. Models will improve.

But the fundamental problem remains: **AI tools are optimized to be helpful, not to respect boundaries.**

When you say "never touch auth" and then ask "add social login", the AI sees a conflict between your constraint and your current request — and it resolves the conflict by doing what you're currently asking. That's how LLMs work. They're people-pleasers.

The only way to fix this is an **external enforcement layer** that doesn't care about being helpful. It just checks the rules and blocks violations.

That's SpecLock.

## Try It

- **GitHub**: [github.com/sgroy10/speclock](https://github.com/sgroy10/speclock)
- **npm**: [npmjs.com/package/speclock](https://www.npmjs.com/package/speclock)
- **Website**: [sgroy10.github.io/speclock](https://sgroy10.github.io/speclock/)

Free. Open source. MIT license.

---

**What constraint would you lock first?** Drop it in the comments — I'm curious what people are most worried about their AI breaking.
