// ===================================================================
// SpecLock Semantic Analysis Engine v3
// Subject-aware conflict detection with scope matching.
// Zero external dependencies — pure JavaScript.
// ===================================================================

// ===================================================================
// SYNONYM GROUPS (75+ groups)
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
  ["move", "relocate", "migrate", "transfer", "shift", "rearrange", "reorganize",
   "transition"],
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
  ["postgresql", "postgres", "mysql", "mongodb", "mongo", "firebase",
   "firestore", "supabase", "dynamodb", "redis", "sqlite", "mariadb",
   "cockroachdb", "cassandra", "couchdb", "neo4j"],
  ["record", "row", "document", "entry", "item", "entity", "tuple"],
  ["column", "field", "attribute", "property", "key"],
  ["backup", "snapshot", "dump", "export"],

  // --- API & networking ---
  ["api", "endpoint", "route", "rest", "graphql", "rpc", "webhook",
   "interface", "service"],
  ["request", "call", "invoke", "query", "fetch"],
  ["response", "reply", "result", "output", "payload"],
  ["network", "connectivity", "connection", "socket", "websocket", "port", "protocol"],

  // --- Testing ---
  ["test", "testing", "spec", "coverage", "assertion", "unit test",
   "integration test", "e2e", "end-to-end"],

  // --- Deployment ---
  ["deploy", "deployment", "release", "ship", "publish",
   "production", "go live", "launch", "push to prod"],

  // --- Security & auth ---
  ["security", "auth", "authentication", "authorization", "login",
   "token", "credential", "permission", "access control", "rbac", "acl"],
  ["encrypt", "encryption", "cipher", "hash", "cryptographic",
   "tls", "ssl", "https"],
  ["certificate", "cert", "signing", "signature", "verification", "verify"],
  ["firewall", "waf", "rate limit", "throttle", "ip block",
   "deny list", "allow list"],
  ["mfa", "multi-factor authentication", "multi-factor", "2fa",
   "two-factor authentication", "two-factor"],
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
  ["salary", "salaries", "payroll", "wages", "compensation",
   "remuneration", "stipend"],
  ["payment gateway", "payment provider", "payment processor",
   "payment service", "payment platform"],
  ["razorpay", "stripe", "paypal", "phonepe", "paytm", "ccavenue",
   "cashfree", "braintree", "adyen", "square", "google pay", "gpay",
   "juspay", "billdesk", "instamojo"],

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
   "gdpr", "data protection", "ssn", "social security number",
   "social security", "email address", "email addresses",
   "phone number", "phone numbers", "date of birth", "dob",
   "passport number", "driver license", "national id"],

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

  // --- Logistics / Supply Chain ---
  ["shipment", "shipping", "consignment", "delivery", "dispatch",
   "freight", "cargo", "package", "parcel"],
  ["manifest", "bill of lading", "shipping document", "waybill",
   "consignment note", "packing list"],
  ["warehouse", "fulfillment center", "distribution center",
   "storage facility", "depot"],
  ["carrier", "shipping provider", "logistics provider",
   "transport company", "freight forwarder"],
  ["eta", "estimated arrival", "delivery time", "arrival time",
   "expected delivery"],
  ["customs", "customs clearance", "import", "export",
   "tariff", "duty", "declaration"],
  ["tracking number", "tracking id", "shipment tracking",
   "delivery tracking", "consignment tracking"],

  // --- Travel / Booking ---
  ["reservation", "booking", "appointment", "ticket",
   "confirmation", "itinerary"],
  ["passenger", "traveler", "guest", "visitor", "tourist"],
  ["passport", "passport data", "travel document",
   "identity document", "visa"],
  ["flight", "airline", "aviation", "air travel"],
  ["hotel", "accommodation", "lodging", "stay", "room"],

  // --- E-commerce ---
  ["checkout", "cart", "shopping cart", "basket",
   "purchase flow", "buy flow"],
  ["order", "purchase", "buy", "acquisition"],
  ["product", "item", "sku", "merchandise", "product listing", "catalog"],
  ["price", "pricing", "cost", "rate", "amount", "charge"],
  ["coupon", "discount", "promo", "promotion", "voucher", "deal"],
  ["inventory", "stock", "supply", "availability"],
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
  "disable":        ["bypass", "circumvent", "turn off", "deactivate"],
  "work around":    ["bypass", "circumvent"],
  "shortcut":       ["bypass", "skip"],

  // Migration/transition euphemisms
  "transition":     ["migrate", "switch", "change", "move", "replace"],
  "transition to":  ["migrate to", "switch to", "change to", "move to"],

  // Financial / accounting euphemisms
  "reconcile":      ["modify", "adjust", "change", "alter"],
  "reverse":        ["undo", "revert", "modify", "change"],
  "recalculate":    ["modify", "change", "update", "alter"],
  "backdate":       ["modify", "tamper", "falsify", "change"],
  "rebalance":      ["modify", "adjust", "change", "redistribute"],
  "reclassify":     ["modify", "change", "recategorize"],
  "redistribute":   ["modify", "change", "move", "reallocate"],
  "reallocate":     ["modify", "change", "move"],
  "write off":      ["delete", "remove", "eliminate"],
  "write down":     ["modify", "reduce", "change"],
  "void":           ["delete", "cancel", "remove", "nullify"],
  "post":           ["modify", "change", "write", "record"],
  "unpost":         ["revert", "undo", "modify", "delete"],
  "journal":        ["modify", "record", "change"],
  "accrue":         ["modify", "add", "change"],
  "amortize":       ["modify", "reduce", "change"],
  "depreciate":     ["modify", "reduce", "change"],

  // Logistics euphemisms
  "reroute":        ["modify", "change", "redirect"],
  "divert":         ["modify", "change", "redirect", "reroute"],
  "reassign":       ["modify", "change", "move", "transfer"],
  "remanifest":     ["modify", "change", "update"],
  "deconsolidate":  ["split", "separate", "modify"],

  // Travel / booking euphemisms
  "rebook":         ["modify", "change", "replace", "cancel"],
  "no-show":        ["cancel", "void", "remove"],
  "waitlist":       ["modify", "change", "queue"],

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

  // Security / data exposure euphemisms
  "make visible":   ["expose", "reveal", "public"],
  "make viewable":  ["expose", "reveal", "public"],
  "make accessible":["expose", "reveal", "public"],
  "make public":    ["expose", "reveal"],
  "transmit":       ["send", "transfer", "expose"],
  "export":         ["extract", "expose", "dump", "download"],
  "exfiltrate":     ["extract", "steal", "expose", "leak"],
  "scrape":         ["extract", "collect", "harvest"],
  "harvest":        ["collect", "extract", "scrape"],

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

  // Financial / Fintech
  "pci":               ["cardholder data", "payment data", "card data",
                        "pci dss", "payment security"],
  "cardholder data":   ["pci", "payment data", "card data", "credit card", "pan"],
  "payment data":      ["pci", "cardholder data", "card data", "transaction", "billing"],
  "trade":             ["executed trade", "trade record", "order", "position"],
  "executed trade":    ["trade", "trade record", "order"],
  "trade record":      ["trade", "executed trade", "transaction record"],
  "transaction":       ["payment", "transfer", "ledger entry", "posting",
                        "settlement", "billing", "charge", "balance"],
  "ledger":            ["transaction", "financial records", "accounting",
                        "general ledger", "journal", "balance sheet", "posting"],
  "balance":           ["account balance", "ledger", "transaction", "funds",
                        "financial records", "settlement"],
  "account":           ["balance", "ledger", "financial records", "customer account",
                        "account balance"],
  "credit card":       ["payment data", "cardholder data", "card data", "pci",
                        "card number", "pan"],
  "card number":       ["credit card", "cardholder data", "payment data", "pan"],
  "settlement":        ["transaction", "payment", "clearing", "reconciliation",
                        "transfer"],
  "fraud detection":   ["fraud", "fraud prevention", "anti-fraud", "fraud monitoring",
                        "suspicious activity", "transaction monitoring"],
  "fraud":             ["fraud detection", "fraud prevention", "suspicious activity",
                        "anti-fraud"],
  "posting":           ["transaction", "ledger entry", "journal entry", "record"],
  "reconciliation":    ["balance", "ledger", "account", "transaction", "audit"],
  "checkout":          ["cart", "purchase", "order"],
  "revenue":           ["payment", "billing", "income", "sales", "earnings",
                        "transaction"],
  "invoice":           ["billing", "payment", "charge", "transaction", "accounts receivable"],

  // Salary / Payroll / Compensation
  "salary":            ["payroll", "wages", "compensation", "financial records",
                        "accounting", "payment"],
  "payroll":           ["salary", "wages", "compensation", "financial records",
                        "accounting", "payment"],
  "wages":             ["salary", "payroll", "compensation", "financial records"],
  "compensation":      ["salary", "payroll", "wages", "financial records"],

  // Payment providers (brand names → payment gateway concept + cross-references)
  "razorpay":          ["payment gateway", "payment processing", "payment",
                        "transaction", "billing", "stripe", "paypal",
                        "phonepe", "paytm", "ccavenue", "cashfree"],
  "phonepe":           ["payment gateway", "payment processing", "payment",
                        "upi", "transaction", "razorpay", "paytm",
                        "stripe", "google pay"],
  "ccavenue":          ["payment gateway", "payment processing", "payment",
                        "transaction", "billing", "razorpay", "stripe",
                        "paypal", "cashfree"],
  "paytm":             ["payment gateway", "payment processing", "payment",
                        "upi", "transaction", "razorpay", "phonepe",
                        "stripe", "google pay"],
  "paypal":            ["payment gateway", "payment processing", "payment",
                        "transaction", "billing", "stripe", "razorpay",
                        "braintree", "adyen"],
  "stripe":            ["payment gateway", "payment processing", "payment",
                        "transaction", "billing", "razorpay", "paypal",
                        "braintree", "adyen", "square"],
  "square":            ["payment gateway", "payment processing", "payment",
                        "transaction", "billing", "stripe", "paypal"],
  "adyen":             ["payment gateway", "payment processing", "payment",
                        "transaction", "billing", "stripe", "paypal",
                        "braintree"],
  "braintree":         ["payment gateway", "payment processing", "payment",
                        "transaction", "billing", "stripe", "paypal",
                        "adyen"],
  "cashfree":          ["payment gateway", "payment processing", "payment",
                        "transaction", "billing", "razorpay", "stripe",
                        "ccavenue", "paytm"],
  "google pay":        ["payment gateway", "payment processing", "payment",
                        "upi", "transaction", "phonepe", "paytm",
                        "razorpay", "gpay"],
  "gpay":              ["payment gateway", "payment processing", "payment",
                        "upi", "transaction", "google pay", "phonepe",
                        "paytm", "razorpay"],
  "juspay":            ["payment gateway", "payment processing", "payment",
                        "transaction", "razorpay", "stripe", "cashfree"],
  "billdesk":          ["payment gateway", "payment processing", "payment",
                        "transaction", "billing", "razorpay", "ccavenue"],
  "instamojo":         ["payment gateway", "payment processing", "payment",
                        "transaction", "billing", "razorpay", "cashfree"],
  "upi":               ["payment gateway", "payment processing", "phonepe",
                        "paytm", "google pay", "razorpay",
                        "transaction", "payment"],

  // Logistics / Supply Chain
  "shipment":          ["cargo", "freight", "consignment", "delivery", "package",
                        "manifest", "tracking", "shipping"],
  "manifest":          ["shipment", "cargo", "freight", "bill of lading",
                        "shipping document", "consignment"],
  "cargo":             ["shipment", "freight", "manifest", "consignment", "goods"],
  "freight":           ["shipment", "cargo", "manifest", "logistics"],
  "delivery":          ["shipment", "shipping", "tracking", "eta", "transit"],
  "eta":               ["delivery time", "estimated arrival", "timestamp",
                        "delivery", "tracking", "schedule"],
  "warehouse":         ["inventory", "stock", "storage", "fulfillment"],
  "inventory":         ["warehouse", "stock", "supply", "goods"],
  "customs":           ["import", "export", "tariff", "duty", "clearance",
                        "border", "declaration"],
  "carrier":           ["shipping provider", "logistics provider", "trucker",
                        "transport", "shipping company"],
  "tracking":          ["shipment tracking", "delivery tracking", "status",
                        "location", "transit"],
  "bill of lading":    ["manifest", "shipping document", "consignment note"],

  // Travel / Booking
  "reservation":       ["booking", "appointment", "ticket", "confirmation",
                        "itinerary", "payment record"],
  "booking":           ["reservation", "appointment", "ticket", "itinerary",
                        "confirmation"],
  "passenger":         ["traveler", "guest", "customer", "pii", "personal data",
                        "user data", "passenger data"],
  "itinerary":         ["booking", "reservation", "travel plan", "route",
                        "schedule", "flight"],
  "passport":          ["pii", "personal data", "identity document", "travel document",
                        "passenger data"],
  "passport data":     ["pii", "personal data", "identity", "passenger",
                        "travel document"],
  "flight":            ["booking", "reservation", "itinerary", "travel"],
  "hotel":             ["booking", "reservation", "accommodation", "lodging"],
  "rate limiting":     ["throttle", "request limit", "api limit", "rate limit",
                        "quota", "access control"],

  // E-commerce
  "cart":              ["checkout", "purchase", "shopping cart"],
  "payment processing":["payment", "billing", "transaction",
                        "stripe", "payment gateway", "payment provider"],
  "payment gateway":   ["payment processing", "stripe", "paypal",
                        "billing", "transaction", "payment provider",
                        "payment processor"],
  "payment provider":  ["payment gateway", "payment processing", "payment",
                        "transaction", "billing"],
  "payment processor": ["payment gateway", "payment processing", "payment",
                        "transaction", "billing"],
  "payment service":   ["payment gateway", "payment processing", "payment",
                        "transaction", "billing"],
  "payment platform":  ["payment gateway", "payment processing", "payment",
                        "transaction", "billing"],
  "product":           ["item", "sku", "catalog", "merchandise", "product listing"],
  "price":             ["pricing", "cost", "amount", "rate", "charge"],

  // Database technologies (brand names → database concept)
  "postgresql":        ["database", "db", "sql", "postgres", "mysql",
                        "mongodb", "firebase", "supabase"],
  "postgres":          ["database", "db", "sql", "postgresql", "mysql",
                        "mongodb", "firebase", "supabase"],
  "mysql":             ["database", "db", "sql", "postgresql", "mongodb",
                        "firebase", "supabase", "mariadb"],
  "mongodb":           ["database", "db", "nosql", "mongo", "postgresql",
                        "firebase", "supabase", "dynamodb"],
  "mongo":             ["database", "db", "nosql", "mongodb", "postgresql",
                        "firebase", "supabase"],
  "firebase":          ["database", "db", "nosql", "firestore", "supabase",
                        "postgresql", "mongodb", "backend"],
  "firestore":         ["database", "db", "nosql", "firebase", "mongodb",
                        "supabase", "dynamodb"],
  "supabase":          ["database", "db", "postgresql", "firebase",
                        "mongodb", "backend", "auth"],
  "dynamodb":          ["database", "db", "nosql", "mongodb", "firebase",
                        "cassandra"],
  "redis":             ["database", "db", "cache", "nosql", "datastore"],
  "sqlite":            ["database", "db", "sql", "embedded database"],
  "mariadb":           ["database", "db", "sql", "mysql", "postgresql"],
  "cassandra":         ["database", "db", "nosql", "dynamodb", "mongodb"],

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

  // Safety systems
  "safety":            ["safety system", "safeguard", "interlock", "protection"],
  "safety system":     ["safety", "interlock", "safeguard", "protection", "fail-safe"],
  "safety systems":    ["safety", "interlock", "safeguard", "protection", "fail-safe"],
  "interlock":         ["safety", "safety system", "safeguard", "protection", "fail-safe"],
  "safeguard":         ["safety", "safety system", "interlock", "protection"],

  // Network
  "network segments":  ["vlans", "subnets", "network zones",
                        "network isolation", "segmentation"],
  "network isolation": ["network segments", "segmentation", "firewall", "air gap"],

  // User data / PII
  "pii":               ["personal data", "user data", "personally identifiable information",
                        "user information", "gdpr", "ssn", "social security",
                        "email address", "phone number"],
  "personal data":     ["pii", "user data", "user information", "gdpr", "data protection",
                        "ssn", "social security", "email address"],
  "gdpr":              ["data protection", "consent", "privacy", "personal data", "pii",
                        "data subject", "right to erasure", "user data"],
  "data protection":   ["gdpr", "privacy", "consent", "personal data", "pii",
                        "data subject", "compliance"],
  "consent":           ["gdpr", "data protection", "opt-in", "opt-out", "user consent",
                        "privacy", "data subject"],
  "user data":         ["pii", "personal data", "user information", "user records",
                        "ssn", "email address"],
  "ssn":               ["social security number", "social security", "pii",
                        "personal data", "user data", "national id"],
  "social security":   ["ssn", "social security number", "pii", "personal data"],
  "social security number": ["ssn", "social security", "pii", "personal data"],
  "email address":     ["pii", "user data", "personal data", "contact information"],
  "email addresses":   ["pii", "user data", "personal data", "email address"],
  "phone number":      ["pii", "user data", "personal data", "contact information"],

  // Encryption
  "cryptographic signatures": ["code signing", "digital signatures",
                               "signature verification", "certificate"],
  "code signing":      ["cryptographic signatures", "signature", "certificate", "verification"],

  // Ban records
  "ban records":       ["ban record", "banned users", "suspension records",
                        "blocked users", "moderation records"],

  // Approval / moderation concepts
  "approve":           ["moderation", "content review", "content moderation",
                        "review queue"],
  "batch approve":     ["bypass moderation", "skip review", "auto-approve",
                        "content moderation", "moderation"],
  "approval queue":    ["moderation", "review queue", "content review"],

  // Authentication/2FA
  "2fa":               ["two-factor", "two factor authentication", "mfa",
                        "multi-factor", "authentication", "auth"],
  "authentication":    ["auth", "login", "sign in", "2fa", "mfa",
                        "credential", "session", "token"],
  "auth":              ["authentication", "login", "sign in", "2fa",
                        "credential", "access control"],
  "mfa":               ["multi-factor authentication", "multi-factor", "2fa",
                        "two-factor", "authentication"],
  "multi-factor":      ["mfa", "2fa", "two-factor", "authentication",
                        "multi-factor authentication"],
  "sso":               ["saml", "oidc", "single sign-on", "oauth",
                        "authentication", "identity provider"],
  "saml":              ["sso", "oidc", "single sign-on", "authentication",
                        "identity provider"],

  // Networking
  "websocket":         ["socket", "real-time connection", "ws", "wss",
                        "socket connection"],
  "socket":            ["websocket", "connection", "real-time connection",
                        "socket connection"],

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
  "add", "create", "implement", "introduce", "set up", "build",
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
  const rawWords = lower
    .replace(/[^a-z0-9\-\/&]+/g, " ")
    .split(/\s+/)
    .filter(w => w.length >= 2);

  // Split slash-separated tokens into parts — "sso/saml" also adds "sso", "saml"
  for (const w of [...rawWords]) {
    if (w.includes('/')) {
      for (const part of w.split('/')) {
        if (part.length >= 2 && !rawWords.includes(part)) rawWords.push(part);
      }
    }
  }

  // Basic plural normalization — add both singular and plural forms
  // so "databases" matches "database" and vice versa
  const words = [...rawWords];
  for (const w of rawWords) {
    if (w.endsWith("ses") && w.length > 4) {
      // "databases" → "database"
      words.push(w.slice(0, -1));
    } else if (w.endsWith("ies") && w.length > 4) {
      // "entries" → "entry"
      words.push(w.slice(0, -3) + "y");
    } else if (w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us") && w.length > 3) {
      // "records" → "record", "logs" → "log"
      words.push(w.slice(0, -1));
    }
  }

  // Verb tense normalization — so "changed" matches "change",
  // "processed" matches "process", "modifying" matches "modify"
  for (const w of rawWords) {
    if (w.endsWith("ed") && w.length > 4) {
      words.push(w.slice(0, -1));  // "changed" → "change" (verb+d)
      words.push(w.slice(0, -2));  // "processed" → "process" (verb+ed)
      if (w.endsWith("ied") && w.length > 5) {
        words.push(w.slice(0, -3) + "y");  // "modified" → "modify"
      }
    }
    if (w.endsWith("ing") && w.length > 5) {
      words.push(w.slice(0, -3));         // "processing" → "process"
      words.push(w.slice(0, -3) + "e");   // "changing" → "change"
    }
  }
  const uniqueWords = [...new Set(words)];

  const all = [...new Set([...phrases, ...uniqueWords])];
  return { words: uniqueWords, phrases, all };
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
      let verb = match[1].trim();
      // Handle passive voice: "must not be changed" → "changed" → stem → "change"
      if (verb.startsWith("be ")) verb = verb.slice(3);
      // Check multi-word markers first
      const allMarkers = [...NEGATIVE_INTENT_MARKERS, ...POSITIVE_INTENT_MARKERS]
        .sort((a, b) => b.length - a.length);
      for (const marker of allMarkers) {
        if (verb.startsWith(marker)) return marker;
      }
      // Stem -ed/-ing verb forms: "changed" → "change", "modified" → "modify"
      const firstWord = verb.split(/\s+/)[0];
      if (firstWord.endsWith("ed") && firstWord.length > 4) {
        const stem1 = firstWord.slice(0, -1);  // changed → change
        const stem2 = firstWord.slice(0, -2);  // processed → process
        for (const marker of allMarkers) {
          if (stem1 === marker || stem2 === marker) return marker;
        }
        if (firstWord.endsWith("ied") && firstWord.length > 5) {
          const stem3 = firstWord.slice(0, -3) + "y";  // modified → modify
          for (const marker of allMarkers) {
            if (stem3 === marker) return marker;
          }
        }
      }
      if (firstWord.endsWith("ing") && firstWord.length > 5) {
        const stem1 = firstWord.slice(0, -3);       // processing → process
        const stem2 = firstWord.slice(0, -3) + "e"; // changing → change
        for (const marker of allMarkers) {
          if (stem1 === marker || stem2 === marker) return marker;
        }
      }
      return firstWord;
    }
  }
  return null;
}

