// ===================================================================
// SpecLock Code Graph Test Suite
// Tests dependency parsing, graph building, blast radius, lock
// mapping, module detection, and critical path analysis.
// Run: node tests/code-graph.test.js
// ===================================================================

import fs from "fs";
import path from "path";
import os from "os";
import {
  buildGraph,
  getBlastRadius,
  mapLocksToFiles,
  getModules,
  getCriticalPaths,
} from "../src/core/code-graph.js";
import { ensureInit, addLock } from "../src/core/memory.js";
import { readBrain } from "../src/core/storage.js";

let passed = 0;
let failed = 0;
const failures = [];
const categories = {};

function test(category, name, fn) {
  if (!categories[category]) categories[category] = { passed: 0, failed: 0, total: 0 };
  categories[category].total++;

  try {
    fn();
    passed++;
    categories[category].passed++;
  } catch (e) {
    failed++;
    categories[category].failed++;
    failures.push({ category, name, error: e.message });
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || "Assertion failed");
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg || "Mismatch"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "speclock-graph-test-"));
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
}

/**
 * Create a mock project structure for testing.
 */
function createMockProject(tmpDir) {
  // src/index.js → imports api/routes.js and utils/helpers.js
  // src/api/routes.js → imports api/auth.js and db/users.js
  // src/api/auth.js → imports utils/jwt.js
  // src/db/users.js → imports db/connection.js
  // src/db/connection.js → no imports
  // src/utils/helpers.js → no imports
  // src/utils/jwt.js → no imports

  const dirs = [
    "src", "src/api", "src/db", "src/utils"
  ];
  for (const d of dirs) {
    fs.mkdirSync(path.join(tmpDir, d), { recursive: true });
  }

  const files = {
    "src/index.js": `
import { setupRoutes } from "./api/routes.js";
import { formatDate } from "./utils/helpers.js";
setupRoutes();
`,
    "src/api/routes.js": `
import { authenticate } from "./auth.js";
import { getUser } from "../db/users.js";
export function setupRoutes() {}
`,
    "src/api/auth.js": `
import { verifyToken } from "../utils/jwt.js";
export function authenticate() {}
`,
    "src/db/users.js": `
import { getConnection } from "./connection.js";
export function getUser() {}
`,
    "src/db/connection.js": `
export function getConnection() { return null; }
`,
    "src/utils/helpers.js": `
export function formatDate() {}
`,
    "src/utils/jwt.js": `
export function verifyToken() {}
`,
  };

  for (const [filePath, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(tmpDir, filePath), content);
  }
}

// ============================================================
// GRAPH BUILDING
// ============================================================

test("graph-building", "builds graph for mock project", () => {
  const tmpDir = makeTempDir();
  try {
    createMockProject(tmpDir);
    const graph = buildGraph(tmpDir);

    assertEqual(graph.stats.totalFiles, 7, "Should find 7 files");
    assert(graph.builtAt, "Should have builtAt timestamp");
    assert(graph.files["src/index.js"], "Should have src/index.js");
    assert(graph.files["src/api/routes.js"], "Should have src/api/routes.js");
    assert(graph.stats.languages.js >= 7, "Should have 7 JS files");
  } finally {
    cleanup(tmpDir);
  }
});

test("graph-building", "tracks imports correctly", () => {
  const tmpDir = makeTempDir();
  try {
    createMockProject(tmpDir);
    const graph = buildGraph(tmpDir);

    const indexImports = graph.files["src/index.js"].imports;
    assert(indexImports.includes("src/api/routes.js"), "index should import routes");
    assert(indexImports.includes("src/utils/helpers.js"), "index should import helpers");
    assertEqual(indexImports.length, 2, "index should have 2 imports");
  } finally {
    cleanup(tmpDir);
  }
});

test("graph-building", "tracks importedBy correctly", () => {
  const tmpDir = makeTempDir();
  try {
    createMockProject(tmpDir);
    const graph = buildGraph(tmpDir);

    const routesImportedBy = graph.files["src/api/routes.js"].importedBy;
    assert(routesImportedBy.includes("src/index.js"), "routes should be imported by index");

    const jwtImportedBy = graph.files["src/utils/jwt.js"].importedBy;
    assert(jwtImportedBy.includes("src/api/auth.js"), "jwt should be imported by auth");
  } finally {
    cleanup(tmpDir);
  }
});

