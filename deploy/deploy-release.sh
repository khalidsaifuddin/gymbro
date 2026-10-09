#!/usr/bin/env bash
set -euo pipefail

release_id="${1:-}"
if [[ ! "$release_id" =~ ^[a-f0-9]{7,40}$ ]]; then
  echo 'Expected a lowercase hexadecimal release ID.' >&2
  exit 2
fi

app_root="$HOME/apps/gymbro"
release="$app_root/releases/$release_id"
current="$app_root/current"
[[ -x "$release/backend/gymbro-api" && -f "$release/frontend/dist/index.html" && -f "$release/deploy/ecosystem.config.cjs" ]] || {
  echo 'Release is missing its API, web export, or PM2 config.' >&2
  exit 1
}
[[ -r "$HOME/.config/gymbro/backend.env" ]] || {
  echo 'Private Gymbro backend configuration is missing.' >&2
  exit 1
}

previous=""
if [[ -L "$current" ]]; then previous="$(readlink -f "$current")"; fi
next="$app_root/.current-$release_id"
ln -sfn "$release" "$next"
mv -Tf "$next" "$current"

rollback() {
  if [[ -n "$previous" && -d "$previous" ]]; then
    ln -sfn "$previous" "$app_root/.current-rollback"
    mv -Tf "$app_root/.current-rollback" "$current"
    pm2 startOrReload "$current/deploy/ecosystem.config.cjs" --update-env >/dev/null 2>&1 || true
    pm2 save >/dev/null 2>&1 || true
  else
    rm -f "$current"
    pm2 delete gymbro-api gymbro-web >/dev/null 2>&1 || true
    pm2 save >/dev/null 2>&1 || true
  fi
}

if ! pm2 startOrReload "$current/deploy/ecosystem.config.cjs" --update-env >/dev/null; then
  rollback
  exit 1
fi
pm2 save >/dev/null

healthy=false
for _ in $(seq 1 30); do
  if curl --fail --silent http://127.0.0.1:4120/health >/dev/null && \
     curl --fail --silent http://127.0.0.1:4121/health >/dev/null && \
     curl --fail --silent --resolve gymbro.spmbbanjarkab.web.id:443:127.0.0.1 https://gymbro.spmbbanjarkab.web.id/health >/dev/null && \
     curl --fail --silent --resolve gymbro-backend.spmbbanjarkab.web.id:443:127.0.0.1 https://gymbro-backend.spmbbanjarkab.web.id/health >/dev/null; then
    healthy=true
    break
  fi
  sleep 2
done
if [[ "$healthy" != true ]]; then
  rollback
  echo 'Health checks failed; previous PM2 release restored when available.' >&2
  exit 1
fi

find "$app_root/releases" -mindepth 1 -maxdepth 1 -type d ! -name "$release_id" -printf '%T@ %p\n' \
  | sort -rn | tail -n +3 | cut -d' ' -f2- | while IFS= read -r old; do rm -rf -- "$old"; done
printf 'Deployed %s\n' "$release_id"
