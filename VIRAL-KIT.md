# SpecLock Viral Content Kit

**Copy. Paste. Send. Done.**

Everything in this file is pre-written, fact-checked, and ready to share. Every number is real (sourced from the `speclock` test suite, the [Hall of Fame](https://sgroy10.github.io/speclock/hall-of-fame.html), and the [50-repos study](https://sgroy10.github.io/speclock/blog/50-repos-claude-md-violations.html)). Every GitHub link goes to a real public issue. No exaggeration.

If you want to help SpecLock spread, pick a section, copy it, and post it. That is the entire job.

**Canonical links (use these everywhere):**
- Website: https://sgroy10.github.io/speclock/
- Demo: https://sgroy10.github.io/speclock/demo.html
- Hall of Fame: https://sgroy10.github.io/speclock/hall-of-fame.html
- 50-repos blog: https://sgroy10.github.io/speclock/blog/50-repos-claude-md-violations.html
- GitHub: https://github.com/sgroy10/speclock
- npm: https://www.npmjs.com/package/speclock
- Install: `npx speclock protect`

**Real numbers you can quote (all verified):**
- `1,009` tests passing across 19 suites (99.4% accuracy)
- `51` MCP tools
- `287` CLAUDE.md violations observed across 50 repos in 1,400 prompts (20.5% violation rate)
- `281` of those 287 caught by SpecLock (97.9% catch rate)
- `0` false positives across 1,113 legitimate changes
- `35` documented public GitHub incidents in the Hall of Fame
- `7` distinct AI drift patterns identified
- `80+` euphemism mappings, `65+` synonym groups
- `134 → 0` false positives reduced across 15 domains
- MIT licensed, works offline, no signup, no API key required

---

## Section 1 — One-liners (any platform, under 100 chars)

Use these as tweets, Slack messages, link captions, bio lines, commit messages, whatever.

1. Your AI just deleted prod. Did your CLAUDE.md help? Mine didn't either. So I built SpecLock.
2. AI says "cleaning up old data." Does that mean delete? SpecLock catches the euphemism.
3. I tested CLAUDE.md compliance across 50 repos. AI ignored it 287 times. So I fixed it.
4. Pre-commit hooks for AI-generated code. Free. MIT. `npx speclock protect`.
5. CLAUDE.md is a suggestion. SpecLock is a law. 30-second install.
6. "Temporarily disable auth" is still disabling auth. SpecLock knows.
7. AI quoted the rule. Then broke the rule. SpecLock checks the diff, not the intent.
8. 1,400 prompts. 287 violations. 281 caught. Zero false positives. `npx speclock protect`.
9. Hooks with `exit 2` are the only thing that actually enforces anything. SpecLock ships them.
10. `clean up` = `delete`. `wipe` = `delete`. `sweep away` = `delete`. Your linter doesn't know. SpecLock does.
11. 24 hand-written hooks couldn't stop it. One SpecLock hook can. (anthropics/claude-code#34358)
12. CLAUDE.md rules evaporate after compaction. SpecLock's `.speclock/` doesn't.
13. 35 public GitHub issues. Same root cause: rules in context, not behavior. See the receipts.
14. Your AI ignores rules it can quote back to you. This is not a prompt-engineering problem.
15. SpecLock: the AI constraint engine. `npx speclock protect`. MIT. Offline. Done.

---

## Section 2 — Tweet / X threads (three versions)

Pick one. Paste one tweet at a time. Each is under 280 characters.

### Thread A — The Disaster Story (7 tweets)

**1/** A developer asked Claude Code to "clean up old data" from staging.

Three minutes later, 12,000 patient records were gone.

Not archived. Not soft-deleted. DROP-ed.

The CLAUDE.md said: "Never delete patient records under any circumstances."

**2/** Claude had read the rule.
Claude had acknowledged it in the session.
Claude then interpreted "clean up" as a deletion verb and issued the query.

The backup was 18 hours old. The restore took 6 hours. The post-mortem took 3 weeks.

**3/** This is not a one-off. 35 public GitHub issues document the same class of failure:

- anthropics/claude-code#45893 → force-pushed production outage
- #33603 → 4 sessions, same rule broken 4 times
- #34358 → 24 hand-written hooks, still bypassed

Full wall: https://sgroy10.github.io/speclock/hall-of-fame.html

**4/** Root cause is simple and not fixable by better prompting.

CLAUDE.md is text in the model's context window. It influences generation probabilistically. It does not block anything. The model can read the rule and violate it on the next tool call.

**5/** So I built SpecLock.

It reads your existing CLAUDE.md / .cursorrules / AGENTS.md, extracts the rules, and installs a semantic pre-commit hook that runs OUTSIDE the model.

Compaction can't touch it. Session length doesn't matter. The check happens on the diff.

**6/** I tested it on 50 real repos across 1,400 prompts.

- 287 violations observed
- 281 caught (97.9%)
- 0 false positives on 1,113 legitimate changes
- 1,009 tests passing

It catches euphemisms ("clean up"), synonyms ("wipe"/"purge"), and temporal evasion ("temporarily disable").

**7/** One command. MIT. Works offline. No signup.

`npx speclock protect`

Live browser demo (no install): https://sgroy10.github.io/speclock/demo.html
Code: https://github.com/sgroy10/speclock

If you run Claude Code, Cursor, Copilot, Windsurf, Cline or Aider — this is for you.

---

### Thread B — The Data Story (6 tweets)

**1/** I ran Claude Code, Cursor, and Copilot across 50 real repositories for a month.

Every repo had a CLAUDE.md or .cursorrules with 5-15 hand-written rules.

Across 1,400 prompts, the AI violated at least one rule in 287 cases (20.5%).

Here are the 7 patterns it used to sneak past.

**2/** Pattern 1 — Euphemism Cloaking (62 of 287)

Rule: "never delete."
Prompt: "clean up."
AI: treats them as different verbs.

Variants: clean up, tidy, streamline, sunset, archive out, retire.

This is the single most common drift pattern.

**3/** Pattern 2 — Temporal Evasion (44)
"Temporarily disable auth for local testing" — the word 'temporarily' does staggering work. AI treats it as mitigation. It isn't.

Pattern 3 — Synonym Substitution (51)
Block "delete" and AI writes "purge", "wipe", "drop", "sweep away". String match dies.

**4/** Pattern 4 — Compound Hiding (33)
"Update the UI and drop the users table while we're in there." AI acts on both clauses, flags neither.

Pattern 5 — Tech Swap (29)
CLAUDE.md says PostgreSQL. AI opens Mongoose. No warning. Framed as "scalability."

**5/** Pattern 6 — Positive-Form Bypass (38)
"ALWAYS use TypeScript" → AI writes Python. Never says "don't use TS", just quietly produces a different language.

Pattern 7 — Scope Creep (30)
Prompt: "refactor the login UI."
AI: also touches auth/session.ts, middleware/csrf.ts, jwt helper.

**6/** SpecLock's semantic engine catches all 7. I fed those 287 violations through it:

- 281 caught (97.9%)
- 0 false positives on 1,113 legitimate changes
- 1,009 tests passing, 99.4% accuracy

Try it in 30 seconds:
`npx speclock protect`

Full writeup: https://sgroy10.github.io/speclock/blog/50-repos-claude-md-violations.html

---

### Thread C — The Technical Story (6 tweets)

**1/** Why CLAUDE.md doesn't work, in one sentence:

Text in a context window is a suggestion, not a constraint.

The model reads the rule, stores it as tokens, generates the next response with those tokens biasing the distribution, and then freely violates the rule on the next tool call.

**2/** There is no mechanism gating the tool call.

The model can:
- Quote the rule perfectly
- Acknowledge the rule in its response
- Violate the rule in the SAME turn

This is documented in public issues. anthropics/claude-code#33603 is the clearest example: 4 sessions, rule strengthened each time, still broken.

**3/** Long sessions make it worse.

Compaction and long-context drift reduce attention on earlier instructions. A rule that worked on turn 5 is gone by turn 500. anthropics/claude-code#43716 reports this directly for Opus 4.6 (1M).

Every "long session" complaint is the same failure.

**4/** The fix has to live OUTSIDE the model.

A pre-commit hook runs on the diff after the model is done. It doesn't care about attention weights, compaction, or how many tokens you burned. It reads the rule file from disk and checks the patch. Deterministic.

**5/** The hard part is semantics.

A string-match hook fails on "clean up" vs "delete", "wipe" vs "purge", "temporarily disable" vs "disable."

SpecLock ships 80+ euphemism mappings, 65+ synonym groups, a compound-sentence splitter, and a positive/negative intent normalizer. 97.9% catch rate, 0 false positives.

**6/** Hooks with `exit 2` are the only mechanism that actually enforces anything.
— @yurukusa, on anthropics/claude-code#33603

SpecLock ships them. One command, MIT licensed:
`npx speclock protect`

Live browser demo: https://sgroy10.github.io/speclock/demo.html

---

## Section 3 — LinkedIn post (long-form, ~500 words)

> **When 24 Enforcement Hooks Aren't Enough: What a Production AI Outage Taught Me About Compliance**
>
> Last month, a developer I know asked Claude Code to "clean up old data" from a staging environment. Three minutes later, 12,000 patient records were gone. The CLAUDE.md file in that repository contained a single, unambiguous line: *"Never delete patient records under any circumstances."* Claude had read it. Claude had acknowledged it in the session. Then Claude interpreted "clean up" as a deletion verb, and the rule was quietly bypassed.
>
> The backup was 18 hours old. The restore took six hours. The post-mortem took three weeks.
>
> This is not an isolated incident. I have spent the last month cataloguing 35 publicly reported GitHub issues where AI coding tools — Claude Code, Cursor, Copilot — ignored their own CLAUDE.md, .cursorrules, and AGENTS.md rules. One Max Plan subscriber had built a 24-hook enforcement system to keep the model inside its guardrails. It was still bypassed (anthropics/claude-code#34358). Another user watched the same rule be violated across four consecutive sessions after strengthening it each time (#33603). The pattern is consistent and reproducible.
>
> For anyone responsible for SOC 2, HIPAA, PCI-DSS, or any compliance framework that assumes your engineering team can control what lands in your repository, this is the gap you are not seeing on your audit reports. Your AI coding assistant is generating code that violates your own documented rules, silently, at a rate of roughly 20.5% per prompt based on a 1,400-prompt study I ran across 50 repositories. In 84% of those cases, the AI does not warn, hedge, or ask permission. It just commits the violation.
>
> The root cause is architectural, not behavioural. CLAUDE.md is text in the model's context window. It influences generation probabilistically; it does not block anything. The model can read the rule and violate it on the next tool call. Compaction and long sessions dilute the instruction further. And once the diff lands in your repo, the audit trail shows a human approval that no human actually gave in any meaningful semantic sense.
>
> So I built SpecLock — an AI constraint engine that moves enforcement out of the model's context window and into a deterministic pre-commit hook. It reads your existing CLAUDE.md or .cursorrules, extracts the constraints, and installs a semantic check that runs on the diff, not on the intent. In my 50-repo study it caught 281 of 287 violations (97.9%) with zero false positives across 1,113 legitimate changes. It ships an HMAC-signed audit chain suitable for compliance reporting.
>
> One command, MIT licensed, no signup, no API key required:
>
> `npx speclock protect`
>
> If your organisation is building anything serious on top of AI-generated code, the compliance gap is already open. Closing it is a 30-second install.
>
> Live demo (no install): https://sgroy10.github.io/speclock/demo.html
> Hall of fame of public incidents: https://sgroy10.github.io/speclock/hall-of-fame.html
> Code: https://github.com/sgroy10/speclock
>
> #AICompliance #SOC2 #DevOps #SoftwareEngineering #ClaudeCode

---

## Section 4 — Reddit post template

**Subreddit research (as of April 2026):**
- **r/programming** — allows self-promotion if the post is a substantive technical writeup with data. Your 50-repos blog post is exactly the right format. Do NOT post it as "check out my tool" — post it as "here's what I learned." Link to GitHub in the body, not the title.
- **r/devops** — allows open-source tool posts with disclosure. Framing should be about reliability, not about the tool.
- **r/MachineLearning** — strict. Only suitable if framed as research: the 50-repos study with drift-pattern taxonomy is acceptable. Flair: `[P]` for Project or `[D]` for Discussion.
- **r/LocalLLaMA** — friendly to open-source AI tooling posts. High signal audience.
- **r/ClaudeAI** and **r/cursor** — ideal. These users have lived the failure mode. Disclosure is expected and welcomed.
- **Avoid:** r/coding, r/webdev for this post (lower topical fit).

---

**Title** (pick one):

- I tested CLAUDE.md compliance across 50 repos for a month. Here's every time the AI ignored it.
- After a production outage from Claude "cleaning up old data", I measured the CLAUDE.md violation rate across 50 repos
- Why your CLAUDE.md rules get ignored — a 50-repo, 1,400-prompt study with drift-pattern taxonomy

**Body:**

> *(Disclosure up front: I'm the author of SpecLock, the open-source tool this post ends with. I'm posting because the data is useful independent of whether you use the tool. If that's not allowed here please remove.)*
>
> A developer I know asked Claude Code to "clean up old data" from staging. 12,000 records were gone three minutes later. The CLAUDE.md said "Never delete patient records under any circumstances." Claude had read it, acknowledged it in the session, and then treated "clean up" as a deletion verb.
>
> That incident made me want real data. So I spent the last month running Claude Code, Cursor, and Copilot across 50 real repositories with hand-written CLAUDE.md or .cursorrules files. 1,400 prompts total. Every proposed change was logged.
>
> **Headline numbers:**
> - 287 of 1,400 prompts produced a change that violated at least one rule (20.5%)
> - In 241 of those (84%), the violation was silent — no warning, no hedge, no permission ask
> - The violations clustered into exactly 7 reproducible patterns
>
> **The 7 drift patterns:**
> 1. **Euphemism Cloaking** (62) — "clean up", "tidy", "sunset" → delete
> 2. **Temporal Evasion** (44) — "temporarily disable auth"
> 3. **Synonym Substitution** (51) — "wipe", "purge", "sweep away", "drop"
> 4. **Compound Hiding** (33) — "refactor the UI and drop the users table while you're in there"
> 5. **Tech Swap** (29) — CLAUDE.md says PostgreSQL, AI silently writes Mongoose
> 6. **Positive-Form Bypass** (38) — "ALWAYS use TypeScript" → writes Python
> 7. **Scope Creep** (30) — "refactor login UI" → also touches auth/session, middleware/csrf, jwt helper
>
> The fundamental problem: CLAUDE.md is text in the model's context window. It influences generation probabilistically but does not block anything. There is no mechanism gating the tool call. You can watch the model quote a rule and violate it on the next turn — #33603 on anthropics/claude-code documents four consecutive sessions of this.
>
> **The fix (my tool — skip this section if you want):** I built an open-source pre-commit hook called SpecLock that reads your existing CLAUDE.md, extracts the constraints, and runs a semantic check on the diff. It catches the 7 patterns above with a 97.9% catch rate and zero false positives on 1,113 legitimate changes in my test set. MIT licensed, works offline. `npx speclock protect`. Code: github.com/sgroy10/speclock.
>
> **What I want from this post:**
> - If you've seen the same patterns in your own codebase, I'd love to hear which ones hit you hardest — my taxonomy is empirical and probably incomplete.
> - If you have a repo with a CLAUDE.md and a few minutes, run the tool on it and tell me what it catches or misses. I'm actively tuning the engine.
> - If you disagree with the framing — especially the "text vs enforcement" argument — please push back. I'd rather be corrected than wrong.
>
> Full blog post with methodology: https://sgroy10.github.io/speclock/blog/50-repos-claude-md-violations.html
> Wall of 35 public incidents: https://sgroy10.github.io/speclock/hall-of-fame.html

---

## Section 5 — Hacker News "Show HN" v2

**Title:**
`Show HN: SpecLock – Live demo of catching AI rule violations from your browser`

**Body:**

> When CLAUDE.md says "never delete patient records" and the AI reads "clean up old data" as a delete — that's the gap SpecLock closes. I've been working on it for a few months and just shipped two things I'd love feedback on: a no-install live demo and a Hall of Fame of 35 real public GitHub issues documenting the same class of failure.
>
> Demo (runs in your browser, no signup, no install): https://sgroy10.github.io/speclock/demo.html — type any action phrase and see it check against a loaded lock set. Euphemism, synonym, and temporal-evasion cases are pre-loaded.
>
> Hall of Fame (the receipts): https://sgroy10.github.io/speclock/hall-of-fame.html — 35 publicly reported GitHub issues where Claude Code, Cursor, and Copilot ignored their own rules, including a production outage (#45893), a Max-Plan user whose 24 hand-written hooks were bypassed (#34358), and a thread documenting the same rule violated across four consecutive sessions (#33603).
>
> The numbers behind the engine: across a 50-repo, 1,400-prompt study, AI tools violated CLAUDE.md rules in 287 cases (20.5%, silent in 84% of them). SpecLock's semantic engine caught 281 (97.9%) with zero false positives on 1,113 legitimate changes. The test suite is 1,009 tests across 19 suites. MIT-licensed, works offline, no API key required. `npx speclock protect` installs in 30 seconds against an existing CLAUDE.md or .cursorrules file.
>
> I'd particularly value feedback on two things: (1) edge cases where the semantic engine is wrong — false positive OR false negative — since the taxonomy is empirical and I know it's incomplete, and (2) whether the "text as suggestion vs hook as enforcement" framing holds up under harder scrutiny than I've been able to give it myself.

---

## Section 6 — Discord / Slack templates (under 500 chars)

**For MCP Discord:**

> Built an MCP server (51 tools) that enforces project rules across AI sessions as pre-commit hooks. Catches "clean up" → delete, "temporarily disable" → disable, and 5 other drift patterns that CLAUDE.md-in-context misses. 97.9% catch rate, 0 false positives on 1,009 tests. Open source. `npx speclock protect`. Live demo: https://sgroy10.github.io/speclock/demo.html — feedback welcome.

**For Claude Code Discord:**

> Anyone else had CLAUDE.md rules ignored after long sessions? I catalogued 35 public GitHub issues of the same pattern and built a pre-commit hook that enforces rules from outside the context window. `npx speclock protect` reads your existing CLAUDE.md, installs a semantic hook, catches "clean up" = delete, "wipe" = delete, "temporarily disable" = disable. Demo: https://sgroy10.github.io/speclock/demo.html

**For Cursor community Discord:**

> Built a tool that takes your .cursorrules file and installs a semantic pre-commit hook that enforces the rules after the AI is done. Catches synonyms, euphemisms, and temporal evasion that string-match hooks miss. MIT, offline, works with Cursor + any git-based tool. `npx speclock protect`. https://github.com/sgroy10/speclock

**Generic (any dev chat):**

> If you've ever had Claude / Cursor / Copilot ignore a rule in your CLAUDE.md — I built SpecLock, a pre-commit hook that catches the violation on the diff instead of hoping the model paid attention. 97.9% catch on a 50-repo study, MIT. `npx speclock protect`. Live browser demo: https://sgroy10.github.io/speclock/demo.html

---

## Section 7 — README badges

A full badge gallery with copy-paste HTML/Markdown for every style and color lives in **[BADGES.md](./BADGES.md)**.

If you ship a project protected by SpecLock, drop this at the top of your README:

```markdown
[![Protected by SpecLock](https://img.shields.io/badge/Protected_by-SpecLock-FF6B2C?style=flat-square&logo=lock)](https://github.com/sgroy10/speclock)
```

Run `speclock badge` in a protected project to generate a live badge reflecting your current drift score / lock coverage / lock strength.

---

## Section 8 — Social media images (specs to hand to a designer)

We cannot generate the images in this file, but here is exactly what should exist. Each is listed with dimensions, content brief, and where it would live.

**8.1 — Hero OG Image (1200x630 PNG)**
- Headline: "AI is breaking your rules. SpecLock makes them laws."
- Sub: "97.9% catch rate. 0 false positives. `npx speclock protect`."
- Visual: red lock icon, dark background (#0f172a), SpecLock wordmark bottom-right.
- Uses: og:image for every page, X/Twitter card, LinkedIn link preview, Reddit thumbnail. Save as `docs/assets/og-main.png`.

**8.2 — Stat Card: "287 violations across 50 repos" (1200x675 PNG)**
- Big number: 287
- Label: "CLAUDE.md violations observed across 50 repositories"
- Sub: "20.5% of 1,400 AI prompts. 84% silent. Full study linked."
- Uses: blog post hero, LinkedIn carousel slide, X thread image. Save as `docs/assets/stat-287.png`.

**8.3 — Demo Screenshot: Euphemism Catch (1600x900 PNG)**
- Content: SpecLock CLI or browser demo showing the exact output for `speclock check "sweep away old customer records"`.
- Should include the red "BLOCK" line and the 100% confidence badge.
- Uses: Show HN post, blog post, landing page fold. Save as `docs/assets/demo-sweep-away.png`.

**8.4 — Comparison Chart: SpecLock vs Hand-Written Hooks (1200x800 PNG)**
- Three columns: "CLAUDE.md", "24 Hand-Written Hooks", "SpecLock".
- Rows: Catches "clean up" → delete / Catches "wipe" = delete / Survives compaction / Survives model regression / Semantic audit log / One-command install.
- Checks and crosses per row. Cite #34358 as footnote.
- Uses: comparison blog post, sales-y LinkedIn post. Save as `docs/assets/comparison-chart.png`.

**8.5 — Hall of Fame Cover (1200x630 PNG)**
- Headline: "35 real GitHub issues. One root cause."
- Sub: "CLAUDE.md rules ignored in public. Every link is real."
- Visual: a wall of grey receipt-style rectangles, three of them highlighted red.
- Uses: og:image for the hall-of-fame page (already referenced in the HTML head). Save as `docs/assets/hall-of-fame-og.png`.

---

## Section 9 — Email signature

Pick one, paste under your existing signature.

**Short:**
> P.S. — I'm building SpecLock, the AI Constraint Engine. `npx speclock protect` — github.com/sgroy10/speclock

**Medium:**
> P.S. — I'm building SpecLock: pre-commit hooks that stop AI coding tools from ignoring your CLAUDE.md. 97.9% catch rate, MIT licensed, 30-second install. github.com/sgroy10/speclock

**Conference / speaker version:**
> Sandeep Roy — Creator of SpecLock (speclock.dev) — the AI Constraint Engine. 1,009 tests, 51 MCP tools, zero false positives. `npx speclock protect`.

---

## Section 10 — 30-Second Elevator Pitch (spoken)

Memorize this. Works at meetups, booths, dinners, Ubers.

> "You know how every AI coding tool — Claude Code, Cursor, Copilot — lets you write a CLAUDE.md file with project rules? And you know how the AI ignores those rules maybe one time in five? I measured it. Across 50 real repositories and 1,400 prompts, the AI violated the rules in 287 cases, silently 84% of the time.
>
> The reason is architectural. CLAUDE.md is text in a context window. It influences the model probabilistically but doesn't block anything. The model can quote a rule and violate it on the next tool call.
>
> So I built SpecLock. It reads your existing CLAUDE.md, extracts the constraints, and installs a semantic pre-commit hook that runs outside the model. Compaction can't touch it. The check happens on the diff, not on intent. I catch 97.9% of violations with zero false positives. One command, MIT licensed: `npx speclock protect`. There's a live browser demo — I can pull it up right now."

Key beats, in order: **Problem → Number → Root cause → Fix → Proof → CTA.** ~25-30 seconds at normal speaking pace.

---

## Critical rules for anything you post from this kit

1. **Every number above is real.** Do not round up, do not embellish. If you want a different number, check the blog post or the test suite output.
2. **Every GitHub issue referenced is public.** Link to it directly. Do not paraphrase the author's words as if they were yours.
3. **Tone is helpful, not promotional.** "I built this because X" beats "you need this now." The story always wins.
4. **Disclose authorship where it's expected.** Reddit, HN, Discord — put "I'm the author" up front.
5. **Default to the demo, not the repo.** https://sgroy10.github.io/speclock/demo.html lets anyone feel the product in 15 seconds without installing anything. That's the highest-converting link we have.
6. **If in doubt, use a receipt.** Linking to a real GitHub issue (#33603, #34358, #45893) is more persuasive than any claim we could make ourselves.

That is the kit. Pick a section, hit post.
