// ===================================================================
// SpecLock Diff Parser — Unified Diff → Structured Changes
// Parses git unified diff format into actionable change objects.
// Foundation for diff-native patch review.
//
// Developed by Sandeep Roy (https://github.com/sgroy10)
// ===================================================================

// --- Import/export detection regexes ---

// JS/TS imports
const JS_IMPORT_FROM = /(?:import|export)\s+(?:[\s\S]*?)\s+from\s+["']([^"']+)["']/;
const JS_REQUIRE = /(?:const|let|var)\s+.*?=\s*require\s*\(\s*["']([^"']+)["']\s*\)/;
const JS_DYNAMIC_IMPORT = /import\s*\(\s*["']([^"']+)["']\s*\)/;
const JS_IMPORT_PLAIN = /^import\s+["']([^"']+)["']/;

// Python imports
const PY_IMPORT = /^import\s+([\w.]+)/;
const PY_FROM_IMPORT = /^from\s+([\w.]+)\s+import/;

// JS/TS exports
const JS_EXPORT_FUNCTION = /export\s+(?:async\s+)?function\s+(\w+)/;
const JS_EXPORT_CONST = /export\s+(?:const|let|var)\s+(\w+)/;
const JS_EXPORT_CLASS = /export\s+(?:default\s+)?class\s+(\w+)/;
const JS_EXPORT_DEFAULT = /export\s+default\s+(?:function\s+)?(\w+)?/;
const JS_NAMED_EXPORT = /export\s*\{([^}]+)\}/;

