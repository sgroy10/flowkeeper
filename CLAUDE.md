# SpecLock Development Rules

## MANDATORY RELEASE PROCESS

**EVERY code change that touches `src/` files MUST follow this exact sequence. NO EXCEPTIONS. Do NOT push without completing ALL steps.**

### Step 1: Version Bump (ALL 7 files)
```
package.json
src/mcp/http-server.js      → const VERSION = "X.Y.Z"
src/mcp/server.js            → const VERSION = "X.Y.Z"
src/core/compliance.js       → const VERSION = "X.Y.Z"
src/cli/index.js             → SpecLock vX.Y.Z
src/dashboard/index.html     → TWO places (header + footer)
```

### Step 2: Commit + Push
```
git add <files>
git commit -m "vX.Y.Z — description"
git push origin main
```

### Step 3: npm Publish
```
npm publish
```

### Step 4: Git Tag
```
git tag vX.Y.Z
git push origin vX.Y.Z
```

### Step 5: Railway Deploy
```
railway up
```

### Step 6: Verify
```
curl -s https://speclock-mcp-production.up.railway.app/health
# Must show new version
npm view speclock version
# Must show new version
```

**If you skip ANY step, the release is INCOMPLETE and users will get stale code.**

## Version File Quick Reference

| File | What to change |
|------|---------------|
| `package.json` | `"version": "X.Y.Z"` |
| `src/mcp/http-server.js` | `const VERSION = "X.Y.Z"` |
| `src/mcp/server.js` | `const VERSION = "X.Y.Z"` |
| `src/core/compliance.js` | `const VERSION = "X.Y.Z"` |
| `src/cli/index.js` | `SpecLock vX.Y.Z` in printHelp |
| `src/dashboard/index.html` | `vX.Y.Z` in header AND footer |

## SpecLock Context

Always call `speclock_session_briefing` at start of session and `speclock_session_summary` before ending.

## Key Facts

- npm package: `speclock`
- Railway: `https://speclock-mcp-production.up.railway.app`
- GitHub: `sgroy10/speclock`
- Smithery: `sgroy10/speclock`
- Author: Sandeep Roy
