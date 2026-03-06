// ===================================================================
// SpecLock Smart Lock Authoring Engine
// Auto-rewrites user locks to prevent verb contamination.
//
// Problem: "Never add authentication" causes false positives because
// the word "add" gets extracted as a prohibited signal and fires on
// every action containing "add" (like "Add dark mode").
//
// Solution: Extract the SUBJECT from the lock, rewrite to state
// what IS fixed/prohibited rather than what ACTION is prohibited.
// "Never add authentication" → "Authentication and login are prohibited"
//
// Developed by Sandeep Roy (https://github.com/sgroy10)
// ===================================================================

// Common action verbs that contaminate lock matching when present in lock text.
// These are the verbs that users naturally write in locks ("never ADD X",
// "don't CHANGE Y") but that the semantic engine then matches against
// ALL actions containing those same verbs.
const CONTAMINATING_VERBS = new Set([
  // Constructive
  "add", "create", "introduce", "insert", "implement", "build", "make",
  "include", "put", "set", "use", "install", "deploy", "attach", "connect",
  // Destructive
  "remove", "delete", "drop", "destroy", "kill", "purge", "wipe", "erase",
  "eliminate", "clear", "empty", "nuke",
  // Modification
  "change", "modify", "alter", "update", "mutate", "transform", "rewrite",
  "edit", "adjust", "tweak", "revise", "amend", "touch", "rework",
  // Movement
  "move", "migrate", "transfer", "shift", "relocate", "switch", "swap",
  "replace", "substitute", "exchange",
  // Toggle
  "enable", "disable", "activate", "deactivate", "start", "stop",
  "turn", "pause", "suspend", "halt",
  // General
  "push", "pull", "send", "expose", "leak", "reveal", "show",
  "allow", "permit", "let", "give", "grant", "open",
  // Informal
  "mess",
]);

// Prohibition patterns — these phrases introduce the verb that follows
const PROHIBITION_PATTERNS = [
  /^never\s+/i,
  /^must\s+not\s+/i,
  /^do\s+not\s+/i,
  /^don'?t\s+/i,
  /^cannot\s+/i,
  /^can'?t\s+/i,
  /^should\s+not\s+/i,
  /^shouldn'?t\s+/i,
  /^no\s+(?:one\s+(?:should|may|can)\s+)?/i,
  /^(?:it\s+is\s+)?(?:forbidden|prohibited|not\s+allowed)\s+to\s+/i,
  /^avoid\s+/i,
  /^prevent\s+/i,
  /^refrain\s+from\s+/i,
  /^stop\s+/i,
];

// Filler words between verb and subject
const FILLER_WORDS = new Set([
  "the", "a", "an", "any", "another", "other", "new", "additional",
  "more", "extra", "further", "existing", "current", "old", "all",
  "our", "their", "user", "users", "to",
]);

// Domain subject → canonical prohibition phrasing
const SUBJECT_TEMPLATES = {
  // Auth/Security
  "authentication": "{subject} and login functionality are prohibited",
  "auth": "Authentication and login functionality are prohibited",
  "login": "Login and authentication functionality are prohibited",
  "signup": "Sign-up and registration functionality are prohibited",
  "user accounts": "User account creation and management are prohibited",
  "2fa": "Two-factor authentication changes are prohibited",
  "mfa": "Multi-factor authentication changes are prohibited",

  // Database
  "database": "External database services are prohibited — use {alternative} only",
  "supabase": "Supabase integration is prohibited",
  "firebase": "Firebase integration is prohibited",
  "mongodb": "MongoDB integration is prohibited",

  // Payment
  "payment": "Additional payment providers are prohibited — use {alternative} exclusively",
  "stripe": "Stripe modifications are prohibited",
  "razorpay": "Razorpay integration is prohibited",
  "paypal": "PayPal integration is prohibited",
};

/**
 * Extract the subject (noun phrase) from a lock text.
 * Given: "Never add user authentication or login functionality"
 * Returns: "user authentication or login functionality"
 */
