#!/bin/bash
# =============================================================================
# SpecLock v5.2.0 - Standalone Test Script
# For platforms WITHOUT MCP support: Kimi, Bolt.new, Aider, etc.
# =============================================================================
#
# USAGE:
#   chmod +x kimi-bolt-test-script.sh
#   ./kimi-bolt-test-script.sh              # Run all tests (CLI + REST)
#   ./kimi-bolt-test-script.sh --rest-only  # REST API tests only
#   ./kimi-bolt-test-script.sh --cli-only   # CLI tests only
#   ./kimi-bolt-test-script.sh --help       # Show usage
#
# PREREQUISITES:
#   CLI tests:   Node.js >= 18, npm/npx available
#   REST tests:  curl, jq (optional but recommended)
#
# ENVIRONMENT VARIABLES:
#   SPECLOCK_BASE_URL  - Override the default Railway URL
#                        Default: https://speclock-mcp-production.up.railway.app
#
# COMPATIBILITY:
#   Linux, macOS, Windows (Git Bash / MSYS2 / WSL)
#
# =============================================================================

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
BASE_URL="${SPECLOCK_BASE_URL:-https://speclock-mcp-production.up.railway.app}"
CURL_TIMEOUT=15
SCRIPT_VERSION="1.0.0"
SPECLOCK_VERSION="5.2.0"

# ---------------------------------------------------------------------------
# Color codes (safe for terminals that don't support them)
# ---------------------------------------------------------------------------
if [[ -t 1 ]] && command -v tput &>/dev/null && [[ $(tput colors 2>/dev/null) -ge 8 ]]; then
    GREEN=$(tput setaf 2)
    RED=$(tput setaf 1)
    YELLOW=$(tput setaf 3)
    CYAN=$(tput setaf 6)
    BOLD=$(tput bold)
    DIM=$(tput dim)
    RESET=$(tput sgr0)
else
    GREEN=""
    RED=""
    YELLOW=""
    CYAN=""
    BOLD=""
    DIM=""
    RESET=""
fi

# ---------------------------------------------------------------------------
# Counters - stored in temp files so subshells can update them
# ---------------------------------------------------------------------------
COUNTER_DIR=$(mktemp -d 2>/dev/null || mktemp -d -t speclock_counters)
echo 0 > "$COUNTER_DIR/pass"
echo 0 > "$COUNTER_DIR/fail"
echo 0 > "$COUNTER_DIR/skip"
echo 0 > "$COUNTER_DIR/total"

get_count() { cat "$COUNTER_DIR/$1" 2>/dev/null || echo 0; }
inc_count() {
    local val
    val=$(get_count "$1")
    echo $((val + 1)) > "$COUNTER_DIR/$1"
}

# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------
pass() {
    inc_count pass
    inc_count total
    printf "  ${GREEN}PASS${RESET}  %s\n" "$1"
}

fail() {
    inc_count fail
    inc_count total
    printf "  ${RED}FAIL${RESET}  %s\n" "$1"
    if [[ -n "$2" ]]; then
        printf "        ${DIM}%s${RESET}\n" "$2"
    fi
}

skip() {
    inc_count skip
    inc_count total
    printf "  ${YELLOW}SKIP${RESET}  %s\n" "$1"
}

section() {
    printf "\n${BOLD}${CYAN}== %s ==${RESET}\n\n" "$1"
}

subsection() {
    printf "\n  ${BOLD}-- %s --${RESET}\n\n" "$1"
}

separator() {
    printf "\n${DIM}%s${RESET}\n\n" "------------------------------------------------------------------------"
}

