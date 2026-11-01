#!/usr/bin/env bash
# Deploy a verified GitHub Actions build to an unprivileged VPS account.
# Releases are copied into new directories and switched with an atomic symlink.
set -euo pipefail

readonly DEPLOY_HOST="38.244.174.235"
readonly DEPLOY_USER="tokyo-deploy"
readonly DEPLOY_ROOT="/var/www/tokyo-streets"
readonly SITE_URL="https://tokyonight.site/"
readonly RELEASE_SHA="\${RELEASE_SHA:?Missing RELEASE_SHA}"
readonly REMOTE="\${DEPLOY_USER}@\${DEPLOY_HOST}"
readonly SSH_OPTIONS=(-o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=15)

if [[ ! "\${RELEASE_SHA}" =~ ^[a-f0-9]{40}$ ]]; then
  echo "Invalid commit SHA" >&2
  exit 1
fi

latest_main() {
  git ls-remote https://github.com/AlexSapronov/Tokyo_Streets.git refs/heads/main | cut -f1
}

if [[ "$(latest_main)" != "$RELEASE_SHA" ]]; then
  echo "A newer main commit exists. Skipping outdated release $RELEASE_SHA."
  exit 0
fi

temp_dir="$(mktemp -d)"
trap 'rm -rf "$temp_dir"' EXIT
mkdir -p "$temp_dir/public"
cp index.html style.css "$temp_dir/public/"
cp -a src assets "$temp_dir/public/"

ssh "\${SSH_OPTIONS[@]}" "$REMOTE" \
  "mkdir -p '$DEPLOY_ROOT/releases/$RELEASE_SHA'"
rsync -az --delete \
  -e 'ssh -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=15' \
  "$temp_dir/public/" "$REMOTE:$DEPLOY_ROOT/releases/$RELEASE_SHA/"

# A slow, older run must not replace a more recent successful build.
if [[ "$(latest_main)" != "$RELEASE_SHA" ]]; then
  echo "main advanced while copying files. Keeping the current site."
  exit 0
fi

ssh "\${SSH_OPTIONS[@]}" "$REMOTE" bash -s -- "$DEPLOY_ROOT" "$RELEASE_SHA" <<'ACTIVATE'
set -euo pipefail
root="$1"
sha="$2"
test -f "$root/releases/$sha/index.html"
test -f "$root/releases/$sha/src/app.js"
old="$(readlink "$root/current" || true)"
if [[ -n "$old" ]]; then
  ln -sfn "$old" "$root/previous"
fi
ln -s "releases/$sha" "$root/.candidate-$sha"
mv -Tf "$root/.candidate-$sha" "$root/current"
ACTIVATE

# Check the actual public page, not merely whether nginx is running.
# Comparing bytes catches a stale CDN/proxy response or an incorrect nginx root.
if ! curl -fsSL --max-time 20 --retry 3 --retry-delay 2 \
  "\${SITE_URL}?release=\${RELEASE_SHA}" -o "$temp_dir/served-index.html" \
  || ! cmp -s "$temp_dir/public/index.html" "$temp_dir/served-index.html"; then
  echo "::error::Public health check failed; restoring previous release."
  ssh "\${SSH_OPTIONS[@]}" "$REMOTE" bash -s -- "$DEPLOY_ROOT" <<'ROLLBACK'
set -euo pipefail
root="$1"
old="$(readlink "$root/previous")"
test -f "$root/$old/index.html"
ln -s "$old" "$root/.rollback-$$"
mv -Tf "$root/.rollback-$$" "$root/current"
ROLLBACK
  exit 1
fi

echo "Published $RELEASE_SHA to $SITE_URL"