export function extractLockSubject(lockText) {
  let remaining = lockText.trim();

  // Step 1: Strip prohibition prefix
  for (const pattern of PROHIBITION_PATTERNS) {
    const match = remaining.match(pattern);
    if (match) {
      remaining = remaining.slice(match[0].length).trim();
      break;
    }
  }

  // Step 2: Strip the first contaminating verb (and optional "to")
  const words = remaining.split(/\s+/);
  let verbIndex = -1;

  // Check first 3 words for a contaminating verb
  for (let i = 0; i < Math.min(3, words.length); i++) {
    const w = words[i].toLowerCase().replace(/[^a-z]/g, "");
    if (CONTAMINATING_VERBS.has(w)) {
      verbIndex = i;
      break;
    }
  }

  if (verbIndex >= 0) {
    let endIdx = verbIndex + 1;
    // Handle compound verbs: "touch or modify", "change and update"
    while (endIdx < words.length - 1) {
      const connector = words[endIdx].toLowerCase();
      if (connector === "or" || connector === "and") {
        const nextWord = (words[endIdx + 1] || "").toLowerCase().replace(/[^a-z]/g, "");
        if (CONTAMINATING_VERBS.has(nextWord)) {
          endIdx += 2; // skip connector + verb
        } else {
          break;
        }
      } else {
        break;
      }
    }
    remaining = words.slice(endIdx).join(" ").trim();
  }

  // Step 3: Strip leading filler words and prepositions like "from"
  const remainingWords = remaining.split(/\s+/);
  let startIdx = 0;
  const STRIP_LEADING = new Set([...FILLER_WORDS, "from", "on", "in", "at", "with"]);
  while (startIdx < remainingWords.length - 1) {
    if (STRIP_LEADING.has(remainingWords[startIdx].toLowerCase())) {
      startIdx++;
    } else {
      break;
    }
  }
  remaining = remainingWords.slice(startIdx).join(" ").trim();

  // Step 4: Truncate at em dash, semicolon, or qualifier phrases
  // "authentication system — NextAuth config must not be changed" → "authentication system"
  remaining = remaining.split(/\s*[—–]\s*/)[0].trim();
  remaining = remaining.split(/\s*;\s*/)[0].trim();
  // Truncate at comma + pronoun/qualifier clause
  // "KYC verification flow, it's SEC-compliant" → "KYC verification flow"
  // But preserve comma-separated lists: "auth, authorization, and login"
  remaining = remaining.replace(/,\s+(?:it'?s?|they|this|that|which|we|since|because|as)\b.*$/i, "").trim();
  // Truncate at "must not", "should not" etc. — they start a qualifier
  remaining = remaining.replace(/\s+(?:must|should|cannot|can't|will)\s+(?:not\s+)?(?:be\s+)?.*$/i, "").trim();
  // Truncate at "to/with any/another/other" — directional qualifier
  remaining = remaining.replace(/\s+(?:to|with)\s+(?:any|another|other|a\s+different)\s+.*$/i, "").trim();

  return remaining || lockText;
}

/**
 * Detect if a lock text contains verb contamination risk.
 * Returns: { hasRisk, verb, subject, suggestion }
 */
export function detectVerbContamination(lockText) {
  const lower = lockText.toLowerCase().trim();

  // Check if it starts with a prohibition pattern
  let matchedProhibition = false;
  let afterProhibition = lower;

  for (const pattern of PROHIBITION_PATTERNS) {
    const match = lower.match(pattern);
    if (match) {
      matchedProhibition = true;
      afterProhibition = lower.slice(match[0].length).trim();
      break;
    }
  }

  if (!matchedProhibition) {
    // No prohibition pattern — could be a declarative lock like
    // "Use Stripe exclusively" — these are already safe
    return { hasRisk: false, verb: null, subject: null, suggestion: null };
  }

  // Check if the next word(s) are a contaminating verb
  const words = afterProhibition.split(/\s+/);
  const firstWord = (words[0] || "").replace(/[^a-z]/g, "");

  if (!CONTAMINATING_VERBS.has(firstWord)) {
    // Prohibition but no contaminating verb — already safe
    // e.g., "Never expose PHI" — "expose" is domain-specific enough
    // Actually, let's still check — "expose" is in the set
    // But we only flag if it's a COMMON verb that will match broadly
    return { hasRisk: false, verb: null, subject: null, suggestion: null };
  }

  const verb = firstWord;
  const subject = extractLockSubject(lockText);

  return {
    hasRisk: true,
    verb,
    subject,
    suggestion: rewriteLock(lockText, verb, subject),
    original: lockText,
  };
}

/**
 * Rewrite a lock to eliminate verb contamination.
 * Transforms "Never add X" → "X is/are prohibited"
 * Preserves the semantic meaning but removes the contaminating verb.
 */
export function rewriteLock(lockText, verb, subject) {
  if (!subject || subject === lockText) return lockText;

  // Determine the appropriate rewrite based on verb category
  const isDestructive = ["remove", "delete", "drop", "destroy", "kill",
    "purge", "wipe", "erase", "eliminate", "clear", "empty", "nuke"].includes(verb);
  const isConstructive = ["add", "create", "introduce", "insert", "implement",
    "build", "make", "include", "install", "deploy", "attach", "connect",
    "put", "set", "use"].includes(verb);
  const isModification = ["change", "modify", "alter", "update", "mutate",
    "transform", "rewrite", "edit", "adjust", "tweak", "revise", "amend",
    "rework", "touch"].includes(verb);
  const isMovement = ["move", "migrate", "transfer", "shift", "relocate",
    "switch", "swap", "replace", "substitute", "exchange"].includes(verb);
  const isToggle = ["enable", "disable", "activate", "deactivate", "start",
    "stop", "turn", "pause", "suspend", "halt"].includes(verb);

  // Clean subject — capitalize first letter
  const cleanSubject = subject.charAt(0).toUpperCase() + subject.slice(1);

  if (isConstructive) {
    // "Never add X" → "X is prohibited — do not introduce it"
    return `${cleanSubject} — prohibited. Must not be introduced or added.`;
  }

  if (isDestructive) {
    // "Never delete X" → "X must be preserved — delete and remove operations are prohibited"
    // CRITICAL: include the original verb so euphemism matching can find it
    // ("phase out" → "remove" needs "remove" in the lock text)
    const destNote = verb === "remove"
      ? "remove and delete operations are prohibited"
      : `${verb} and remove operations are prohibited`;
    return `${cleanSubject} must be preserved — ${destNote}.`;
  }

  if (isModification) {
    // "Never modify X" → "X is frozen — modify and change operations are prohibited"
    const modNote = verb === "change"
      ? "change operations are prohibited"
      : `${verb} and change operations are prohibited`;
    return `${cleanSubject} is frozen — ${modNote}.`;
  }

  if (isMovement) {
    // "Never migrate X" → "X must remain unchanged — migrate and replace operations are prohibited"
    const moveNote = verb === "replace"
      ? "replace operations are prohibited"
      : `${verb} and replace operations are prohibited`;
    return `${cleanSubject} must remain unchanged — ${moveNote}.`;
  }

  if (isToggle) {
    if (verb === "disable" || verb === "deactivate" || verb === "stop" ||
        verb === "pause" || verb === "suspend" || verb === "halt" || verb === "turn") {
      // "Never disable X" → "X must remain active — disable is prohibited"
      return `${cleanSubject} must remain active and enabled — ${verb} is prohibited.`;
    } else {
      // "Never enable X" → "X must remain disabled"
      return `${cleanSubject} must remain disabled — do not activate.`;
    }
  }

  // Fallback: generic rewrite
  return `${cleanSubject} — no ${verb} operations allowed.`;
}

/**
 * Smart lock normalizer. Takes raw user lock text and returns
 * the best version for the semantic engine.
 *
 * Returns: {
 *   normalized: string,    // The rewritten lock (or original if safe)
 *   wasRewritten: boolean, // Whether the lock was rewritten
 *   original: string,      // The original lock text
 *   reason: string|null,   // Why it was rewritten (or null)
 * }
 */
export function normalizeLock(lockText) {
  const contamination = detectVerbContamination(lockText);

  if (!contamination.hasRisk) {
    return {
      normalized: lockText,
      wasRewritten: false,
      original: lockText,
      reason: null,
    };
  }

  return {
    normalized: contamination.suggestion,
    wasRewritten: true,
    original: lockText,
    reason: `Verb "${contamination.verb}" in lock text causes false positives — ` +
            `rewritten to focus on the subject "${contamination.subject}"`,
  };
}

/**
 * Extract subject noun phrases from any text (lock or action).
 * This is the foundation for scope-aware matching.
 *
 * Given: "Update the WhatsApp message formatting logic"
 * Returns: ["whatsapp message formatting logic", "whatsapp", "message formatting", "formatting logic"]
 *
 * Given: "Never modify the WhatsApp session handler"
 * Returns: ["whatsapp session handler", "whatsapp", "session handler"]
 */
export function extractSubjects(text) {
  const lower = text.toLowerCase().trim();
  const subjects = [];

  // Step 1: Strip prohibition prefix
  let content = lower;
  for (const pattern of PROHIBITION_PATTERNS) {
    const match = content.match(pattern);
    if (match) {
      content = content.slice(match[0].length).trim();
      break;
    }
  }

  // Step 2: Strip leading verb
  const words = content.split(/\s+/);
  let startIdx = 0;

  // Skip action verbs at the beginning
  for (let i = 0; i < Math.min(2, words.length); i++) {
    const w = words[i].replace(/[^a-z]/g, "");
    if (CONTAMINATING_VERBS.has(w)) {
      startIdx = i + 1;
      break;
    }
  }

  // Step 3: Skip fillers
  while (startIdx < words.length - 1) {
    const w = words[startIdx].replace(/[^a-z]/g, "");
    if (FILLER_WORDS.has(w)) {
      startIdx++;
    } else {
      break;
    }
  }

  // Step 4: The remaining text is the subject noun phrase
  const subjectWords = words.slice(startIdx);
  if (subjectWords.length === 0) return subjects;

  // Full noun phrase
  const fullPhrase = subjectWords.join(" ").replace(/[^a-z0-9\s\-]/g, "").trim();
  if (fullPhrase.length > 1) subjects.push(fullPhrase);

  // Split on conjunctions for sub-phrases
  const conjSplit = fullPhrase.split(/\s+(?:and|or|,)\s+/).map(s => s.trim()).filter(s => s.length > 1);
  if (conjSplit.length > 1) {
    for (const s of conjSplit) subjects.push(s);
  }

  // Bigrams and individual significant words
  const significantWords = subjectWords
    .map(w => w.replace(/[^a-z0-9\-]/g, ""))
    .filter(w => w.length > 2 && !FILLER_WORDS.has(w));

  // Generic words too vague to establish subject identity
  const GENERIC_WORDS = new Set([
    "system", "service", "module", "component", "feature", "function",
    "method", "class", "model", "handler", "controller", "manager",
    "process", "workflow", "flow", "logic", "config", "configuration",
    "settings", "data", "information", "record", "records", "file",
    "files", "page", "section", "layer", "level", "part", "item",
    "code", "app", "application", "project",
  ]);

  // Add individual significant words (proper nouns, domain terms) — skip generic
  for (const w of significantWords) {
    if (!CONTAMINATING_VERBS.has(w) && !GENERIC_WORDS.has(w) && w.length > 3) {
      subjects.push(w);
    }
  }

  // Adjacent bigrams from significant words
  for (let i = 0; i < significantWords.length - 1; i++) {
    const bigram = `${significantWords[i]} ${significantWords[i + 1]}`;
    if (!subjects.includes(bigram)) {
      subjects.push(bigram);
    }
  }

  return [...new Set(subjects)];
}

/**
 * Compare subjects from action and lock to determine if they target
 * the same component. This is the scope-awareness engine.
 *
 * Returns: {
 *   overlaps: boolean,
 *   overlapScore: 0-1,
 *   matchedSubjects: string[],
 *   lockSubjects: string[],
 *   actionSubjects: string[],
 * }
 */
export function compareSubjects(actionText, lockText) {
  const lockSubjects = extractSubjects(lockText);
  const actionSubjects = extractSubjects(actionText);

  if (lockSubjects.length === 0 || actionSubjects.length === 0) {
    return {
      overlaps: false,
      overlapScore: 0,
      matchedSubjects: [],
      lockSubjects,
      actionSubjects,
    };
  }

  const matched = [];

  // Check for direct subject overlap
  for (const ls of lockSubjects) {
    for (const as of actionSubjects) {
      // Exact match
      if (ls === as) {
        matched.push(ls);
        continue;
      }
      // Word-level containment — "patient records" inside "old patient records"
      // NOT substring: "shipping" should NOT match "calculateshipping"
      const asRe = new RegExp(`\\b${as.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
      const lsRe = new RegExp(`\\b${ls.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
      if (asRe.test(ls) || lsRe.test(as)) {
        matched.push(`${as} ⊂ ${ls}`);
        continue;
      }
      // Word-level overlap for multi-word phrases
      if (ls.includes(" ") && as.includes(" ")) {
        const lsWords = new Set(ls.split(/\s+/));
        const asWords = new Set(as.split(/\s+/));
        const intersection = [...lsWords].filter(w => asWords.has(w) && w.length > 2);
        // Need significant overlap — more than just shared filler
        const significantIntersection = intersection.filter(w => !FILLER_WORDS.has(w));
        if (significantIntersection.length >= 1 && significantIntersection.length >= Math.min(lsWords.size, asWords.size) * 0.4) {
          matched.push(`word overlap: ${significantIntersection.join(", ")}`);
        }
      }
    }
  }

  const uniqueMatched = [...new Set(matched)];
  const overlapScore = uniqueMatched.length > 0
    ? Math.min(uniqueMatched.length / Math.max(lockSubjects.length, 1), 1.0)
    : 0;

  return {
    overlaps: uniqueMatched.length > 0,
    overlapScore,
    matchedSubjects: uniqueMatched,
    lockSubjects,
    actionSubjects,
  };
}