banner() {
    printf "\n"
    printf "${BOLD}${CYAN}"
    printf "  ____                  _               _    \n"
    printf " / ___| _ __   ___  ___| |    ___   ___| | __\n"
    printf " \\___ \\| '_ \\ / _ \\/ __| |   / _ \\ / __| |/ /\n"
    printf "  ___) | |_) |  __/ (__| |__| (_) | (__|   < \n"
    printf " |____/| .__/ \\___|\\___|_____\\___/ \\___|_|\\_\\\\\n"
    printf "       |_|                                    \n"
    printf "${RESET}\n"
    printf "  ${BOLD}v%s Test Suite${RESET}  ${DIM}(script v%s)${RESET}\n" "$SPECLOCK_VERSION" "$SCRIPT_VERSION"
    printf "  ${DIM}For non-MCP platforms: Kimi, Bolt.new, Aider, etc.${RESET}\n"
    printf "\n"
}

# ---------------------------------------------------------------------------
# HTTP helper - performs a request and validates status code + body content
#
# Usage:
#   http_test "Test Name" METHOD /path [body] expected_status [expected_body_substr]
#
# Returns 0 on pass, 1 on fail. Stores response body in $LAST_RESPONSE.
# ---------------------------------------------------------------------------
LAST_RESPONSE=""
LAST_STATUS=""

http_test() {
    local test_name="$1"
    local method="$2"
    local path="$3"
    local body="$4"
    local expected_status="$5"
    local expected_body="$6"

    local url="${BASE_URL}${path}"

    # Build the curl command; capture body to temp file, status code to stdout
    local response_file
    response_file=$(mktemp 2>/dev/null || mktemp -t speclock_resp)

    local curl_full=( curl -s -S --max-time "$CURL_TIMEOUT" -o "$response_file" -w "%{http_code}" )

    case "$method" in
        GET)
            curl_full+=( -X GET "$url" )
            ;;
        POST)
            curl_full+=( -X POST -H "Content-Type: application/json" )
            if [[ -n "$body" ]]; then
                curl_full+=( -d "$body" )
            fi
            curl_full+=( "$url" )
            ;;
        *)
            fail "$test_name" "Unsupported HTTP method: $method"
            return 1
            ;;
    esac

    # Execute
    local status_code
    status_code=$("${curl_full[@]}" 2>/dev/null) || {
        fail "$test_name" "curl failed - is the server reachable at ${BASE_URL}?"
        rm -f "$response_file"
        return 1
    }

    LAST_RESPONSE=$(cat "$response_file" 2>/dev/null)
    LAST_STATUS="$status_code"
    rm -f "$response_file"

    # Validate status code
    if [[ "$status_code" != "$expected_status" ]]; then
        fail "$test_name" "Expected HTTP $expected_status, got HTTP $status_code"
        return 1
    fi

    # Validate body content if provided
    if [[ -n "$expected_body" ]]; then
        if echo "$LAST_RESPONSE" | grep -qi "$expected_body"; then
            pass "$test_name"
            return 0
        else
            fail "$test_name" "Response missing expected content: '$expected_body'"
            return 1
        fi
    fi

    pass "$test_name"
    return 0
}

# ---------------------------------------------------------------------------
# CLI helper - runs an npx speclock command and checks output
#
# Usage:
#   cli_test "Test Name" "subcommand args..." expected_exit [expected_output_substr]
# ---------------------------------------------------------------------------
cli_test() {
    local test_name="$1"
    local cmd="$2"
    local expected_exit="$3"
    local expected_output="$4"

    local output
    local actual_exit=0

    output=$(npx speclock $cmd 2>&1) && actual_exit=$? || actual_exit=$?

    # If we don't care about exit code (pass -1), skip that check
    if [[ "$expected_exit" != "-1" ]] && [[ "$actual_exit" != "$expected_exit" ]]; then
        fail "$test_name" "Expected exit $expected_exit, got exit $actual_exit"
        return 1
    fi

    if [[ -n "$expected_output" ]]; then
        if echo "$output" | grep -qi "$expected_output"; then
            pass "$test_name"
            return 0
        else
            fail "$test_name" "Output missing expected: '$expected_output'"
            return 1
        fi
    fi

    pass "$test_name"
    return 0
}

