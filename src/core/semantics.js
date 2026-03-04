// ===================================================================
// SpecLock Semantic Analysis Engine v2
// Replaces keyword matching with real semantic conflict detection.
// Zero external dependencies — pure JavaScript.
// ===================================================================

// ===================================================================
// SYNONYM GROUPS (55 groups)
// Each group contains words/phrases that are semantically equivalent.
// ===================================================================

export const SYNONYM_GROUPS = [
  // --- Destructive actions ---
  ["remove", "delete", "drop", "eliminate", "destroy", "kill", "purge",
   "wipe", "erase", "obliterate", "expunge", "nuke"],
  ["truncate", "clear", "empty", "flush", "reset", "zero-out"],
  ["disable", "deactivate", "turn off", "switch off", "shut off",
   "shut down", "power off", "halt", "suspend", "pause", "freeze"],
  ["uninstall", "unplug", "disconnect", "detach", "decouple", "sever"],
  ["downgrade", "rollback", "revert", "regress", "undo"],

  // --- Constructive actions ---
  ["add", "create", "introduce", "insert", "new", "generate", "produce", "spawn"],
  ["enable", "activate", "turn on", "switch on", "start", "boot",
   "initialize", "launch", "engage"],
  ["install", "plug in", "connect", "attach", "couple", "integrate", "mount"],
  ["upgrade", "update", "patch", "bump", "advance"],

  // --- Modification actions ---
  ["change", "modify", "alter", "update", "mutate", "transform",
   "rewrite", "revise", "amend", "adjust", "tweak"],
  ["replace", "swap", "substitute", "switch", "exchange",
   "override", "overwrite"],
  ["move", "relocate", "migrate", "transfer", "shift", "rearrange", "reorganize"],
  ["rename", "relabel", "rebrand", "alias"],
  ["merge", "combine", "consolidate", "unify", "join", "blend"],
  ["split", "separate", "partition", "divide", "fork", "decompose"],

  // --- Breaking changes ---
  ["break", "breaking", "incompatible", "destabilize", "corrupt", "damage"],

  // --- Visibility ---
  ["public", "external", "exposed", "user-facing", "client-facing", "open", "visible"],
  ["private", "internal", "hidden", "encapsulated", "restricted", "closed", "secret"],

  // --- Data stores ---
  ["database", "db", "datastore", "data store", "schema", "table",
   "collection", "index", "migration", "sql", "nosql", "storage"],
  ["record", "row", "document", "entry", "item", "entity", "tuple"],
  ["column", "field", "attribute", "property", "key"],
  ["backup", "snapshot", "dump", "export"],

  // --- API & networking ---
  ["api", "endpoint", "route", "rest", "graphql", "rpc", "webhook",
   "interface", "service"],
  ["request", "call", "invoke", "query", "fetch"],
  ["response", "reply", "result", "output", "payload"],
  ["network", "connectivity", "connection", "socket", "port", "protocol"],

  // --- Testing ---
  ["test", "testing", "spec", "coverage", "assertion", "unit test",
   "integration test", "e2e", "end-to-end"],

  // --- Deployment ---
  ["deploy", "deployment", "release", "ship", "publish",
   "production", "go live", "launch", "push to prod"],

  // --- Security & auth ---
  ["security", "auth", "authentication", "authorization", "token",
   "credential", "permission", "access control", "rbac", "acl"],
  ["encrypt", "encryption", "cipher", "hash", "cryptographic",
   "tls", "ssl", "https"],
  ["certificate", "cert", "signing", "signature", "verification", "verify"],
  ["firewall", "waf", "rate limit", "throttle", "ip block",
   "deny list", "allow list"],
  ["audit", "audit log", "audit trail", "logging", "log",
   "monitoring", "observability", "telemetry", "tracking"],

  // --- Dependencies ---
  ["dependency", "package", "library", "module", "import", "require",
   "vendor", "third-party"],

  // --- Refactoring ---
  ["refactor", "restructure", "reorganize", "cleanup", "simplify"],

  // --- Medical / Healthcare ---
  ["patient data", "patient records", "patient information",
   "phi", "protected health information", "health records",
   "medical records", "clinical data", "ehr", "emr",
   "electronic health records", "health information"],
  ["hipaa", "hipaa compliance", "health insurance portability"],
  ["diagnosis", "diagnostic", "treatment", "prescription",
   "medication", "clinical", "medical"],

  // --- Financial / PCI ---
  ["cardholder data", "card data", "payment data", "credit card",
   "debit card", "pan", "primary account number", "card number", "cvv"],
  ["pci", "pci dss", "pci compliance", "payment card industry"],
  ["transaction", "payment", "charge", "refund", "settlement",
   "billing", "invoice"],
  ["financial records", "financial data", "accounting records",
   "ledger", "general ledger", "accounts"],
  ["trade", "trades", "executed trade", "trade record", "order",
   "position", "portfolio"],

  // --- IoT / firmware ---
  ["firmware", "firmware update", "ota", "over the air",
   "flash", "rom", "bios", "bootloader", "embedded software"],
  ["device", "iot", "sensor", "actuator", "controller",
   "microcontroller", "mcu", "plc", "edge device"],
  ["signed", "unsigned", "verified", "unverified",
   "trusted", "untrusted", "certified", "uncertified"],

  // --- Content safety / Social media ---
  ["csam", "csam detection", "child safety", "content safety",
   "safety scanning", "content moderation", "abuse detection",
   "content filtering", "harmful content"],
  ["moderation", "content review", "report", "flag",
   "content policy", "trust and safety"],
  ["ban", "ban record", "ban records", "banned", "suspension",
   "suspended", "blocked user"],
  ["user data", "user information", "user records", "pii",
   "personally identifiable information", "personal data",
   "gdpr", "data protection"],

  // --- DevOps / Infrastructure ---
  ["container", "docker", "kubernetes", "k8s", "pod",
   "service mesh", "helm"],
  ["pipeline", "ci", "cd", "ci/cd", "continuous integration",
   "continuous deployment", "build", "artifact"],
  ["infrastructure", "infra", "terraform", "cloudformation",
   "iac", "provisioning"],
  ["dns", "domain", "routing", "load balancer", "cdn",
   "reverse proxy", "gateway", "ingress"],

  // --- Expose / visibility actions ---
  ["expose", "reveal", "leak", "make visible", "make public",
   "make viewable", "make accessible", "show", "display publicly"],

  // --- Compliance / regulatory ---
  ["compliance", "regulatory", "regulation", "standard",
   "certification", "governance"],
  ["retention", "retention policy", "data retention",
   "archival", "preservation", "lifecycle"],
  ["consent", "user consent", "opt-in", "opt-out",
   "data subject", "right to erasure"],
];

