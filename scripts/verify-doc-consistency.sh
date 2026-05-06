#!/usr/bin/env bash
# verify-doc-consistency.sh
# Cross-doc semantic consistency gate.
# Checks:
#   1. NFR-17..21 status alignment between SCOPE.md and README.md
#   2. k6 threshold consistency across README.md, SCOPE.md, test/performance/rides-request.k6.js
#   3. Current-tag freshness (docs must not claim an older tag as current state)
#
# Usage: bash scripts/verify-doc-consistency.sh
# Exit 0 = all consistent. Exit 1 = contradiction found.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCOPE="$REPO_ROOT/SCOPE.md"
README="$REPO_ROOT/README.md"
RUBRIC="$REPO_ROOT/docs/rubric-checklist.md"
K6="$REPO_ROOT/test/performance/rides-request.k6.js"

ERRORS=0

fail() {
  echo "FAIL: $*" >&2
  ERRORS=$((ERRORS + 1))
}

info() {
  echo "INFO: $*"
}

# ---------------------------------------------------------------------------
# CHECK 1 — NFR-17..21 status alignment between SCOPE.md and README.md
# ---------------------------------------------------------------------------
info "Check 1: NFR-17..21 status alignment (SCOPE.md vs README.md)"

# Synonym normalisation: collapse alternate whitespace/dash forms to a canonical word.
normalise_status() {
  # Lowercase, trim, collapse internal spaces
  echo "$1" | tr '[:upper:]' '[:lower:]' | sed 's/[[:space:]]*—[[:space:]]*//' | sed 's/fuera de alcance/fuera_de_alcance/g' | tr -d '[:space:]'
}

# Extract status for a given NFR-ID from SCOPE.md.
# SCOPE table format: | NFR-NN | NFR  | <STATUS> | ...
scope_status() {
  local nfr_id="$1"
  # Match the table row, capture the 3rd pipe-delimited field (status)
  grep -m1 "| ${nfr_id} |" "$SCOPE" | awk -F'|' '{print $4}' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//'
}

# Detect if README.md mentions an NFR-ID together with a status word that conflicts.
# We look for rows in README that reference the NFR-ID and compare the adjacent status cell.
# README table format: | ... | <STATUS> | NFR-XX |  (status in column 2, NFR ref in column 3)
readme_status() {
  local nfr_id="$1"
  # Find lines in README that contain the NFR-ID
  grep "${nfr_id}" "$README" | grep '|' | awk -F'|' '{print $3}' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | head -1
}

check_nfr() {
  local nfr_id="$1"
  local scope_raw
  scope_raw="$(scope_status "$nfr_id")"

  if [ -z "$scope_raw" ]; then
    info "  $nfr_id — not found in SCOPE.md (skipping)"
    return
  fi

  local readme_raw
  readme_raw="$(readme_status "$nfr_id")"

  if [ -z "$readme_raw" ]; then
    info "  $nfr_id — not mentioned in README.md (skipping)"
    return
  fi

  # Normalise both
  local scope_norm readme_norm
  scope_norm="$(normalise_status "$scope_raw")"
  readme_norm="$(normalise_status "$readme_raw")"

  # The scope_norm may contain extra description after the status word.
  # We test if readme_norm is a prefix of scope_norm or vice-versa, or they match.
  if echo "$scope_norm" | grep -q "^${readme_norm}" || echo "$readme_norm" | grep -q "^${scope_norm}"; then
    info "  $nfr_id OK — SCOPE='$scope_raw' README='$readme_raw'"
  else
    fail "$nfr_id status mismatch: SCOPE.md says '$scope_raw' but README.md says '$readme_raw'"
  fi
}

for nfr in NFR-17 NFR-18 NFR-19 NFR-20 NFR-21; do
  check_nfr "$nfr"
done

# ---------------------------------------------------------------------------
# CHECK 2 — k6 threshold consistency
# ---------------------------------------------------------------------------
info "Check 2: k6 threshold consistency"

# Extract p(95) and p(99) threshold values (ms) from each file.
# We look for patterns like: p(95)<NNN, p95<NNN, p(99)<NNN, p99<NNN
# Exclude lines tagged as historical/superseded/ADR-004.

extract_p95() {
  local file="$1"
  grep -v -i 'histórico\|superseded\|ADR-004\|v0\.1\.0\|p99<1500\|1500ms' "$file" \
    | grep -oP 'p\(?95\)?<\K[0-9]+' \
    | sort -u
}

extract_p99() {
  local file="$1"
  grep -v -i 'histórico\|superseded\|ADR-004\|v0\.1\.0\|p99<1500\|1500ms' "$file" \
    | grep -oP 'p\(?99\)?<\K[0-9]+' \
    | sort -u
}

