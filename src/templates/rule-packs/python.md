# Python Rule Pack

Curated SpecLock constraints for generic Python projects (security, type hints, hygiene).
These rules are enforced by SpecLock — do not remove without a migration plan.

## Rules

- NEVER use `eval()`, `exec()`, or `compile()` on user-supplied input — they are remote code execution vectors.
- NEVER use `pickle.loads`, `shelve`, or `marshal.loads` on untrusted data — use JSON or a schema-validated format.
- ALWAYS use `subprocess.run` with a list of arguments and `shell=False` — never `shell=True` on user input.
- NEVER hardcode secrets, API keys, or passwords in source files — read from environment variables or a secrets manager.
- ALWAYS add type hints to public functions and class methods and verify with `mypy` or `pyright` in CI.
- NEVER catch bare `except:` — always catch specific exception classes and log the traceback.
- ALWAYS use context managers (`with` statements) for files, sockets, locks, and database connections.
- NEVER write SQL with string concatenation or f-strings — use parameterized queries or an ORM.
- ALWAYS pin dependencies in `requirements.txt` / `pyproject.toml` and audit with `pip-audit` or `safety`.
- NEVER commit virtual environments, `.env` files, or credentials to version control.
- ALWAYS validate external input with `pydantic`, `marshmallow`, or explicit type checks before use.
- NEVER mutate function default arguments — use `None` and assign inside the function body.
- ALWAYS use `logging` instead of `print` for anything other than CLI output, and configure levels per environment.
- NEVER use `os.system` — use `subprocess` with explicit argument lists.
- ALWAYS format code with `black` / `ruff format` and lint with `ruff` / `flake8` in CI.