// ===================================================================
// EUPHEMISM MAP
// Maps soft/indirect language to actual operations.
// ===================================================================

export const EUPHEMISM_MAP = {
  // Deletion euphemisms
  "clean up":       ["delete", "remove", "purge"],
  "tidy up":        ["delete", "remove"],
  "clear out":      ["delete", "remove", "purge"],
  "phase out":      ["remove", "deprecate", "disable"],
  "sunset":         ["remove", "deprecate", "delete"],
  "decommission":   ["remove", "disable", "delete", "shut down"],
  "retire":         ["remove", "deprecate", "delete"],
  "archive":        ["remove", "delete"],
  "prune":          ["delete", "remove", "trim"],
  "trim":           ["delete", "remove", "reduce"],
  "housekeeping":   ["delete", "remove", "clean"],
  "garbage collect":["delete", "remove", "purge"],
  "gc":             ["delete", "remove", "purge"],
  "reclaim":        ["delete", "remove", "free"],
  "free up":        ["delete", "remove"],
  "make room":      ["delete", "remove"],
  "declutter":      ["delete", "remove", "reorganize"],
  "thin out":       ["delete", "remove", "reduce"],

  // Modification euphemisms
  "streamline":     ["remove", "simplify", "modify", "reduce"],
  "optimize":       ["modify", "change", "remove", "reduce"],
  "modernize":      ["replace", "rewrite", "change"],
  "revamp":         ["replace", "rewrite", "change"],
  "overhaul":       ["replace", "rewrite", "change", "modify"],
  "refresh":        ["replace", "update", "change"],
  "rework":         ["modify", "rewrite", "change"],
  "fine-tune":      ["modify", "adjust", "change"],
  "adjust":         ["modify", "change", "alter"],
  "tweak":          ["modify", "change", "alter"],
  "touch up":       ["modify", "change"],
  "polish":         ["modify", "change"],

  // Disabling euphemisms
  "turn off":       ["disable", "deactivate"],
  "switch off":     ["disable", "deactivate"],
  "shut down":      ["disable", "stop", "kill"],
  "power down":     ["disable", "stop"],
  "wind down":      ["disable", "stop", "deprecate"],
  "stand down":     ["disable", "stop"],
  "put on hold":    ["disable", "pause", "suspend"],
  "take offline":   ["disable", "remove", "shut down"],
  "take down":      ["disable", "remove", "delete"],
  "pull the plug":  ["disable", "stop", "remove"],
  "skip":           ["disable", "bypass", "ignore"],
  "bypass":         ["disable", "circumvent", "skip"],
  "work around":    ["bypass", "circumvent"],
  "shortcut":       ["bypass", "skip"],

  // Database euphemisms
  "truncate":       ["delete", "remove", "wipe", "empty"],
  "vacuum":         ["delete", "remove", "clean"],
  "compact":        ["delete", "remove", "reorganize"],
  "normalize":      ["modify", "restructure", "change"],
  "reseed":         ["reset", "modify", "overwrite"],
  "rebuild index":  ["modify", "change", "restructure"],
  "drop":           ["delete", "remove", "destroy"],

  // IoT/firmware euphemisms
  "flash":          ["overwrite", "replace", "install", "push"],
  "reflash":        ["overwrite", "replace", "install"],
  "reprovision":    ["reset", "reconfigure", "reinstall"],
  "factory reset":  ["delete", "wipe", "reset"],
  "hard reset":     ["delete", "wipe", "reset"],

  // Network/infrastructure euphemisms
  "bridge":         ["connect", "link", "merge", "join"],
  "segment":        ["split", "separate", "isolate", "divide"],
  "flatten":        ["merge", "simplify", "restructure"],
  "consolidate":    ["merge", "combine", "reduce"],
  "spin up":        ["create", "deploy", "start"],
  "spin down":      ["delete", "remove", "stop"],
  "tear down":      ["delete", "remove", "destroy"],
  "nuke":           ["delete", "destroy", "remove", "wipe"],

  // Approval/moderation euphemisms
  "batch approve":  ["bypass", "skip", "disable", "approve all"],
  "auto-approve":   ["bypass", "skip", "disable"],
  "fast-track":     ["bypass", "skip"],
  "approve all":    ["bypass", "skip", "disable"],

  // Infrastructure euphemisms
  "reprovision":    ["modify", "change", "reset", "reconfigure"],
  "reconfigure":    ["modify", "change", "alter"],
  "provision":      ["configure", "install", "deploy"],
  "rotate":         ["change", "replace", "renew", "modify"],
  "renew":          ["change", "replace", "rotate", "modify"],

  // Security euphemisms
  "make visible":   ["expose", "reveal", "public"],
  "make viewable":  ["expose", "reveal", "public"],
  "make accessible":["expose", "reveal", "public"],
  "make public":    ["expose", "reveal"],
  "transmit":       ["send", "transfer", "expose"],

  // Encryption euphemisms
  "unencrypted":    ["without encryption", "disable encryption", "no encryption", "plaintext"],
  "plaintext":      ["without encryption", "unencrypted", "no encryption"],
  "without encryption": ["unencrypted", "disable encryption", "plaintext"],
};