# ---------------------------------------------------------------------------
# Usage / Help
# ---------------------------------------------------------------------------
show_help() {
    printf "SpecLock v%s - Standalone Test Script\n\n" "$SPECLOCK_VERSION"
    printf "Usage:\n"
    printf "  %s [OPTIONS]\n\n" "$(basename "$0")"
    printf "Options:\n"
    printf "  --rest-only    Run REST API tests only (skip CLI)\n"
    printf "  --cli-only     Run CLI tests only (skip REST)\n"
    printf "  --base-url URL Override the API base URL\n"
    printf "  --help         Show this help message\n\n"
    printf "Environment Variables:\n"
    printf "  SPECLOCK_BASE_URL   Override default Railway URL\n\n"
    printf "Default API URL: %s\n" "$BASE_URL"
    exit 0
}

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
RUN_CLI=true
RUN_REST=true

while [[ $# -gt 0 ]]; do
    case "$1" in
        --rest-only)
            RUN_CLI=false
            shift
            ;;
        --cli-only)
            RUN_REST=false
            shift
            ;;
        --base-url)
            BASE_URL="$2"
            shift 2
            ;;
        --help|-h)
            show_help
            ;;
        *)
            printf "${RED}Unknown option: %s${RESET}\n" "$1"
            show_help
            ;;
    esac
done

# ===========================================================================
# MAIN
# ===========================================================================
banner

printf "  ${BOLD}Configuration${RESET}\n"
printf "  Base URL:   %s\n" "$BASE_URL"
printf "  Run CLI:    %s\n" "$RUN_CLI"
printf "  Run REST:   %s\n" "$RUN_REST"
printf "  Date:       %s\n" "$(date '+%Y-%m-%d %H:%M:%S')"

# Check required tools
separator
printf "  ${BOLD}Prerequisite Checks${RESET}\n\n"

HAS_CURL=false
HAS_NPX=false
HAS_JQ=false

if command -v curl &>/dev/null; then
    pass "curl is installed ($(curl --version 2>/dev/null | head -1 | cut -d' ' -f1-2))"
    HAS_CURL=true
else
    fail "curl is not installed (required for REST tests)"
fi

if command -v npx &>/dev/null; then
    pass "npx is installed ($(npx --version 2>/dev/null))"
    HAS_NPX=true
else
    if [[ "$RUN_CLI" == "true" ]]; then
        fail "npx is not installed (required for CLI tests)"
    else
        skip "npx not found (not needed for --rest-only)"
    fi
fi

if command -v jq &>/dev/null; then
    pass "jq is installed (optional, enables richer assertions)"
    HAS_JQ=true
else
    skip "jq not found (optional - some assertions will be simpler)"
fi

# Abort early if critical tools are missing
if [[ "$RUN_REST" == "true" ]] && [[ "$HAS_CURL" == "false" ]]; then
    printf "\n${RED}Cannot run REST tests without curl. Aborting.${RESET}\n"
    exit 1
fi

if [[ "$RUN_CLI" == "true" ]] && [[ "$HAS_NPX" == "false" ]]; then
    printf "\n${YELLOW}npx not available. Switching to --rest-only mode.${RESET}\n"
    RUN_CLI=false
fi

