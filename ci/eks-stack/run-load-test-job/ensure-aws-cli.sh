#!/usr/bin/env bash
set -euo pipefail

aws_ok=false
if aws --version >/dev/null 2>&1; then
  aws_ok=true
else
  echo "aws not found or not runnable; installing awscli into user site..."
fi

if [[ "$aws_ok" != true ]]; then
  python3 -m pip install --user --upgrade awscli
  echo "$HOME/.local/bin" >> "$GITHUB_PATH"
  export PATH="$HOME/.local/bin:$PATH"
fi

if ! type -P aws >/dev/null 2>&1 || ! aws --version >/dev/null 2>&1; then
  echo "Failed to provision aws executable for EKS auth plugin" >&2
  exit 1
fi
