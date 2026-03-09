// ===================================================================
// SpecLock Code Graph — Dependency Analysis & Blast Radius
// Builds a live dependency graph of the codebase by parsing imports.
// Enables blast radius calculation, lock-to-file mapping, module
// detection, and critical path analysis.
//
// Developed by Sandeep Roy (https://github.com/sgroy10)
// ===================================================================

import fs from "fs";
import path from "path";
import { readBrain } from "./storage.js";
import { extractLockSubject } from "./lock-author.js";

// --- Constants ---

const SUPPORTED_EXTENSIONS = new Set([
  ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs",
  ".py", ".pyw",
]);

const SKIP_DIRS = new Set([
  "node_modules", ".git", ".speclock", "__pycache__",
  "dist", "build", ".next", "coverage", ".cache",
  "venv", ".venv", "env", ".env",
]);

const GRAPH_FILE = "code-graph.json";
const GRAPH_STALE_MS = 60 * 60 * 1000; // 1 hour

// --- Import parsing regexes ---

// JS/TS: import ... from "path"
const JS_IMPORT_FROM = /(?:import|export)\s+(?:[\s\S]*?)\s+from\s+["']([^"']+)["']/g;
// JS/TS: require("path")
const JS_REQUIRE = /require\s*\(\s*["']([^"']+)["']\s*\)/g;
// JS/TS: import("path") — dynamic import
const JS_DYNAMIC_IMPORT = /import\s*\(\s*["']([^"']+)["']\s*\)/g;

// Python: import module
const PY_IMPORT = /^import\s+([\w.]+)/gm;
// Python: from module import ...
const PY_FROM_IMPORT = /^from\s+([\w.]+)\s+import/gm;

// --- Core functions ---

/**
 * Build the dependency graph for a project.
 * @param {string} root - Project root path
 * @param {{ force?: boolean, extensions?: string[] }} options
 * @returns {Object} The built graph
 */
export function buildGraph(root, options = {}) {
  const extensions = options.extensions
    ? new Set(options.extensions)
    : SUPPORTED_EXTENSIONS;

  // Scan all source files
  const sourceFiles = [];
  scanDirectory(root, root, extensions, sourceFiles);

  // Build adjacency graph
  const files = {};
  for (const filePath of sourceFiles) {
    const relPath = path.relative(root, filePath).replace(/\\/g, "/");
    const ext = path.extname(filePath).toLowerCase();
    const language = getLanguage(ext);
    const content = safeReadFile(filePath);

    let imports = [];
    if (content) {
      if (language === "js" || language === "ts") {
        imports = parseJsImports(content, filePath, root);
      } else if (language === "py") {
        imports = parsePyImports(content, filePath, root);
      }
    }

    let size = 0;
    try { size = fs.statSync(filePath).size; } catch (_) {}

    files[relPath] = {
      imports: imports,
      importedBy: [], // populated in second pass
      size,
      language,
    };
  }

  // Second pass: populate importedBy
  for (const [filePath, data] of Object.entries(files)) {
    for (const imp of data.imports) {
      if (files[imp]) {
        if (!files[imp].importedBy.includes(filePath)) {
          files[imp].importedBy.push(filePath);
        }
      }
    }
  }

  // Compute stats
  const languageCounts = {};
  let totalEdges = 0;
  const entryPoints = [];

  for (const [filePath, data] of Object.entries(files)) {
    const lang = data.language;
    languageCounts[lang] = (languageCounts[lang] || 0) + 1;
    totalEdges += data.imports.length;
    if (data.importedBy.length === 0 && data.imports.length > 0) {
      entryPoints.push(filePath);
    }
  }

  const graph = {
    builtAt: new Date().toISOString(),
    root: root.replace(/\\/g, "/"),
    files,
    stats: {
      totalFiles: Object.keys(files).length,
      totalEdges,
      entryPoints,
      languages: languageCounts,
    },
  };

  // Save to .speclock/code-graph.json
  saveGraph(root, graph);

  return graph;
}

/**
 * Get or rebuild the graph if stale.
 * @param {string} root - Project root
 * @param {{ force?: boolean }} options
 * @returns {Object} The graph
 */
export function getOrBuildGraph(root, options = {}) {
  if (!options.force) {
    const existing = loadGraph(root);
    if (existing) {
      const age = Date.now() - new Date(existing.builtAt).getTime();
      if (age < GRAPH_STALE_MS) {
        return existing;
      }
    }
  }
  return buildGraph(root, options);
}