test("graph-building", "identifies entry points", () => {
  const tmpDir = makeTempDir();
  try {
    createMockProject(tmpDir);
    const graph = buildGraph(tmpDir);

    // index.js is imported by nothing but imports other files → entry point
    assert(graph.stats.entryPoints.includes("src/index.js"), "index.js should be entry point");
  } finally {
    cleanup(tmpDir);
  }
});

test("graph-building", "handles empty project", () => {
  const tmpDir = makeTempDir();
  try {
    const graph = buildGraph(tmpDir);
    assertEqual(graph.stats.totalFiles, 0, "Empty project should have 0 files");
    assertEqual(graph.stats.totalEdges, 0, "Empty project should have 0 edges");
  } finally {
    cleanup(tmpDir);
  }
});

test("graph-building", "saves graph to .speclock/code-graph.json", () => {
  const tmpDir = makeTempDir();
  try {
    createMockProject(tmpDir);
    buildGraph(tmpDir);

    const graphPath = path.join(tmpDir, ".speclock", "code-graph.json");
    assert(fs.existsSync(graphPath), "Graph file should exist");

    const saved = JSON.parse(fs.readFileSync(graphPath, "utf-8"));
    assertEqual(saved.stats.totalFiles, 7, "Saved graph should have 7 files");
  } finally {
    cleanup(tmpDir);
  }
});

test("graph-building", "skips node_modules", () => {
  const tmpDir = makeTempDir();
  try {
    createMockProject(tmpDir);
    // Add a file inside node_modules
    fs.mkdirSync(path.join(tmpDir, "node_modules", "lodash"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "node_modules", "lodash", "index.js"), "export default {}");

    const graph = buildGraph(tmpDir);
    assert(!graph.files["node_modules/lodash/index.js"], "Should skip node_modules files");
  } finally {
    cleanup(tmpDir);
  }
});

test("graph-building", "tracks file sizes", () => {
  const tmpDir = makeTempDir();
  try {
    createMockProject(tmpDir);
    const graph = buildGraph(tmpDir);

    for (const [filePath, data] of Object.entries(graph.files)) {
      assert(typeof data.size === "number", `${filePath} should have numeric size`);
      assert(data.size > 0, `${filePath} should have positive size`);
    }
  } finally {
    cleanup(tmpDir);
  }
});

// ============================================================
// JS IMPORT PARSING
// ============================================================

test("js-imports", "parses ES module imports", () => {
  const tmpDir = makeTempDir();
  try {
    fs.mkdirSync(path.join(tmpDir, "src"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "src/a.js"), 'import { foo } from "./b.js";\n');
    fs.writeFileSync(path.join(tmpDir, "src/b.js"), "export const foo = 1;\n");

    const graph = buildGraph(tmpDir);
    assert(graph.files["src/a.js"].imports.includes("src/b.js"), "Should parse ES import");
  } finally {
    cleanup(tmpDir);
  }
});

test("js-imports", "parses require() calls", () => {
  const tmpDir = makeTempDir();
  try {
    fs.mkdirSync(path.join(tmpDir, "src"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "src/a.js"), 'const bar = require("./b.js");\n');
    fs.writeFileSync(path.join(tmpDir, "src/b.js"), "module.exports = {};\n");

    const graph = buildGraph(tmpDir);
    assert(graph.files["src/a.js"].imports.includes("src/b.js"), "Should parse require");
  } finally {
    cleanup(tmpDir);
  }
});

test("js-imports", "parses dynamic imports", () => {
  const tmpDir = makeTempDir();
  try {
    fs.mkdirSync(path.join(tmpDir, "src"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "src/a.js"), 'const b = await import("./b.js");\n');
    fs.writeFileSync(path.join(tmpDir, "src/b.js"), "export default {};\n");

    const graph = buildGraph(tmpDir);
    assert(graph.files["src/a.js"].imports.includes("src/b.js"), "Should parse dynamic import");
  } finally {
    cleanup(tmpDir);
  }
});

test("js-imports", "skips external packages", () => {
  const tmpDir = makeTempDir();
  try {
    fs.mkdirSync(path.join(tmpDir, "src"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "src/a.js"), `
import express from "express";
import { z } from "zod";
import { foo } from "./b.js";
`);
    fs.writeFileSync(path.join(tmpDir, "src/b.js"), "export const foo = 1;\n");

    const graph = buildGraph(tmpDir);
    const imports = graph.files["src/a.js"].imports;
    assertEqual(imports.length, 1, "Should only have 1 local import");
    assert(imports.includes("src/b.js"), "Should only include local import");
  } finally {
    cleanup(tmpDir);
  }
});

