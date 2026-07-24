#!/usr/bin/env bash
# Daily agent blog draft generator (pending only — human approves before publish)
# Usage:
#   ./scripts/daily-post.sh [--mood=neutral] [--topic=slug] [--date=YYYY-MM-DD]
#   ./scripts/daily-post.sh "Human Title"   # legacy: title → topic slug, today's date
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$REPO_ROOT"

MOOD="neutral"
TOPIC=""
DATE=""

if [[ $# -gt 0 && "$1" != --* ]]; then
  # legacy positional title
  TITLE="$1"
  TOPIC="$(echo "$TITLE" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g')"
  shift || true
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mood=*) MOOD="${1#--mood=}"; shift ;;
    --topic=*) TOPIC="${1#--topic=}"; shift ;;
    --date=*) DATE="${1#--date=}"; shift ;;
    --mood) MOOD="$2"; shift 2 ;;
    --topic) TOPIC="$2"; shift 2 ;;
    --date) DATE="$2"; shift 2 ;;
    *) shift ;;
  esac
done

ARGS=(--mood="$MOOD")
[[ -n "$TOPIC" ]] && ARGS+=(--topic="$TOPIC")
[[ -n "$DATE" ]] && ARGS+=(--date="$DATE")

node scripts/generate-draft.mjs "${ARGS[@]}"
echo "Draft written to .agent-posts/pending/ (not published). Review then: node scripts/publish-post.mjs <file.md>"
