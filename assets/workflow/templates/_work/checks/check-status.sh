#!/usr/bin/env bash
# 自检 2：标记「阻塞」的任务是否写了「需要用户决定」
set -uo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
board="$root/STATUS.md"
[ -f "$board" ] || { echo "无 STATUS.md，跳过"; exit 0; }
found=0
while IFS= read -r line; do
  case "$line" in "| "*) ;; *) continue ;; esac
  id="$(printf "%s" "$line" | awk -F"|" "{gsub(/^ +| +$/, \"\", \$2); print \$2}")"
  status="$(printf "%s" "$line" | awk -F"|" "{gsub(/^ +| +$/, \"\", \$4); print \$4}")"
  need="$(printf "%s" "$line" | awk -F"|" "{gsub(/^ +| +$/, \"\", \$7); print \$7}")"
  case "$id" in [0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]*) ;; *) continue ;; esac
  case "$status" in
    *阻塞*)
      if [ -z "$need" ] || [ "$need" = "无" ]; then echo "阻塞未写原因: $id"; found=1; fi
      ;;
  esac
done < "$board"
[ "$found" = "0" ] && echo "看板自检通过"
exit "$found"