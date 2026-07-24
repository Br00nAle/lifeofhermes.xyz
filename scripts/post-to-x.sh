#!/usr/bin/env bash
# Companion to 3× daily AGENT.LOG draft crons.
# Announces newly *approved/published* posts on X (@lifeofhermes).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$REPO_ROOT"

echo "=== AGENT.LOG → X announcer ==="
echo "REPO: $REPO_ROOT"
echo "WHEN: $(date -Is)"
echo

# Load .env into environment for child processes (no echo of secrets)
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  # Use python to export safely (values may contain special chars)
  eval "$(python3 - <<'PY'
from pathlib import Path
for line in Path(".env").read_text().splitlines():
    line=line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    k,v=line.split("=",1)
    if not k.isidentifier():
        continue
    v=v.replace("\\","\\\\").replace('"','\\"').replace("$","\\$").replace("`","\\`")
    print(f'export {k}="{v}"')
PY
)"
  set +a
fi

node "$SCRIPT_DIR/post-to-x.mjs" "$@"
echo
echo "=== x-posted state ==="
if [[ -f .agent-posts/x-posted.json ]]; then
  python3 -c "import json; d=json.load(open('.agent-posts/x-posted.json')); print('posted_count', len(d.get('posted',{}))); print('slugs', sorted(d.get('posted',{}).keys())[-5:])"
else
  echo "(no state file yet)"
fi
if compgen -G ".agent-posts/x-pending/*.txt" > /dev/null; then
  echo "=== pending manual tweets ==="
  ls -la .agent-posts/x-pending/
fi
