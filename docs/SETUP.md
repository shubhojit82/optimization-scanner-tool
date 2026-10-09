# Mac setup, cloud deployment and Git changes

## 1. What you are downloading

`GEO_Workbench_Complete_Source.zip` contains one top-level `geo-workbench-v0.2.1/` folder, application source, dependency lockfile, Docker deployment files, tests and these instructions. No database, installed dependencies, personal credentials or build output is included.

Default runtime: React + Vite frontend, Node 24 HTTP API, SQLite repository. Business logic and contracts are shared with the first hosted version. A complete original Sites source snapshot is included under `reference/`; it does not require restoring anything for the standalone setup.

The existing private demo and your local/cloud instances have separate databases. This archive does not transfer data from the private demo. No GitHub repository was created in your account; create the repository once using the steps below.

## 2. Install on your Mac

Use Terminal. Install Homebrew first if needed: https://brew.sh. Alternatively install Node 24 from https://nodejs.org/en/download.

With Homebrew:

```sh
brew install node@24 git
export PATH="$(brew --prefix node@24)/bin:$PATH"
node --version
npm --version
```

`node --version` must show v24.x. Add the PATH export line to your shell configuration if Node 24 is not selected in new Terminal windows. `.nvmrc` is included for users who already use nvm: run `nvm install` and `nvm use` inside the project instead.

Extract the download, then enter its `geo-workbench-v0.2.1` folder. For a ZIP in Downloads:

```sh
cd ~/Downloads
unzip GEO_Workbench_Complete_Source.zip
cd geo-workbench-v0.2.1
cp .env.example .env
npm ci
npm run dev
```

Open http://localhost:5173. The API listens on 127.0.0.1:8080. Both processes stop with Control-C. If these ports are in use, stop the other application; the provided dev proxy assumes API port 8080.

Create a client, import page HTML and inspect findings. Local authentication uses `local-admin`, binds to loopback and requires no password. Imported content is never executed or published. HTML audits and manual imports work without a provider key. Automatic observations require a server-side OPENAI_API_KEY; see OBSERVATIONS.md.

Frontend edits reload automatically. Stop and rerun `npm run dev` after editing `src/core`, `src/application`, validation or the Node server, because the dev server compiles these modules at startup.

### Production build on your Mac

Stop the development processes first:

```sh
npm run typecheck
npm test
npm start
```

Open http://localhost:8080. `npm test` performs a build and runs 28 checks. You can also use `npm run build` when building without tests.

### Local data

The database is `data/geo.sqlite`, with SQLite WAL/SHM companions while running. Stop the app before copying the entire `data/` directory for an offline backup. Reusing the same directory preserves clients and audit history. `.env`, database files and `data/` are excluded from Git. Changing `GEO_LOCAL_USER` changes the owner identity and hides records belonging to the old owner.

The SQLite adapter applies an initial, version-tracked schema once. Future schema changes should append versioned migrations; do not edit an already-applied migration in place. The original Drizzle files are for the original D1 adapter, not the standalone startup path.

## 3. Push the source to your Git repository

Create an **empty private repository** on GitHub called `geo-workbench`. Do not initialize its README, because this folder already contains one. GitLab or another Git server works too.

From the project folder:

```sh
git init -b main
git add .
git commit -m "Add modular GEO Workbench foundation and portable runtime"
git remote add origin git@github.com:YOUR_USERNAME/geo-workbench.git
git push -u origin main
```

Replace `YOUR_USERNAME`. SSH requires your Git host's SSH setup; you may use its HTTPS clone URL instead. Keep authentication credentials in your Git credential manager, not in source or command arguments.

For later changes:

```sh
git checkout -b feature/queued-crawler
# Edit the code, then verify it.
npm run typecheck
npm test
git add .
git commit -m "Add queued crawler"
git push -u origin feature/queued-crawler
```

Open a pull request to `main`. The included GitHub workflow installs dependencies, checks types and builds/tests the portable application. It does **not** log into or deploy to your cloud account. After merging, update your VM using the deployment steps below.

If your Git identity has not been configured, configure your name and email using `git config` before committing.

## 4. Deploy on a cloud VM

The supplied deployment is a **single Linux VM** using Docker Compose, suitable for an initial private instance. It can run on AWS EC2, Azure VM, Google Compute Engine or another Linux VM with Docker. Infrastructure provisioning and DNS remain your cloud account's configuration.

Use a supported Linux OS and install Docker Engine plus the Compose plugin using Docker's official instructions for that OS: https://docs.docker.com/engine/install/. Confirm:

```sh
docker --version
docker compose version
```

For HTTPS, point a DNS hostname such as `geo.your-domain.com` at the VM's public IP. Allow inbound TCP 80 and 443; restrict SSH 22 to your administrative access. Do not expose application port 8080 publicly. Remove any incorrect AAAA record if the VM is not reachable over IPv6.

