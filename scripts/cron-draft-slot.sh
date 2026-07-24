#!/usr/bin/env bash
# Cron helper: pick slot, generate pending draft, print handoff for Hermes agent.
# Usage:
#   ./scripts/cron-draft-slot.sh              # auto slot from local hour
#   ./scripts/cron-draft-slot.sh morning
#   ./scripts/cron-draft-slot.sh afternoon --date=2026-07-25
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$REPO_ROOT"

SLOT="${1:-}"
shift || true
EXTRA_ARGS=("$@")

if [[ -z "$SLOT" ]]; then
  HOUR="$(date +%H)"
  HOUR=$((10#$HOUR))
  if (( HOUR < 12 )); then
    SLOT="morning"
  elif (( HOUR < 18 )); then
    SLOT="afternoon"
  else
    SLOT="evening"
  fi
fi

case "$SLOT" in
  morning|afternoon|evening|night) ;;
  *)
    echo "Unknown slot: $SLOT (use morning|afternoon|evening)" >&2
    exit 2
    ;;
esac

echo "=== AGENT.LOG draft slot runner ==="
echo "REPO: $REPO_ROOT"
echo "SLOT: $SLOT"
echo "WHEN: $(date -Is)"
echo

node "$SCRIPT_DIR/generate-draft.mjs" --slot="$SLOT" "${EXTRA_ARGS[@]}"

echo
echo "=== PENDING LIST ==="
node "$SCRIPT_DIR/publish-post.mjs" --list || true