/**
 * Calculate blast radius for a file change.
 * @param {string} root - Project root
 * @param {string} filePath - Relative path of the file being changed
 * @returns {Object} Blast radius analysis
 */
export function getBlastRadius(root, filePath) {
  const graph = getOrBuildGraph(root);
  const normalizedPath = filePath.replace(/\\/g, "/");

  if (!graph.files[normalizedPath]) {
    return {
      file: normalizedPath,
      found: false,
      error: `File not found in graph: ${normalizedPath}`,
      directDependents: [],
      transitiveDependents: [],
      depth: 0,
      blastRadius: 0,
      totalFiles: graph.stats.totalFiles,
      impactPercent: 0,
    };
  }

  // BFS to find all transitive dependents
  const visited = new Set();
  const queue = [{ file: normalizedPath, depth: 0 }];
  const directDependents = [...graph.files[normalizedPath].importedBy];
  let maxDepth = 0;

  while (queue.length > 0) {
    const { file, depth } = queue.shift();
    if (visited.has(file)) continue;
    visited.add(file);
    if (depth > maxDepth) maxDepth = depth;

    const node = graph.files[file];
    if (!node) continue;

    for (const dependent of node.importedBy) {
      if (!visited.has(dependent)) {
        queue.push({ file: dependent, depth: depth + 1 });
      }
    }
  }

  // Remove the file itself from transitive dependents
  visited.delete(normalizedPath);
  const transitiveDependents = [...visited];

  const blastRadius = transitiveDependents.length;
  const impactPercent = graph.stats.totalFiles > 0
    ? Math.round((blastRadius / graph.stats.totalFiles) * 1000) / 10
    : 0;

  return {
    file: normalizedPath,
    found: true,
    directDependents,
    transitiveDependents,
    depth: maxDepth,
    blastRadius,
    totalFiles: graph.stats.totalFiles,
    impactPercent,
  };
}

/**
 * Map all active locks to actual code files.
 * @param {string} root - Project root
 * @returns {Array} Lock-to-file mappings
 */
export function mapLocksToFiles(root) {
  const graph = getOrBuildGraph(root);
  const brain = readBrain(root);
  if (!brain) return [];

  const activeLocks = (brain.specLock?.items || []).filter(l => l.active !== false);
  const allFiles = Object.keys(graph.files);

  const mappings = [];
  for (const lock of activeLocks) {
    const subject = extractLockSubject(lock.text).toLowerCase();
    const keywords = extractKeywords(subject);

    const matchedFiles = [];
    const matchedModules = new Set();

    for (const file of allFiles) {
      const fileLower = file.toLowerCase();
      const matched = keywords.some(kw => {
        // Match against file path segments
        const segments = fileLower.split("/");
        return segments.some(seg => seg.includes(kw));
      });

      if (matched) {
        matchedFiles.push(file);
        // Extract module name (first directory under src/ or top-level)
        const parts = file.split("/");
        if (parts.length >= 2) {
          const moduleDir = parts[0] === "src" && parts.length >= 3 ? parts[1] : parts[0];
          matchedModules.add(moduleDir);
        }
      }
    }

    // Calculate combined blast radius for all matched files
    let totalBlastRadius = 0;
    const allAffected = new Set();
    for (const f of matchedFiles) {
      const br = getBlastRadius(root, f);
      for (const dep of br.transitiveDependents) {
        allAffected.add(dep);
      }
    }
    totalBlastRadius = allAffected.size;

    mappings.push({
      lockId: lock.id,
      lockText: lock.text,
      matchedFiles,
      matchedModules: [...matchedModules],
      blastRadius: totalBlastRadius,
    });
  }

  return mappings;
}

/**
 * Identify logical modules in the project.
 * @param {string} root - Project root
 * @returns {Object} Modules with their files and dependencies
 */