// Function/class definitions (for symbol detection)
const JS_FUNCTION_DEF = /(?:async\s+)?function\s+(\w+)\s*\(/;
const JS_ARROW_DEF = /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(?/;
const JS_CLASS_METHOD = /(?:async\s+)?(\w+)\s*\([^)]*\)\s*\{/;
const PY_FUNCTION_DEF = /^def\s+(\w+)\s*\(/;
const PY_CLASS_DEF = /^class\s+(\w+)/;

// Route patterns
const EXPRESS_ROUTE = /(?:app|router)\s*\.\s*(get|post|put|patch|delete|all)\s*\(\s*["']([^"']+)["']/;
const FASTAPI_ROUTE = /@(?:app|router)\s*\.\s*(get|post|put|patch|delete)\s*\(\s*["']([^"']+)["']/;

// Schema/migration patterns
const SCHEMA_FILE_PATTERNS = [
  /migration/i, /schema/i, /model/i, /prisma/i, /\.sql$/i,
  /knexfile/i, /sequelize/i, /typeorm/i, /drizzle/i,
];

/**
 * Parse a unified diff string into structured file changes.
 *
 * @param {string} diffText - Raw unified diff (git diff output)
 * @returns {object} Parsed diff with structured changes per file
 */
export function parseDiff(diffText) {
  if (!diffText || typeof diffText !== "string") {
    return { files: [], stats: { filesChanged: 0, additions: 0, deletions: 0, hunks: 0 } };
  }

  const files = [];
  let totalAdditions = 0;
  let totalDeletions = 0;
  let totalHunks = 0;

  // Split into file diffs
  const fileDiffs = diffText.split(/^diff --git /m).filter(Boolean);

  for (const fileDiff of fileDiffs) {
    const parsed = parseFileDiff(fileDiff);
    if (parsed) {
      files.push(parsed);
      totalAdditions += parsed.additions;
      totalDeletions += parsed.deletions;
      totalHunks += parsed.hunks.length;
    }
  }

  return {
    files,
    stats: {
      filesChanged: files.length,
      additions: totalAdditions,
      deletions: totalDeletions,
      hunks: totalHunks,
    },
  };
}

/**
 * Parse a single file's diff section.
 */
function parseFileDiff(fileDiffText) {
  // Extract file path
  const pathMatch = fileDiffText.match(/a\/(.+?)\s+b\/(.+?)(?:\n|$)/);
  if (!pathMatch) return null;

  const filePath = pathMatch[2];
  const language = detectLanguage(filePath);

  // Parse hunks
  const hunks = [];
  const hunkRegex = /^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@(.*)?$/gm;
  let match;

  while ((match = hunkRegex.exec(fileDiffText)) !== null) {
    const hunkStart = match.index;
    const nextHunk = fileDiffText.indexOf("\n@@", hunkStart + 1);
    const hunkEnd = nextHunk === -1 ? fileDiffText.length : nextHunk;
    const hunkBody = fileDiffText.substring(hunkStart, hunkEnd);

    const lines = hunkBody.split("\n").slice(1); // skip @@ header
    const addedLines = [];
    const removedLines = [];

    for (const line of lines) {
      if (line.startsWith("+") && !line.startsWith("+++")) {
        addedLines.push(line.substring(1));
      } else if (line.startsWith("-") && !line.startsWith("---")) {
        removedLines.push(line.substring(1));
      }
    }

    hunks.push({
      oldStart: parseInt(match[1], 10),
      oldCount: parseInt(match[2] || "1", 10),
      newStart: parseInt(match[3], 10),
      newCount: parseInt(match[4] || "1", 10),
      context: (match[5] || "").trim(),
      addedLines,
      removedLines,
    });
  }

  // Count additions/deletions
  let additions = 0;
  let deletions = 0;
  for (const hunk of hunks) {
    additions += hunk.addedLines.length;
    deletions += hunk.removedLines.length;
  }

  // Detect import changes
  const importsAdded = [];
  const importsRemoved = [];
  for (const hunk of hunks) {
    for (const line of hunk.addedLines) {
      const imp = extractImport(line.trim(), language);
      if (imp && !importsAdded.includes(imp)) importsAdded.push(imp);
    }
    for (const line of hunk.removedLines) {
      const imp = extractImport(line.trim(), language);
      if (imp && !importsRemoved.includes(imp)) importsRemoved.push(imp);
    }
  }

  // Detect export changes
  const exportsAdded = [];
  const exportsRemoved = [];
  const exportsModified = [];
  for (const hunk of hunks) {
    for (const line of hunk.addedLines) {
      const exp = extractExport(line.trim(), language);
      if (exp) {
        // Check if this export was in removed lines (modified) or truly new
        const wasRemoved = hunk.removedLines.some(rl => {
          const re = extractExport(rl.trim(), language);
          return re && re.symbol === exp.symbol;
        });
        if (wasRemoved) {
          if (!exportsModified.find(e => e.symbol === exp.symbol)) {
            exportsModified.push({ ...exp, changeType: "signature_changed" });
          }
        } else {
          if (!exportsAdded.find(e => e.symbol === exp.symbol)) {
            exportsAdded.push(exp);
          }
        }
      }
    }
    for (const line of hunk.removedLines) {
      const exp = extractExport(line.trim(), language);
      if (exp) {
        const wasAdded = hunk.addedLines.some(al => {
          const ae = extractExport(al.trim(), language);
          return ae && ae.symbol === exp.symbol;
        });
        if (!wasAdded) {
          if (!exportsRemoved.find(e => e.symbol === exp.symbol)) {
            exportsRemoved.push({ ...exp, changeType: "removed" });
          }
        }
      }
    }
  }

  // Detect symbols touched (functions/classes modified)
  const symbolsTouched = [];
  for (const hunk of hunks) {
    // Context line from @@ header often shows the function scope
    if (hunk.context) {
      const sym = extractSymbol(hunk.context, language);
      if (sym && !symbolsTouched.find(s => s.symbol === sym.symbol)) {
        symbolsTouched.push({ ...sym, changeType: "body_modified" });
      }
    }
    // Also check removed/added lines for function definitions
    for (const line of [...hunk.removedLines, ...hunk.addedLines]) {
      const sym = extractSymbol(line.trim(), language);
      if (sym && !symbolsTouched.find(s => s.symbol === sym.symbol)) {
        symbolsTouched.push({ ...sym, changeType: "definition_changed" });
      }
    }
  }

  // Detect route changes
  const routeChanges = [];
  for (const hunk of hunks) {
    for (const line of hunk.addedLines) {
      const route = extractRoute(line.trim());
      if (route) {
        const wasRemoved = hunk.removedLines.some(rl => extractRoute(rl.trim())?.path === route.path);
        routeChanges.push({ ...route, changeType: wasRemoved ? "modified" : "added" });
      }
    }
    for (const line of hunk.removedLines) {
      const route = extractRoute(line.trim());
      if (route) {
        const wasAdded = hunk.addedLines.some(al => extractRoute(al.trim())?.path === route.path);
        if (!wasAdded) routeChanges.push({ ...route, changeType: "removed" });
      }
    }
  }

  // Detect if this is a schema/migration file
  const isSchemaFile = SCHEMA_FILE_PATTERNS.some(p => p.test(filePath));

  return {
    path: filePath,
    language,
    additions,
    deletions,
    hunks,
    importsAdded,
    importsRemoved,
    exportsAdded,
    exportsRemoved,
    exportsModified,
    symbolsTouched,
    routeChanges,
    isSchemaFile,
  };
}

// --- Extraction helpers ---

function extractImport(line, language) {
  if (language === "python") {
    let m = line.match(PY_IMPORT);
    if (m) return m[1];
    m = line.match(PY_FROM_IMPORT);
    if (m) return m[1];
    return null;
  }

  // JS/TS
  let m = line.match(JS_IMPORT_FROM);
  if (m) return m[1];
  m = line.match(JS_REQUIRE);
  if (m) return m[1];
  m = line.match(JS_DYNAMIC_IMPORT);
  if (m) return m[1];
  m = line.match(JS_IMPORT_PLAIN);
  if (m) return m[1];
  return null;
}

function extractExport(line, language) {
  if (language === "python") {
    // Python doesn't have explicit exports in the same way
    // but we detect class/function definitions at module level
    let m = line.match(PY_FUNCTION_DEF);
    if (m && !m[1].startsWith("_")) return { symbol: m[1], kind: "function" };
    m = line.match(PY_CLASS_DEF);
    if (m) return { symbol: m[1], kind: "class" };
    return null;
  }

  // JS/TS
  let m = line.match(JS_EXPORT_FUNCTION);
  if (m) return { symbol: m[1], kind: "function" };
  m = line.match(JS_EXPORT_CONST);
  if (m) return { symbol: m[1], kind: "const" };
  m = line.match(JS_EXPORT_CLASS);
  if (m) return { symbol: m[1], kind: "class" };
  m = line.match(JS_EXPORT_DEFAULT);
  if (m && m[1]) return { symbol: m[1], kind: "default" };
  // Named exports: export { a, b, c }
  m = line.match(JS_NAMED_EXPORT);
  if (m) {
    // Return just the first symbol for simplicity
    const symbols = m[1].split(",").map(s => s.trim().split(/\s+as\s+/)[0].trim());
    if (symbols[0]) return { symbol: symbols[0], kind: "named" };
  }
  return null;
}

function extractSymbol(line, language) {
  if (language === "python") {
    let m = line.match(PY_FUNCTION_DEF);
    if (m) return { symbol: m[1], kind: "function" };
    m = line.match(PY_CLASS_DEF);
    if (m) return { symbol: m[1], kind: "class" };
    return null;
  }

  // JS/TS
  let m = line.match(JS_EXPORT_FUNCTION);
  if (m) return { symbol: m[1], kind: "function" };
  m = line.match(JS_FUNCTION_DEF);
  if (m) return { symbol: m[1], kind: "function" };
  m = line.match(JS_EXPORT_CLASS);
  if (m) return { symbol: m[1], kind: "class" };
  m = line.match(JS_CLASS_METHOD);
  if (m && !["if", "for", "while", "switch", "catch", "else"].includes(m[1])) {
    return { symbol: m[1], kind: "method" };
  }
  return null;
}

function extractRoute(line) {
  let m = line.match(EXPRESS_ROUTE);
  if (m) return { method: m[1].toUpperCase(), path: m[2] };
  m = line.match(FASTAPI_ROUTE);
  if (m) return { method: m[1].toUpperCase(), path: m[2] };
  return null;
}

function detectLanguage(filePath) {
  const ext = filePath.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "js": case "jsx": case "mjs": case "cjs": return "javascript";
    case "ts": case "tsx": return "typescript";
    case "py": case "pyw": return "python";
    case "rb": return "ruby";
    case "go": return "go";
    case "rs": return "rust";
    case "java": return "java";
    case "sql": return "sql";
    case "json": return "json";
    case "yaml": case "yml": return "yaml";
    default: return "unknown";
  }
}
