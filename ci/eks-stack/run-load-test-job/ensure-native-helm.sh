#!/usr/bin/env bash
set -euo pipefail

HELM_VERSION="${HELM_VERSION:-3.15.4}"

is_wrapper() {
  local p="$1"
  [ -f "$p" ] && head -n 8 "$p" | grep -qi 'docker'
}

find_native_helm() {
  local p
  while IFS= read -r p; do
    [ -z "$p" ] && continue
    if ! is_wrapper "$p"; then
      echo "$p"
      return 0
    fi
  done < <(type -aP helm 2>/dev/null | awk '!seen[$0]++')
  return 1
}

native_helm=""
if native_helm="$(find_native_helm)"; then
  native_dir="$(dirname "$native_helm")"
  echo "$native_dir" >> "$GITHUB_PATH"
  export PATH="$native_dir:$PATH"
  echo "Using existing native helm at $native_helm"
  helm version --short
  exit 0
fi

if type -P helm >/dev/null 2>&1; then
  echo "helm appears to be a docker wrapper at $(type -P helm); provisioning native helm binary..."
else
  echo "helm not found in PATH; provisioning native helm binary..."
fi

mkdir -p "$HOME/.local/bin"

if type -P docker >/dev/null 2>&1; then
  helm_image="alpine/helm:${HELM_VERSION}"
  if type -P helm >/dev/null 2>&1; then
    helm_path="$(type -P helm)"
    if [ -f "$helm_path" ]; then
      detected_image="$(awk -F'"' '/^IMAGE=/{print $2; exit}' "$helm_path" || true)"
      if [[ -n "$detected_image" ]]; then
        helm_image="$detected_image"
      fi
    fi
  fi

  cid="$(docker create "$helm_image" 2>/dev/null || true)"
  if [[ -n "$cid" ]]; then
    copied=false
    for cpath in /usr/bin/helm /usr/local/bin/helm /bin/helm; do
      if docker cp "$cid:$cpath" "$HOME/.local/bin/helm" >/dev/null 2>&1; then
        copied=true
        break
      fi
    done
    docker rm -f "$cid" >/dev/null 2>&1 || true

    if [[ "$copied" == true ]]; then
      chmod +x "$HOME/.local/bin/helm"
      echo "$HOME/.local/bin" >> "$GITHUB_PATH"
      export PATH="$HOME/.local/bin:$PATH"
      if native_helm="$(find_native_helm)"; then
        echo "Using docker-extracted native helm at $native_helm"
        helm version --short
        exit 0
      fi
    fi
  fi
fi

if type -P dnf >/dev/null 2>&1; then
  dnf -y install helm || true
elif type -P yum >/dev/null 2>&1; then
  yum -y install helm || true
elif type -P apt-get >/dev/null 2>&1; then
  apt-get update -y || true
  apt-get install -y helm || true
fi

if native_helm="$(find_native_helm)"; then
  native_dir="$(dirname "$native_helm")"
  echo "$native_dir" >> "$GITHUB_PATH"
  export PATH="$native_dir:$PATH"
  echo "Using package-manager native helm at $native_helm"
  helm version --short
  exit 0
fi

arch="amd64"
if [[ "$(uname -m)" == "aarch64" || "$(uname -m)" == "arm64" ]]; then
  arch="arm64"
fi

helm_version="v${HELM_VERSION}"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT
helm_urls=(
  "https://get.helm.sh/helm-${helm_version}-linux-${arch}.tar.gz"
  "https://github.com/helm/helm/releases/download/${helm_version}/helm-${helm_version}-linux-${arch}.tar.gz"
)
downloaded=false
for url in "${helm_urls[@]}"; do
  if curl --retry 6 --retry-all-errors --retry-delay 2 --connect-timeout 20 --max-time 180 -fsSL -o "$tmp_dir/helm.tar.gz" "$url"; then
    downloaded=true
    break
  fi
done
if [[ "$downloaded" != true ]]; then
  echo "Failed to download helm tarball from all sources" >&2
  exit 1
fi
tar -xzf "$tmp_dir/helm.tar.gz" -C "$tmp_dir"
install -m 0755 "$tmp_dir/linux-${arch}/helm" "$HOME/.local/bin/helm"
echo "$HOME/.local/bin" >> "$GITHUB_PATH"
export PATH="$HOME/.local/bin:$PATH"

if ! native_helm="$(find_native_helm)"; then
  echo "Failed to provision native helm executable" >&2
  exit 1
fi

echo "Using helm at $native_helm"
helm version --short
