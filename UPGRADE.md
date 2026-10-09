# Update v0.1.1 or v0.2.0 to v0.2.1 on your Mac

This download contains the complete source and two upgrade patches. Check the version in your existing `package.json`:

- From **v0.2.0**, use `updates/v0.2.0-to-v0.2.1.patch`.
- From **v0.1.1**, use `updates/v0.1.1-to-v0.2.1.patch`.

Apply the matching patch to your existing installation to retain your clients and audits. The example commands below show the v0.2.0 upgrade.

1. Stop your app with Control-C.
2. Extract this release into a **separate** folder. Do not replace your old project with an empty fresh installation.
3. In Terminal, enter your **existing** `geo-workbench` project directory. Back up its `data/` directory while the app is stopped. Keep `.env` and `GEO_LOCAL_USER` unchanged so you retain access to your records.
4. Replace the placeholder patch path below with its actual extracted location:

   ```sh
   git apply --check /absolute/path/geo-workbench-v0.2.1/updates/v0.2.0-to-v0.2.1.patch
   git apply /absolute/path/geo-workbench-v0.2.1/updates/v0.2.0-to-v0.2.1.patch
   npm ci
   npm run typecheck
   npm test
   ```

   `git apply` works even if you have not initialized a repository. If the check reports a conflict, stop before applying and merge that file against the full source in this release. Each patch expects the original source for its starting version; it does not overwrite `data/` or `.env`.
5. Add `OPENAI_API_KEY=your_api_key` and `GEO_OPENAI_MODEL=gpt-4.1` to your **existing** `.env`. Never commit that file.
6. Run `npm run dev`, reload http://localhost:5173 and select your existing client. Click **Edit client**. For WFG, enter:

   - Brand name: `World Financial Group`
   - Brand aliases: `WFG, WorldFinancialgroup`

   Save. Existing answers are re-evaluated; their text and timestamps stay unchanged. The old audit is preserved. Reimport page HTML if you want a fresh brand-cue assessment, then review your existing observations before running more questions.

For a new installation, enter the extracted `geo-workbench-v0.2.1` folder, run `cp .env.example .env`, then `npm ci` and `npm run dev`. This creates a new empty database. Existing installations should use the patch above.

## Commit and deploy your change

Review `git diff` and `git status` in your existing Git repository. Stage the changed code/docs and new source/test files, then commit and push to your configured remote. `.env`, `data/` and build outputs are ignored. If you are starting Git for the first time, follow `docs/SETUP.md`.

```sh
git add README.md UPGRADE.md app src tests docs package.json package-lock.json .env.example .env.cloud.example
git commit -m "Add editable client identity and brand aliases"
git push
```

On your single cloud VM, pull that commit. Add the key to the VM's existing `.env` and run `docker compose up -d --build`. Keep the existing persistent volume and owner identity. Do not run `docker compose down -v`. HTTP Basic authentication must remain behind HTTPS as described in `docs/SETUP.md`.