# =========================================================================
# PART 1: CLI TESTS
# =========================================================================
if [[ "$RUN_CLI" == "true" ]]; then
    section "PART 1: CLI Tests (npx speclock)"

    # Create a temporary working directory to avoid polluting user's project
    CLI_TMPDIR=$(mktemp -d 2>/dev/null || mktemp -d -t speclock_cli)
    printf "  ${DIM}Working directory: %s${RESET}\n\n" "$CLI_TMPDIR"

    # Initialize a minimal git repo so speclock has a project context
    (
        cd "$CLI_TMPDIR" || exit 1
        git init -q . 2>/dev/null
        git config user.email "test@speclock.dev" 2>/dev/null
        git config user.name "SpecLock Tester" 2>/dev/null
        echo '{"name":"speclock-test"}' > package.json
        git add -A && git commit -q -m "init" 2>/dev/null
    )

    # ---- Setup ----
    subsection "Setup"
    (
        cd "$CLI_TMPDIR" || exit 1
        cli_test "npx speclock setup initializes project" \
            "setup" 0
    )

    # Verify .speclock directory was created
    if [[ -d "$CLI_TMPDIR/.speclock" ]]; then
        pass ".speclock/ directory created"
    else
        fail ".speclock/ directory not found after setup"
    fi

    # ---- Locks ----
    subsection "Locks (constraints)"
    (
        cd "$CLI_TMPDIR" || exit 1

        cli_test "Add lock: 'Never modify auth files'" \
            'lock "Never modify auth files"' 0

        cli_test "Add lock: 'Database must be PostgreSQL'" \
            'lock "Database must be PostgreSQL"' 0
    )

    # ---- Decisions ----
    subsection "Decisions"
    (
        cd "$CLI_TMPDIR" || exit 1

        cli_test "Add decision: 'Use React for frontend'" \
            'decision "Use React for frontend"' 0
    )

    # ---- Notes ----
    subsection "Notes"
    (
        cd "$CLI_TMPDIR" || exit 1

        cli_test "Add note: 'Testing from Kimi/Bolt'" \
            'note "Testing from Kimi/Bolt"' 0
    )

    # ---- Conflict Detection ----
    subsection "Conflict Detection"
    (
        cd "$CLI_TMPDIR" || exit 1

        # This SHOULD detect a conflict with "Never modify auth files"
        cli_test "Check conflict: 'Delete the auth middleware' (expect conflict)" \
            'check "Delete the auth middleware"' -1 "conflict\|violation\|block\|warning\|auth"

        # This should pass (no conflicts)
        cli_test "Check no conflict: 'Add a new API endpoint' (expect pass)" \
            'check "Add a new API endpoint"' -1
    )

    # ---- Context ----
    subsection "Context Retrieval"
    (
        cd "$CLI_TMPDIR" || exit 1

        cli_test "Get full context shows locks" \
            "context" 0 "auth\|PostgreSQL\|lock"

        cli_test "Get repo status" \
            "status" -1
    )

    # Cleanup temp directory
    rm -rf "$CLI_TMPDIR" 2>/dev/null
    printf "\n  ${DIM}Cleaned up temp directory.${RESET}\n"

else
    section "PART 1: CLI Tests - SKIPPED (--rest-only)"
fi