// Neutral modification/replacement verbs — not inherently positive or negative,
// but important for extractPrimaryVerb to detect as action verbs.
const NEUTRAL_ACTION_VERBS = [
  "modify", "change", "alter", "reconfigure", "rework",
  "overhaul", "restructure", "refactor", "redesign",
  "replace", "swap", "switch", "migrate", "transition", "substitute",
  "touch", "mess", "configure", "optimize", "tweak",
  "extend", "shorten", "adjust", "customize", "personalize",
];

function extractPrimaryVerb(actionText) {
  const lower = actionText.toLowerCase();
  // Find first matching marker in text (includes neutral action verbs)
  const allMarkers = [...POSITIVE_INTENT_MARKERS, ...NEGATIVE_INTENT_MARKERS, ...NEUTRAL_ACTION_VERBS]
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
    || /\bno\s+\w/i.test(lockText)
    // Normalized lock patterns from lock-author.js rewriting
    || /\bis\s+frozen\b/i.test(lockText)
    || /\bmust\s+(remain|be\s+preserved|stay|always)\b/i.test(lockText);
}

// ===================================================================
// INLINE SUBJECT EXTRACTION (avoids circular dependency with lock-author.js)
// Extracts noun-phrase subjects from action/lock text for scope matching.
// ===================================================================

