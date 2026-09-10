# Skeet Tracker environments

## Live field testing

- URL: https://sk33t.net
- Site: `appgprj_6a9d4e9d4e0c8191a6d59d0110caa77e`
- Checkout: `C:/Users/James/Documents/Codex/Skeet-Tracker`
- Branch: `main`
- Baseline: `b60ac8dde39d657fa84f72155394bda8fa94d669` (PR #6 merged).
- Hosted version at test setup: 11.
- Contains real shooting records. Do not deploy test work or apply test migrations here.

## User-account testing

- URL: https://skeet-tracker-login-test.jtdelosh.chatgpt.site
- Site: `appgprj_6aa28fd30fc0819180dd17a3c078983a`
- Checkout: `C:/Users/James/Documents/Codex/Skeet-Tracker-Login-Test`
- Branch: `feature/user-accounts`
- Separate Sites-managed D1 database using the logical binding `DB`.
- Owner-only access. The banner and browser title identify this as TEST.
- Starts with no shoots; no live data is copied. Test entries are disposable and do not sync to live.
- Login functionality is not implemented yet; this is the isolated baseline for that work.

## Deployment procedure

1. Work in the test checkout on `feature/user-accounts`.
2. Verify `.openai/hosting.json` contains the test Site ID above before using any hosting or database tools. Stop on a mismatch.
3. Build and run the existing tests. Package using the Sites helper.
4. Push validated source only to the test Site's returned source repository, save a version, and publish privately.
5. Record the deployed source SHA and version in the release handoff.

Both environments use the name `DB`; the distinct Site project IDs determine isolation. Never copy the live hosting manifest into this checkout. Do not use `db:migrate:remote` or `deploy:cloudflare` for Sites deployments.

Before merging the account release, remove the test-only banner/title and test Site ID from the proposed production change. Review account migration, back up the latest live data, and obtain rollout approval. A GitHub push or merge is not a substitute for the explicit Sites deployment procedure.
