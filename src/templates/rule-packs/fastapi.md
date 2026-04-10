# FastAPI Rule Pack

Curated SpecLock constraints for FastAPI + Python (async, Pydantic, JWT).
These rules are enforced by SpecLock — do not remove without a migration plan.

## Rules

- NEVER bypass Pydantic validation on request bodies — every endpoint must declare a typed request model.
- NEVER expose database connection strings, API keys, or secrets in code — load them from environment variables or a secrets manager.
- ALWAYS use FastAPI dependency injection (`Depends`) for database sessions, auth, and shared services.
- NEVER write SQL queries with string concatenation or f-strings on user input — use parameterized queries or an ORM like SQLAlchemy.
- ALWAYS use `async def` for I/O-bound endpoints (database, HTTP, file) and sync `def` only for pure CPU work.
- NEVER catch broad `Exception` without logging the traceback — use `logger.exception` and re-raise when appropriate.
- ALWAYS validate and verify JWT tokens (signature, expiry, issuer, audience) before trusting any claim.
- NEVER store passwords in plaintext — use bcrypt, argon2, or passlib with a strong work factor.
- NEVER expose internal error messages, stack traces, or ORM errors to API responses — return sanitized error shapes.
- ALWAYS enforce HTTPS in production environments — redirect HTTP, set HSTS, and reject insecure cookies.
- NEVER use `eval()`, `exec()`, or `pickle.loads` on user-supplied input — all three are remote code execution vectors.
- ALWAYS rate-limit public API endpoints with `slowapi` or an upstream gateway to prevent abuse.
- ALWAYS pin dependency versions in `requirements.txt` or `pyproject.toml` and review with `pip-audit` / `safety`.
- NEVER commit `.env`, `credentials.json`, or private keys to version control — add them to `.gitignore`.
- ALWAYS configure CORS explicitly with allowed origins — never use `allow_origins=["*"]` together with credentials.