const _CONTAMINATING_VERBS = new Set([
  "add", "create", "introduce", "insert", "implement", "build", "make",
  "include", "put", "set", "use", "install", "deploy", "attach", "connect",
  "remove", "delete", "drop", "destroy", "kill", "purge", "wipe", "erase",
  "eliminate", "clear", "empty", "nuke",
  "change", "modify", "alter", "update", "mutate", "transform", "rewrite",
  "edit", "adjust", "tweak", "revise", "amend", "touch", "rework",
  "move", "migrate", "transfer", "shift", "relocate", "switch", "swap",
  "replace", "substitute", "exchange",
  "enable", "disable", "activate", "deactivate", "start", "stop",
  "turn", "pause", "suspend", "halt",
  "push", "pull", "send", "expose", "leak", "reveal", "show",
  "allow", "permit", "let", "give", "grant", "open",
  "bypass", "skip", "ignore", "circumvent",
  "refactor", "restructure", "simplify", "consolidate",
  "mess",
  "fix", "repair", "restore", "recover", "break", "revert", "rollback",
  "reconcile", "reverse", "recalculate", "backdate", "rebalance",
  "reroute", "divert", "reassign", "rebook", "cancel",
  "upgrade", "downgrade", "patch", "bump",
  "optimize", "streamline", "modernize", "overhaul", "revamp",
]);

