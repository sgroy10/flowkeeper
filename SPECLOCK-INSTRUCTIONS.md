# SpecLock Project Instructions — Copy-Paste Templates

These are **project-level instructions** that you paste into your AI coding platform's settings. They force the AI to use SpecLock on every action — turning it from a passive notepad into an active guardrail.

---

## For Lovable

Go to **Project Settings → Knowledge** and paste this:

```
## SpecLock Rules (MANDATORY — follow on every message)

1. START OF EVERY CONVERSATION: Call speclock_session_briefing FIRST. Read all locks, decisions, and goals before doing anything else. Show a brief summary: "🔒 Memory loaded — X locks, Y decisions."

2. BEFORE WRITING OR MODIFYING ANY CODE: Call speclock_check_conflict with a description of what you're about to change (e.g., "Adding payment page, creating new route and components" or "Modifying the auth login flow"). If a conflict is found with HIGH confidence, STOP and tell me which lock would be violated. Do NOT proceed unless I explicitly say to override it.

3. WHEN I SAY "lock this", "never touch this", "don't ever change this", "this is critical", or similar: Immediately call speclock_add_lock with my exact constraint. Confirm with: "🔒 Locked: [constraint]"

4. AFTER COMPLETING ANY FEATURE OR SIGNIFICANT CHANGE: Call speclock_log_change with a summary of what was built/changed and which files were affected. Also call speclock_add_decision if an architectural choice was made.

5. WHEN I ASK TO REMOVE OR CHANGE SOMETHING THAT WAS LOCKED: Warn me first: "⚠️ You locked this: [constraint]. Want me to unlock it and proceed?" Only proceed if I confirm.

6. END OF CONVERSATION: Call speclock_session_summary with what was accomplished.
```

---

## For Cursor

Create or add to `.cursorrules` in your project root:

```
## SpecLock Rules (MANDATORY — follow on every message)

1. START OF EVERY CONVERSATION: Call speclock_session_briefing FIRST. Read all locks, decisions, and goals before doing anything else. Show a brief summary: "🔒 Memory loaded — X locks, Y decisions."

2. BEFORE WRITING OR MODIFYING ANY CODE: Call speclock_check_conflict with a description of what you're about to change. If a conflict is found with HIGH confidence, STOP and tell me which lock would be violated. Do NOT proceed unless I explicitly say to override.

3. WHEN I SAY "lock this", "never touch this", "don't change this": Call speclock_add_lock immediately. Confirm: "🔒 Locked: [constraint]"

4. AFTER COMPLETING ANY FEATURE: Call speclock_log_change with a summary and files affected. Call speclock_add_decision if an architectural choice was made.

5. WHEN I ASK TO CHANGE SOMETHING LOCKED: Warn me: "⚠️ This is locked: [constraint]. Unlock and proceed?" Only continue if I confirm.

6. END OF SESSION: Call speclock_session_summary.
```

---

## For Claude Code

Add to `CLAUDE.md` in your project root:

```
## SpecLock Rules (MANDATORY — follow on every message)

1. START OF EVERY CONVERSATION: Call speclock_session_briefing FIRST. Read all locks, decisions, and goals before doing anything else. Show: "🔒 Memory loaded — X locks, Y decisions."

2. BEFORE WRITING OR MODIFYING ANY CODE: Call speclock_check_conflict with what you're about to change. If conflict found (HIGH), STOP and warn me. Do NOT proceed unless I override.

3. WHEN I SAY "lock this", "never touch", "don't change": Call speclock_add_lock. Confirm: "🔒 Locked: [constraint]"

4. AFTER COMPLETING FEATURES: Call speclock_log_change + speclock_add_decision for architectural choices.

5. LOCKED ITEMS: Warn before changing. Only proceed if I confirm unlock.

6. END OF SESSION: Call speclock_session_summary.
```

---

## For Windsurf

Add to `.windsurfrules` in your project root:

```
## SpecLock Rules (MANDATORY — follow on every message)

1. START OF EVERY CONVERSATION: Call speclock_session_briefing FIRST. Show: "🔒 Memory loaded — X locks, Y decisions."

2. BEFORE MODIFYING CODE: Call speclock_check_conflict. If HIGH conflict, STOP and warn me.

3. WHEN I SAY "lock this" / "never touch" / "don't change": Call speclock_add_lock. Confirm: "🔒 Locked: [constraint]"

4. AFTER FEATURES: Call speclock_log_change + speclock_add_decision.

5. LOCKED ITEMS: Warn before changing. Only unlock if I confirm.

6. END: Call speclock_session_summary.
```

