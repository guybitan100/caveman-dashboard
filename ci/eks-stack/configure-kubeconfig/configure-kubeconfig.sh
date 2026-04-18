#!/usr/bin/env bash
set -euo pipefail

cluster_name="${EKS_CLUSTER_NAME:-}"
aws_region="${AWS_REGION:-}"

if [[ -z "$cluster_name" || -z "$aws_region" ]]; then
  echo "Missing required EKS_CLUSTER_NAME/AWS_REGION" >&2
  exit 1
fi

tmp_root="${RUNNER_TEMP:-/tmp}"
mkdir -p "$tmp_root"
kcfg="$(mktemp "$tmp_root/kubeconfig.${cluster_name}.XXXXXX")"
chmod 600 "$kcfg"

aws eks update-kubeconfig \
  --name "$cluster_name" \
  --region "$aws_region" \
  --kubeconfig "$kcfg"

echo "KUBECONFIG=$kcfg" >> "$GITHUB_ENV"
