#!/usr/bin/env bash
# 新建任务隔离目录（P0-3）： bash _work/new-task.sh <task-id> ["标题"]
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
id="${1:?用法: new-task.sh <task-id> [标题]}"
title="${2:-$id}"
dst="$here/$id"
if [ -e "$dst" ]; then echo "已存在: $dst"; exit 1; fi
mkdir -p "$dst/evidence" "$dst/backup" "$dst/archive"
cp "$here/_template/README.md" "$dst/README.md"
cp "$here/_template/notes.md" "$dst/notes.md"
cp "$here/_template/evidence/README.md" "$dst/evidence/README.md"
sed -i "s/<id>/$id/g" "$dst/README.md" "$dst/notes.md"
ts="$(date +%Y-%m-%d\ %H:%M)"
printf "%s | 任务创建 | %s (%s)\n" "$ts" "$title" "$id" > "$dst/run.log"
printf "%s | 依据 | AGENT_WORKFLOW.md 4. 生命周期钩子（开工）\n" "$ts" >> "$dst/run.log"
echo "已创建: $dst"