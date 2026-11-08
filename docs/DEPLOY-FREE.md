# Free-tier deployment (Oracle Always Free Micro VM + GitHub Actions)

```
feature branch --PR--> CI: typecheck, 45 tests, docker build + container smoke test
merge to main        > CI runs again (nothing is deployed)
git tag v0.1.0       > CI > build image in GitHub > stream it to the VM > health check > auto-rollback if unhealthy
```

| Piece | Free option |
|---|---|
| Server | Oracle Cloud Always Free `VM.Standard.E2.1.Micro` (x86, 1 GB RAM). If the free ARM shape (A1) ever becomes available, the same scripts work on it. |
| CI/CD | GitHub Actions |
| HTTPS | Caddy (Let's Encrypt) on a free `sslip.io` name such as `app.1-2-3-4.sslip.io` |
| Data | SQLite on the VM disk, nightly gzip backup, 14 days kept |

Why the image is built in GitHub: a 1 GB VM cannot run `npm ci` and the Vite build. CI builds it and pipes it to the VM, which only runs it.

Limits to know: one environment (production) fits on this VM, so "staging" is the CI container smoke test. There is a short outage on each deploy. Backups live on the same VM, so copy them off now and then. Oracle can suspend accounts idle for 30 days or more.

## Setup, once

1. Oracle: create the Micro instance (Ubuntu 24.04 Minimal, x86, `VM.Standard.E2.1.Micro`, Always Free-eligible), with your SSH public key and a public IPv4 address. Open ports 80 and 443 in the subnet's Security List.
2. Copy and run the bootstrap on the VM:
   ```bash
   scp -i ~/.ssh/oracle_geo deploy/bootstrap.sh ubuntu@VM_IP:~
   ssh -i ~/.ssh/oracle_geo ubuntu@VM_IP
   GEO_ADMIN_EMAIL=you@company.com bash bootstrap.sh
   ```
   It prints the Super Admin password and, once, a private key for GitHub.
3. GitHub, repo Settings > Secrets and variables > Actions:

   | Name | Type | Value |
   |---|---|---|
   | `VM_HOST` | secret | VM public IP |
   | `VM_USER` | secret | `ubuntu` |
   | `VM_SSH_KEY` | secret | the private key printed by bootstrap |
   | `PROD_URL` | variable | `https://app.<ip-with-dashes>.sslip.io` |

## Day to day

1. `git switch -c feature/x`, develop with `npm run dev`, open a PR. CI must pass.
2. Merge to `main`.
3. Release: `git tag v0.1.0 && git push origin v0.1.0`. Production updates and is smoke tested.
4. Redeploy or roll forward: Actions > Deploy > Run workflow.

## Operations (on the VM)

```bash
docker ps
docker logs -f $(docker ps -qf label=com.docker.compose.service=app)
/opt/geo/backup.sh && ls /opt/geo/backups
nano /opt/geo/.env && cd /opt/geo && GEO_TAG=$(cat current-tag) docker compose --env-file host.env -p geo -f compose.yaml up -d   # apply new keys
```

Restore: `docker compose -p geo stop app`, `gunzip -c backup.sqlite.gz > /opt/geo/data/geo.sqlite`, delete `geo.sqlite-wal` and `geo.sqlite-shm`, `chown 1000:1000 /opt/geo/data/geo.sqlite`, start the app again.
Rollback: a failed health check rolls back automatically. To go back manually, re-run the Deploy workflow on an older tag.