// ===================================================================
// CONCEPT MAP
// Maps domain-specific terms to related concepts.
// ===================================================================

export const CONCEPT_MAP = {
  // Content safety
  "csam":              ["content safety", "child safety", "safety scanning",
                        "content moderation", "abuse detection"],
  "csam detection":    ["content safety", "safety scanning", "content moderation"],
  "content safety":    ["csam", "csam detection", "safety scanning",
                        "content moderation", "abuse detection"],
  "safety scanning":   ["csam", "csam detection", "content safety",
                        "content moderation"],
  "content moderation":["csam detection", "content safety",
                        "safety scanning", "abuse detection"],

  // Healthcare
  "phi":               ["patient data", "patient records", "health information",
                        "medical records", "protected health information", "hipaa"],
  "patient data":      ["phi", "health records", "medical records",
                        "protected health information", "ehr"],
  "patient records":   ["phi", "patient data", "health records",
                        "medical records", "ehr"],
  "health records":    ["phi", "patient data", "patient records",
                        "medical records", "ehr", "emr"],
  "medical records":   ["phi", "patient data", "patient records",
                        "health records", "ehr", "emr"],
  "hipaa":             ["phi", "patient data", "health information",
                        "medical records", "compliance"],

  // Financial
  "pci":               ["cardholder data", "payment data", "card data",
                        "pci dss", "payment security"],
  "cardholder data":   ["pci", "payment data", "card data", "credit card", "pan"],
  "payment data":      ["pci", "cardholder data", "card data", "transaction", "billing"],
  "trade":             ["executed trade", "trade record", "order", "position"],
  "executed trade":    ["trade", "trade record", "order"],
  "trade record":      ["trade", "executed trade", "transaction record"],

  // Audit/logging
  "audit logging":     ["audit log", "audit trail", "logging", "monitoring"],
  "audit log":         ["audit logging", "audit trail", "logging"],
  "audit trail":       ["audit logging", "audit log", "logging"],

  // Firmware/IoT
  "firmware":          ["firmware update", "ota", "flash", "embedded software"],
  "ota":               ["firmware", "firmware update", "over the air", "remote update"],
  "flash":             ["firmware", "firmware update", "overwrite"],
  "signed firmware":   ["verified firmware", "trusted firmware", "secure boot"],
  "unsigned firmware": ["unverified firmware", "untrusted firmware", "insecure"],

  // Network
  "network segments":  ["vlans", "subnets", "network zones",
                        "network isolation", "segmentation"],
  "network isolation": ["network segments", "segmentation", "firewall", "air gap"],

  // User data
  "pii":               ["personal data", "user data", "personally identifiable information",
                        "user information", "gdpr"],
  "personal data":     ["pii", "user data", "user information", "gdpr", "data protection"],
  "user data":         ["pii", "personal data", "user information", "user records"],

  // Encryption
  "cryptographic signatures": ["code signing", "digital signatures",
                               "signature verification", "certificate"],
  "code signing":      ["cryptographic signatures", "signature", "certificate", "verification"],

  // Ban records
  "ban records":       ["ban record", "banned users", "suspension records",
                        "blocked users", "moderation records"],

  // Authentication/2FA
  "2fa":               ["two-factor", "two factor authentication", "mfa",
                        "multi-factor", "authentication", "auth"],
  "authentication":    ["auth", "login", "sign in", "2fa", "mfa",
                        "credential", "session", "token"],
  "auth":              ["authentication", "login", "sign in", "2fa",
                        "credential", "access control"],

  // Encryption
  "encryption":        ["encrypt", "tls", "ssl", "https", "cryptographic",
                        "cipher", "encrypted", "unencrypted"],
  "unencrypted":       ["plaintext", "plain text", "cleartext",
                        "without encryption", "insecure", "disable encryption",
                        "encryption"],

  // User records/PII
  "email addresses":   ["pii", "personal data", "user data", "user information"],
  "user email":        ["pii", "personal data", "user data"],
  "email":             ["pii", "personal data", "contact information"],

  // Certificate management
  "certificate rotation": ["cert renewal", "certificate renewal",
                          "cert rotation", "key rotation"],
  "security certs":    ["certificates", "tls certificates", "ssl certificates",
                        "certificate rotation"],

  // Activity/logging
  "user activity":     ["audit log", "audit trail", "logging", "tracking",
                        "monitoring", "activity log"],
  "recording":         ["logging", "tracking", "monitoring", "audit"],

  // Infrastructure
  "k8s":               ["kubernetes", "cluster", "infrastructure",
                        "container orchestration"],
  "cluster":           ["kubernetes", "k8s", "infrastructure", "nodes"],
};

// ===================================================================
// TEMPORAL MODIFIERS
// Words/phrases that attempt to soften an action by claiming
// it is temporary. These should NEVER reduce confidence.
// ===================================================================

export const TEMPORAL_MODIFIERS = [
  "temporarily", "temp", "briefly", "for now", "just for now",
  "for a moment", "for a bit", "for a second",
  "for testing", "for debugging", "for development",
  "during maintenance", "during migration",
  "until we fix", "until we resolve", "while we",
  "short-term", "short term", "quickly", "momentarily",
  "provisional", "provisionally", "interim", "in the meantime",
  "as a workaround", "as a stopgap", "as a temporary measure",
  "just this once", "one-time", "one time",
];

// ===================================================================
// STOPWORDS
// Common words filtered from direct matching to reduce noise.
// ===================================================================

