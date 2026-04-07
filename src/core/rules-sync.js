/**
 * SpecLock Rules Sync — Universal AI Rules File Generator
 * Syncs SpecLock constraints to .cursorrules, CLAUDE.md, AGENTS.md,
 * .windsurfrules, copilot-instructions.md, GEMINI.md, and more.
 *
 * One source of truth → every AI tool gets the same constraints.
 *
 * Developed by Sandeep Roy (https://github.com/sgroy10)
 */

import fs from "fs";
import path from "path";
import { readBrain } from "./storage.js";
import { ensureInit } from "./memory.js";

// --- Format definitions ---

const FORMATS = {
  cursor: {
    name: "Cursor",
    file: ".cursor/rules/speclock.mdc",
    description: "Cursor AI rules (MDC format)",
    generate: generateCursorRules,
  },
  claude: {
    name: "Claude Code",
    file: "CLAUDE.md",
    description: "Claude Code project instructions",
    generate: generateClaudeMd,
  },
  agents: {
    name: "AGENTS.md",
    file: "AGENTS.md",
    description: "Cross-tool agent instructions (Linux Foundation standard)",
    generate: generateAgentsMd,
  },
  windsurf: {
    name: "Windsurf",
    file: ".windsurf/rules/speclock.md",
    description: "Windsurf AI rules",
    generate: generateWindsurfRules,
  },
  copilot: {
    name: "GitHub Copilot",
    file: ".github/copilot-instructions.md",
    description: "GitHub Copilot custom instructions",
    generate: generateCopilotInstructions,
  },
  gemini: {
    name: "Gemini",
    file: "GEMINI.md",
    description: "Google Gemini CLI instructions",
    generate: generateGeminiMd,
  },
  codex: {
    name: "Codex",
    file: "AGENTS.md",
    description: "OpenAI Codex agent instructions (uses AGENTS.md)",
    generate: generateAgentsMd,
  },
  aider: {
    name: "Aider",
    file: ".aider.conf.yml",
    description: "Aider conventions file",
    generate: generateAiderConf,
  },
};

// --- Helpers ---

function getActiveLocks(brain) {
  return (brain.specLock?.items || []).filter((l) => l.active !== false);
}

function getActiveDecisions(brain) {
  return brain.decisions || [];
}

function getGoal(brain) {
  return brain.goal?.text || "";
}

function timestamp() {
  return new Date().toISOString().substring(0, 19).replace("T", " ");
}

function header(format) {
  return `# SpecLock Constraints — Auto-synced for ${format}\n# Generated: ${timestamp()}\n# Source: .speclock/brain.json\n# Do not edit manually — run \`speclock sync\` to regenerate\n# https://github.com/sgroy10/speclock\n`;
}

// --- Format generators ---