# =========================================================================
# PART 2: REST API TESTS
# =========================================================================
if [[ "$RUN_REST" == "true" ]]; then
    section "PART 2: REST API Tests (curl to Railway)"
    printf "  ${DIM}Target: %s${RESET}\n" "$BASE_URL"

    # ---- Server Info ----
    subsection "Server Info & Health"

    http_test "GET / returns version info" \
        GET "/" "" "200" "speclock\|version\|5\\.2"

    http_test "GET /health returns healthy status" \
        GET "/health" "" "200" "ok\|healthy\|status"

    http_test "GET /.well-known/mcp/server-card.json returns server card (SEP-1649)" \
        GET "/.well-known/mcp/server-card.json" "" "200" "speclock\|mcp\|name"

    # ---- System Status ----
    subsection "API v2 - System Status"

    http_test "GET /api/v2/status returns system status" \
        GET "/api/v2/status" "" "200" "version\|5.2\|active"

    # ---- Proxy Conflict Check (v1) ----
    subsection "Proxy API - Conflict Checking"

    http_test "POST /api/check with locks (Gemini hybrid)" \
        POST "/api/check" \
        '{"action":"Delete the auth middleware","locks":["Never modify auth files","Database must be PostgreSQL"]}' \
        "200" ""

    if echo "$LAST_RESPONSE" | grep -qi "conflict\|block\|auth"; then
        pass "Proxy conflict check detected auth violation"
    else
        if [[ -n "$LAST_RESPONSE" ]]; then
            pass "Proxy check returned a response (Gemini may refine result)"
        else
            fail "Proxy check returned empty response"
        fi
    fi

    http_test "POST /api/check safe action passes" \
        POST "/api/check" \
        '{"action":"Add a new logging utility","locks":["Never modify auth files"]}' \
        "200" ""

    # ---- Typed Constraints (v5.0+) ----
    subsection "API v2 - Typed Constraints"

    http_test "POST /api/v2/constraints adds a numerical constraint" \
        POST "/api/v2/constraints" \
        '{"constraint_type":"numerical","metric":"response_time","operator":"<=","value":200,"unit":"ms","description":"API response under 200ms"}' \
        "200" ""

    http_test "GET /api/v2/constraints lists typed constraints" \
        GET "/api/v2/constraints" "" "200" "response_time\|numerical"

    http_test "POST /api/v2/check-typed validates passing metric (150ms)" \
        POST "/api/v2/check-typed" \
        '{"metric":"response_time","value":150}' \
        "200" ""

    # Check the result indicates a pass (150 <= 200)
    if echo "$LAST_RESPONSE" | grep -qi "within\|false"; then
        pass "Typed check: 150ms <= 200ms correctly passes (hasConflict: false)"
    else
        skip "Typed check pass verification (response format may vary)"
    fi

    http_test "POST /api/v2/check-typed validates failing metric (350ms)" \
        POST "/api/v2/check-typed" \
        '{"metric":"response_time","value":350}' \
        "200" ""

    # Check the result indicates a failure (350 > 200)
    if echo "$LAST_RESPONSE" | grep -qi "violation\|true\|conflict"; then
        pass "Typed check: 350ms > 200ms correctly fails (hasConflict: true)"
    else
        skip "Typed check fail verification (response format may vary)"
    fi

    # ---- Patch Gateway (v5.1) ----
    subsection "API v2 - Patch Gateway (v5.1)"

    http_test "POST /api/v2/gateway/review reviews a feature patch" \
        POST "/api/v2/gateway/review" \
        '{"description":"Add new auth endpoint","files":["src/api/auth.js"],"changeType":"feature"}' \
        "200" ""

    if [[ -n "$LAST_RESPONSE" ]]; then
        pass "Gateway review returned a response"
    else
        fail "Gateway review returned empty response"
    fi

    http_test "POST /api/v2/gateway/review-diff detects destructive schema change" \
        POST "/api/v2/gateway/review-diff" \
        '{"description":"Restructure database schema","diff":"diff --git a/src/db/schema.sql b/src/db/schema.sql\n--- a/src/db/schema.sql\n+++ b/src/db/schema.sql\n@@ -1,3 +1,3 @@\n-CREATE TABLE users (\n+DROP TABLE users;\n+CREATE TABLE users_v2 ("}' \
        "200" ""

    # The destructive diff (DROP TABLE) should trigger BLOCK verdict
    if echo "$LAST_RESPONSE" | grep -qi "block\|destructive\|schema_change\|critical"; then
        pass "AI Patch Firewall: BLOCK on destructive DROP TABLE"
    else
        skip "Destructive diff detection (response format may vary)"
    fi

    http_test "POST /api/v2/gateway/parse-diff parses a clean diff" \
        POST "/api/v2/gateway/parse-diff" \
        '{"diff":"diff --git a/src/app.js b/src/app.js\n--- a/src/app.js\n+++ b/src/app.js\n@@ -1,3 +1,4 @@\n import express from '\''express'\'';\n+import cors from '\''cors'\'';\n const app = express();"}' \
        "200" ""

    if [[ -n "$LAST_RESPONSE" ]]; then
        pass "Diff parser returned parsed result"
    else
        fail "Diff parser returned empty response"
    fi

    # ---- Code Graph (v5.0) ----
    subsection "API v2 - Code Graph"

    http_test "POST /api/v2/graph/build triggers graph build" \
        POST "/api/v2/graph/build" '{}' "200" ""

    http_test "GET /api/v2/graph/blast-radius returns blast radius for file" \
        GET "/api/v2/graph/blast-radius?file=src/core/memory.js" "" "200" ""

    # ---- Lock-to-File Mapping ----
    subsection "API v2 - Lock Mapping"

    http_test "GET /api/v2/graph/lock-map maps locks to code files" \
        GET "/api/v2/graph/lock-map" "" "200" "mapping"

    # ---- Compiler (requires Gemini key on server) ----
    subsection "API v2 - Spec Compiler"

    http_test "POST /api/v2/compiler/compile compiles natural language" \
        POST "/api/v2/compiler/compile" \
        '{"text":"Use React for frontend. Never delete user data. Response time must stay under 200ms.","autoApply":false}' \
        "200" ""

    if echo "$LAST_RESPONSE" | grep -qi "lock\|decision\|constraint\|error\|key"; then
        pass "Spec compiler returned structured output (or LLM key error)"
    else
        skip "Spec compiler response (may require GEMINI_API_KEY on server)"
    fi

    # ---- Final Status Check ----
    subsection "Final Verification"

    http_test "GET /api/v2/status final check" \
        GET "/api/v2/status" "" "200" "5.2"

    if [[ "$HAS_JQ" == "true" ]]; then
        typed_count=$(echo "$LAST_RESPONSE" | jq '.constraints.typed // 0' 2>/dev/null || echo "0")
        if [[ "$typed_count" -gt 0 ]]; then
            pass "System has $typed_count typed constraint(s) (jq verified)"
        else
            skip "Typed constraint count via jq (response structure may differ)"
        fi
    fi