const STOPWORDS = new Set([
  // Articles & pronouns
  "a", "an", "the", "this", "that", "it", "its", "our", "their",
  "your", "my", "his", "her", "we", "they", "them", "i",
  // Prepositions & conjunctions
  "to", "of", "in", "on", "at", "by", "up", "as", "or", "and",
  "nor", "but", "so", "if", "no", "not", "is", "be", "do", "did",
  "with", "from", "for", "into", "over", "under", "between", "through",
  "about", "before", "after", "during", "while",
  // Auxiliary verbs & common verbs
  "are", "was", "were", "been", "being", "have", "has", "had",
  "will", "would", "could", "should", "may", "might", "shall",
  "can", "need", "must", "does", "done",
  // Quantifiers & adjectives
  "all", "any", "every", "some", "most", "other", "each", "both",
  "few", "more", "less", "many", "much",
  // Adverbs
  "also", "just", "very", "too", "really", "quite", "only", "then",
  "now", "here", "there", "when", "where", "how", "what", "which",
  "who", "whom", "why",
  // Common generic nouns (too vague to be meaningful in conflict matching)
  "system", "page", "app", "application", "project", "code", "file",
  "files", "data", "way", "thing", "things", "part", "set", "use",
  "using", "used", "make", "made", "new", "get", "got",
  "module", "component", "service", "feature", "function", "method",
  "class", "type", "model", "view", "controller", "handler",
]);

// ===================================================================
// POSITIVE & NEGATIVE INTENT MARKERS
// ===================================================================

const POSITIVE_INTENT_MARKERS = [
  "enable", "activate", "turn on", "switch on", "start",
  "add", "create", "implement", "introduce", "set up",
  "install", "deploy", "launch", "initialize",
  "enforce", "strengthen", "harden", "improve", "enhance",
  "increase", "expand", "extend", "upgrade", "boost",
  "verify", "validate", "check", "confirm", "ensure",
  "protect", "secure", "guard", "shield", "defend",
  "restore", "recover", "repair", "fix", "resolve",
  "maintain", "preserve", "keep", "retain", "uphold",
  "monitor", "track", "observe", "watch",
  "document", "record", "log", "report",
  "comply", "adhere", "follow",
  "view", "read", "inspect", "review", "examine",
  "test", "scan", "detect", "encrypt",
].sort((a, b) => b.length - a.length);

const NEGATIVE_INTENT_MARKERS = [
  "disable", "deactivate", "turn off", "switch off", "stop",
  "remove", "delete", "drop", "destroy", "kill", "purge",
  "wipe", "erase", "eliminate", "nuke",
  "uninstall", "disconnect", "detach",
  "weaken", "loosen", "relax", "reduce", "lower",
  "bypass", "circumvent", "skip", "ignore", "avoid",
  "override", "overrule", "suppress",
  "break", "violate", "breach",
  "downgrade", "rollback", "revert",
  "truncate", "empty", "clear", "flush",
  "expose", "leak", "reveal",
  "pause", "suspend", "freeze", "halt",
  // euphemistic negatives
  "clean up", "sunset", "retire", "phase out",
  "decommission", "wind down", "take down",
  "take offline", "pull the plug",
  "streamline",
].sort((a, b) => b.length - a.length);

// ===================================================================
// NEGATION WORDS
// ===================================================================

const NEGATION_WORDS = [
  "no", "not", "never", "without", "dont", "don't",
  "cannot", "can't", "shouldn't", "mustn't", "won't",
  "wouldn't", "couldn't", "isn't", "aren't", "wasn't",
  "weren't", "hasn't", "haven't", "hadn't",
  "avoid", "prevent", "prohibit", "forbid", "disallow",
  "cease", "refrain",
];

// ===================================================================
// OPPOSITE ACTION PAIRS
// If a lock prohibits verb A and the action does verb B (opposite), no conflict.
// ===================================================================

const OPPOSITE_PAIRS = [
  [["enable", "activate", "turn on", "switch on", "start"],
   ["disable", "deactivate", "turn off", "switch off", "stop", "halt", "pause"]],
  [["add", "create", "introduce", "insert", "generate"],
   ["remove", "delete", "drop", "destroy", "kill", "purge", "wipe", "erase"]],
  [["install", "connect", "attach", "mount"],
   ["uninstall", "disconnect", "detach", "unplug"]],
  [["encrypt", "strengthen", "harden", "secure", "protect", "upgrade"],
   ["decrypt", "weaken", "loosen", "expose", "relax", "remove", "disable"]],
  [["upgrade", "improve", "enhance", "boost"],
   ["downgrade", "rollback", "revert", "regress"]],
  [["verify", "validate", "check", "confirm", "ensure", "enforce"],
   ["bypass", "circumvent", "skip", "ignore", "avoid"]],
  [["monitor", "track", "observe", "watch", "record", "log", "audit"],
   ["stop", "cease", "halt", "suppress", "disable", "remove"]],
  [["read", "view", "inspect", "review", "examine", "generate", "report"],
   ["modify", "change", "alter", "rewrite", "overwrite", "delete", "remove", "disable"]],
];

// ===================================================================
// SCORING WEIGHTS
// ===================================================================

const SCORING = {
  directWordMatch:     20,
  synonymMatch:        15,
  euphemismMatch:      25,
  conceptMatch:        20,
  phraseMatch:         30,

  negationConflict:    35,
  intentConflict:      30,
  destructiveAction:   15,
  temporalEvasion:     10,

  positiveActionOnNegativeLock: -40,

  conflictThreshold:   25,
  highThreshold:       70,
  mediumThreshold:     40,
};

// ===================================================================
// UTILITY: Regex escaper
// ===================================================================

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ===================================================================
// PHRASE-AWARE TOKENIZER
// ===================================================================

