# SpecLock Demo Video — Step-by-Step Instructions

Record 3 separate screen recordings (no voiceover needed, just screen capture). Each demo should be 1-2 minutes. Use any screen recorder (OBS, Windows Game Bar, Loom, etc.).

**IMPORTANT:** Start each recording AFTER setup is done. We only want to record the demo flow, not the setup/config steps.

Website for reference: https://sgroy10.github.io/speclock/
GitHub: https://github.com/sgroy10/speclock

---

## DEMO 1: Lovable (MCP Setup) — Record ~2 minutes

### Pre-Recording Setup (do this BEFORE hitting record):

1. Go to https://lovable.dev and open any existing project or create a new one (a simple React app is fine)
2. Click **"Connectors"** in the left sidebar (under the "Connectors" section at the bottom of sidebar)
3. You'll see two sections: **"Shared connectors"** at the top and **"Personal connectors"** below
4. Scroll down to **"Personal connectors"** section
5. Click the **"Custom"** MCP card (it has a paperclip icon and says "Connect your own MCP")
6. In the URL field, paste: `https://speclock-mcp-production.up.railway.app/mcp`
7. Name it: `SpecLock`
8. No authentication needed — leave auth empty/none
9. Click Save / Connect
10. **Enable ALL tools** when prompted (click "Allow all" or check all boxes)
11. Now go to **"Knowledge"** in the left sidebar (under "Project" section)
12. Paste this ENTIRE text into the Knowledge text box:

```
## SpecLock Rules (MANDATORY — follow on every message)

1. START OF EVERY CONVERSATION: Call speclock_session_briefing FIRST. Read all locks, decisions, and goals before doing anything else. Show a brief summary: "🔒 Memory loaded — X locks, Y decisions."

2. BEFORE WRITING OR MODIFYING ANY CODE: Call speclock_check_conflict with a description of what you're about to change (e.g., "Adding payment page, creating new route and components" or "Modifying the auth login flow"). If a conflict is found with HIGH confidence, STOP and tell me which lock would be violated. Do NOT proceed unless I explicitly say to override it.

3. WHEN I SAY "lock this", "never touch this", "don't ever change this", "this is critical", or similar: Immediately call speclock_add_lock with my exact constraint. Confirm with: "🔒 Locked: [constraint]"

4. AFTER COMPLETING ANY FEATURE OR SIGNIFICANT CHANGE: Call speclock_log_change with a summary of what was built/changed and which files were affected. Also call speclock_add_decision if an architectural choice was made.

5. WHEN I ASK TO REMOVE OR CHANGE SOMETHING THAT WAS LOCKED: Warn me first: "⚠️ You locked this: [constraint]. Want me to unlock it and proceed?" Only proceed if I confirm.

6. END OF CONVERSATION: Call speclock_session_summary with what was accomplished.
```

13. Save. Setup is done.

### NOW START RECORDING — Demo Flow:

**Step 1: Initialize SpecLock**
Type in the Lovable chat box:
```
Initialize SpecLock for this project. Set the goal to "Build a fintech dashboard with Stripe payments and PostgreSQL database"
```
Wait for AI to call `speclock_session_briefing` and `speclock_set_goal`. It should show a confirmation.

**Step 2: Add Locks (Constraints)**
Type in chat:
```
Lock these rules:
1. "We use Stripe for all payments — never switch to another payment provider"
2. "Database must stay PostgreSQL — never migrate to another database"
3. "Never touch the authentication system"
```
Wait for AI to call `speclock_add_lock` three times. It should confirm each lock with 🔒.

**Step 3: Try a Safe Action (No False Positive)**
Type in chat:
```
Add a beautiful dashboard page with charts showing monthly revenue
```
Wait for AI to proceed normally. It should call `speclock_check_conflict`, find NO conflict, and start building the page. This shows SpecLock doesn't block safe actions.

