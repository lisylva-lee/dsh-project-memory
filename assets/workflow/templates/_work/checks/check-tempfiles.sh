#!/usr/bin/env bash
# 自检 3：项目根是否散落临时文件（_n_*.png / nul / *.tmp 等）
set -uo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
found=0
while IFS= read -r f; do
  [ -n "$f" ] || continue
  base="$(basename "$f")"
  echo "临时文件: $base（应移入 _work/<任务>/ 或删除）"
  found=1
done < <(find "$root" -maxdepth 1 \( -name "_*.png" -o -name "_*.jpg" -o -name "_*.jpeg" -o -name "*.tmp" -o -name "nul" -o -name "NUL" \) 2>/dev/null)
[ "$found" = "0" ] && echo "临时文件自检通过"
exit "$found"