test("js-imports", "resolves parent directory imports", () => {
  const tmpDir = makeTempDir();
  try {
    fs.mkdirSync(path.join(tmpDir, "src/sub"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "src/root.js"), "export const x = 1;\n");
    fs.writeFileSync(path.join(tmpDir, "src/sub/child.js"), 'import { x } from "../root.js";\n');

    const graph = buildGraph(tmpDir);
    assert(graph.files["src/sub/child.js"].imports.includes("src/root.js"), "Should resolve ../");
  } finally {
    cleanup(tmpDir);
  }
});

// ============================================================
// PYTHON IMPORT PARSING
// ============================================================

test("py-imports", "parses python from-import with __init__.py", () => {
  const tmpDir = makeTempDir();
  try {
    fs.mkdirSync(path.join(tmpDir, "mypackage"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "mypackage/__init__.py"), "");
    fs.writeFileSync(path.join(tmpDir, "mypackage/utils.py"), "def helper(): pass\n");
    fs.writeFileSync(path.join(tmpDir, "main.py"), "from mypackage import utils\n");

    const graph = buildGraph(tmpDir);
    // main.py should try to import mypackage (resolved to __init__.py)
    const mainImports = graph.files["main.py"]?.imports || [];
    assert(mainImports.length >= 1, "main.py should have at least 1 import");
  } finally {
    cleanup(tmpDir);
  }
});

test("py-imports", "parses python module imports", () => {
  const tmpDir = makeTempDir();
  try {
    fs.writeFileSync(path.join(tmpDir, "helpers.py"), "def help(): pass\n");
    fs.writeFileSync(path.join(tmpDir, "app.py"), "import helpers\n");

    const graph = buildGraph(tmpDir);
    const appImports = graph.files["app.py"]?.imports || [];
    assert(appImports.includes("helpers.py"), "app.py should import helpers.py");
  } finally {
    cleanup(tmpDir);
  }
});

// ============================================================
// BLAST RADIUS
// ============================================================

test("blast-radius", "calculates direct dependents", () => {
  const tmpDir = makeTempDir();
  try {
    createMockProject(tmpDir);
    const result = getBlastRadius(tmpDir, "src/utils/jwt.js");

    assert(result.found, "File should be found");
    assert(result.directDependents.includes("src/api/auth.js"), "jwt direct dependent: auth");
    assertEqual(result.directDependents.length, 1, "jwt should have 1 direct dependent");
  } finally {
    cleanup(tmpDir);
  }
});

test("blast-radius", "calculates transitive dependents", () => {
  const tmpDir = makeTempDir();
  try {
    createMockProject(tmpDir);
    // jwt.js → auth.js → routes.js → index.js
    const result = getBlastRadius(tmpDir, "src/utils/jwt.js");

    assert(result.transitiveDependents.includes("src/api/auth.js"), "Should include auth.js");
    assert(result.transitiveDependents.includes("src/api/routes.js"), "Should include routes.js");
    assert(result.transitiveDependents.includes("src/index.js"), "Should include index.js");
    assertEqual(result.blastRadius, 3, "Blast radius should be 3");
  } finally {
    cleanup(tmpDir);
  }
});

test("blast-radius", "calculates depth correctly", () => {
  const tmpDir = makeTempDir();
  try {
    createMockProject(tmpDir);
    // connection.js → users.js → routes.js → index.js (depth = 3)
    const result = getBlastRadius(tmpDir, "src/db/connection.js");
    assert(result.depth >= 3, "Depth should be at least 3");
  } finally {
    cleanup(tmpDir);
  }
});

test("blast-radius", "calculates impact percent", () => {
  const tmpDir = makeTempDir();
  try {
    createMockProject(tmpDir);
    const result = getBlastRadius(tmpDir, "src/db/connection.js");
    assert(result.impactPercent > 0, "Impact should be > 0");
    assert(result.impactPercent <= 100, "Impact should be <= 100");
    assertEqual(result.totalFiles, 7, "Total files should be 7");
  } finally {
    cleanup(tmpDir);
  }
});

