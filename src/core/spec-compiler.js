// ===================================================================
// SpecLock Spec Compiler — Natural Language → Structured Constraints
// Turns messy human inputs (PRDs, READMEs, chat logs, architecture
// docs) into normalized, machine-enforceable SpecLock constraints.
// Uses Gemini Flash by default (cheapest, free tier available).
//
// Developed by Sandeep Roy (https://github.com/sgroy10)
// ===================================================================

import fs from "fs";
import path from "path";
import { getConfig, callLLM, parseJsonResponse } from "./llm-provider.js";
import { readBrain } from "./storage.js";
import { addLock, addTypedLock, addDecision, addNote, ensureInit } from "./memory.js";
import { validateTypedLock } from "./typed-constraints.js";

// --- System prompt for spec compilation ---

const COMPILER_SYSTEM_PROMPT = `You are the SpecLock Spec Compiler — an expert at extracting structured constraints from natural language documents.

Your job: Read the input text (which could be a PRD, README, architecture doc, chat conversation, or informal instructions) and extract ALL enforceable constraints, decisions, and context notes.

## Extraction Rules

### Text Locks (constraints/prohibitions/requirements)
Extract as "locks" — these are rules that must NEVER be violated:
- Prohibitions: "don't touch X", "never change Y", "leave Z alone", "X is off-limits"
- Requirements: "must always use X", "never deploy without Y", "always run Z before deploying"
- Protections: "database is X, don't change it", "the API is done, don't mess with it"

### Typed Locks (measurable/quantifiable constraints)
Extract as "typedLocks" when constraints have specific numbers:
- numerical: "response time must be under 200ms" → { constraintType: "numerical", metric: "response_time_ms", operator: "<=", value: 200, unit: "ms" }
- range: "keep temperature between 20-25C" → { constraintType: "range", metric: "temperature_celsius", min: 20, max: 25, unit: "C" }
- state: "never go from production to debug mode" → { constraintType: "state", metric: "system_mode", entity: "system", forbidden: [{ from: "production", to: "debug" }] }
- temporal: "heartbeat must occur every 30 seconds" → { constraintType: "temporal", metric: "heartbeat_interval_s", operator: "<=", value: 30, unit: "s" }

### Decisions (architecture/technology choices)
Extract as "decisions" — these are choices that have been made:
- Technology: "use React", "backend is FastAPI", "deploy on Vercel"
- Architecture: "microservices architecture", "REST API, not GraphQL"
- Process: "always review PRs before merge", "use trunk-based development"

### Notes (context/reference information)
Extract as "notes" — useful context that doesn't fit above:
- Background info: "the old system used PHP", "migration from MongoDB to Postgres"
- References: "API docs at example.com/docs", "design spec in Figma"
- Context: "this was built for a hackathon", "client is in healthcare"

## Output Format
Respond with ONLY valid JSON (no markdown, no explanation):
{
  "locks": [
    { "text": "Never modify auth files", "tags": ["security"] }
  ],
  "typedLocks": [
    {
      "constraintType": "numerical",
      "metric": "response_time_ms",
      "operator": "<=",
      "value": 200,
      "unit": "ms",
      "description": "API response time must stay under 200ms"
    }
  ],
  "decisions": [
    { "text": "Use React for frontend", "tags": ["architecture"] }
  ],
  "notes": [
    { "text": "Payment integration uses Stripe API v3" }
  ],
  "summary": "Brief summary of what was extracted"
}

## Important Rules
1. Be thorough — extract EVERYTHING, even if implicit
2. Deduplicate — don't create two locks that say the same thing
3. Be specific — "Never modify auth" is better than "Don't change things"
4. Use appropriate tags — security, architecture, database, api, performance, deployment, testing, etc.
5. If the text mentions a metric with a number, ALWAYS make it a typedLock, not a text lock
6. If there's nothing to extract, return empty arrays — don't hallucinate constraints
7. Keep lock text concise but clear — one constraint per lock`;

// --- Core functions ---

/**
 * Compile natural language text into structured SpecLock constraints.
 * @param {string} root - Project root path (for LLM config)
 * @param {string} inputText - Raw text to compile (PRD, README, chat, etc.)
 * @param {{ source?: string }} options
 * @returns {Promise<Object>} Compiled result with locks, typedLocks, decisions, notes
 */
export async function compileSpec(root, inputText, options = {}) {
  if (!inputText || typeof inputText !== "string" || inputText.trim().length === 0) {
    return {
      success: false,
      error: "Input text is empty or invalid",
      locks: [],
      typedLocks: [],
      decisions: [],
      notes: [],
    };
  }

  // Check for LLM configuration
  const config = getConfig(root);
  if (!config) {
    return {
      success: false,
      error: "Spec Compiler requires an LLM API key. Set GEMINI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY environment variable.",
      locks: [],
      typedLocks: [],
      decisions: [],
      notes: [],
    };
  }

  // Truncate very long inputs to avoid token limits
  const maxChars = 30000;
  const truncated = inputText.length > maxChars
    ? inputText.substring(0, maxChars) + "\n\n[... truncated ...]"
    : inputText;

  const userPrompt = `Extract all constraints, decisions, and notes from this document:\n\n---\n${truncated}\n---`;

  // Call LLM with longer timeout for compilation
  const llmResult = await callLLM(root, COMPILER_SYSTEM_PROMPT, userPrompt, {
    timeout: 10000,
    maxTokens: 2000,
  });

  if (!llmResult) {
    return {
      success: false,
      error: "LLM call failed. Check your API key and network connection.",
      locks: [],
      typedLocks: [],
      decisions: [],
      notes: [],
    };
  }

  // Validate and normalize the result
  const result = normalizeCompilerOutput(llmResult);
  result.success = true;
  result.inputLength = inputText.length;
  result.source = options.source || "spec-compiler";

  return result;
}

