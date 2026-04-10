# Node.js / Express Rule Pack

Curated SpecLock constraints for Node.js and Express (async, security, reliability).
These rules are enforced by SpecLock — do not remove without a migration plan.

## Rules

- NEVER block the event loop with synchronous I/O (`fs.readFileSync`, `crypto.pbkdf2Sync`) on request paths — use async variants.
- NEVER use `eval()`, `new Function()`, or `vm.runInThisContext` on user-supplied input — they are remote code execution vectors.
- ALWAYS validate and sanitize request input with `zod`, `joi`, or `express-validator` before trusting it.
- NEVER concatenate user input into SQL or shell commands — use parameterized queries and `execFile` with argument arrays.
- ALWAYS store secrets in environment variables or a secrets manager — never commit them to the repo.
- NEVER catch promise rejections silently — always handle errors in `.catch()` or `try/await/catch` and log them.
- ALWAYS set security headers via `helmet` and enable strict CORS with an explicit origin allowlist.
- NEVER trust `req.body`, `req.query`, `req.params`, or `req.headers` without validation.
- ALWAYS hash passwords with `bcrypt`, `argon2`, or `scrypt` — never MD5, SHA1, or plain SHA256.
- NEVER use `dangerouslySetInnerHTML`, `eval`-based templating, or unescaped interpolation in server-rendered HTML.
- ALWAYS pin dependencies with `package-lock.json` and audit with `npm audit` / `snyk` in CI.
- NEVER ship `console.log` or `debugger` statements to production — use a proper logger like `pino` or `winston`.
- ALWAYS enforce rate limiting on public endpoints with `express-rate-limit` or an upstream gateway.
- NEVER log passwords, tokens, session IDs, or PII — redact sensitive fields before logging.
- ALWAYS handle `unhandledRejection` and `uncaughtException` at the process level and exit cleanly.