const _FILLER_WORDS = new Set([
  // Articles & determiners
  "the", "a", "an", "any", "another", "other", "new", "additional",
  "more", "extra", "further", "existing", "current", "old", "all",
  "our", "their", "user", "users",
  // Prepositions
  "to", "of", "in", "on", "for", "from", "with", "by", "at", "up",
  "as", "into", "through", "between", "about", "before", "after",
  "without", "within", "during", "under", "over", "above", "below",
  // Conjunctions — CRITICAL: "and"/"or" must not create false bigram overlaps
  "and", "or", "nor", "but", "yet", "so",
  // Auxiliary/modal verbs — these are grammar, not subjects
  "is", "be", "are", "was", "were", "been", "being",
  "must", "never", "should", "shall", "can", "could", "would",
  "will", "may", "might", "do", "does", "did", "has", "have", "had",
  // Negation
  "not", "no", "none",
  // Common adverbs
  "just", "only", "also", "always", "every",
]);

const _PROHIBITION_PATTERNS = [
  /^never\s+/i, /^must\s+not\s+/i, /^do\s+not\s+/i, /^don'?t\s+/i,
  /^cannot\s+/i, /^can'?t\s+/i, /^should\s+not\s+/i, /^shouldn'?t\s+/i,
  /^no\s+(?:one\s+(?:should|may|can)\s+)?/i,
  /^(?:it\s+is\s+)?(?:forbidden|prohibited|not\s+allowed)\s+to\s+/i,
  /^avoid\s+/i, /^prevent\s+/i, /^refrain\s+from\s+/i, /^stop\s+/i,
];

// Generic words that are too vague to establish subject overlap on their own
const _GENERIC_SUBJECT_WORDS = new Set([
  "system", "service", "module", "component", "feature", "function",
  "method", "class", "model", "handler", "controller", "manager",
  "process", "workflow", "flow", "logic", "config", "configuration",
  "settings", "options", "parameters", "data", "information", "record",
  "records", "file", "files", "page", "section", "area", "zone",
  "layer", "level", "tier", "part", "piece", "item", "items",
  "thing", "stuff", "code", "app", "application", "project",
  // Rewritten lock qualifiers (from lock-author.js output)
  "frozen", "prohibited", "preserved", "active", "enabled",
  "disabled", "allowed", "introduced", "added", "modifications",
  "deletion", "removal", "migration", "replacement",
]);

// Check if a word is a verb form (past participle / gerund) of a contaminating verb.
// e.g., "exposed" → "expose", "logged" → "log", "modified" → "modif" → "modify"
function _isVerbForm(word) {
  // -ed suffix: "exposed" → "expos" → check "expose"; "logged" → "logg" → check "log"
  if (word.endsWith("ed")) {
    const stem1 = word.slice(0, -1);  // "exposed" → "expose"
    if (_CONTAMINATING_VERBS.has(stem1)) return true;
    const stem2 = word.slice(0, -2);  // "logged" → "logg" — nope
    if (_CONTAMINATING_VERBS.has(stem2)) return true;
    const stem3 = word.slice(0, -3);  // "logged" → "log" (double consonant)
    if (_CONTAMINATING_VERBS.has(stem3)) return true;
    // "modified" → "modifi" → "modify" (ied → y)
    if (word.endsWith("ied")) {
      const stem4 = word.slice(0, -3) + "y";  // "modified" → "modify"
      if (_CONTAMINATING_VERBS.has(stem4)) return true;
    }
  }
  // -ing suffix: "exposing" → "expos" → check "expose"; "logging" → "logg" → "log"
  if (word.endsWith("ing")) {
    const stem1 = word.slice(0, -3);  // "building" → "build"
    if (_CONTAMINATING_VERBS.has(stem1)) return true;
    const stem2 = word.slice(0, -3) + "e";  // "exposing" → "expose"
    if (_CONTAMINATING_VERBS.has(stem2)) return true;
    const stem3 = word.slice(0, -4);  // "logging" → "log" (double consonant)
    if (_CONTAMINATING_VERBS.has(stem3)) return true;
  }
  // -s suffix: "exposes" → "expose"
  if (word.endsWith("s") && !word.endsWith("ss")) {
    const stem1 = word.slice(0, -1);
    if (_CONTAMINATING_VERBS.has(stem1)) return true;
    // "pushes" → "push"
    if (word.endsWith("es")) {
      const stem2 = word.slice(0, -2);
      if (_CONTAMINATING_VERBS.has(stem2)) return true;
    }
  }
  return false;
}