test("blast-radius", "handles file not found", () => {
  const tmpDir = makeTempDir();
  try {
    createMockProject(tmpDir);
    const result = getBlastRadius(tmpDir, "nonexistent.js");
    assert(!result.found, "Should report not found");
    assert(result.error.includes("not found"), "Error should mention not found");
    assertEqual(result.blastRadius, 0, "Blast radius should be 0");
  } finally {
    cleanup(tmpDir);
  }
});

test("blast-radius", "leaf file has zero blast radius", () => {
  const tmpDir = makeTempDir();
  try {
    createMockProject(tmpDir);
    // index.js is not imported by anything
    const result = getBlastRadius(tmpDir, "src/index.js");
    assertEqual(result.blastRadius, 0, "Entry point should have 0 blast radius");
    assertEqual(result.directDependents.length, 0, "Entry point should have 0 dependents");
  } finally {
    cleanup(tmpDir);
  }
});

// ============================================================
// LOCK-TO-FILE MAPPING
// ============================================================

test("lock-mapping", "maps auth lock to auth files", () => {
  const tmpDir = makeTempDir();
  try {
    createMockProject(tmpDir);
    ensureInit(tmpDir);
    addLock(tmpDir, "Never modify auth files", ["security"], "user");

    const mappings = mapLocksToFiles(tmpDir);
    assert(mappings.length >= 1, "Should have at least 1 mapping");

    const authMapping = mappings.find(m => m.lockText.includes("auth"));
    assert(authMapping, "Should have auth mapping");
    assert(authMapping.matchedFiles.some(f => f.includes("auth")), "Should match auth files");
  } finally {
    cleanup(tmpDir);
  }
});

test("lock-mapping", "maps database lock to db files", () => {
  const tmpDir = makeTempDir();
  try {
    createMockProject(tmpDir);
    ensureInit(tmpDir);
    addLock(tmpDir, "Never modify database connection", ["database"], "user");

    const mappings = mapLocksToFiles(tmpDir);
    const dbMapping = mappings.find(m => m.lockText.includes("database"));
    assert(dbMapping, "Should have db mapping");
    // "database" keyword should match files with "db" or "connection" in path
    // The keyword extractor will pull "database" and "connection"
    assert(dbMapping.matchedFiles.some(f => f.includes("connection")), "Should match connection files");
  } finally {
    cleanup(tmpDir);
  }
});

test("lock-mapping", "returns empty for unmatched lock", () => {
  const tmpDir = makeTempDir();
  try {
    createMockProject(tmpDir);
    ensureInit(tmpDir);
    addLock(tmpDir, "Never change the color scheme", ["ui"], "user");

    const mappings = mapLocksToFiles(tmpDir);
    const colorMapping = mappings.find(m => m.lockText.includes("color"));
    assert(colorMapping, "Should have mapping entry");
    assertEqual(colorMapping.matchedFiles.length, 0, "Should have 0 matched files for unrelated lock");
  } finally {
    cleanup(tmpDir);
  }
});

// ============================================================
// MODULE DETECTION
// ============================================================

test("modules", "detects modules from directory structure", () => {
  const tmpDir = makeTempDir();
  try {
    createMockProject(tmpDir);
    const modules = getModules(tmpDir);

    assert(modules["api"], "Should detect api module");
    assert(modules["db"], "Should detect db module");
    assert(modules["utils"], "Should detect utils module");
  } finally {
    cleanup(tmpDir);
  }
});

test("modules", "tracks inter-module dependencies", () => {
  const tmpDir = makeTempDir();
  try {
    createMockProject(tmpDir);
    const modules = getModules(tmpDir);

    // api module depends on db and utils
    const apiDeps = modules["api"]?.dependencies || [];
    assert(apiDeps.includes("db"), "api should depend on db");
    assert(apiDeps.includes("utils"), "api should depend on utils");
  } finally {
    cleanup(tmpDir);
  }
});

test("modules", "identifies entry points per module", () => {
  const tmpDir = makeTempDir();
  try {
    createMockProject(tmpDir);
    const modules = getModules(tmpDir);

    for (const [name, mod] of Object.entries(modules)) {
      assert(mod.entryPoint, `${name} module should have entry point`);
      assert(mod.files.length > 0, `${name} module should have files`);
    }
  } finally {
    cleanup(tmpDir);
  }
});

// ============================================================
// CRITICAL PATHS
// ============================================================