/**
 * Compile a file into structured constraints.
 * @param {string} root - Project root path
 * @param {string} filePath - Path to file (.md, .txt, .yaml, .json, etc.)
 * @param {{ source?: string }} options
 * @returns {Promise<Object>}
 */
export async function compileFile(root, filePath, options = {}) {
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(root, filePath);

  if (!fs.existsSync(fullPath)) {
    return {
      success: false,
      error: `File not found: ${filePath}`,
      locks: [],
      typedLocks: [],
      decisions: [],
      notes: [],
    };
  }

  const content = fs.readFileSync(fullPath, "utf-8");
  if (!content.trim()) {
    return {
      success: false,
      error: `File is empty: ${filePath}`,
      locks: [],
      typedLocks: [],
      decisions: [],
      notes: [],
    };
  }

  const result = await compileSpec(root, content, {
    source: options.source || `file:${path.basename(filePath)}`,
  });
  result.filePath = filePath;
  return result;
}

/**
 * Compile text and auto-apply results to brain.json.
 * @param {string} root - Project root path
 * @param {string} inputText - Raw text to compile
 * @param {{ source?: string }} options
 * @returns {Promise<Object>} Result with applied counts
 */
export async function compileAndApply(root, inputText, options = {}) {
  const compiled = await compileSpec(root, inputText, options);

  if (!compiled.success) {
    return compiled;
  }

  ensureInit(root);
  const source = compiled.source || "spec-compiler";
  const applied = { locks: 0, typedLocks: 0, decisions: 0, notes: 0 };

  // Apply text locks
  for (const lock of compiled.locks) {
    addLock(root, lock.text, lock.tags || [], source);
    applied.locks++;
  }

  // Apply typed locks
  for (const tl of compiled.typedLocks) {
    const constraint = { ...tl };
    const description = constraint.description;
    delete constraint.description;
    const result = addTypedLock(root, constraint, tl.tags || [], source, description);
    if (result.lockId) {
      applied.typedLocks++;
    }
  }

  // Apply decisions
  for (const dec of compiled.decisions) {
    addDecision(root, dec.text, dec.tags || [], source);
    applied.decisions++;
  }

  // Apply notes
  for (const note of compiled.notes) {
    addNote(root, note.text, true);
    applied.notes++;
  }

  compiled.applied = applied;
  compiled.totalApplied = applied.locks + applied.typedLocks + applied.decisions + applied.notes;
  return compiled;
}

// --- Internal helpers ---

/**
 * Normalize and validate LLM compiler output.
 */
function normalizeCompilerOutput(raw) {
  const result = {
    locks: [],
    typedLocks: [],
    decisions: [],
    notes: [],
    summary: raw.summary || "",
  };

  // Normalize locks
  if (Array.isArray(raw.locks)) {
    for (const lock of raw.locks) {
      if (lock && typeof lock.text === "string" && lock.text.trim()) {
        result.locks.push({
          text: lock.text.trim(),
          tags: Array.isArray(lock.tags) ? lock.tags : [],
        });
      }
    }
  }

  // Normalize typed locks — validate each one
  if (Array.isArray(raw.typedLocks)) {
    for (const tl of raw.typedLocks) {
      if (!tl || !tl.constraintType) continue;
      const validation = validateTypedLock(tl);
      if (validation.valid) {
        result.typedLocks.push({
          constraintType: tl.constraintType,
          ...(tl.metric && { metric: tl.metric }),
          ...(tl.operator && { operator: tl.operator }),
          ...(tl.value !== undefined && { value: tl.value }),
          ...(tl.min !== undefined && { min: tl.min }),
          ...(tl.max !== undefined && { max: tl.max }),
          ...(tl.unit && { unit: tl.unit }),
          ...(tl.entity && { entity: tl.entity }),
          ...(tl.forbidden && { forbidden: tl.forbidden }),
          ...(tl.description && { description: tl.description }),
          tags: Array.isArray(tl.tags) ? tl.tags : [],
        });
      }
    }
  }

  // Normalize decisions
  if (Array.isArray(raw.decisions)) {
    for (const dec of raw.decisions) {
      if (dec && typeof dec.text === "string" && dec.text.trim()) {
        result.decisions.push({
          text: dec.text.trim(),
          tags: Array.isArray(dec.tags) ? dec.tags : [],
        });
      }
    }
  }

  // Normalize notes
  if (Array.isArray(raw.notes)) {
    for (const note of raw.notes) {
      if (note && typeof note.text === "string" && note.text.trim()) {
        result.notes.push({ text: note.text.trim() });
      }
    }
  }

  return result;
}