export function getModules(root) {
  const graph = getOrBuildGraph(root);
  const modules = {};

  for (const [filePath, data] of Object.entries(graph.files)) {
    const parts = filePath.split("/");
    let moduleName;

    if (parts[0] === "src" && parts.length >= 3) {
      moduleName = parts[1]; // src/<module>/...
    } else if (parts.length >= 2) {
      moduleName = parts[0]; // <module>/...
    } else {
      moduleName = "_root"; // top-level files
    }

    if (!modules[moduleName]) {
      modules[moduleName] = {
        files: [],
        entryPoint: null,
        dependencies: new Set(),
        dependents: new Set(),
        totalSize: 0,
      };
    }

    modules[moduleName].files.push(filePath);
    modules[moduleName].totalSize += data.size;

    // Track inter-module dependencies
    for (const imp of data.imports) {
      const impParts = imp.split("/");
      let impModule;
      if (impParts[0] === "src" && impParts.length >= 3) {
        impModule = impParts[1];
      } else if (impParts.length >= 2) {
        impModule = impParts[0];
      } else {
        impModule = "_root";
      }

      if (impModule !== moduleName) {
        modules[moduleName].dependencies.add(impModule);
      }
    }

    for (const dep of data.importedBy) {
      const depParts = dep.split("/");
      let depModule;
      if (depParts[0] === "src" && depParts.length >= 3) {
        depModule = depParts[1];
      } else if (depParts.length >= 2) {
        depModule = depParts[0];
      } else {
        depModule = "_root";
      }

      if (depModule !== moduleName) {
        modules[moduleName].dependents.add(depModule);
      }
    }
  }

  // Find entry points per module (most imported file within the module)
  for (const [name, mod] of Object.entries(modules)) {
    let bestEntry = null;
    let maxImportedBy = -1;

    for (const file of mod.files) {
      const importedByCount = graph.files[file]?.importedBy?.length || 0;
      if (importedByCount > maxImportedBy) {
        maxImportedBy = importedByCount;
        bestEntry = file;
      }
    }

    mod.entryPoint = bestEntry;
    // Convert Sets to arrays for serialization
    mod.dependencies = [...mod.dependencies];
    mod.dependents = [...mod.dependents];
  }

  return modules;
}

/**
 * Find critical paths — files with highest risk/impact.
 * @param {string} root - Project root
 * @param {{ limit?: number }} options
 * @returns {Array} Files sorted by risk score
 */
export function getCriticalPaths(root, options = {}) {
  const limit = options.limit || 10;
  const graph = getOrBuildGraph(root);

  const scored = [];
  for (const [filePath, data] of Object.entries(graph.files)) {
    const directDependents = data.importedBy.length;
    const imports = data.imports.length;

    // Simple risk score: weighted by dependents (files that break if this changes)
    const riskScore = directDependents * 3 + imports;

    scored.push({
      file: filePath,
      directDependents,
      imports,
      riskScore,
      language: data.language,
      size: data.size,
    });
  }

  // Sort by risk score descending
  scored.sort((a, b) => b.riskScore - a.riskScore);

  return scored.slice(0, limit);
}

// --- Import parsers ---

function parseJsImports(content, filePath, root) {
  const imports = [];
  const dir = path.dirname(filePath);

  // Reset regex lastIndex
  JS_IMPORT_FROM.lastIndex = 0;
  JS_REQUIRE.lastIndex = 0;
  JS_DYNAMIC_IMPORT.lastIndex = 0;

  const rawImports = new Set();

  let match;
  while ((match = JS_IMPORT_FROM.exec(content)) !== null) {
    rawImports.add(match[1]);
  }
  while ((match = JS_REQUIRE.exec(content)) !== null) {
    rawImports.add(match[1]);
  }
  while ((match = JS_DYNAMIC_IMPORT.exec(content)) !== null) {
    rawImports.add(match[1]);
  }

  for (const raw of rawImports) {
    const resolved = resolveJsImport(raw, dir, root);
    if (resolved) {
      imports.push(resolved);
    }
  }

  return imports;
}

function resolveJsImport(importPath, fromDir, root) {
  // Skip external/node_modules imports
  if (!importPath.startsWith(".") && !importPath.startsWith("/")) {
    return null;
  }

  const resolved = path.resolve(fromDir, importPath);
  const relPath = path.relative(root, resolved).replace(/\\/g, "/");

  // Try exact path first, then with extensions
  const extensions = [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"];

  // Check exact path
  if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
    return relPath;
  }

  // Try adding extensions
  for (const ext of extensions) {
    const withExt = resolved + ext;
    if (fs.existsSync(withExt)) {
      return path.relative(root, withExt).replace(/\\/g, "/");
    }
  }

  // Try index files
  for (const ext of extensions) {
    const indexFile = path.join(resolved, "index" + ext);
    if (fs.existsSync(indexFile)) {
      return path.relative(root, indexFile).replace(/\\/g, "/");
    }
  }

  // Return the normalized path even if file doesn't exist (might be an alias)
  return relPath;
}

