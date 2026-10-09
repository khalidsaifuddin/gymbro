#!/usr/bin/env bash
set -euo pipefail

mode="${1:-}"
case "$mode" in
  acme) source_file="nginx-gymbro-acme.conf" ;;
  tls) source_file="nginx-gymbro.conf" ;;
  *) echo 'Usage: install-nginx.sh acme|tls' >&2; exit 2 ;;
esac

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
target=/etc/nginx/sites-available/gymbro
sudo install -m 0644 "$script_dir/$source_file" "$target"
sudo ln -sfn "$target" /etc/nginx/sites-enabled/gymbro
sudo nginx -t
sudo systemctl reload nginx
