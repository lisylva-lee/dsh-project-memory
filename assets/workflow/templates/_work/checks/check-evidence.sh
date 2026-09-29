#!/usr/bin/env bash
# 自检 1：未完成任务的证据目录是否有文件（不含 README.md）
set -uo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
board="$root/STATUS.md"
[ -f "$board" ] || { echo "无 STATUS.md，跳过"; exit 0; }
found=0
while IFS= read -r line; do
  case "$line" in
    "| "*) ;;
    *) continue ;;
  esac
  id="$(printf "%s" "$line" | awk -F"|" "{gsub(/^ +| +$/, \"\", \$2); print \$2}")"
  status="$(printf "%s" "$line" | awk -F"|" "{gsub(/^ +| +$/, \"\", \$4); print \$4}")"
  case "$id" in
    [0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]*) ;;
    *) continue ;;
  esac
  case "$status" in *完成*|*中止*|*取消*) continue ;; esac
  dir="$root/_work/$id/evidence"
  if [ -d "$dir" ]; then
    n="$(find "$dir" -maxdepth 1 -type f ! -name README.md | wc -l | tr -d " ")"
  else
    n=0
  fi
  if [ "$n" = "0" ]; then echo "缺证据: $id (_work/$id/evidence/ 无文件)"; found=1; fi
done < "$board"
[ "$found" = "0" ] && echo "证据自检通过"
exit "$found"