function buildKnownPhrases() {
  const phrases = new Set();

  for (const key of Object.keys(EUPHEMISM_MAP)) {
    if (key.includes(" ")) phrases.add(key.toLowerCase());
  }
  for (const key of Object.keys(CONCEPT_MAP)) {
    if (key.includes(" ")) phrases.add(key.toLowerCase());
  }
  for (const group of SYNONYM_GROUPS) {
    for (const term of group) {
      if (term.includes(" ")) phrases.add(term.toLowerCase());
    }
  }
  for (const values of Object.values(CONCEPT_MAP)) {
    for (const term of values) {
      if (term.includes(" ")) phrases.add(term.toLowerCase());
    }
  }
  for (const mod of TEMPORAL_MODIFIERS) {
    if (mod.includes(" ")) phrases.add(mod.toLowerCase());
  }

  return [...phrases].sort((a, b) => b.length - a.length);
}

const KNOWN_PHRASES = buildKnownPhrases();

export function tokenize(text) {
  const lower = text.toLowerCase();
  const phrases = [];

  // Extract known multi-word phrases (greedy, longest first)
  for (const phrase of KNOWN_PHRASES) {
    const regex = new RegExp(`\\b${escapeRegex(phrase)}\\b`, "g");
    if (regex.test(lower)) {
      phrases.push(phrase);
    }
  }

  // Extract single words (>= 2 chars)
  const words = lower
    .replace(/[^a-z0-9\-\/&]+/g, " ")
    .split(/\s+/)
    .filter(w => w.length >= 2);

  const all = [...new Set([...phrases, ...words])];
  return { words, phrases, all };
}

// ===================================================================
// COMPOUND SENTENCE SPLITTER
// ===================================================================

const CLAUSE_SEPARATORS = [
  /\band also\b/i,
  /\bas well as\b/i,
  /\balong with\b/i,
  /\bin addition\b/i,
  /\bfollowed by\b/i,
  /\badditionally\b/i,
  /\bfurthermore\b/i,
  /\bmoreover\b/i,
  /,\s*also\b/i,
  /;\s*/,
  /\balso\b/i,
  /\bwhile\b/i,
  /\bthen\b/i,
  /\bplus\b/i,
];

export function splitClauses(text) {
  let clauses = [text];

  for (const separator of CLAUSE_SEPARATORS) {
    const newClauses = [];
    for (const clause of clauses) {
      const parts = clause.split(separator).map(s => s.trim()).filter(s => s.length > 3);
      newClauses.push(...parts);
    }
    if (newClauses.length > 0) {
      clauses = newClauses;
    }
  }

  // Filter out clauses too short to be meaningful
  const meaningful = clauses.filter(c => {
    const words = c.split(/\s+/).filter(w => w.length > 2);
    return words.length >= 2;
  });

  return meaningful.length > 0 ? meaningful : [text];
}

// ===================================================================
// INTENT CLASSIFIER
// ===================================================================

function isNegatedContext(precedingText) {
  const words = precedingText.trim().split(/\s+/).slice(-4);
  return words.some(w => NEGATION_WORDS.includes(w.toLowerCase()));
}

export function classifyIntent(text) {
  const lower = text.toLowerCase();

  let detectedPositive = [];
  let detectedNegative = [];

  // Check positive markers
  for (const marker of POSITIVE_INTENT_MARKERS) {
    const regex = new RegExp(`\\b${escapeRegex(marker)}\\b`, "i");
    const match = lower.match(regex);
    if (match) {
      const preceding = lower.substring(0, match.index);
      if (isNegatedContext(preceding)) {
        detectedNegative.push({ marker, negated: true });
      } else {
        detectedPositive.push({ marker, negated: false });
      }
    }
  }

  // Check negative markers
  for (const marker of NEGATIVE_INTENT_MARKERS) {
    const regex = new RegExp(`\\b${escapeRegex(marker)}\\b`, "i");
    const match = lower.match(regex);
    if (match) {
      const preceding = lower.substring(0, match.index);
      if (isNegatedContext(preceding)) {
        detectedPositive.push({ marker, negated: true });
      } else {
        detectedNegative.push({ marker, negated: false });
      }
    }
  }

  // Expand through euphemism map
  for (const [euphemism, meanings] of Object.entries(EUPHEMISM_MAP)) {
    const regex = new RegExp(`\\b${escapeRegex(euphemism)}\\b`, "i");
    if (regex.test(lower)) {
      const hasDestructive = meanings.some(m =>
        ["delete", "remove", "purge", "disable", "wipe",
         "destroy", "kill", "stop", "bypass"].includes(m)
      );
      if (hasDestructive) {
        detectedNegative.push({ marker: euphemism, negated: false, euphemismFor: meanings });
      }
    }
  }

  const posCount = detectedPositive.length;
  const negCount = detectedNegative.length;

  if (posCount === 0 && negCount === 0) {
    return { intent: "neutral", confidence: 0.5, actionVerb: "",
             negated: false, positiveMarkers: [], negativeMarkers: [] };
  }
  if (posCount > 0 && negCount === 0) {
    return { intent: "positive", confidence: Math.min(0.5 + posCount * 0.15, 0.95),
             actionVerb: detectedPositive[0].marker, negated: detectedPositive[0].negated,
             positiveMarkers: detectedPositive, negativeMarkers: [] };
  }
  if (negCount > 0 && posCount === 0) {
    return { intent: "negative", confidence: Math.min(0.5 + negCount * 0.15, 0.95),
             actionVerb: detectedNegative[0].marker, negated: detectedNegative[0].negated,
             positiveMarkers: [], negativeMarkers: detectedNegative };
  }

  // Mixed
  return { intent: "mixed", confidence: 0.7,
           actionVerb: detectedNegative[0].marker, negated: false,
           positiveMarkers: detectedPositive, negativeMarkers: detectedNegative };
}

// ===================================================================
// SEMANTIC EXPANSION
// ===================================================================

