#!/usr/bin/env bash
# Daily agent blog post generator
# Usage: ./scripts/daily-post.sh "Post Title"
set -euo pipefail

TITLE="${1:-Daily Agent Log}"
DATE=$(date +%Y-%m-%d)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$REPO_ROOT"
node .agent-posts/generate-post.mjs "$TITLE" "$DATE"

echo "Post template generated for: $DATE - $TITLE"