---

## How It Works In Practice

### Example 1: User locks something
```
User: "Don't ever touch the auth files"
AI:   🔒 Locked: "Never modify auth files"
```

### Example 2: AI checks before changing
```
User: "Add social login to the login page"
AI:   *calls speclock_check_conflict("Modifying auth login page to add social login")*
      ⚠️ This conflicts with your lock: "Never modify auth files"
      Should I proceed anyway, or find another approach?
```

### Example 3: New session, full memory
```
User: "Let's keep working on the dashboard"
AI:   *calls speclock_session_briefing*
      🔒 Memory loaded — 5 locks, 3 decisions, 2 sessions tracked.
      Last session you added the payment page and locked the auth files.
      Ready to work on the dashboard.
```

### Example 4: User changes their mind
```
User: "Actually, unlock the auth files, I need to change them"
AI:   You locked: "Never modify auth files". Want me to unlock this?
User: "Yes"
AI:   🔓 Unlocked. Proceeding with auth file changes.
```

---

## The Complete Setup (2 minutes)

### Lovable:
1. Connect SpecLock: Settings → Connectors → Custom → URL: `https://speclock-mcp-production.up.railway.app/mcp` → No auth
2. Paste the instruction above into: Project Settings → Knowledge
3. Say "initialize speclock" in your first chat
4. Done. Every session after: AI auto-checks memory and constraints.

### Cursor:
1. Add to `.cursor/mcp.json`: `{"mcpServers":{"speclock":{"command":"npx","args":["-y","speclock","serve","--project","."]}}}`
2. Create `.cursorrules` with the instruction above
3. Done.

### Claude Code:
1. Add to `~/.claude.json` or `.mcp.json`: `{"mcpServers":{"speclock":{"command":"npx","args":["-y","speclock","serve","--project","."]}}}`
2. Add the instruction above to `CLAUDE.md`
3. Done.

---

## For Bolt.new, Kimi, Replit, and other platforms WITHOUT MCP

These platforms don't have MCP connectors. SpecLock works via `npm install` + direct JavaScript API. The conflict checking uses a cloud proxy to get Gemini LLM coverage automatically — no API key needed.

### Setup:
1. Install: `npm install speclock`
2. Paste the instructions below into the platform's Knowledge / System Prompt / Project Instructions.

### Instructions to paste:

```
## SpecLock Rules (MANDATORY — follow on every message)

This project uses SpecLock for constraint protection. SpecLock is installed via npm.

### How to check conflicts:
Before making ANY significant code change, run this check:

const { checkConflictAsync } = await import("speclock/src/core/engine.js");
const result = await checkConflictAsync("description of what you are about to do", ["lock text 1", "lock text 2"]);
if (result.hasConflict) {
  // STOP — warn the user about the conflict
  // result.analysis contains the details
}

### How to check conflicts (alternative — pass lock text directly):
const { checkConflictAsync } = await import("speclock/src/core/engine.js");
const result = await checkConflictAsync("Add Razorpay payment gateway", "Never change from Stripe payment integration");
// result.hasConflict will be true

### Rules:
1. MAINTAIN A LIST of user constraints (locks) in memory. When the user says "never", "always", "don't touch", "lock this" — add it to your lock list.
2. BEFORE MODIFYING CODE: Call checkConflictAsync with what you're about to do and ALL active locks. If hasConflict is true, STOP and warn the user.
3. The function is ASYNC — always use await. It calls a cloud API for accurate detection across all domains.
4. If the function is unavailable, at minimum do a manual check: does your proposed action violate any of the user's stated constraints?
```

### Example usage in code:
```javascript
import { checkConflictAsync } from "speclock/src/core/engine.js";

// Check a single lock
const r = await checkConflictAsync("Switch to MongoDB", "Never change the database technology");
console.log(r.hasConflict); // true
console.log(r.analysis);    // "1 conflict(s) confirmed..."

// Check multiple locks
const r2 = await checkConflictAsync("Add Razorpay payments", [
  "Never change from Stripe",
  "Never modify the payment system"
]);
console.log(r2.hasConflict); // true
```
