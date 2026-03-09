// ===================================================================
// SpecLock LLM Provider — Shared LLM Calling Utilities
// Supports Gemini, OpenAI, and Anthropic APIs.
// Zero mandatory dependencies — uses built-in fetch().
// Falls back gracefully if no API key is configured.
//
// Developed by Sandeep Roy (https://github.com/sgroy10)
// ===================================================================

import { readBrain } from "./storage.js";

// --- Configuration ---

/**
 * Get LLM configuration (API key + provider).
 * Priority: explicit SPECLOCK key > provider-specific env vars > brain.json
 * @param {string} root - Project root path
 * @returns {{ apiKey: string, provider: string } | null}
 */
export function getConfig(root) {
  const apiKey =
    process.env.SPECLOCK_LLM_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.ANTHROPIC_API_KEY;

  const provider =
    process.env.SPECLOCK_LLM_PROVIDER ||
    (process.env.SPECLOCK_LLM_KEY ? "gemini" : null) ||
    (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY ? "gemini" : null) ||
    (process.env.OPENAI_API_KEY ? "openai" : null) ||
    (process.env.ANTHROPIC_API_KEY ? "anthropic" : null) ||
    "gemini";

  if (apiKey) {
    return { apiKey, provider };
  }

  // Check brain.json for LLM config
  try {
    const brain = readBrain(root);
    if (brain?.facts?.llm) {
      return {
        apiKey: brain.facts.llm.apiKey,
        provider: brain.facts.llm.provider || "gemini",
      };
    }
  } catch (_) {}

  return null;
}

// --- API callers ---

/**
 * Call OpenAI API.
 * @param {string} apiKey
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {{ timeout?: number, maxTokens?: number }} options
 * @returns {Promise<Object|null>}
 */
export async function callOpenAI(apiKey, systemPrompt, userPrompt, options = {}) {
  const { timeout = 5000, maxTokens = 1000 } = options;
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: maxTokens,
    }),
    signal: AbortSignal.timeout(timeout),
  });

  if (!resp.ok) return null;
  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content;
  return parseJsonResponse(content);
}

/**
 * Call Anthropic API.
 * @param {string} apiKey
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {{ timeout?: number, maxTokens?: number }} options
 * @returns {Promise<Object|null>}
 */
export async function callAnthropic(apiKey, systemPrompt, userPrompt, options = {}) {
  const { timeout = 5000, maxTokens = 1000 } = options;
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [
        { role: "user", content: userPrompt },
      ],
    }),
    signal: AbortSignal.timeout(timeout),
  });

  if (!resp.ok) return null;
  const data = await resp.json();
  const content = data.content?.[0]?.text;
  return parseJsonResponse(content);
}

/**
 * Call Gemini API.
 * @param {string} apiKey
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {{ timeout?: number, maxTokens?: number }} options
 * @returns {Promise<Object|null>}
 */
export async function callGemini(apiKey, systemPrompt, userPrompt, options = {}) {
  const { timeout = 3000, maxTokens = 1000 } = options;
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: systemPrompt + "\n\n" + userPrompt },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: maxTokens,
        },
      }),
      signal: AbortSignal.timeout(timeout),
    }
  );

  if (!resp.ok) return null;
  const data = await resp.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return parseJsonResponse(content);
}

/**
 * Call the configured LLM provider.
 * @param {string} root - Project root (for config lookup)
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {{ timeout?: number, maxTokens?: number }} options
 * @returns {Promise<Object|null>}
 */
export async function callLLM(root, systemPrompt, userPrompt, options = {}) {
  const config = getConfig(root);
  if (!config) return null;

  try {
    if (config.provider === "gemini") {
      return await callGemini(config.apiKey, systemPrompt, userPrompt, options);
    } else if (config.provider === "anthropic") {
      return await callAnthropic(config.apiKey, systemPrompt, userPrompt, options);
    } else {
      return await callOpenAI(config.apiKey, systemPrompt, userPrompt, options);
    }
  } catch (_) {
    return null;
  }
}

// --- JSON response parser ---

/**
 * Parse a JSON response from an LLM, handling markdown code blocks.
 * @param {string} content - Raw LLM response text
 * @returns {Object|null}
 */
export function parseJsonResponse(content) {
  if (!content) return null;
  try {
    return JSON.parse(content);
  } catch (_) {
    // Try to extract JSON from markdown code block
    const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch (_) {}
    }
    return null;
  }
}