function parsePyImports(content, filePath, root) {
  const imports = [];
  const dir = path.dirname(filePath);

  PY_IMPORT.lastIndex = 0;
  PY_FROM_IMPORT.lastIndex = 0;

  const rawImports = new Set();

  let match;
  while ((match = PY_IMPORT.exec(content)) !== null) {
    rawImports.add(match[1]);
  }
  while ((match = PY_FROM_IMPORT.exec(content)) !== null) {
    rawImports.add(match[1]);
  }

  for (const raw of rawImports) {
    const resolved = resolvePyImport(raw, dir, root);
    if (resolved) {
      imports.push(resolved);
    }
  }

  return imports;
}

function resolvePyImport(importPath, fromDir, root) {
  // Skip stdlib and installed packages (no dots = likely external)
  if (importPath.startsWith(".")) {
    // Relative import
    const parts = importPath.split(".");
    let upCount = 0;
    for (const p of parts) {
      if (p === "") upCount++;
      else break;
    }
    const remaining = parts.filter(p => p !== "");
    let resolved = fromDir;
    for (let i = 0; i < upCount; i++) {
      resolved = path.dirname(resolved);
    }
    const modulePath = path.join(resolved, ...remaining);
    return tryResolvePyPath(modulePath, root);
  }

  // Try as project-local import (check if the module exists in root)
  const parts = importPath.split(".");
  const modulePath = path.join(root, ...parts);
  return tryResolvePyPath(modulePath, root);
}

function tryResolvePyPath(modulePath, root) {
  // Try as .py file
  const pyFile = modulePath + ".py";
  if (fs.existsSync(pyFile)) {
    return path.relative(root, pyFile).replace(/\\/g, "/");
  }

  // Try as package (__init__.py)
  const initFile = path.join(modulePath, "__init__.py");
  if (fs.existsSync(initFile)) {
    return path.relative(root, initFile).replace(/\\/g, "/");
  }

  return null;
}

// --- File scanning ---

function scanDirectory(root, dir, extensions, results) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_) {
    return;
  }

  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".") continue;
    if (SKIP_DIRS.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      scanDirectory(root, fullPath, extensions, results);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (extensions.has(ext)) {
        results.push(fullPath);
      }
    }
  }
}

// --- Utilities ---

function safeReadFile(filePath) {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch (_) {
    return null;
  }
}

function getLanguage(ext) {
  switch (ext) {
    case ".js": case ".jsx": case ".mjs": case ".cjs": return "js";
    case ".ts": case ".tsx": return "ts";
    case ".py": case ".pyw": return "py";
    default: return "unknown";
  }
}

function saveGraph(root, graph) {
  const speclockDir = path.join(root, ".speclock");
  if (!fs.existsSync(speclockDir)) {
    fs.mkdirSync(speclockDir, { recursive: true });
  }
  const graphPath = path.join(speclockDir, GRAPH_FILE);
  fs.writeFileSync(graphPath, JSON.stringify(graph, null, 2));
}

function loadGraph(root) {
  const graphPath = path.join(root, ".speclock", GRAPH_FILE);
  if (!fs.existsSync(graphPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(graphPath, "utf-8"));
  } catch (_) {
    return null;
  }
}

/**
 * Extract meaningful keywords from lock subject text.
 * @param {string} text - The lock subject
 * @returns {string[]} Keywords to match against file paths
 */
function extractKeywords(text) {
  // Split on whitespace and common separators, filter short/stop words
  const stopWords = new Set([
    "the", "a", "an", "is", "are", "was", "were", "be", "been",
    "and", "or", "but", "in", "on", "at", "to", "for", "of",
    "with", "by", "from", "as", "not", "no", "do", "does",
    "did", "will", "would", "should", "could", "may", "might",
    "must", "shall", "can", "this", "that", "it", "its",
    "any", "all", "each", "every", "some", "system", "module",
    "file", "files", "code", "change", "modify", "touch", "edit",
    "update", "delete", "remove", "add", "create", "never",
    "always", "configuration", "config",
  ]);

  const words = text
    .split(/[\s\-_./\\]+/)
    .map(w => w.replace(/[^a-z0-9]/g, ""))
    .filter(w => w.length >= 2 && !stopWords.has(w));

  return [...new Set(words)];
}
