#!/usr/bin/env bash
# verify-status-consistency.sh — Judgment 16° B6 + 17° F2 closure
#
# Cross-check that NFR/RTF/CT/CAT status declarations agree across:
#   - SCOPE.md (matrix por ID)
#   - docs/traceability-matrix.md (matrix por documento fuente)
#
# v17 extension: bidirectional drift detection (Implementado→Parcial AND
# Parcial→Implementado), compound IDs expanded (e.g. NFR-02..04 → 02,03,04).
# rubric-checklist.md cross-check is deferred to v0.1.18+ (rubric uses different
# row schema, not directly comparable).
#
# Rule: for any ID X declared in BOTH files, the normalized status MUST match.
#   normalized: 'Implementado — ...' / 'Implementado · ...' → 'Implementado'
#               'Parcial — ...' / 'Parcial · ...'           → 'Parcial'
#               'Fuera de Alcance — ...'                     → 'Fuera de Alcance'
#
# Usage: bash scripts/verify-status-consistency.sh
# Exit 0 = consistent, 1 = drift detected

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCOPE="$ROOT/SCOPE.md"
MATRIX="$ROOT/docs/traceability-matrix.md"

drift_found=0

normalize_status() {
  local raw="$1"
  if [[ "$raw" =~ ^Implementado ]]; then echo 'Implementado'; return; fi
  if [[ "$raw" =~ ^Parcial ]]; then echo 'Parcial'; return; fi
  if [[ "$raw" =~ ^Fuera ]]; then echo 'Fuera de Alcance'; return; fi
  echo "$raw"
}

extract_status_scope() {
  local id="$1" file="$2"
  rg -oN "^\| *${id} *\|[^|]*\|\s*([^|]+?)\s*\|" "$file" -r '$1' | head -1 || true
}

extract_status_matrix() {
  local id="$1" file="$2"
  rg -oN "^\|[^|]+\|\s*${id}\s*\|\s*([^|]+?)\s*\|" "$file" -r '$1' | head -1 || true
}

# Expand compound IDs (NFR-02..04) into individual IDs (NFR-02, NFR-03, NFR-04).
expand_compound() {
  while IFS= read -r tok; do
    if [[ "$tok" =~ ^([A-Z]+)-([0-9]+)\.\.([0-9]+)$ ]]; then
      local prefix="${BASH_REMATCH[1]}"
      local from="${BASH_REMATCH[2]}"
      local to="${BASH_REMATCH[3]}"
      for ((i=10#$from; i<=10#$to; i++)); do
        printf '%s-%02d\n' "$prefix" "$i"
      done
    else
      echo "$tok"
    fi
  done
}

compare_pair() {
  local id="$1" status_a="$2" status_b="$3"
  local norm_a norm_b
  [[ -z "$status_a" ]] && return 0
  [[ -z "$status_b" ]] && return 0
  norm_a="$(normalize_status "$status_a")"
  norm_b="$(normalize_status "$status_b")"
  if [[ "$norm_a" != "$norm_b" ]]; then
    echo "DRIFT: ${id} — SCOPE.md='${norm_a}' but matrix='${norm_b}'"
    echo "  SCOPE:  $status_a"
    echo "  MATRIX: $status_b"
    drift_found=1
  fi
}

check_id() {
  local id="$1"
  local scope_status matrix_status
  scope_status="$(extract_status_scope "$id" "$SCOPE")"
  matrix_status="$(extract_status_matrix "$id" "$MATRIX")"
  compare_pair "$id" "$scope_status" "$matrix_status"
}

mapfile -t SCOPE_IDS < <(rg -oN '^\| *([A-Z]+-[0-9]+(?:\.\.[0-9]+)?) *\|' "$SCOPE" -r '$1' || true)
mapfile -t MATRIX_IDS < <(rg -oN '^\|[^|]+\|\s*([A-Z]+-[0-9]+(?:\.\.[0-9]+)?)\s*\|' "$MATRIX" -r '$1' || true)

ALL_IDS="$( (printf '%s\n' "${SCOPE_IDS[@]}"; printf '%s\n' "${MATRIX_IDS[@]}") | expand_compound | sort -u | rg -v '^$' || true )"

while IFS= read -r id; do
  [[ -z "$id" ]] && continue
  check_id "$id"
done <<< "$ALL_IDS"

if [[ $drift_found -eq 0 ]]; then
  echo "verify-status-consistency: ALL STATUSES CONSISTENT (SCOPE ↔ matrix, bidirectional, compounds expanded)"
  exit 0
fi

echo ""
echo "verify-status-consistency: drift detected — sync SCOPE.md ↔ docs/traceability-matrix.md"
exit 1
