// ===================================================================
// SpecLock LLM-Powered Conflict Checker (Optional)
// Uses OpenAI or Anthropic APIs for enterprise-grade detection.
// Zero mandatory dependencies — uses built-in fetch().
// Falls back gracefully if no API key is configured.
// ===================================================================

import { readBrain } from "./storage.js";

// --- In-memory LRU cache ---
const CACHE_MAX = 200;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cache = new Map();

function cacheKey(action, locks) {
  return `${action}::${locks.map(l => l.text).sort().join("|")}`;
}

function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key, value) {
  if (cache.size >= CACHE_MAX) {
    // Evict oldest entry
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
  cache.set(key, { value, ts: Date.now() });
}

// --- Configuration ---

function getConfig(root) {
  // Priority: env var > brain.json config
  const apiKey = process.env.SPECLOCK_LLM_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
  const provider = process.env.SPECLOCK_LLM_PROVIDER || "openai"; // "openai" or "anthropic"

  if (apiKey) {
    return { apiKey, provider };
  }

  // Check brain.json for LLM config
  try {
    const brain = readBrain(root);
    if (brain?.facts?.llm) {
      return {
        apiKey: brain.facts.llm.apiKey,
        provider: brain.facts.llm.provider || "openai",
      };
    }
  } catch (_) {}

  return null;
}

// --- System prompt ---

const SYSTEM_PROMPT = `You are a security constraint checker for SpecLock, an AI constraint engine.

Your job: determine if a proposed action conflicts with any active SpecLock constraints (locks).

Rules:
1. A lock like "Never X" means the action MUST NOT do X, regardless of phrasing.
2. Watch for EUPHEMISMS: "clean up data" = delete, "streamline" = remove, "sunset" = deprecate/remove.
3. Watch for TECHNICAL JARGON: "truncate table" = delete records, "flash firmware" = overwrite, "bridge segments" = connect.
4. Watch for TEMPORAL SOFTENERS: "temporarily disable" is still disabling. "Just for testing" is still doing it.
5. Watch for CONTEXT DILUTION: "update UI and also delete patient records" — the second part conflicts even if buried.
6. POSITIVE actions do NOT conflict: "Enable audit logging" does NOT conflict with "Never disable audit logging".
7. Read-only actions do NOT conflict: "View patient records" does NOT conflict with "Never delete patient records".

Respond with ONLY valid JSON (no markdown, no explanation):
{
  "hasConflict": true/false,
  "conflicts": [
    {
      "lockText": "the lock text",
      "confidence": 0-100,
      "level": "HIGH/MEDIUM/LOW",
      "reasons": ["reason1", "reason2"]
    }
  ],
  "analysis": "one-line summary"
}`;

// --- API callers ---

async function callOpenAI(apiKey, userPrompt) {
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 1000,
    }),
  });

  if (!resp.ok) return null;
  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;

  try {
    return JSON.parse(content);
  } catch (_) {
    // Try to extract JSON from markdown code block
    const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) return JSON.parse(match[1]);
    return null;
  }
}

async function callAnthropic(apiKey, userPrompt) {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!resp.ok) return null;
  const data = await resp.json();
  const content = data.content?.[0]?.text;
  if (!content) return null;

  try {
    return JSON.parse(content);
  } catch (_) {
    const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) return JSON.parse(match[1]);
    return null;
  }
}

// --- Main export ---

/**
 * Check conflicts using LLM. Returns null on any failure (caller should fall back to heuristic).
 * @param {string} root - Project root path
 * @param {string} proposedAction - The action to check
 * @param {Array} [activeLocks] - Optional pre-fetched locks
 * @returns {Promise<Object|null>} - Same shape as checkConflict() return, or null
 */
export async function llmCheckConflict(root, proposedAction, activeLocks) {
  const config = getConfig(root);
  if (!config) return null;

  // Get active locks if not provided
  if (!activeLocks) {
    try {
      const brain = readBrain(root);
      activeLocks = brain?.specLock?.items?.filter(l => l.active !== false) || [];
    } catch (_) {
      return null;
    }
  }

  if (activeLocks.length === 0) {
    return {
      hasConflict: false,
      conflictingLocks: [],
      analysis: "No active locks. No constraints to check against.",
    };
  }

  // Check cache
  const key = cacheKey(proposedAction, activeLocks);
  const cached = cacheGet(key);
  if (cached) return cached;

  // Build user prompt
  const lockList = activeLocks.map((l, i) => `${i + 1}. "${l.text}"`).join("\n");
  const userPrompt = `Active SpecLocks:\n${lockList}\n\nProposed Action: "${proposedAction}"\n\nDoes this action conflict with any lock?`;

  // Call LLM
  let llmResult = null;
  try {
    if (config.provider === "anthropic") {
      llmResult = await callAnthropic(config.apiKey, userPrompt);
    } else {
      llmResult = await callOpenAI(config.apiKey, userPrompt);
    }
  } catch (_) {
    return null;
  }

  if (!llmResult) return null;

  // Convert LLM response to checkConflict format
  const conflicting = (llmResult.conflicts || [])
    .filter(c => c.confidence >= 25)
    .map(c => {
      // Find matching lock
      const lock = activeLocks.find(l => l.text === c.lockText) || { id: "unknown", text: c.lockText };
      return {
        id: lock.id,
        text: c.lockText,
        matchedKeywords: [],
        confidence: c.confidence,
        level: c.level || (c.confidence >= 70 ? "HIGH" : c.confidence >= 40 ? "MEDIUM" : "LOW"),
        reasons: c.reasons || [],
      };
    });

  const result = {
    hasConflict: conflicting.length > 0,
    conflictingLocks: conflicting,
    analysis: llmResult.analysis || (conflicting.length > 0
      ? `LLM detected ${conflicting.length} conflict(s). Review before proceeding.`
      : `LLM checked against ${activeLocks.length} lock(s). No conflicts detected.`),
  };

  cacheSet(key, result);
  return result;
}