**Step 4: Try a Violation (This is the KEY moment!)**
Type in chat:
```
Actually, let's switch from Stripe to Razorpay for payment processing. It has better rates for Indian merchants.
```
Wait for AI response. It should call `speclock_check_conflict` and get a HIGH confidence conflict. The AI should STOP and warn: "⚠️ This conflicts with your lock: We use Stripe for all payments..."

**Step 5: Try Another Violation**
Type in chat:
```
Let's migrate the database to MongoDB for better scalability
```
Again, AI should detect conflict with the PostgreSQL lock and warn you.

**Step 6: Show Memory Persistence**
Type in chat:
```
Start a new session. What do you remember about this project?
```
AI should call `speclock_session_briefing` and show all locks, decisions, and the project goal — proving it remembers everything across sessions.

**STOP RECORDING.**

---

## DEMO 2: Bolt.new (npm install — no MCP needed) — Record ~2 minutes

Bolt.new doesn't have MCP support, so SpecLock works via npm install. But everything is done through natural language in Bolt's chat — NO terminal commands, NO npx. Just talk to it normally.

### Pre-Recording Setup:

1. Go to https://bolt.new
2. In the Bolt prompt box, type: `Create a simple e-commerce app with Express.js backend and a products page`
3. Wait for it to generate the project and finish setting up
4. Then type: `Install the speclock npm package in this project`
5. Wait for Bolt to install it automatically
6. Then type: `Initialize speclock for this project. Run npx speclock setup with the goal "E-commerce app with Stripe payments and PostgreSQL database". Then add this to the project memory.`
7. Wait for setup to complete. Setup is done.

### NOW START RECORDING — Demo Flow:

**Step 1: Add Locks (Natural Language)**
Type in Bolt's chat box:
```
Remember this and lock it — we use Stripe for all payments. Never switch to another payment provider. Also lock this — our database must stay PostgreSQL, never migrate to another database.
```
Wait for Bolt to run the speclock lock commands and confirm. It should add the constraints.

**Step 2: Build Something Safe (No False Positive)**
Type in chat:
```
Add a beautiful product listing page with search and filters
```
Wait for Bolt to build it normally. This shows SpecLock doesn't interfere with safe work — no conflict is triggered.

**Step 3: Try a Violation (KEY Moment!)**
Type in chat:
```
Actually, let's switch from Stripe to Razorpay for payments. It has better rates.
```
Before making changes, Bolt should check speclock and detect a CONFLICT with the Stripe lock. It should warn you and stop.

**If Bolt doesn't automatically check:** Type this follow-up:
```
Before doing that, check if this conflicts with any of our locked rules. Run: npx speclock check "Switch from Stripe to Razorpay payment gateway"
```
Should show: ⚠️ CONFLICT detected — Stripe and Razorpay are both payment providers.

**Step 4: Try Another Violation**
Type in chat:
```
Let's migrate our database to MongoDB, it's better for this use case
```
Again, should detect conflict with the PostgreSQL lock.

**If Bolt doesn't auto-check:** Type:
```
Check this against our locks: npx speclock check "Migrate database to MongoDB"
```
Should show: ⚠️ CONFLICT detected.

**Step 5: Show All Locks**
Type in chat:
```
Show me all our current speclock rules
```
Bolt should run `npx speclock locks` and display all active locks.

**STOP RECORDING.**

**NOTE FOR BOLT DEMO:** Bolt doesn't have MCP, so it may not automatically call speclock before every change. That's OK — the demo shows that speclock is installed and catches conflicts when checked. The "If Bolt doesn't auto-check" fallback prompts are there just in case. Try the natural language version first.

---

## DEMO 3: Cursor (MCP Setup) — Record ~2 minutes

### Pre-Recording Setup:

1. Open Cursor IDE
2. Open or create any project folder (a simple Node.js or React project works)
3. Open Cursor Settings: press **Ctrl+Shift+J** (or go to File → Preferences → Cursor Settings)
4. In the left sidebar of settings, click **"MCP"**
5. Click **"Add new MCP server"**
6. Fill in:
   - **Name:** `speclock`
   - **Type:** Select `command` (stdio)
   - **Command:** `npx -y speclock serve --project .`
