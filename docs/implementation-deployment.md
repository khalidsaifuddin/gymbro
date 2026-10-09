# Deployment implementation plan

## Scope

Deploy the current Gymbro web/API version to the user-authorized VPS at `103.127.132.229`, route the frontend through `gymbro.spmbbanjarkab.web.id` and the API through `gymbro-backend.spmbbanjarkab.web.id`, use PM2 for both services, preserve the installed PostgreSQL service and its existing data, and configure GitHub Actions to deploy commits pushed to `main`.

## Components affected

- `docs/deployment-plan.md` and this file for runbook/acceptance evidence.
- Frontend API base URL, credentialed CORS, OAuth callback/redirect origins, backend runtime configuration, and deployment scripts for a repeatable production start.
- Separate nginx virtual hosts and certificates for the frontend and API domains, plus PM2 process definitions on the VPS.
- A GitHub Actions workflow and narrowly scoped repository secrets for SSH deployment.
- Existing PostgreSQL: inspect version, readiness, roles/databases, and backups; never reset, drop, or replace it.

## Acceptance scenarios

1. Record VPS OS/architecture, free loopback ports, nginx/PM2 availability, PostgreSQL health, disk space, and current backups without printing credentials or modifying existing application data.
2. Build and test the current frontend and Go backend; deploy to a dedicated application directory and run both services under PM2 bound to loopback addresses.
3. Verify both DNS names resolve to this VPS. Verify frontend and API health locally and through nginx using each `Host` header. Obtain and validate a certificate for each name before enabling HTTPS redirects; if DNS/ACME validation is unavailable, leave safe HTTP vhosts prepared and report the DNS blocker.
4. Connect to the existing PostgreSQL instance using an app-specific database/role only after confirming no collision; apply versioned migrations without changing unrelated databases. Preserve an existing Gymbro database if found.
5. Verify the GitHub Actions workflow runs on every push to `main`, builds/tests before deployment, serializes deployments, checks health, and keeps the previous release available for app rollback.
6. Verify the app sends credentialed API calls to the backend origin, the API only grants CORS to the frontend origin, mutation CSRF checks use that frontend origin, and OAuth callback cookies remain on the API origin while callback redirects return to the frontend.
7. Keep SSH key/database/OAuth values out of git, command output, and committed config. Do not configure a placeholder Google OAuth identity or secret.

## Order of work

1. Inspect repository deployment conventions and validate local tests/builds.
2. Inspect VPS, DNS, certificates, and GitHub access read-only; choose ports and an isolated deployment path from observed state.
3. Implement and test separate-origin frontend/API access, CORS, OAuth callback routing, deployment files, and GitHub workflow.
4. Deploy current commit to the VPS; create or reuse only the Gymbro-owned database and role after inspection, then run migrations.
5. Configure PM2 and the two nginx vhosts, issue certificates for both names, verify HTTPS health and redirects, and retain rollback release.
6. Add GitHub repository secrets without revealing values; trigger/validate the workflow on a safe `main` commit only if repository policy and branch state permit it.

## Validation commands

- `cd frontend && npm test`
- `cd frontend && npm run typecheck && npm run build:web`
- `go test ./...`
- `go test -tags integration ./...` with the documented disposable PostgreSQL test database only
- `git diff --check`
- Deployment-specific: workflow YAML parse, SSH remote `nginx -t`, PM2 status/log tail without environment dumps, loopback health checks, and nginx `Host` header health checks.

## Safety boundaries and open observations

- No destructive database command is permitted. Existing PostgreSQL data and other PM2/nginx apps are outside this change.
- Nginx reload is allowed only after syntax validation and a dedicated site config is installed.
- A successful manual deployment does not prove the GitHub workflow. Workflow execution requires a permitted push/merge to `main` after the required secret exists.

## Execution record — 2026-10-09

- Both DNS names resolve to `103.127.132.229`. Separate Let's Encrypt certificates were issued for `gymbro-frontend` and `gymbro-backend`, valid through 2027-01-07. HTTP requests redirect to HTTPS. Certbot timer is enabled; dry-run renewal for both certificates succeeded.
- Nginx routes the frontend and API to loopback ports `4121` and `4120`. API root is 404; `/api/` and `/health` are proxied. `nginx -t` passed before reload.
- Dedicated PostgreSQL role/database `gymbro_app`/`gymbro` were created after confirming no collision. Existing databases were not changed. The credential is in `/home/spmb-sandbox/.config/gymbro/backend.env` with owner-only permissions.
- PM2 processes `gymbro-api` and `gymbro-web` are online; the PM2 systemd unit is enabled. Both local and HTTPS `/health` checks returned `ok`, the exercise catalog endpoint returned data, and the HTTP hosts returned 301.
- Release `c30ca01cbb48` is active under `/home/spmb-sandbox/apps/gymbro/current`; release rollback remains available. The API binds `127.0.0.1:4120`; the static frontend binds `127.0.0.1:4121`.
- Verified locally: frontend 294 unit tests and typecheck, three static-server tests including PM2 symlink startup, Go unit tests, PostgreSQL integration tests, production web export, account-sync browser suite (9/9), workflow YAML parse, shell syntax, and `git diff --check`.
- GitHub Actions workflow is present locally but not active in GitHub: this session has no GitHub authentication, the repository metadata is read-only, and the change has not been merged to `main`. Once published, add repository secret `GYMBRO_DEPLOY_KEY` with the authorized private deploy key. No key value belongs in this document.
- Google OAuth is not configured on the VPS. Register callback `https://gymbro-backend.spmbbanjarkab.web.id/api/v1/auth/google/callback` and add the real client credentials privately if account login is needed.
- Live camera accuracy, including push-up reps on a physical device, is not established by the automated tests. Native iOS/Android and Safari remain outside this web deployment validation.
