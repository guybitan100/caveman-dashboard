#!/usr/bin/env bash
set -euo pipefail

if ! type -P aws >/dev/null 2>&1; then
  echo "aws executable not found in PATH; installing awscli into user site..."
  python3 -m pip install --user --upgrade awscli
  echo "$HOME/.local/bin" >> "$GITHUB_PATH"
  export PATH="$HOME/.local/bin:$PATH"
fi

missing=()
for tool in aws kubectl helm; do
  if ! type -P "$tool" >/dev/null 2>&1; then
    missing+=("$tool")
  fi
done

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "Missing required EKS tools: ${missing[*]}" >&2
  echo "Runner host must have aws/kubectl/helm installed before running this workflow." >&2
  exit 1
fi

