#!/usr/bin/env bash
# 剥离常见凭据变量后执行命令（P1-5）： bash _work/sanitize-env.sh -- <命令...>
set -euo pipefail
if [ "${1:-}" = "--" ]; then shift; fi
[ "$#" -ge 1 ] || { echo "用法: sanitize-env.sh -- <命令...>"; exit 1; }
strip=()
for v in GITHUB_TOKEN GH_TOKEN GITLAB_TOKEN LINEAR_API_KEY OPENAI_API_KEY ANTHROPIC_API_KEY \
         AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN AZURE_DEVOPS_EXT_PAT \
         NPM_TOKEN DOCKER_PASSWORD DOCKER_AUTH_CONFIG HF_TOKEN; do
  strip+=(-u "$v")
done
exec env "${strip[@]}" "$@"