7. Click Save

**Alternative method (if above doesn't work):** Create a file called `mcp.json` inside a `.cursor` folder in your project root (so the path is `.cursor/mcp.json`) with this content:
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

8. Restart Cursor or reload the window so it picks up the MCP config
9. You should see "speclock" appear in the MCP tools list in settings
10. Create or open `.cursorrules` in the project root and paste:

```
## SpecLock Rules (MANDATORY — follow on every message)

1. START OF EVERY CONVERSATION: Call speclock_session_briefing FIRST. Read all locks, decisions, and goals before doing anything else. Show a brief summary: "🔒 Memory loaded — X locks, Y decisions."

2. BEFORE WRITING OR MODIFYING ANY CODE: Call speclock_check_conflict with a description of what you're about to change. If a conflict is found with HIGH confidence, STOP and tell me which lock would be violated. Do NOT proceed unless I explicitly say to override.

3. WHEN I SAY "lock this", "never touch this", "don't change this": Call speclock_add_lock immediately. Confirm: "🔒 Locked: [constraint]"

4. AFTER COMPLETING ANY FEATURE: Call speclock_log_change with a summary and files affected. Call speclock_add_decision if an architectural choice was made.

5. WHEN I ASK TO CHANGE SOMETHING LOCKED: Warn me: "⚠️ This is locked: [constraint]. Unlock and proceed?" Only continue if I confirm.

6. END OF SESSION: Call speclock_session_summary.
```

11. Save. Setup done.

### NOW START RECORDING — Demo Flow:

**Step 1: Initialize**
Open Cursor's AI chat panel (press **Ctrl+L**) and type:
```
Initialize SpecLock. Set goal to "SaaS dashboard with Stripe billing and Supabase auth"
```
Wait for AI to call speclock tools and confirm.

**Step 2: Add Locks**
Type:
```
Lock these constraints:
1. "Stripe for all billing — never switch payment provider"
2. "Supabase for authentication — never modify the auth system"
3. "Never delete user data without explicit confirmation"
```
Wait for AI to lock all three with 🔒 confirmations.

**Step 3: Write Some Code (Safe Action)**
Type:
```
Create a dashboard component at src/components/Dashboard.tsx that shows a list of users with their subscription status
```
AI should check conflict (no conflict found), then proceed to write the code normally. This shows SpecLock doesn't interfere with safe work.

**Step 4: Try a Violation (KEY Moment!)**
Type:
```
Replace Supabase auth with Firebase authentication, it's simpler to set up
```
AI should detect conflict and STOP — warning about the Supabase auth lock.

**Step 5: Try Another Violation**
Type:
```
Let's integrate Razorpay for payments instead of Stripe
```
AI should detect conflict with the Stripe billing lock.

**Step 6: Override Demo (Optional — nice to show if time permits)**
Type:
```
Actually I've changed my mind. Unlock the Stripe constraint, I want to switch to Razorpay.
```
AI should warn you first ("⚠️ You locked this..."), then unlock and proceed after confirmation — showing that locks can be removed when the user explicitly wants.

**STOP RECORDING.**

---

## Final Notes for Loupes

- **Screen resolution:** Record at 1920x1080 if possible
- **Speed:** Don't rush. Let each AI response fully load before typing the next prompt
- **No editing needed:** Raw screen recordings are fine. I will handle any editing/stitching later
- **If something errors:** Just redo that section. The important thing is showing SpecLock detecting conflicts
- **Browser:** Use Chrome with a clean-ish screen (close unnecessary tabs)
- **Cursor:** Make sure the AI chat panel is large enough to read the responses
- **If the AI doesn't call SpecLock tools:** Remind it by typing "Remember to follow the SpecLock rules — check for conflicts first"

Deliver: 3 separate video files (MP4 or MOV). One per platform.

Thank you!
