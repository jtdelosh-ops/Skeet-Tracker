# Skeet Tracker environments

## Production

- URL: https://sk33t.net
- Site: `appgprj_6a9d4e9d4e0c8191a6d59d0110caa77e`
- Main checkout: `C:/Users/James/Documents/Codex/Skeet-Tracker`
- Branch: `main`; this branch's hosting manifest must identify production.
- One production database holds all accounts, with records and settings isolated by account. James is the designated administrator.
- Set `APP_ORIGIN=https://sk33t.net`. Store `AUTH_SECRET`, `RESEND_API_KEY`, and `OPENAI_API_KEY` as Sites secrets.

## Account testing

- URL: https://skeet-tracker-login-test.jtdelosh.chatgpt.site
- Site: `appgprj_6aa28fd30fc0819180dd17a3c078983a`
- Checkout: `C:/Users/James/Documents/Codex/Skeet-Tracker-Login-Test`
- The existing `feature/user-accounts` branch preserves the tested build.
- The account rollout transfers test records once into production. The old test URL then redirects to production; its original database remains preserved.
- Future testing must deliberately resume an isolated test deployment. Never point a development database at production or assume data synchronizes.

## Publishing

Use Sites-managed D1 and native Sites publishing. Both databases use logical binding `DB`; the Site project ID determines the actual database. Do not use standalone Cloudflare deployment or remote migration commands.

Verify the target manifest, exact pushed source and relevant tests before publishing. Applied schema migrations are immutable. GitHub merging alone does not deploy a Site.

See `docs/account-rollout.md` for the migration procedure. Earlier milestone documents describe historical checkpoints, not current deployment access.