export function expandSemantics(tokens) {
  const expanded = new Set(tokens);
  const expansions = new Map();

  for (const token of tokens) {
    const t = token.toLowerCase();

    // Skip stopwords — they shouldn't trigger synonym/euphemism/concept expansions
    if (STOPWORDS.has(t)) continue;

    // Synonym group expansion
    for (const group of SYNONYM_GROUPS) {
      if (group.includes(t)) {
        for (const syn of group) {
          if (!expanded.has(syn)) {
            expanded.add(syn);
            expansions.set(syn, { via: t, source: "synonym" });
          }
        }
      }
    }

    // Euphemism expansion
    if (EUPHEMISM_MAP[t]) {
      for (const meaning of EUPHEMISM_MAP[t]) {
        if (!expanded.has(meaning)) {
          expanded.add(meaning);
          expansions.set(meaning, { via: t, source: "euphemism" });
        }
      }
    }

    // Concept map expansion
    if (CONCEPT_MAP[t]) {
      for (const related of CONCEPT_MAP[t]) {
        if (!expanded.has(related)) {
          expanded.add(related);
          expansions.set(related, { via: t, source: "concept" });
        }
      }
    }
  }

  return { expanded: [...expanded], expansions };
}

// ===================================================================
// TEMPORAL MODIFIER DETECTION
// ===================================================================

function detectTemporalModifier(text) {
  const lower = text.toLowerCase();
  for (const mod of TEMPORAL_MODIFIERS) {
    const regex = new RegExp(`\\b${escapeRegex(mod)}\\b`, "i");
    if (regex.test(lower)) return mod;
  }
  return null;
}

// ===================================================================
// CONFIDENCE SCORING
// ===================================================================

// ===================================================================
// VERB EXTRACTION & OPPOSITE CHECKING
// ===================================================================

function extractProhibitedVerb(lockText) {
  const lower = lockText.toLowerCase();
  // Match: "never <verb>", "must not <verb>", "don't <verb>", "do not <verb>", "cannot <verb>"
  const patterns = [
    /\bnever\s+(\S+(?:\s+\S+)?)/i,
    /\bmust\s+not\s+(\S+(?:\s+\S+)?)/i,
    /\bdo\s+not\s+(\S+(?:\s+\S+)?)/i,
    /\bdon't\s+(\S+(?:\s+\S+)?)/i,
    /\bcannot\s+(\S+(?:\s+\S+)?)/i,
    /\bcan't\s+(\S+(?:\s+\S+)?)/i,
    /\bno\s+(\S+(?:\s+\S+)?)/i,
  ];

  for (const pattern of patterns) {
    const match = lower.match(pattern);
    if (match) {
      const verb = match[1].trim();
      // Check multi-word markers first
      const allMarkers = [...NEGATIVE_INTENT_MARKERS, ...POSITIVE_INTENT_MARKERS]
        .sort((a, b) => b.length - a.length);
      for (const marker of allMarkers) {
        if (verb.startsWith(marker)) return marker;
      }
      // Return the first word
      return verb.split(/\s+/)[0];
    }
  }
  return null;
}

function extractPrimaryVerb(actionText) {
  const lower = actionText.toLowerCase();
  // Find first matching marker in text
  const allMarkers = [...POSITIVE_INTENT_MARKERS, ...NEGATIVE_INTENT_MARKERS]
    .sort((a, b) => b.length - a.length);

  let earliest = null;
  let earliestPos = Infinity;

  for (const marker of allMarkers) {
    const regex = new RegExp(`\\b${escapeRegex(marker)}\\b`, "i");
    const match = lower.match(regex);
    if (match && match.index < earliestPos) {
      earliestPos = match.index;
      earliest = marker;
    }
  }

  // Also check euphemism map keys
  for (const euphemism of Object.keys(EUPHEMISM_MAP)) {
    const regex = new RegExp(`\\b${escapeRegex(euphemism)}\\b`, "i");
    const match = lower.match(regex);
    if (match && match.index < earliestPos) {
      earliestPos = match.index;
      earliest = euphemism;
    }
  }

  return earliest;
}

function checkOpposites(verb1, verb2) {
  const v1 = verb1.toLowerCase();
  const v2 = verb2.toLowerCase();

  for (const [groupA, groupB] of OPPOSITE_PAIRS) {
    const v1InA = groupA.includes(v1);
    const v1InB = groupB.includes(v1);
    const v2InA = groupA.includes(v2);
    const v2InB = groupB.includes(v2);

    if ((v1InA && v2InB) || (v1InB && v2InA)) return true;
  }

  // Also check via euphemism expansion
  const v1Meanings = EUPHEMISM_MAP[v1] || [];
  const v2Meanings = EUPHEMISM_MAP[v2] || [];

  for (const [groupA, groupB] of OPPOSITE_PAIRS) {
    for (const m of v1Meanings) {
      if (groupA.includes(m) && groupB.includes(v2)) return true;
      if (groupB.includes(m) && groupA.includes(v2)) return true;
    }
    for (const m of v2Meanings) {
      if (groupA.includes(m) && groupB.includes(v1)) return true;
      if (groupB.includes(m) && groupA.includes(v1)) return true;
    }
  }

  return false;
}

function isProhibitiveLock(lockText) {
  return /\b(never|must not|do not|don't|cannot|can't|forbidden|prohibited|disallowed)\b/i.test(lockText)
    || /\bno\s+\w/i.test(lockText);
}