On the VM, clone your repository (using a deploy key or another configured Git credential):

```sh
git clone git@github.com:YOUR_USERNAME/geo-workbench.git
cd geo-workbench
cp .env.cloud.example .env
```

Generate a password and enter it into `.env` with an editor. This command prints a new password on your own terminal:

```sh
openssl rand -hex 32
```

Your VM `.env` should contain your actual values:

```dotenv
GEO_AUTH_MODE=basic
GEO_ADMIN_USERNAME=admin
GEO_ADMIN_PASSWORD=YOUR_GENERATED_PASSWORD
GEO_ALLOWED_ORIGINS=https://geo.your-domain.com
GEO_PUBLIC_HOST=geo.your-domain.com
```

Use the exact public origin, without a trailing slash. The password must be at least 16 characters; startup refuses the example placeholder. The root `.env` is excluded from Git and the Docker build context. Protect its filesystem permissions:

```sh
chmod 600 .env
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 app proxy
```

Open https://geo.your-domain.com. The browser prompts for the configured username/password. Caddy handles HTTPS for the hostname; certificate issuance depends on correct DNS and reachability. Credentials must be used over HTTPS for remote access. This is single-owner Basic authentication, not enterprise SSO or multiuser tenancy.

The app container runs without root, and `geo_data` stores SQLite outside the disposable container. One app replica uses that volume. Container rebuilds reuse it. Do not run multiple replicas against the same SQLite file; use the repository abstraction to move to PostgreSQL before that stage.

A deployment without a domain can be tested on a VM over an SSH tunnel using a loopback-only published Docker port, but that alternate Compose configuration is not included. The supplied deployment expects a hostname.

## 5. Deploy Git changes to the VM

Merge tested changes to `main`. On the VM, inside the cloned project:

```sh
bash scripts/deploy-vm.sh
```

The script performs `git pull --ff-only origin main`, rebuilds the image and restarts the application. It keeps the existing data volume and `.env`. This is an explicit Git-driven update, not an automatic remote deployment.

For the equivalent manual flow:

```sh
git pull --ff-only origin main
docker compose up -d --build
docker compose ps
```

Keep cloud secrets out of source. If `.env` changes, recreate the app with `docker compose up -d`. App source changes require `--build`. Review migrations and back up the database before a release that changes its schema.

An automated SSH/CD workflow can be added once the target VM, deployment credentials and release policy are chosen. The included GitHub CI is ready to use immediately.

## 6. Move data or back it up

To move your Mac data to the VM, stop the local app first and copy the `data/` directory securely. Keep the same owner identity on the VM (`GEO_ADMIN_USERNAME=local-admin` if you used the local default). Copy the snapshot into the app's mounted volume while the cloud app is stopped; database file ownership in that volume must permit the container's `node` user (UID 1000) to read/write it. Do not merge independent databases by copying files over one another.

A cloud backup example, with the proxy still running:

```sh
mkdir -p backups
docker compose stop app
docker compose run --rm --no-deps --user root --entrypoint tar app -C /app/data -czf - . > backups/geo-data.tar.gz
docker compose start app
```

Use a unique backup filename each time and store backups outside the VM too. Stop the app before restoring a consistent snapshot; preserve file ownership. `docker compose down` keeps named volumes, while `docker compose down -v` removes them. Avoid the latter when you need saved data.

## 7. What is verified and what remains

Verified in Linux with Node 24: type checks, frontend/server build, 12 domain/application tests, 4 portable integration tests, 6 provider/collection tests and 6 identity tests. HTTP tests cover creating clients, saving audits and observations, Basic authentication, spoofed identity-header rejection, origin checks, SQLite persistence and failed-batch rollback.

The Mac commands use the same Node/Vite code paths, but were not executed on an actual Mac. Docker is unavailable in the build environment, so the image/Compose/HTTPS deployment has not been executed. The package includes a normal npm lockfile using public npm registry URLs; clean downloading of dependencies requires Internet access.

This edition automates one OpenAI web-search observation per request. Add OPENAI_API_KEY to the server .env and restart; see OBSERVATIONS.md. Prompt generation and import-based audits/observations remain available without a key. Crawling, queued campaigns, additional providers, organization identity, CMS connectors, multi-instance storage and production telemetry are future increments.

## Official setup references

- Homebrew Node 24: https://formulae.brew.sh/formula/node@24
- Node SQLite API: https://nodejs.org/docs/latest-v24.x/api/sqlite.html
- Vite: https://vite.dev/guide/
- Docker Engine: https://docs.docker.com/engine/install/
- Docker Desktop on Mac (optional): https://docs.docker.com/desktop/setup/install/mac-install/
- Docker volumes: https://docs.docker.com/engine/storage/volumes/