function _extractSubjectsInline(text) {
  const lower = text.toLowerCase().trim();
  const subjects = [];

  // Strip prohibition prefix
  let content = lower;
  for (const pattern of _PROHIBITION_PATTERNS) {
    const match = content.match(pattern);
    if (match) {
      content = content.slice(match[0].length).trim();
      break;
    }
  }

  // Handle rewritten lock format — truncate at qualifier phrases
  // "Authentication system is frozen — no modifications allowed."
  // "Patient records must be preserved — deletion and removal are prohibited."
  // "Audit logging must remain active and enabled at all times."
  content = content.replace(/\s+is\s+frozen\b.*$/i, "").trim();
  content = content.replace(/\s+must\s+(?:be\s+)?(?:preserved|remain)\b.*$/i, "").trim();
  content = content.replace(/\s*[—–]\s+(?:prohibited|no\s+|must\s+not|deletion|do\s+not|migration)\b.*$/i, "").trim();

  // Strip leading verb
  const words = content.split(/\s+/);
  let startIdx = 0;
  for (let i = 0; i < Math.min(2, words.length); i++) {
    const w = words[i].replace(/[^a-z]/g, "");
    if (_CONTAMINATING_VERBS.has(w)) {
      startIdx = i + 1;
      break;
    }
  }

  // Skip fillers
  while (startIdx < words.length - 1) {
    const w = words[startIdx].replace(/[^a-z]/g, "");
    if (_FILLER_WORDS.has(w)) {
      startIdx++;
    } else {
      break;
    }
  }

  const subjectWords = words.slice(startIdx);
  if (subjectWords.length === 0) return subjects;

  // Full noun phrase
  const fullPhrase = subjectWords.join(" ").replace(/[^a-z0-9\s\-\/]/g, "").trim();
  if (fullPhrase.length > 1) subjects.push(fullPhrase);

  // Split on conjunctions
  const conjSplit = fullPhrase.split(/\s+(?:and|or|,)\s+/).map(s => s.trim()).filter(s => s.length > 1);
  if (conjSplit.length > 1) {
    for (const s of conjSplit) subjects.push(s);
  }

  // Individual significant words (excluding generic words)
  const significantWords = subjectWords
    .map(w => w.replace(/[^a-z0-9\-\/]/g, ""))
    .filter(w => w.length > 2 && !_FILLER_WORDS.has(w));

  for (const w of significantWords) {
    if (_GENERIC_SUBJECT_WORDS.has(w) || w.length <= 3) continue;
    if (_CONTAMINATING_VERBS.has(w)) continue;
    // Also skip past participles/gerunds of contaminating verbs
    // "exposed" → "expose", "logged" → "log", "modified" → "modify"
    if (_isVerbForm(w)) continue;
    subjects.push(w);
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

function _compareSubjectsInline(actionText, lockText) {
  const lockSubjects = _extractSubjectsInline(lockText);
  const actionSubjects = _extractSubjectsInline(actionText);

  if (lockSubjects.length === 0 || actionSubjects.length === 0) {
    return { overlaps: false, overlapScore: 0, matchedSubjects: [], lockSubjects, actionSubjects };
  }

  const matched = [];

  // Expand subjects through concept map for cross-domain matching.
  // IMPORTANT: Do NOT seed with originals — only concept-derived terms go here.
  // Including originals causes self-matches: if "device" is in both sides,
  // actionExpanded.has("device") fires for EVERY (ls, as) pair, creating
  // spurious "concept: dashboard ~ device" matches that inflate strongMatchCount.
  const lockExpanded = new Set();
  const actionExpanded = new Set();

  for (const ls of lockSubjects) {
    // Check concept map — if a lock subject maps to a concept that
    // contains an action subject (or vice versa), it's a scope match
    if (CONCEPT_MAP[ls]) {
      for (const related of CONCEPT_MAP[ls]) {
        lockExpanded.add(related);
      }
    }
    // Also check individual words within the subject
    for (const word of ls.split(/\s+/)) {
      if (CONCEPT_MAP[word]) {
        for (const related of CONCEPT_MAP[word]) {
          lockExpanded.add(related);
        }
      }
    }
  }

  for (const as of actionSubjects) {
    if (CONCEPT_MAP[as]) {
      for (const related of CONCEPT_MAP[as]) {
        actionExpanded.add(related);
      }
    }
    for (const word of as.split(/\s+/)) {
      if (CONCEPT_MAP[word]) {
        for (const related of CONCEPT_MAP[word]) {
          actionExpanded.add(related);
        }
      }
    }
  }

  let strongMatchCount = 0;  // multi-word phrase or containment matches

  for (const ls of lockSubjects) {
    for (const as of actionSubjects) {
      // Exact match
      if (ls === as) {
        matched.push(ls);
        // Multi-word exact = STRONG. Single word exact = WEAK (one shared entity word).
        if (ls.includes(" ")) strongMatchCount++;
        continue;
      }
      // Word-level containment — "patient records" is inside "old patient records archive"
      // Multi-word containment is always a STRONG match.
      const asRegex = new RegExp(`\\b${as.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
      const lsRegex = new RegExp(`\\b${ls.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
      if (asRegex.test(ls) || lsRegex.test(as)) {
        matched.push(`${as} ⊂ ${ls}`);
        // STRONG only if the contained phrase is multi-word (a compound concept inside a bigger one)
        // "patient records" ⊂ "old patient records" = STRONG (multi-word phrase match)
        // "device" ⊂ "device api" = WEAK (single word found in a bigram — just one shared word)
        if (as.includes(" ") && ls.includes(" ")) strongMatchCount++;
        continue;
      }
      // Synonym group match — same category items (e.g., Razorpay ↔ Stripe)
      // Always STRONG because being in the same synonym group means same domain scope.
      let isSynonym = false;
      for (const group of SYNONYM_GROUPS) {
        if (group.includes(as) && group.includes(ls)) {
          matched.push(`synonym: ${as} ↔ ${ls}`);
          strongMatchCount++;
          isSynonym = true;
          break;
        }
      }
      if (isSynonym) continue;

      // Concept-expanded match — only STRONG if BOTH sides are multi-word phrases
      // Single-word concept matches (account~ledger, device~iot) are too ambiguous
      // to be considered strong scope overlap.
      if (actionExpanded.has(ls) || lockExpanded.has(as)) {
        matched.push(`concept: ${as} ~ ${ls}`);
        if (as.includes(" ") && ls.includes(" ") && !_GENERIC_SUBJECT_WORDS.has(as) && !_GENERIC_SUBJECT_WORDS.has(ls)) {
          strongMatchCount++;
        }
        continue;
      }
      // Word-level overlap for multi-word subjects — skip generic words
      if (ls.includes(" ") && as.includes(" ")) {
        const lsWords = new Set(ls.split(/\s+/));
        const asWords = new Set(as.split(/\s+/));
        const intersection = [...lsWords].filter(w =>
          asWords.has(w) && w.length > 2 &&
          !_FILLER_WORDS.has(w) && !_CONTAMINATING_VERBS.has(w) &&
          !_GENERIC_SUBJECT_WORDS.has(w));
        if (intersection.length >= 2 && intersection.length >= Math.min(lsWords.size, asWords.size) * 0.4) {
          // 2+ shared words in a multi-word subject = STRONG
          matched.push(`word overlap: ${intersection.join(", ")}`);
          strongMatchCount++;
        } else if (intersection.length >= 1 && intersection.length >= Math.min(lsWords.size, asWords.size) * 0.4) {
          // 1 shared word in multi-word subjects = WEAK (different components of same entity)
          matched.push(`weak overlap: ${intersection.join(", ")}`);
        }
      }
    }
  }

  // Count unique single-word exact matches — 2+ different single words = STRONG
  const singleWordMatches = new Set(
    matched.filter(m => !m.includes(" ") && !m.includes("⊂") && !m.includes("~") && !m.includes(":"))
  );
  if (singleWordMatches.size >= 2) strongMatchCount++;

  const uniqueMatched = [...new Set(matched)];
  return {
    overlaps: uniqueMatched.length > 0,
    strongOverlap: strongMatchCount > 0,
    overlapScore: uniqueMatched.length > 0 ? Math.min(uniqueMatched.length / Math.max(lockSubjects.length, 1), 1.0) : 0,
    matchedSubjects: uniqueMatched,
    lockSubjects,
    actionSubjects,
  };
}

// --- Performance cache: avoid re-computing action-side analysis across multiple locks ---
const _actionCache = new Map();
const _ACTION_CACHE_MAX = 50;

function _getCachedAction(text) {
  const cached = _actionCache.get(text);
  if (cached) return cached;
  const tokens = tokenize(text);
  const expanded = expandSemantics(tokens.all);
  const intent = classifyIntent(text);
  const temporal = detectTemporalModifier(text);
  const entry = { tokens, expanded, intent, temporal };
  if (_actionCache.size >= _ACTION_CACHE_MAX) {
    _actionCache.delete(_actionCache.keys().next().value);
  }
  _actionCache.set(text, entry);
  return entry;
}

export function scoreConflict({ actionText, lockText }) {
  const actionCached = _getCachedAction(actionText);
  const actionTokens = actionCached.tokens;
  const actionExpanded = actionCached.expanded;
  const actionIntent = actionCached.intent;
  const hasTemporalMod = actionCached.temporal;

  const lockTokens = tokenize(lockText);
  const lockExpanded = expandSemantics(lockTokens.all);
  const lockIntent = classifyIntent(lockText);
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

  // 4b. Split-phrase euphemisms — "make X public", "make X visible", etc.
  // These have intervening words between the verb and the key modifier.
  const SPLIT_PHRASE_PATTERNS = [
    [/\bmake\s+\w+\s+public\b/i, "expose", "make ... public"],
    [/\bmake\s+\w+\s+visible\b/i, "expose", "make ... visible"],
    [/\bmake\s+\w+\s+accessible\b/i, "expose", "make ... accessible"],
    [/\bmake\s+\w+\s+(?:data\s+)?public\b/i, "expose", "make ... public"],
  ];
  for (const [pattern, meaning, label] of SPLIT_PHRASE_PATTERNS) {
    if (pattern.test(actionText) && lockExpanded.expanded.includes(meaning)) {
      euphemismMatches.push(`"${label}" (euphemism for ${meaning})`);
    }
  }

  // 4c. Destructive method verbs — "by replacing", "through overwriting", "via deleting"
  // When an action uses a positive primary verb but employs a destructive method,
  // the method verb is the real operation. "Optimize X by replacing Y" = replacement.
  const DESTRUCTIVE_METHODS = new Set([
    "replace", "remove", "delete", "destroy", "rewrite", "overwrite",
    "restructure", "reconfigure", "migrate", "swap", "switch",
    "override", "bypass", "eliminate", "strip", "gut", "scrap",
    "discard", "drop", "disable", "break", "wipe", "erase",
  ]);
  const methodVerbMatch = actionText.toLowerCase().match(
    /\b(?:by|through|via)\s+(\w+ing)\b/i);
  if (methodVerbMatch) {
    const gerund = methodVerbMatch[1];
    const stem1 = gerund.slice(0, -3);        // "switching" → "switch"
    const stem2 = gerund.slice(0, -3) + "e";  // "replacing" → "replace"
    const stem3 = gerund.slice(0, -4);        // "dropping" → "drop"
    for (const verb of DESTRUCTIVE_METHODS) {
      if (verb === stem1 || verb === stem2 || verb === stem3) {
        euphemismMatches.push(`"${gerund}" (destructive method: ${verb})`);
        break;
      }
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

  // 6. SUBJECT RELEVANCE GATE (v3 — scope-aware)
  // The core innovation: extract noun-phrase subjects from BOTH the lock
  // and the action, then check if they target the same component.
  //
  // "Update WhatsApp message formatting" vs "Never modify WhatsApp session handler"
  //   → Lock subject: "whatsapp session handler"
  //   → Action subject: "whatsapp message formatting"
  //   → Subjects DON'T match (different components) → reduce score
  //
  // "Delete patient records" vs "Never delete patient records"
  //   → Lock subject: "patient records"
  //   → Action subject: "patient records"
  //   → Subjects MATCH → keep score
  //
  // This replaces the old verb-only check with proper scope awareness.

  const ACTION_VERBS_SET = new Set([
    // Modification verbs
    "modify", "change", "alter", "update", "mutate", "transform", "rewrite",
    "revise", "amend", "adjust", "tweak", "tune", "rework", "overhaul",
    // Destructive verbs
    "delete", "remove", "drop", "kill", "destroy", "purge", "wipe", "erase",
    "eliminate", "obliterate", "expunge", "nuke", "truncate", "clear", "empty",
    "flush", "reset", "void",
    // Creation verbs
    "add", "create", "introduce", "insert", "generate", "produce", "spawn",
    // Toggle verbs
    "disable", "enable", "activate", "deactivate", "start", "stop", "halt",
    "pause", "suspend", "freeze",
    // Replacement verbs
    "replace", "swap", "substitute", "switch", "exchange", "override", "overwrite",
    // Movement verbs
    "move", "relocate", "migrate", "transfer", "shift", "rearrange", "reorganize",
    "merge", "split", "separate", "partition", "divide", "fork",
    // Installation verbs
    "install", "uninstall", "deploy", "connect", "disconnect", "detach",
    // Structural verbs
    "refactor", "restructure", "simplify", "reduce", "consolidate",
    "clean", "normalize", "flatten",
    // Recovery verbs
    "fix", "repair", "restore", "recover", "break", "revert", "rollback",
    // Visibility verbs
    "expose", "hide", "reveal", "leak",
    // Bypass verbs
    "bypass", "skip", "ignore", "circumvent",
    // Financial verbs
    "reconcile", "reverse", "recalculate", "backdate", "rebalance",
    "post", "unpost", "accrue", "amortize", "depreciate", "journal",
    // Logistics verbs
    "reroute", "divert", "reassign", "deconsolidate",
    // Booking verbs
    "rebook", "cancel",
    // Upgrade/downgrade
    "upgrade", "downgrade", "patch", "bump", "advance",
  ]);

  // Check if any synonym/concept match involves a non-verb term (= subject match)
  const hasSynonymSubjectMatch = synonymMatches.some(m => {
    const parts = m.split(" → ");
    const expansion = (parts[1] || "").trim();
    return !ACTION_VERBS_SET.has(expansion);
  });

  // OLD check (vocabulary overlap) — kept as one input
  const hasVocabSubjectMatch = directOverlap.length > 0 || phraseOverlap.length > 0 ||
    conceptMatches.length > 0 || hasSynonymSubjectMatch;

  // NEW check (scope-aware subject extraction)
  // Extract actual noun-phrase subjects and compare scopes
  const subjectComparison = _compareSubjectsInline(actionText, lockText);
  const hasScopeMatch = subjectComparison.overlaps;
  // strongOverlap = multi-word phrase match, containment, or 2+ individual word matches
  // Single-word overlaps like "product" alone are WEAK — different components of same entity
  const hasStrongScopeMatch = subjectComparison.strongOverlap;

  // Combined subject match: EITHER vocabulary overlap on non-verbs
  // OR proper subject/scope overlap
  const hasSubjectMatch = hasVocabSubjectMatch || hasScopeMatch;
  const hasAnyMatch = hasSubjectMatch || synonymMatches.length > 0 ||
    euphemismMatches.length > 0;

  // A "strong" vocabulary match means 2+ direct keyword overlap or a multi-word
  // phrase match. A single shared word + synonym/concept expansion = WEAK.
  // Synonym expansion inflates score ("device" → "iot, sensor, actuator") but
  // doesn't prove scope overlap — the action could be about a different "device".
  const hasStrongVocabMatch = directOverlap.length >= 2 || phraseOverlap.length > 0;

  // Apply the subject relevance gate based on match quality
  if (!hasSubjectMatch && (synonymMatches.length > 0 || euphemismMatches.length > 0)) {
    // Exception: if the action's euphemism DIRECTLY matches the lock's prohibited
    // verb AND there's at least some shared content word, skip the subject gate.
    // "Make the data public" euphemism = "expose", lock = "Never expose user data"
    // → euphemism proves the conflict + "data" provides content overlap.
    // But "Tax statement export" vs "Never expose portfolio positions" has no
    // content overlap — gate should still fire to prevent false positive.
    // Note: we check raw word overlap (ignoring stopwords filter) because common
    // words like "data" are stopwords but still provide content signal.
    const _prohibVerb = extractProhibitedVerb(lockText);
    const _GATE_SKIP_STOPWORDS = new Set([
      "a", "an", "the", "this", "that", "it", "its", "our", "their",
      "your", "my", "his", "her", "we", "they", "them", "i",
      "to", "of", "in", "on", "at", "by", "up", "as", "or", "and",
      "nor", "but", "so", "if", "no", "not", "is", "be", "do", "did",
      "with", "from", "for", "into", "over", "under", "between", "through",
      "about", "before", "after", "during", "while",
      "are", "was", "were", "been", "being", "have", "has", "had",
      "will", "would", "could", "should", "may", "might", "shall",
      "can", "need", "must", "does", "done",
      "all", "any", "every", "some", "most", "other", "each", "both",
      "few", "more", "less", "many", "much",
      "also", "just", "very", "too", "really", "quite", "only", "then",
      "now", "here", "there", "when", "where", "how", "what", "which",
      "who", "whom", "why",
      // Common verbs/adjectives (but NOT nouns like "data", "system")
      "way", "thing", "things", "part", "set", "use",
      "using", "used", "make", "made", "new", "get", "got",
    ]);
    const rawWordOverlap = actionTokens.words.some(w =>
      lockTokens.words.includes(w) && !_GATE_SKIP_STOPWORDS.has(w));
    const euphemismMatchesProhibitedVerb = _prohibVerb &&
      rawWordOverlap &&
      euphemismMatches.some(m => m.includes(`euphemism for ${_prohibVerb}`));

    if (!euphemismMatchesProhibitedVerb) {
      // NO subject match at all — verb-only match → heavy reduction
      score = Math.floor(score * 0.15);
      reasons.push("subject gate: no subject overlap — verb-only match, likely false positive");
    }
  } else if (hasVocabSubjectMatch && !hasScopeMatch && subjectComparison.lockSubjects.length > 0 && subjectComparison.actionSubjects.length > 0) {
    // Vocabulary overlap exists but subjects point to DIFFERENT scopes
    score = Math.floor(score * 0.35);
    reasons.push(`scope gate: shared vocabulary but different scope — lock targets "${subjectComparison.lockSubjects[0]}", action targets "${subjectComparison.actionSubjects[0]}"`);
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
    // Only block alignment if the action actually performs the prohibited operation.
    // Noun synonyms ("price → pricing") are incidental and should NOT block.
    // But if the action contains the prohibited verb or its synonym ("shows" ≈ "expose"),
    // that's a real violation signal.
    const hasDestructiveLanguageMatch = euphemismMatches.length > 0;

    // Check if action text contains the prohibited verb or its synonyms
    let actionPerformsProhibitedOp = false;
    if (prohibitedVerb) {
      const actionWordsLower = actionText.toLowerCase().split(/\s+/)
        .map(w => w.replace(/[^a-z]/g, ""));
      for (const w of actionWordsLower) {
        if (!w) continue;
        // Direct match (including conjugations: show/shows/showing/showed)
        if (w === prohibitedVerb || w.startsWith(prohibitedVerb)) {
          actionPerformsProhibitedOp = true;
          break;
        }
        // Synonym match: check if word is in the same synonym group as prohibited verb
        for (const group of SYNONYM_GROUPS) {
          if (group.includes(prohibitedVerb)) {
            if (group.some(syn => w === syn || w.startsWith(syn) && w.length <= syn.length + 3)) {
              actionPerformsProhibitedOp = true;
            }
            break;
          }
        }
        if (actionPerformsProhibitedOp) break;
      }
    }

    if (prohibitedIsNegative && !actionIntent.negated &&
        !hasDestructiveLanguageMatch && !actionPerformsProhibitedOp) {
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

    // OBSERVABILITY ACTIONS: "add logging", "add monitoring", "add tracking"
    // are constructive observability actions, NOT modifications to the locked system.
    // If the action verb is "add/create/implement" AND the object is an
    // observability concept, treat it as safe.
    const OBSERVABILITY_KEYWORDS = new Set([
      "logging", "log", "logs", "monitoring", "monitor", "tracking",
      "tracing", "trace", "metrics", "alerting", "alerts", "alert",
      "observability", "telemetry", "analytics", "reporting", "auditing",
      "profiling", "instrumentation", "dashboard",
    ]);
    const actionLower = actionText.toLowerCase();
    const actionWords = actionLower.split(/\s+/);
    const hasObservabilityObject = actionWords.some(w => OBSERVABILITY_KEYWORDS.has(w));
    const CONSTRUCTIVE_VERBS = new Set(["add", "create", "implement", "introduce", "set up", "enable"]);
    if (CONSTRUCTIVE_VERBS.has(actionPrimaryVerb) && hasObservabilityObject) {
      intentAligned = true;
      reasons.push(
        `intent alignment: observability action "${actionPrimaryVerb} ... ${actionWords.find(w => OBSERVABILITY_KEYWORDS.has(w))}" is non-destructive`);
    }

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

  // Check 4: Enhancement/constructive actions against preservation/maintenance locks
  // "Increase the rate limit" is COMPLIANT with "rate limiting must remain active"
  // "Add better rate limit error messages" is COMPLIANT (doesn't disable rate limiting)
  // But "Add a way to bypass rate limiting" is NOT safe (contains negative op "bypass")
  if (!intentAligned && actionPrimaryVerb) {
    const ENHANCEMENT_VERBS = new Set([
      "increase", "improve", "enhance", "boost", "strengthen",
      "upgrade", "raise", "expand", "extend", "grow",
    ]);
    const CONSTRUCTIVE_FOR_PRESERVATION = new Set([
      "build", "add", "create", "implement", "make", "design",
      "develop", "introduce",
    ]);
    const lockIsPreservation = /must remain|must be preserved|must always|at all times|must stay/i.test(lockText);
    if (lockIsPreservation) {
      if (ENHANCEMENT_VERBS.has(actionPrimaryVerb)) {
        // Enhancement verbs always align with preservation locks
        intentAligned = true;
        reasons.push(
          `intent alignment: enhancement action "${actionPrimaryVerb}" is ` +
          `compliant with preservation lock`);
      } else if (CONSTRUCTIVE_FOR_PRESERVATION.has(actionPrimaryVerb)) {
        // Constructive verbs align ONLY if the action doesn't contain negative ops
        const actionLower = actionText.toLowerCase();
        const hasNegativeOp = NEGATIVE_INTENT_MARKERS.some(m =>
          new RegExp(`\\b${escapeRegex(m)}\\b`, "i").test(actionLower));
        if (!hasNegativeOp) {
          intentAligned = true;
          reasons.push(
            `intent alignment: constructive "${actionPrimaryVerb}" is ` +
            `compliant with preservation lock (no negative operations)`);
        }
      }
    }
  }

  // Check 5: Constructive actions with weak/no scope overlap
  // "Build a device dashboard" shares "device" with "Device API keys" lock,
  // but building a dashboard doesn't modify API key handling.
  {
    const FEATURE_BUILDING_VERBS = new Set([
      "build", "add", "create", "implement", "make", "design",
      "develop", "introduce", "setup", "establish", "launch",
      "integrate", "include", "support",
    ]);
    // 5a: Weak scope overlap (single shared word, no strong vocab match)
    if (!intentAligned && hasScopeMatch && !hasStrongScopeMatch && !hasStrongVocabMatch) {
      if (FEATURE_BUILDING_VERBS.has(actionPrimaryVerb)) {
        // Guard: if the shared word is a long, specific entity name (10+ chars),
        // it strongly identifies the target system — not an incidental overlap.
        // "authentication" (14 chars) clearly points to the auth system.
        // "product" (7 chars) or "device" (6 chars) are generic modifiers.
        const hasSpecificOverlap = directOverlap.some(w => w.length >= 10);
        if (!hasSpecificOverlap) {
          intentAligned = true;
          reasons.push(
            `intent alignment: constructive "${actionPrimaryVerb}" with ` +
            `weak scope overlap — new feature, not modification of locked component`);
        }
      }
    }
    // 5b: Vocab overlap but NO scope overlap (subjects point to different things)
    // Even weaker signal — shared vocabulary but different actual components.
    if (!intentAligned && hasVocabSubjectMatch && !hasScopeMatch &&
        subjectComparison.lockSubjects.length > 0 && subjectComparison.actionSubjects.length > 0) {
      if (FEATURE_BUILDING_VERBS.has(actionPrimaryVerb)) {
        intentAligned = true;
        reasons.push(
          `intent alignment: constructive "${actionPrimaryVerb}" with ` +
          `no scope overlap — different components despite shared vocabulary`);
      }
    }

    // 5c: UI/cosmetic changes that share a location word with a system lock.
    // "Change the font on the login page" shares "login" with auth locks,
    // but changing a font/color/style is a visual change, not a system modification.
    // Only applies when scope overlap is WEAK (shared location word, not shared target).
    const UI_COSMETIC_WORDS = new Set([
      "font", "fonts", "color", "colors", "colour", "theme", "themes",
      "styling", "style", "styles", "css", "icon", "icons", "layout",
      "margin", "padding", "border", "background", "typography", "spacing",
      "alignment", "animation", "hover", "tooltip",
      "placeholder", "logo", "banner", "hero", "avatar",
      "sidebar", "navigation", "menu", "breadcrumb", "footer",
    ]);
    if (!intentAligned && !hasStrongVocabMatch) {
      const actionLower = actionText.toLowerCase();
      const actionWords = actionLower.split(/\s+/).map(w => w.replace(/[^a-z]/g, ""));
      const hasUISubject = actionWords.some(w => UI_COSMETIC_WORDS.has(w));
      if (hasUISubject) {
        intentAligned = true;
        reasons.push(
          `intent alignment: UI/cosmetic change — visual modification, ` +
          `not system logic change`);
      }
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

    // 7. Negation conflict bonus — requires STRONG subject match
    //    Either: scope overlap (subject extraction confirms same target)
    //    Or: 2+ direct word overlaps (not just a single shared word)
    //    Or: phrase overlap (multi-word match is strong signal)
    const hasStrongSubjectMatch = hasStrongScopeMatch ||
      directOverlap.length >= 2 ||
      phraseOverlap.length > 0;
    if (lockIsProhibitive && hasStrongSubjectMatch) {
      score += SCORING.negationConflict;
      reasons.push("lock prohibits this action (negation detected)");
    }

    // 8. Intent conflict bonus — requires strong subject match
    if (lockIsProhibitive && actionIntent.intent === "negative" && hasStrongSubjectMatch) {
      score += SCORING.intentConflict;
      reasons.push(
        `intent conflict: action "${actionIntent.actionVerb}" ` +
        `conflicts with lock prohibition`);
    }

    // 9. Destructive action bonus — requires strong subject match
    const DESTRUCTIVE = new Set(["remove", "delete", "drop", "destroy",
      "kill", "purge", "wipe", "break", "disable", "truncate",
      "erase", "nuke", "obliterate"]);
    const actionIsDestructive = actionTokens.all.some(t => DESTRUCTIVE.has(t)) ||
      actionIntent.intent === "negative";
    if (actionIsDestructive && hasStrongSubjectMatch) {
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

// Question framing prefixes that should be stripped before analysis.
// "Should we add Razorpay?" → "add Razorpay"
// "What if we used Firebase?" → "used Firebase"
const QUESTION_PREFIXES = [
  /^would\s+it\s+make\s+sense\s+to\s+/i,
  /^would\s+it\s+be\s+(?:better|good|wise|smart|possible)\s+(?:to|if)\s+(?:we\s+)?/i,
  /^what\s+if\s+we\s+(?:could\s+)?/i,
  /^what\s+about\s+/i,
  /^how\s+about\s+(?:we\s+)?/i,
  /^should\s+we\s+(?:consider\s+)?/i,
  /^could\s+we\s+(?:possibly\s+)?/i,
  /^can\s+we\s+/i,
  /^i\s+was\s+wondering\s+if\s+(?:we\s+)?(?:could\s+)?/i,
  /^maybe\s+we\s+(?:should\s+)?(?:consider\s+)?/i,
  /^perhaps\s+we\s+(?:should\s+)?(?:consider\s+)?/i,
  /^wouldn't\s+it\s+be\s+(?:better|good)\s+(?:to|if)\s+(?:we\s+)?/i,
  /^is\s+(?:it\s+)?(?:a\s+)?(?:good\s+idea\s+)?(?:to\s+)?/i,
  /^let\s+me\s+/i,
  /^we\s+should\s+(?:probably\s+)?(?:consider\s+)?(?:look\s+at\s+)?/i,
  /^explore\s+(?:using\s+)?/i,
];

// Special transformations where simple prefix stripping loses the subject.
// "Would Firebase be better for real-time sync?" → "switch to Firebase for real-time sync"
const QUESTION_TRANSFORMS = [
  [/^would\s+(.+?)\s+be\s+(?:a\s+)?better\s+(?:option\s+)?(?:for|than)\s+(.+)/i, "switch to $1 for $2"],
  [/^is\s+(.+?)\s+(?:a\s+)?better\s+(?:option|choice|alternative)\s+(?:for|than)\s+(.+)/i, "switch to $1 for $2"],
  [/^wouldn't\s+(.+?)\s+be\s+(?:a\s+)?better\s+(?:option|choice)?\s*(?:for|than)?\s*(.+)?/i, "switch to $1 $2"],
];

function stripQuestionFraming(text) {
  let stripped = text;

  // Try special transformations first (they preserve the subject)
  for (const [pattern, replacement] of QUESTION_TRANSFORMS) {
    if (pattern.test(stripped)) {
      stripped = stripped.replace(pattern, replacement).trim();
      stripped = stripped.replace(/\?\s*$/, "").trim();
      return stripped || text;
    }
  }

  // Then try simple prefix stripping
  for (const pattern of QUESTION_PREFIXES) {
    stripped = stripped.replace(pattern, "");
  }
  // Also remove trailing question marks
  stripped = stripped.replace(/\?\s*$/, "").trim();
  return stripped || text; // fallback to original if everything was stripped
}

export function analyzeConflict(actionText, lockText) {
  // Strip question framing so "Should we add Razorpay?" → "add Razorpay"
  actionText = stripQuestionFraming(actionText);
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
