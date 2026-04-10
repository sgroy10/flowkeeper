// SpecLock Git Hook Management
// Developed by Sandeep Roy (https://github.com/sgroy10)

import fs from "fs";
import path from "path";

const HOOK_MARKER = "# SPECLOCK-HOOK";

const HOOK_SCRIPT = `#!/bin/sh
${HOOK_MARKER} — Do not remove this line
# SpecLock pre-commit hook: runs semantic audit of staged diff + commit message
# against active locks. Unlike the legacy 'audit' subcommand, this one feeds
# the actual diff content AND the commit message through the semantic conflict
# engine — the same one used by 'speclock check'.
# Install: npx speclock hook install
# Remove:  npx speclock hook remove
#
# Enforcement mode precedence (first match wins):
#   1. SPECLOCK_STRICT=1 in the environment when git commit runs
#   2. brain.enforcement.mode === "hard" in .speclock/brain.json
#      (set with: speclock enforce hard)
#   3. Default: warn mode — violations printed, commit allowed
#
# NOTE: Some git versions/shells sanitize the environment before running
# hooks, which can strip SPECLOCK_STRICT. The persistent brain mode set by
# 'speclock enforce hard' is the reliable way to enforce strict blocking.

# Explicitly export SPECLOCK_STRICT so it survives any sh -c subshells the
# CLI may spawn. If unset, leave it unset — the CLI will then fall back to
# reading brain.enforcement.mode from .speclock/brain.json.
if [ -n "\${SPECLOCK_STRICT:-}" ]; then
  export SPECLOCK_STRICT
fi

# Marker so the CLI knows it's running inside the pre-commit hook.
export SPECLOCK_HOOK=1

npx speclock audit-semantic --pre-commit
exit $?
`;

export function installHook(root) {
  const hooksDir = path.join(root, ".git", "hooks");
  if (!fs.existsSync(path.join(root, ".git"))) {
    return { success: false, error: "Not a git repository. Run 'git init' first." };
  }

  // Ensure hooks directory exists
  fs.mkdirSync(hooksDir, { recursive: true });

  const hookPath = path.join(hooksDir, "pre-commit");

  // Check if existing hook exists (not ours)
  if (fs.existsSync(hookPath)) {
    const existing = fs.readFileSync(hookPath, "utf-8");
    if (existing.includes(HOOK_MARKER)) {
      return { success: false, error: "SpecLock pre-commit hook is already installed." };
    }
    // Append to existing hook
    const appended = existing.trimEnd() + "\n\n" + HOOK_SCRIPT;
    fs.writeFileSync(hookPath, appended, { mode: 0o755 });
    return { success: true, message: "SpecLock hook appended to existing pre-commit hook." };
  }

  fs.writeFileSync(hookPath, HOOK_SCRIPT, { mode: 0o755 });
  return { success: true, message: "SpecLock pre-commit hook installed." };
}

export function removeHook(root) {
  const hookPath = path.join(root, ".git", "hooks", "pre-commit");
  if (!fs.existsSync(hookPath)) {
    return { success: false, error: "No pre-commit hook found." };
  }

  const content = fs.readFileSync(hookPath, "utf-8");
  if (!content.includes(HOOK_MARKER)) {
    return { success: false, error: "Pre-commit hook exists but was not installed by SpecLock." };
  }

  // Strip our block (from the SPECLOCK-HOOK marker through the trailing
  // `exit $?` that terminates the script snippet). Everything inside the
  // block is ours — comments, env exports, the npx invocation, etc.
  const cleaned = content
    .replace(/\n*# SPECLOCK-HOOK[^\n]*\n[\s\S]*?exit \$\?\n?/, "\n")
    .trim();

  // If nothing meaningful remains (just #!/bin/sh or empty), remove file.
  const remaining = cleaned
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && l !== "#!/bin/sh")
    .join("\n");

  if (remaining.length === 0) {
    fs.unlinkSync(hookPath);
    return { success: true, message: "SpecLock pre-commit hook removed." };
  }

  // Other hook content exists — keep the rest.
  fs.writeFileSync(hookPath, cleaned + "\n", { mode: 0o755 });
  return { success: true, message: "SpecLock hook removed. Other hook content preserved." };
}

export function isHookInstalled(root) {
  const hookPath = path.join(root, ".git", "hooks", "pre-commit");
  if (!fs.existsSync(hookPath)) return false;
  const content = fs.readFileSync(hookPath, "utf-8");
  return content.includes(HOOK_MARKER);
}