test("critical-paths", "finds high-impact files", () => {
  const tmpDir = makeTempDir();
  try {
    createMockProject(tmpDir);
    const critical = getCriticalPaths(tmpDir);

    assert(critical.length > 0, "Should find critical files");
    // routes.js is imported by index.js and imports auth.js + users.js → high score
    const routesEntry = critical.find(c => c.file === "src/api/routes.js");
    assert(routesEntry, "routes.js should be in critical paths");
    assert(routesEntry.riskScore > 0, "routes.js should have positive risk score");
  } finally {
    cleanup(tmpDir);
  }
});

test("critical-paths", "respects limit parameter", () => {
  const tmpDir = makeTempDir();
  try {
    createMockProject(tmpDir);
    const critical = getCriticalPaths(tmpDir, { limit: 3 });
    assert(critical.length <= 3, "Should respect limit");
  } finally {
    cleanup(tmpDir);
  }
});

test("critical-paths", "sorted by risk score descending", () => {
  const tmpDir = makeTempDir();
  try {
    createMockProject(tmpDir);
    const critical = getCriticalPaths(tmpDir);

    for (let i = 1; i < critical.length; i++) {
      assert(critical[i].riskScore <= critical[i - 1].riskScore,
        `${critical[i].file} should not have higher score than ${critical[i - 1].file}`);
    }
  } finally {
    cleanup(tmpDir);
  }
});

// ============================================================
// EDGE CASES
// ============================================================

test("edge-cases", "handles circular imports", () => {
  const tmpDir = makeTempDir();
  try {
    fs.mkdirSync(path.join(tmpDir, "src"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "src/a.js"), 'import { b } from "./b.js";\nexport const a = 1;\n');
    fs.writeFileSync(path.join(tmpDir, "src/b.js"), 'import { a } from "./a.js";\nexport const b = 1;\n');

    const graph = buildGraph(tmpDir);
    assertEqual(graph.stats.totalFiles, 2, "Should handle circular imports without crash");

    // Blast radius should still work (BFS handles visited set)
    const br = getBlastRadius(tmpDir, "src/a.js");
    assert(br.found, "Should find file in circular graph");
    // Both files depend on each other
    assert(br.blastRadius >= 1, "Blast radius should include the circular dependency");
  } finally {
    cleanup(tmpDir);
  }
});

test("edge-cases", "handles file with no imports", () => {
  const tmpDir = makeTempDir();
  try {
    fs.mkdirSync(path.join(tmpDir, "src"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "src/standalone.js"), "export const x = 42;\n");

    const graph = buildGraph(tmpDir);
    const node = graph.files["src/standalone.js"];
    assert(node, "Should include standalone file");
    assertEqual(node.imports.length, 0, "Standalone file should have 0 imports");
    assertEqual(node.importedBy.length, 0, "Standalone file should have 0 importedBy");
  } finally {
    cleanup(tmpDir);
  }
});

test("edge-cases", "handles mixed JS and Python project", () => {
  const tmpDir = makeTempDir();
  try {
    fs.mkdirSync(path.join(tmpDir, "src"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "src/app.js"), 'import { x } from "./utils.js";\n');
    fs.writeFileSync(path.join(tmpDir, "src/utils.js"), "export const x = 1;\n");
    fs.writeFileSync(path.join(tmpDir, "main.py"), "import os\n");

    const graph = buildGraph(tmpDir);
    assert(graph.stats.languages.js >= 2, "Should have JS files");
    assert(graph.stats.languages.py >= 1, "Should have Python files");
  } finally {
    cleanup(tmpDir);
  }
});

// ============================================================
// RESULTS
// ============================================================

console.log("\n" + "=".repeat(60));
console.log("SpecLock Code Graph Test Results");
console.log("=".repeat(60));

for (const [cat, stats] of Object.entries(categories)) {
  const icon = stats.failed === 0 ? "PASS" : "FAIL";
  console.log(`  [${icon}] ${cat}: ${stats.passed}/${stats.total}`);
}

console.log("-".repeat(60));
console.log(`  Total: ${passed}/${passed + failed} passed`);

if (failures.length > 0) {
  console.log("\nFailures:");
  for (const f of failures) {
    console.log(`  [${f.category}] ${f.name}: ${f.error}`);
  }
}

console.log("=".repeat(60));
process.exit(failed > 0 ? 1 : 0);