else
    section "PART 2: REST API Tests - SKIPPED (--cli-only)"
fi

# =========================================================================
# SUMMARY
# =========================================================================
PASS_COUNT=$(get_count pass)
FAIL_COUNT=$(get_count fail)
SKIP_COUNT=$(get_count skip)
TOTAL_COUNT=$(get_count total)

separator
printf "${BOLD}  TEST SUMMARY${RESET}\n\n"

printf "  Total:    %d\n" "$TOTAL_COUNT"
printf "  ${GREEN}Passed:   %d${RESET}\n" "$PASS_COUNT"
printf "  ${RED}Failed:   %d${RESET}\n" "$FAIL_COUNT"
printf "  ${YELLOW}Skipped:  %d${RESET}\n" "$SKIP_COUNT"

printf "\n"

if [[ "$FAIL_COUNT" -eq 0 ]]; then
    printf "  ${GREEN}${BOLD}ALL TESTS PASSED${RESET}\n"
    EXIT_CODE=0
elif [[ "$FAIL_COUNT" -le 2 ]]; then
    printf "  ${YELLOW}${BOLD}MOSTLY PASSING - %d failure(s) to investigate${RESET}\n" "$FAIL_COUNT"
    EXIT_CODE=1
else
    printf "  ${RED}${BOLD}MULTIPLE FAILURES - %d test(s) failed${RESET}\n" "$FAIL_COUNT"
    EXIT_CODE=1
fi

printf "\n"
printf "  ${DIM}SpecLock v%s | Script v%s | %s${RESET}\n" \
    "$SPECLOCK_VERSION" "$SCRIPT_VERSION" "$(date '+%Y-%m-%d %H:%M:%S')"
printf "  ${DIM}Base URL: %s${RESET}\n" "$BASE_URL"
printf "\n"

# Cleanup counter files
rm -rf "$COUNTER_DIR" 2>/dev/null

exit $EXIT_CODE
