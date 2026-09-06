# NSSA Skeet Tracker

A phone-friendly tracker for NSSA registered skeet scores, rolling five-event
averages, classifications, HOA/HAA, and tournament history. It supports 12,
20, and 28 gauge, .410 bore, optional doubles, and multiple same-gauge events
within one shoot.

The tracker starts empty. It contains no personal score history, account,
deployment URL, production database identifier, or preset starting classes.
Starting classes can be configured per event in the app; leaving one unset uses
the mathematical rolling-average class without an annual downgrade floor.

## Run it locally

Prerequisite: [Node.js](https://nodejs.org/) 22.13 or newer.

```bash
git clone https://github.com/jtdelosh-ops/Skeet-Tracker.git
cd Skeet-Tracker
npm ci
npm run dev
```

Open the address printed in the terminal. The first run automatically creates
and migrates a local D1-compatible SQLite database. Local scores are stored
under `.wrangler/` and never sent to a hosted database.

To start without checking migrations again, use `npm run dev:app`.

## Deploy it

Choose the hosting path that fits you:

- **Cloudflare Workers:** native deployment with a D1 database. See
  [`docs/deploy-cloudflare.md`](docs/deploy-cloudflare.md).
- **ChatGPT Sites:** ask ChatGPT to configure and host an independent copy. See
  [`docs/deploy-chatgpt-sites.md`](docs/deploy-chatgpt-sites.md).
- **Another provider:** the interface is ordinary React/Next code, but the
  current persistence adapter uses Cloudflare D1. A different host needs a
  compatible SQLite/database adapter or a Cloudflare D1 connection.

Every deployment receives its own empty database. Scores entered in one hosted
instance are not stored in Git and are not shared with other installations.

## Useful commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Migrate and start the local application |
| `npm run build` | Create a production build |
| `npm test` | Build and run the test suite |
| `npm run lint` | Check the source code |
| `npm run db:generate` | Generate a migration after a schema change |
| `npm run db:migrate:local` | Apply migrations to the local database |
| `npm run db:migrate:remote` | Apply migrations to the configured Cloudflare database |
| `npm run deploy:cloudflare` | Migrate, build, and deploy to Cloudflare |

## Architecture

- React 19 and Next.js-compatible App Router APIs through
  [Vinext](https://github.com/cloudflare/vinext)
- Cloudflare Worker API routes
- Cloudflare D1 / SQLite persistence
- Drizzle ORM with versioned migrations in `drizzle/`
- No required secrets or external services

The optional `.openai/hosting.json` contains only logical binding names so the
same repository can be imported into ChatGPT Sites. It contains no Site ID and
does not affect ordinary local or Cloudflare use.

## Data and privacy

This repository contains the database schema and migrations only. Do not commit
`.wrangler/`, `.env*`, database exports, or personal score files. These paths
are ignored by Git.

## License

MIT. See [`LICENSE`](LICENSE).
