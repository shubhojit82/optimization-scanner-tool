# Free-tier deployment pipeline

```
feature branch --PR--> CI (typecheck, tests, docker build)
                          |
                    merge to main --> CI --> auto-deploy STAGING
                          |
                  git tag v0.1.0  --> CI --> deploy PRODUCTION (nightly backup + auto-rollback)
```

Everything runs on one free VM plus GitHub Actions (free for private repos up to 2,000 min/month).

| Piece | Free option |
|---|---|
| Server | Oracle Cloud Always Free VM (Ubuntu 24.04, ARM Ampere A1 or AMD micro). Needs a card for sign-up verification, not charged on Always Free resources. |
| CI/CD | GitHub Actions |
| HTTPS + hostname | Caddy (Let's Encrypt) + `sslip.io` names such as `app.1-2-3-4.sslip.io`. Swap in a real domain later. |
| Data | SQLite files on the VM disk, nightly gzip backup, 14 days kept |
| Environments | `staging` and `prod` are two containers on the same VM, each with its own data folder, `.env` and database |

Not free-tier safe: Oracle can reclaim Always Free instances that sit idle for 7 days (CPU, network and memory all under about 20%). Keep the app in use, or convert the account to Pay As You Go (still $0 for Always Free shapes).

## One-time setup

### 1. Push the code to GitHub
Create a private repo (or use the existing `origin`). Use `gh auth login` or a fresh personal access token. Never paste the token into the remote URL.

### 2. Create the VM (Oracle Cloud console)
1. Compute > Instances > Create. Image: Ubuntu 24.04. Shape: `VM.Standard.A1.Flex` with 2 OCPU and 12 GB (Always Free), or `VM.Standard.E2.1.Micro`. If A1 reports "Out of capacity", retry later or in another availability domain.
2. Upload your SSH public key.
3. Networking > VCN > Security List > add **Ingress rules** for TCP 80 and 443 from `0.0.0.0/0`.

### 3. Bootstrap the VM
```bash
ssh ubuntu@<vm-ip>
curl -fsSLO https://raw.githubusercontent.com/<you>/<repo>/main/deploy/bootstrap.sh   # private repo: scp it instead
GEO_REPO_URL=git@github.com:<you>/<repo>.git GEO_ADMIN_EMAIL=you@company.com bash bootstrap.sh
```
The first run prints a public key. Add it under repo > Settings > Deploy keys (read-only), then run the script again. At the end it prints:
- the Super Admin password for each environment (stored only in `/opt/geo/<env>/.env`)
- the private key for GitHub Actions, shown once
- the values for the secrets below

### 4. GitHub settings
Repo > Settings > Secrets and variables > Actions:

| Name | Type | Value |
|---|---|---|
| `VM_HOST` | secret | VM public IP |
| `VM_USER` | secret | `ubuntu` |
| `VM_SSH_KEY` | secret | private key printed by bootstrap |
| `STAGING_URL` | variable | `https://staging.<ip-dashes>.sslip.io` |
| `PROD_URL` | variable | `https://app.<ip-dashes>.sslip.io` |

Then: Settings > Environments > `production` > add yourself as **Required reviewer** (free for public repos; private repos need a paid plan, in which case the tag itself is your approval). Settings > Branches > protect `main`: require the `verify` check and a pull request.

## Day-to-day flow
1. `git switch -c feature/x`, develop locally with `npm run dev`.
2. Open a PR. CI runs typecheck, all tests, the deploy-script syntax check and a Docker build.
3. Merge to `main`. Staging deploys automatically. Check it at the staging URL.
4. Release: `git tag v0.1.0 && git push origin v0.1.0`. Production deploys after the same CI checks.
5. Hotfix or redeploy: Actions > Deploy > Run workflow.

## Operations (on the VM)
```bash
docker logs -f $(docker ps -qf label=com.docker.compose.project=geo-prod)   # prod logs
sudo docker compose -p geo-prod ps
bash /opt/geo/prod/app/deploy/backup.sh prod                                  # manual backup
ls /opt/geo/backups/prod
```
Restore: stop the app, `gunzip -c backup.sqlite.gz > /opt/geo/prod/data/geo.sqlite`, remove `geo.sqlite-wal` and `geo.sqlite-shm`, start the app again.
Rollback: a failed health check rolls back automatically. To go back manually, re-run the Deploy workflow on the older tag.
AI keys and SMTP settings: edit `/opt/geo/<env>/.env`, then redeploy (or `docker compose -p geo-<env> restart`).

## Known limits
- Backups live on the same VM. Copy `/opt/geo/backups` off-box (for example `rclone` to any free storage) before relying on them.
- A single VM means a short outage during each deploy and no high availability.
- sslip.io is a shared public service. Use your own domain for anything long-lived.
- The first build on a small VM is slow (several minutes). A 2 GB swap file is created for it.
