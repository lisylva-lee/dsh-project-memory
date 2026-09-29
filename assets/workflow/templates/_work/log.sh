#!/usr/bin/env bash
# 追加任务日志： bash _work/log.sh <task-id> "<动作>" ["结果摘要"]
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
id="${1:?用法: log.sh <task-id> <动作> [结果]}"
act="${2:?缺少动作}"
res="${3:-}"
log="$here/$id/run.log"
[ -f "$log" ] || { echo "无该任务日志: $log"; exit 1; }
printf "%s | %s | %s\n" "$(date +%Y-%m-%d\ %H:%M)" "$act" "$res" >> "$log"
tail -1 "$log"