function generateCursorRules(brain) {
  const locks = getActiveLocks(brain);
  const decisions = getActiveDecisions(brain);
  const goal = getGoal(brain);

  const lines = [];

  // MDC frontmatter
  lines.push("---");
  lines.push("description: SpecLock project constraints — enforced automatically");
  lines.push("globs: **/*");
  lines.push("alwaysApply: true");
  lines.push("---");
  lines.push("");
  lines.push("# SpecLock Constraints");
  lines.push("");
  lines.push(`> Auto-synced from SpecLock. Run \`speclock sync --format cursor\` to update.`);
  lines.push("");

  if (goal) {
    lines.push("## Project Goal");
    lines.push(goal);
    lines.push("");
  }

  if (locks.length > 0) {
    lines.push("## Non-Negotiable Constraints");
    lines.push("");
    lines.push("**These constraints MUST be followed. Violating any of them is an error.**");
    lines.push("");
    for (const lock of locks) {
      lines.push(`- **[LOCKED]** ${lock.text}`);
    }
    lines.push("");
  }

  if (decisions.length > 0) {
    lines.push("## Architectural Decisions");
    lines.push("");
    for (const dec of decisions.slice(0, 10)) {
      lines.push(`- ${dec.text}`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("*Powered by [SpecLock](https://github.com/sgroy10/speclock) — AI Constraint Engine by Sandeep Roy*");
  lines.push("");

  return lines.join("\n");
}

function generateClaudeMd(brain) {
  const locks = getActiveLocks(brain);
  const decisions = getActiveDecisions(brain);
  const goal = getGoal(brain);

  const lines = [];
  lines.push(header("Claude Code"));
  lines.push("");
  lines.push("# Project Constraints (SpecLock)");
  lines.push("");

  if (goal) {
    lines.push("## Goal");
    lines.push(goal);
    lines.push("");
  }

  if (locks.length > 0) {
    lines.push("## IMPORTANT: Non-Negotiable Rules");
    lines.push("");
    lines.push("The following constraints are enforced by SpecLock. Do NOT violate any of them.");
    lines.push("If a task conflicts with these constraints, STOP and inform the user.");
    lines.push("");
    for (let i = 0; i < locks.length; i++) {
      lines.push(`${i + 1}. **${lock_text(locks[i])}**`);
    }
    lines.push("");
  }

  if (decisions.length > 0) {
    lines.push("## Architectural Decisions");
    lines.push("");
    for (const dec of decisions.slice(0, 10)) {
      lines.push(`- ${dec.text}`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("*Auto-synced by [SpecLock](https://github.com/sgroy10/speclock). Run `speclock sync` to update.*");
  lines.push("");

  return lines.join("\n");
}

function lock_text(lock) {
  return lock.originalText || lock.text;
}

function generateAgentsMd(brain) {
  const locks = getActiveLocks(brain);
  const decisions = getActiveDecisions(brain);
  const goal = getGoal(brain);

  const lines = [];
  lines.push("# AGENTS.md");
  lines.push("");
  lines.push(`> Auto-synced from SpecLock. Run \`speclock sync --format agents\` to update.`);
  lines.push("");

  if (goal) {
    lines.push("## Project Goal");
    lines.push("");
    lines.push(goal);
    lines.push("");
  }

  if (locks.length > 0) {
    lines.push("## Constraints");
    lines.push("");
    lines.push("The following rules are non-negotiable. Any AI agent working on this codebase MUST respect them:");
    lines.push("");
    for (const lock of locks) {
      lines.push(`- **NEVER VIOLATE:** ${lock_text(lock)}`);
    }
    lines.push("");
  }

  if (decisions.length > 0) {
    lines.push("## Decisions");
    lines.push("");
    for (const dec of decisions.slice(0, 10)) {
      lines.push(`- ${dec.text}`);
    }
    lines.push("");
  }

  lines.push("## Working with this project");
  lines.push("");
  lines.push("- Before making changes, check if they conflict with the constraints above");
  lines.push("- If a requested change violates a constraint, inform the user and suggest alternatives");
  lines.push("- Run `speclock check \"<your planned action>\"` to verify before proceeding");
  lines.push("");
  lines.push("---");
  lines.push("*Powered by [SpecLock](https://github.com/sgroy10/speclock) — AI Constraint Engine by Sandeep Roy*");
  lines.push("");

  return lines.join("\n");
}

function generateWindsurfRules(brain) {
  const locks = getActiveLocks(brain);
  const decisions = getActiveDecisions(brain);
  const goal = getGoal(brain);

  const lines = [];
  lines.push("# SpecLock Constraints for Windsurf");
  lines.push("");
  lines.push(`> Auto-synced. Run \`speclock sync --format windsurf\` to update.`);
  lines.push("");

  if (goal) {
    lines.push(`## Project Goal: ${goal}`);
    lines.push("");
  }

  if (locks.length > 0) {
    lines.push("## Rules (Non-Negotiable)");
    lines.push("");
    for (const lock of locks) {
      lines.push(`- MUST: ${lock_text(lock)}`);
    }
    lines.push("");
  }

  if (decisions.length > 0) {
    lines.push("## Architectural Decisions");
    lines.push("");
    for (const dec of decisions.slice(0, 10)) {
      lines.push(`- ${dec.text}`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("*Powered by [SpecLock](https://github.com/sgroy10/speclock)*");
  lines.push("");

  return lines.join("\n");
}

function generateCopilotInstructions(brain) {
  const locks = getActiveLocks(brain);
  const decisions = getActiveDecisions(brain);
  const goal = getGoal(brain);

  const lines = [];
  lines.push("# GitHub Copilot Instructions (SpecLock)");
  lines.push("");
  lines.push(`> Auto-synced. Run \`speclock sync --format copilot\` to update.`);
  lines.push("");

  if (goal) {
    lines.push(`## Project: ${goal}`);
    lines.push("");
  }

  if (locks.length > 0) {
    lines.push("## Constraints");
    lines.push("");
    lines.push("When generating or modifying code, respect these constraints:");
    lines.push("");
    for (const lock of locks) {
      lines.push(`- **DO NOT** violate: ${lock_text(lock)}`);
    }
    lines.push("");
  }

  if (decisions.length > 0) {
    lines.push("## Project Decisions");
    lines.push("");
    for (const dec of decisions.slice(0, 10)) {
      lines.push(`- ${dec.text}`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("*Auto-synced by [SpecLock](https://github.com/sgroy10/speclock)*");
  lines.push("");

  return lines.join("\n");
}

function generateGeminiMd(brain) {
  const locks = getActiveLocks(brain);
  const decisions = getActiveDecisions(brain);
  const goal = getGoal(brain);

  const lines = [];
  lines.push("# GEMINI.md — Project Constraints (SpecLock)");
  lines.push("");
  lines.push(`> Auto-synced. Run \`speclock sync --format gemini\` to update.`);
  lines.push("");

  if (goal) {
    lines.push("## Goal");
    lines.push(goal);
    lines.push("");
  }

  if (locks.length > 0) {
    lines.push("## Non-Negotiable Constraints");
    lines.push("");
    lines.push("These rules must NEVER be violated:");
    lines.push("");
    for (const lock of locks) {
      lines.push(`- ${lock_text(lock)}`);
    }
    lines.push("");
  }

  if (decisions.length > 0) {
    lines.push("## Decisions");
    lines.push("");
    for (const dec of decisions.slice(0, 10)) {
      lines.push(`- ${dec.text}`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("*Powered by [SpecLock](https://github.com/sgroy10/speclock) — AI Constraint Engine by Sandeep Roy*");
  lines.push("");

  return lines.join("\n");
}

function generateAiderConf(brain) {
  const locks = getActiveLocks(brain);
  const goal = getGoal(brain);

  const lines = [];
  lines.push("# Aider configuration — SpecLock constraints");
  lines.push(`# Auto-synced. Run \`speclock sync --format aider\` to update.`);
  lines.push("");

  const conventionLines = [];
  if (goal) {
    conventionLines.push(`Project goal: ${goal}`);
    conventionLines.push("");
  }
  if (locks.length > 0) {
    conventionLines.push("NON-NEGOTIABLE CONSTRAINTS:");
    for (const lock of locks) {
      conventionLines.push(`- ${lock_text(lock)}`);
    }
  }

  if (conventionLines.length > 0) {
    lines.push("conventions: |");
    for (const cl of conventionLines) {
      lines.push(`  ${cl}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// --- Main sync function ---

/**
 * Sync SpecLock constraints to one or all AI tool rule formats.
 *
 * @param {string} root - Project root directory
 * @param {Object} options
 * @param {string} [options.format] - Specific format to sync (cursor, claude, agents, windsurf, copilot, gemini, aider). If omitted, syncs all.
 * @param {boolean} [options.dryRun] - If true, returns content without writing files
 * @param {boolean} [options.append] - If true, appends to existing file instead of overwriting (for claude format)
 * @returns {{ synced: Array<{format: string, file: string, size: number}>, errors: string[] }}
 */
export function syncRules(root, options = {}) {
  const brain = ensureInit(root);
  const activeLocks = getActiveLocks(brain);

  if (activeLocks.length === 0) {
    return {
      synced: [],
      errors: ["No active locks found. Add constraints first: speclock lock \"Your constraint\""],
      lockCount: 0,
    };
  }

  const formats = options.format
    ? { [options.format]: FORMATS[options.format] }
    : { ...FORMATS };

  // Remove codex duplicate (uses same file as agents)
  if (!options.format) {
    delete formats.codex;
  }

  if (options.format && !FORMATS[options.format]) {
    return {
      synced: [],
      errors: [`Unknown format: "${options.format}". Available: ${Object.keys(FORMATS).join(", ")}`],
      lockCount: activeLocks.length,
    };
  }

  const synced = [];
  const errors = [];

  for (const [key, fmt] of Object.entries(formats)) {
    try {
      const content = fmt.generate(brain);
      const filePath = path.join(root, fmt.file);

      if (options.dryRun) {
        synced.push({
          format: key,
          name: fmt.name,
          file: fmt.file,
          size: content.length,
          content,
        });
        continue;
      }

      // Handle append mode for CLAUDE.md
      if (options.append && key === "claude" && fs.existsSync(filePath)) {
        const existing = fs.readFileSync(filePath, "utf8");
        // Remove old SpecLock section if present
        const cleaned = removeSpecLockSection(existing);
        const merged = cleaned.trimEnd() + "\n\n" + content;
        fs.writeFileSync(filePath, merged);
      } else {
        // Ensure directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, content);
      }

      synced.push({
        format: key,
        name: fmt.name,
        file: fmt.file,
        size: content.length,
      });
    } catch (err) {
      errors.push(`${key}: ${err.message}`);
    }
  }

  return {
    synced,
    errors,
    lockCount: activeLocks.length,
    decisionCount: getActiveDecisions(brain).length,
  };
}

/**
 * Remove existing SpecLock section from a file's content.
 * Looks for the auto-sync header comment and removes everything until the next --- or EOF.
 */
function removeSpecLockSection(content) {
  // Remove from "# SpecLock Constraints" or "# Project Constraints (SpecLock)" to end of SpecLock block
  const markers = [
    /# SpecLock Constraints.*$/m,
    /# Project Constraints \(SpecLock\).*$/m,
    /^# SpecLock Constraints — Auto-synced.*$/m,
  ];

  for (const marker of markers) {
    const match = content.match(marker);
    if (match) {
      const startIdx = content.indexOf(match[0]);
      // Find the end marker: "Auto-synced by [SpecLock]" line
      const endMarker = "*Auto-synced by [SpecLock]";
      const endIdx = content.indexOf(endMarker, startIdx);
      if (endIdx !== -1) {
        // Remove until end of that line + trailing newlines
        const lineEnd = content.indexOf("\n", endIdx + endMarker.length);
        const removeEnd = lineEnd !== -1 ? lineEnd + 1 : content.length;
        content = content.substring(0, startIdx) + content.substring(removeEnd);
      }
    }
  }

  return content;
}

/**
 * Get list of available sync formats.
 */
export function getSyncFormats() {
  return Object.entries(FORMATS).map(([key, fmt]) => ({
    key,
    name: fmt.name,
    file: fmt.file,
    description: fmt.description,
  }));
}

/**
 * Preview what would be generated for a specific format without writing.
 */
export function previewSync(root, format) {
  return syncRules(root, { format, dryRun: true });
}
