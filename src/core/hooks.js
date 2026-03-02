// SpecLock Git Hook Management

import fs from "fs";
import path from "path";

const HOOK_MARKER = "# SPECLOCK-HOOK";

const HOOK_SCRIPT = `#!/bin/sh
${HOOK_MARKER} — Do not remove this line
# SpecLock pre-commit hook: checks staged files against active locks
# Install: npx speclock hook install
# Remove:  npx speclock hook remove

npx speclock audit
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

  // Check if lines other than our speclock block exist
  const lines = content.split("\n");
  const nonSpeclockLines = lines.filter((line) => {
    const trimmed = line.trim();
    const lower = trimmed.toLowerCase();
    if (!trimmed || trimmed === "#!/bin/sh") return false;
    if (lower.includes("speclock")) return false;
    if (lower.includes("npx speclock")) return false;
    if (trimmed === "exit $?") return false;
    return true;
  });

  if (nonSpeclockLines.length === 0) {
    // Entire hook was ours — remove file
    fs.unlinkSync(hookPath);
    return { success: true, message: "SpecLock pre-commit hook removed." };
  }

  // Other hook content exists — remove our block, keep the rest
  const cleaned = content
    .replace(/\n*# SPECLOCK-HOOK[^\n]*\n.*?exit \$\?\n?/s, "\n")
    .trim();
  fs.writeFileSync(hookPath, cleaned + "\n", { mode: 0o755 });
  return { success: true, message: "SpecLock hook removed. Other hook content preserved." };
}

export function isHookInstalled(root) {
  const hookPath = path.join(root, ".git", "hooks", "pre-commit");
  if (!fs.existsSync(hookPath)) return false;
  const content = fs.readFileSync(hookPath, "utf-8");
  return content.includes(HOOK_MARKER);
}
