#!/usr/bin/env bash
# verify-doc-paths.sh — Detect phantom file references in Markdown docs.
#
# For every *.md file in the repository, extract path mentions of the form:
#   (src|test|docs|scripts|.github)/path/to/file.ext
# and verify each exists on disk. Only paths whose final segment contains
# a dot (i.e. have a file extension) are checked; bare directory references
# and extensionless names are skipped.
#
# Allowlist: lines in .docpaths-allowlist are treated as intentional
# placeholder paths and are silently skipped.
#
# Usage:
#   bash scripts/verify-doc-paths.sh        # from repo root
#   REPO_ROOT=/path/to/repo bash scripts/verify-doc-paths.sh

set -euo pipefail

REPO_ROOT="${REPO_ROOT:-$(git -C "$(dirname "$0")" rev-parse --show-toplevel)}"
ALLOWLIST="${REPO_ROOT}/.docpaths-allowlist"

# Load allowlist entries (one per line, # comments allowed)
declare -A ALLOWED
if [[ -f "$ALLOWLIST" ]]; then
  while IFS= read -r line; do
    line="${line%%#*}"          # strip inline comments
    # trim leading whitespace
    line="${line#"${line%%[![:space:]]*}"}"
    # trim trailing whitespace
    line="${line%"${line##*[![:space:]]}"}"
    [[ -z "$line" ]] && continue
    ALLOWED["$line"]=1
  done < "$ALLOWLIST"
fi

FAIL=0
TOTAL_CHECKED=0
TOTAL_PHANTOM=0

# Extract path-like tokens from every .md file under repo root.
# We use rg with --only-matching and a PCRE pattern.
# Format of each rg line: /abs/path/file.md:LINENO:extracted-path
while IFS=: read -r doc lineno path; do
  # Strip surrounding Markdown markup (backticks, parens, quotes)
  # but NOT dots (dots are part of file extensions)
  path="${path//\`/}"
  path="${path//\'/}"
  path="${path//\"/}"
  path="${path//(/}"
  path="${path//)/}"
  # Trim trailing non-path punctuation: comma, colon, angle bracket, asterisk, bracket
  # Note: we deliberately exclude dot from this list
  while [[ "$path" =~ [,\>\*\]]$ ]]; do
    path="${path%?}"
  done
  # Trim leading/trailing whitespace
  path="${path#"${path%%[![:space:]]*}"}"
  path="${path%"${path##*[![:space:]]}"}"

  [[ -z "$path" ]] && continue

  # Only check paths whose last segment has a file extension (contains a dot)
  basename="${path##*/}"
  [[ "$basename" != *.* ]] && continue

  # Strip line number suffix if present (e.g. "file.ts:12-45")
  path="${path%%:*}"

  # Skip if it's in the allowlist
  [[ -n "${ALLOWED[$path]+_}" ]] && continue

  TOTAL_CHECKED=$((TOTAL_CHECKED + 1))

  if [[ ! -f "${REPO_ROOT}/${path}" ]]; then
    echo "PHANTOM: ${doc}:${lineno}: ${path}"
    TOTAL_PHANTOM=$((TOTAL_PHANTOM + 1))
    FAIL=1
  fi
done < <(
  rg \
    --only-matching \
    --no-heading \
    --line-number \
    --glob '*.md' \
    '(?:src|test|docs|scripts|\.github)/[A-Za-z0-9_.\-]+(?:/[A-Za-z0-9_.\-]+)+' \
    "${REPO_ROOT}" 2>/dev/null || true
)

echo ""
echo "verify-doc-paths: checked ${TOTAL_CHECKED} path mention(s), ${TOTAL_PHANTOM} phantom(s) found."

exit "$FAIL"
