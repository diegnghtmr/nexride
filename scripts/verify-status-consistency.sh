#!/usr/bin/env bash
# verify-status-consistency.sh — Judgment 16° B6 closure
#
# Cross-check that NFR/RTF status declarations agree between SCOPE.md and
# docs/traceability-matrix.md. The "stale-after-fix" pattern (SCOPE updated,
# matrix forgotten) appeared in 7 consecutive judgment cycles (v11..v16);
# this script blocks the pattern at lint-typecheck CI step.
#
# Rule: if SCOPE.md row for ID X starts with "Parcial" / "Fuera de Alcance",
# the matrix row for the same ID must NOT start with "Implementado".
#
# Usage: bash scripts/verify-status-consistency.sh
# Exit 0 = consistent, 1 = drift detected

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCOPE="$ROOT/SCOPE.md"
MATRIX="$ROOT/docs/traceability-matrix.md"

drift_found=0

check_id() {
  local id="$1"
  local scope_status matrix_status

  scope_status="$(rg -oN "^\| ${id}\s*\|[^|]*\|\s*([^|]+?)\s*\|" "$SCOPE" -r '$1' | head -1 || true)"
  matrix_status="$(rg -oN "^\|[^|]+\|\s*${id}\s*\|\s*([^|]+?)\s*\|" "$MATRIX" -r '$1' | head -1 || true)"

  if [[ -z "$scope_status" ]] || [[ -z "$matrix_status" ]]; then
    return 0
  fi

  local scope_kind matrix_kind
  scope_kind="$(echo "$scope_status" | rg -o '^(Parcial|Fuera de Alcance|Implementado)' || echo 'unknown')"
  matrix_kind="$(echo "$matrix_status" | rg -o '^(Parcial|Fuera de Alcance|Implementado)' || echo 'unknown')"

  if [[ "$scope_kind" == "Parcial" ]] && [[ "$matrix_kind" == "Implementado" ]]; then
    echo "DRIFT: ${id} — SCOPE.md='Parcial' but matrix='Implementado'"
    echo "  SCOPE:  $scope_status"
    echo "  MATRIX: $matrix_status"
    drift_found=1
  fi

  if [[ "$scope_kind" == "Fuera de Alcance" ]] && [[ "$matrix_kind" == "Implementado" ]]; then
    echo "DRIFT: ${id} — SCOPE.md='Fuera de Alcance' but matrix='Implementado'"
    drift_found=1
  fi
}

# Extract all NFR-XX, RTF-XX, CT-XX, CAT-XX IDs that appear in both files
mapfile -t IDS < <(rg -oN '\b(NFR|RTF|CT|CAT)-[0-9]+\b' "$SCOPE" "$MATRIX" | rg -o '(NFR|RTF|CT|CAT)-[0-9]+' | sort -u)

for id in "${IDS[@]}"; do
  check_id "$id"
done

if [[ $drift_found -eq 0 ]]; then
  echo "verify-status-consistency: ALL STATUSES CONSISTENT"
  exit 0
fi

echo ""
echo "verify-status-consistency: drift detected — sync SCOPE.md ↔ docs/traceability-matrix.md"
exit 1