export function scoreConflict({ actionText, lockText }) {
  const actionTokens = tokenize(actionText);
  const lockTokens = tokenize(lockText);

  const actionExpanded = expandSemantics(actionTokens.all);
  const lockExpanded = expandSemantics(lockTokens.all);

  const actionIntent = classifyIntent(actionText);
  const lockIntent = classifyIntent(lockText);

  const hasTemporalMod = detectTemporalModifier(actionText);
  const lockIsProhibitive = isProhibitiveLock(lockText);

  let score = 0;
  const reasons = [];

  // 1. Direct word overlap (minus stopwords)
  const directOverlap = actionTokens.words.filter(w =>
    lockTokens.words.includes(w) && !STOPWORDS.has(w));
  if (directOverlap.length > 0) {
    const pts = directOverlap.length * SCORING.directWordMatch;
    score += pts;
    reasons.push(`direct keyword match: ${directOverlap.join(", ")}`);
  }

  // 2. Phrase matches
  const phraseOverlap = actionTokens.phrases.filter(p =>
    lockTokens.phrases.includes(p));
  if (phraseOverlap.length > 0) {
    const pts = phraseOverlap.length * SCORING.phraseMatch;
    score += pts;
    reasons.push(`phrase match: ${phraseOverlap.join(", ")}`);
  }

  // 3. Synonym matches
  const synonymMatches = [];
  for (const [term, info] of actionExpanded.expansions) {
    if (info.source === "synonym" && lockExpanded.expanded.includes(term)) {
      if (!directOverlap.includes(term)) {
        synonymMatches.push(`${info.via} → ${term}`);
      }
    }
  }
  for (const [term, info] of lockExpanded.expansions) {
    if (info.source === "synonym" && actionExpanded.expanded.includes(term)) {
      const key = `${info.via} → ${term}`;
      if (!synonymMatches.includes(key) && !directOverlap.includes(term)) {
        synonymMatches.push(key);
      }
    }
  }
  if (synonymMatches.length > 0) {
    const pts = Math.min(synonymMatches.length, 4) * SCORING.synonymMatch;
    score += pts;
    reasons.push(`synonym match: ${synonymMatches.slice(0, 3).join("; ")}`);
  }

  // 4. Euphemism matches
  const euphemismMatches = [];
  for (const [term, info] of actionExpanded.expansions) {
    if (info.source === "euphemism" && lockExpanded.expanded.includes(term)) {
      euphemismMatches.push(`"${info.via}" (euphemism for ${term})`);
    }
  }
  if (euphemismMatches.length > 0) {
    const pts = Math.min(euphemismMatches.length, 3) * SCORING.euphemismMatch;
    score += pts;
    reasons.push(`euphemism detected: ${euphemismMatches.slice(0, 2).join("; ")}`);
  }

  // 5. Concept map matches
  const conceptMatches = [];
  for (const [term, info] of actionExpanded.expansions) {
    if (info.source === "concept" && lockExpanded.expanded.includes(term)) {
      conceptMatches.push(`${info.via} (concept: ${term})`);
    }
  }
  for (const [term, info] of lockExpanded.expansions) {
    if (info.source === "concept" && actionExpanded.expanded.includes(term)) {
      const key = `${info.via} (concept: ${term})`;
      if (!conceptMatches.includes(key)) {
        conceptMatches.push(key);
      }
    }
  }
  if (conceptMatches.length > 0) {
    const pts = Math.min(conceptMatches.length, 3) * SCORING.conceptMatch;
    score += pts;
    reasons.push(`concept match: ${conceptMatches.slice(0, 2).join("; ")}`);
  }

  // 6. Subject relevance gate — prevent false positives where only verb-level
  // matches exist (euphemism/synonym on verbs) but the subjects are different.
  // "Optimize images" should NOT conflict with "Do not modify calculateShipping"
  // because the subjects (images vs shipping function) don't overlap.
  //
  // However, subject-level synonyms like "content safety" → "CSAM detection"
  // should still count as subject relevance (same concept, different words).
  const ACTION_VERBS_SET = new Set([
    "modify", "change", "alter", "update", "delete", "remove", "add", "create",
    "disable", "enable", "replace", "swap", "switch", "move", "migrate",
    "install", "uninstall", "deploy", "rewrite", "revise", "restructure",
    "refactor", "clean", "purge", "wipe", "drop", "kill", "destroy",
    "reduce", "simplify", "fix", "repair", "restore", "recover", "break",
    "expose", "hide", "connect", "disconnect", "merge", "split", "truncate",
    "bypass", "skip", "ignore", "override", "adjust", "tweak", "tune",
  ]);

  // Check if any synonym/concept match involves a non-verb term (= subject match)
  const hasSynonymSubjectMatch = synonymMatches.some(m => {
    // Format: "term → expansion" — check if expansion is not a common verb
    const parts = m.split(" → ");
    const expansion = (parts[1] || "").trim();
    return !ACTION_VERBS_SET.has(expansion);
  });

  const hasSubjectMatch = directOverlap.length > 0 || phraseOverlap.length > 0 ||
    conceptMatches.length > 0 || hasSynonymSubjectMatch;
  const hasAnyMatch = hasSubjectMatch || synonymMatches.length > 0 ||
    euphemismMatches.length > 0;

  // If the ONLY matches are verb-level (euphemism/synonym) with no subject
  // overlap, drastically reduce the score — these are likely false positives
  if (!hasSubjectMatch && (synonymMatches.length > 0 || euphemismMatches.length > 0)) {
    score = Math.floor(score * 0.15);
  }

  const prohibitedVerb = extractProhibitedVerb(lockText);
  const actionPrimaryVerb = extractPrimaryVerb(actionText);

  let intentAligned = false;  // true = action is doing the OPPOSITE of what lock prohibits

  // Check 1: Direct opposite verbs (e.g., "enable" vs "disable")
  if (lockIsProhibitive && prohibitedVerb && actionPrimaryVerb) {
    if (checkOpposites(actionPrimaryVerb, prohibitedVerb)) {
      intentAligned = true;
      reasons.push(
        `intent alignment: action "${actionPrimaryVerb}" is opposite of ` +
        `prohibited "${prohibitedVerb}" (compliant, not conflicting)`);
    }
  }

  // Check 2: Positive action intent against a lock that prohibits a negative action
  // ONLY applies when there are no euphemism/synonym matches suggesting the
  // action is actually destructive despite sounding positive (e.g., "reseed" → "reset")
  if (!intentAligned && lockIsProhibitive && actionIntent.intent === "positive" && prohibitedVerb) {
    const prohibitedIsNegative = NEGATIVE_INTENT_MARKERS.some(m =>
      prohibitedVerb === m || prohibitedVerb.startsWith(m));
    const hasEuphemismOrSynonymMatch = euphemismMatches.length > 0 || synonymMatches.length > 0;
    if (prohibitedIsNegative && !actionIntent.negated && !hasEuphemismOrSynonymMatch) {
      intentAligned = true;
      reasons.push(
        `intent alignment: positive action "${actionPrimaryVerb}" against ` +
        `lock prohibiting negative "${prohibitedVerb}"`);
    }
  }

  // Check 3: Positive/constructive/observational actions that don't perform
  //          the prohibited operation — even if they share subject nouns
  if (!intentAligned && lockIsProhibitive && actionPrimaryVerb) {
    const SAFE_ACTION_VERBS = new Set([
      // Read-only / observational — these NEVER modify the system
      "read", "view", "inspect", "review", "examine",
      "monitor", "observe", "watch", "check", "scan", "detect",
      "generate", "report", "document", "test",
      // Security / verification — passive checking
      "verify", "validate", "confirm", "ensure", "enforce",
      "protect", "secure", "guard", "shield",
      // Activation — enabling features/checks is observational
      "enable", "activate",
      // Preservation — maintaining state
      "maintain", "preserve", "comply", "encrypt",
      // NOTE: "add", "create", "implement", "improve", "enhance", "upgrade"
      // are NOT safe — they modify the target system. Adding to a locked area
      // IS a modification. Only truly read-only and activation verbs are safe.
    ]);

    const PROHIBITED_ACTION_VERBS = new Set([
      "modify", "change", "alter", "delete", "remove", "disable",
      "drop", "break", "weaken", "expose", "install", "push",
      "deploy", "connect", "merge", "reset", "truncate",
    ]);

    if (SAFE_ACTION_VERBS.has(actionPrimaryVerb) &&
        PROHIBITED_ACTION_VERBS.has(prohibitedVerb) &&
        !PROHIBITED_ACTION_VERBS.has(actionPrimaryVerb)) {
      intentAligned = true;
      reasons.push(
        `intent alignment: safe action "${actionPrimaryVerb}" against ` +
        `lock prohibiting "${prohibitedVerb}"`);
    }
  }

  // If intent is ALIGNED, the action is COMPLIANT — slash the score to near zero
  // Shared keywords are expected (both discuss the same subject) but the action
  // is doing the right thing.
  if (intentAligned) {
    score = Math.floor(score * 0.10);  // Keep only 10% of accumulated score
    // Skip all further bonuses (negation, intent conflict, destructive)
  } else {
    // NOT aligned — apply standard conflict bonuses

    // 7. Negation conflict bonus — requires subject match, not just verb-level matches
    if (lockIsProhibitive && hasSubjectMatch) {
      score += SCORING.negationConflict;
      reasons.push("lock prohibits this action (negation detected)");
    }

    // 8. Intent conflict bonus — requires subject match
    if (lockIsProhibitive && actionIntent.intent === "negative" && hasSubjectMatch) {
      score += SCORING.intentConflict;
      reasons.push(
        `intent conflict: action "${actionIntent.actionVerb}" ` +
        `conflicts with lock prohibition`);
    }

    // 9. Destructive action bonus — requires subject match
    const DESTRUCTIVE = new Set(["remove", "delete", "drop", "destroy",
      "kill", "purge", "wipe", "break", "disable", "truncate",
      "erase", "nuke", "obliterate"]);
    const actionIsDestructive = actionTokens.all.some(t => DESTRUCTIVE.has(t)) ||
      actionIntent.intent === "negative";
    if (actionIsDestructive && hasSubjectMatch) {
      score += SCORING.destructiveAction;
      reasons.push("destructive action against locked constraint");
    }

    // 10. Temporal evasion (BONUS, not reduction) — requires subject match
    if (hasTemporalMod && score > 0 && hasSubjectMatch) {
      score += SCORING.temporalEvasion;
      reasons.push(`temporal modifier "${hasTemporalMod}" does NOT reduce severity`);
    }
  }

  // Clamp and classify
  const confidence = Math.max(0, Math.min(score, 100));
  const isConflict = confidence >= SCORING.conflictThreshold;
  const level = confidence >= SCORING.highThreshold ? "HIGH"
    : confidence >= SCORING.mediumThreshold ? "MEDIUM" : "LOW";

  return { confidence, level, reasons, isConflict };
}

// ===================================================================
// MAIN ENTRY POINT
// ===================================================================

export function analyzeConflict(actionText, lockText) {
  const clauses = splitClauses(actionText);

  const clauseResults = clauses.map(clause => ({
    clause,
    ...scoreConflict({ actionText: clause, lockText })
  }));

  // Take MAX confidence across all clauses
  const maxResult = clauseResults.reduce((best, curr) =>
    curr.confidence > best.confidence ? curr : best,
    clauseResults[0]
  );

  // Merge reasons from all conflicting clauses
  const allReasons = [];
  for (const r of clauseResults) {
    if (r.isConflict) {
      if (clauses.length > 1) {
        allReasons.push(`[clause: "${r.clause.substring(0, 60)}"]`);
      }
      allReasons.push(...r.reasons);
    }
  }

  return {
    confidence: maxResult.confidence,
    level: maxResult.level,
    reasons: allReasons.length > 0 ? allReasons : maxResult.reasons,
    isConflict: maxResult.isConflict,
    clauseResults,
  };
}
