#!/usr/bin/env bash
# Standalone installer for the agent-workflow templates (no plugin required).
#   bash install-workflow.sh [target-dir] [--force]
# Copies AGENT_WORKFLOW.md + STATUS.md + _work/ into the target project root.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
target="${1:-$PWD}"
force="${2:-}"
if [ ! -d "$target" ]; then echo "目标目录不存在: $target"; exit 1; fi
copy() {
  src="$1"; dst="$2"
  if [ -e "$dst" ] && [ "$force" != "--force" ]; then
    echo "skip (exists): ${dst#$target/}"
    return 0
  fi
  mkdir -p "$(dirname "$dst")"
  cp -p "$src" "$dst"
  echo "write: ${dst#$target/}"
}
tpl="$here/templates"
copy "$tpl/AGENT_WORKFLOW.md" "$target/AGENT_WORKFLOW.md"
copy "$tpl/STATUS.md" "$target/STATUS.md"
mkdir -p "$target/_work"
copy "$tpl/_work/README.md" "$target/_work/README.md"
for f in new-task.sh log.sh sanitize-env.sh; do copy "$tpl/_work/$f" "$target/_work/$f"; done
for f in README.md notes.md run.log; do copy "$tpl/_work/_template/$f" "$target/_work/_template/$f"; done
copy "$tpl/_work/_template/evidence/README.md" "$target/_work/_template/evidence/README.md"
for f in check-evidence.sh check-status.sh check-tempfiles.sh; do copy "$tpl/_work/checks/$f" "$target/_work/checks/$f"; done
chmod +x "$target/_work/"*.sh "$target/_work/checks/"*.sh 2>/dev/null || true
echo "done. 下一步：读 AGENT_WORKFLOW.md，用 _work/new-task.sh 开工。"