# p95 values
p95_readme="$(extract_p95 "$README")"
p95_scope="$(extract_p95 "$SCOPE")"
p95_k6="$(extract_p95 "$K6")"

# p99 values
p99_readme="$(extract_p99 "$README")"
p99_scope="$(extract_p99 "$SCOPE")"
p99_k6="$(extract_p99 "$K6")"

check_threshold_consistency() {
  local metric="$1"
  local val_readme="$2"
  local val_scope="$3"
  local val_k6="$4"

  # Collect non-empty unique values
  local all_vals
  all_vals="$(printf '%s\n%s\n%s\n' "$val_readme" "$val_scope" "$val_k6" | grep -v '^$' | sort -u)"
  local count
  count="$(echo "$all_vals" | grep -c '.' || true)"

  if [ "$count" -le 1 ]; then
    info "  ${metric} OK — consistent value(s): $(echo "$all_vals" | tr '\n' ' ')"
  else
    fail "${metric} threshold mismatch across files:"
    [ -n "$val_readme" ] && echo "    README.md: ${val_readme}ms" >&2
    [ -n "$val_scope"  ] && echo "    SCOPE.md:  ${val_scope}ms"  >&2
    [ -n "$val_k6"     ] && echo "    k6 script: ${val_k6}ms"     >&2
  fi
}

check_threshold_consistency "p95" "$p95_readme" "$p95_scope" "$p95_k6"
check_threshold_consistency "p99" "$p99_readme" "$p99_scope" "$p99_k6"

# ---------------------------------------------------------------------------
# CHECK 3 — Current-tag freshness
# ---------------------------------------------------------------------------
info "Check 3: Current-tag freshness"

CURRENT_TAG=""
if git -C "$REPO_ROOT" describe --tags --abbrev=0 >/dev/null 2>&1; then
  CURRENT_TAG="$(git -C "$REPO_ROOT" describe --tags --abbrev=0)"
  info "  Current git tag: $CURRENT_TAG"
else
  info "  No git tags found or not in a git context — skipping tag freshness check"
fi

if [ -n "$CURRENT_TAG" ]; then
  # Extract version numbers from tag like v0.1.2-mvp → 0 1 2
  tag_to_ints() {
    echo "$1" | grep -oP '\d+' | head -3 | tr '\n' ' '
  }

  is_older_tag() {
    local candidate="$1"
    local current="$2"
    local cand_ints curr_ints
    cand_ints="$(tag_to_ints "$candidate")"
    curr_ints="$(tag_to_ints "$current")"

    # Compare as arrays: major minor patch
    read -r c_maj c_min c_pat <<< "$cand_ints"
    read -r t_maj t_min t_pat <<< "$curr_ints"

    c_maj=${c_maj:-0}; c_min=${c_min:-0}; c_pat=${c_pat:-0}
    t_maj=${t_maj:-0}; t_min=${t_min:-0}; t_pat=${t_pat:-0}

    if   [ "$c_maj" -lt "$t_maj" ]; then return 0
    elif [ "$c_maj" -gt "$t_maj" ]; then return 1
    elif [ "$c_min" -lt "$t_min" ]; then return 0
    elif [ "$c_min" -gt "$t_min" ]; then return 1
    elif [ "$c_pat" -lt "$t_pat" ]; then return 0
    else return 1
    fi
  }

  check_file_tag() {
    local file="$1"
    local label="$2"
    # Find all version tags in the file that look like v0.x.y-mvp
    # Exclude lines with explicit historical context markers
    while IFS= read -r line; do
      local tag
      tag="$(echo "$line" | grep -oP 'v\d+\.\d+\.\d+-mvp' | head -1)"
      [ -z "$tag" ] && continue
      # Skip historical-context lines
      if echo "$line" | grep -qi 'histór\|original\|previous\|superseded\|ADR-004\|v0\.1\.0\|→\|históricamente'; then
        continue
      fi
      if is_older_tag "$tag" "$CURRENT_TAG"; then
        fail "$label claims tag '$tag' as current state, but current tag is '$CURRENT_TAG' (line: $line)"
      fi
    done < <(grep -n 'v[0-9]\+\.[0-9]\+\.[0-9]\+-mvp' "$file")
  }

  check_file_tag "$README"  "README.md"
  check_file_tag "$SCOPE"   "SCOPE.md"
  check_file_tag "$RUBRIC"  "docs/rubric-checklist.md"
fi

# ---------------------------------------------------------------------------
# Result
# ---------------------------------------------------------------------------
echo ""
if [ "$ERRORS" -eq 0 ]; then
  echo "verify-doc-consistency: ALL CHECKS PASSED"
  exit 0
else
  echo "verify-doc-consistency: $ERRORS ERROR(S) FOUND" >&2
  exit 1
fi
