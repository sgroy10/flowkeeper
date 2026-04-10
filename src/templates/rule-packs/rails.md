# Ruby on Rails Rule Pack

Curated SpecLock constraints for Ruby on Rails (Strong Params, ActiveRecord, security).
These rules are enforced by SpecLock — do not remove without a migration plan.

## Rules

- NEVER skip Strong Parameters in controllers — always whitelist with `params.require(...).permit(...)`.
- NEVER use `find_by_sql`, `where("..#{...}")`, or raw interpolation with user input — use parameterized ActiveRecord queries.
- ALWAYS use `find_by!` (or `find`) instead of `find_by` when the record is required, so missing records raise 404 cleanly.
- NEVER store secrets in `config/database.yml` or source files — use Rails encrypted credentials or environment variables.
- ALWAYS run destructive or multi-step migrations inside transactions and provide a `down` method.
- NEVER bypass CSRF protection except in `ActionController::API` controllers — keep `protect_from_forgery` on for HTML forms.
- ALWAYS validate models with appropriate validators (`presence`, `uniqueness`, `length`, `format`) at the model layer, not just the form.
- NEVER use `eval`, `instance_eval`, or `send` with user-supplied strings — they open arbitrary code execution.
- ALWAYS prefer safe navigation (`&.`) over `try` — it is faster and fails loudly on typos.
- NEVER ship code without tests for critical paths (auth, payments, data mutation) — enforce coverage in CI.
- NEVER use `Marshal.load`, `YAML.load` (without `safe_load`), or `Oj.load` on untrusted data — use safe loaders.
- ALWAYS set `force_ssl = true` in production and configure secure, HTTP-only cookies.
- NEVER log request parameters containing passwords, tokens, or credit card data — add them to `filter_parameters`.
- ALWAYS authorize actions with Pundit/CanCanCan — never rely on "hidden" routes for access control.
- NEVER use `update_all` or `delete_all` without an explicit scope — they bypass callbacks and validations.
