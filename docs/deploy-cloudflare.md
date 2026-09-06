# Deploy to Cloudflare Workers

This deployment uses Cloudflare Workers for the application and Cloudflare D1
for its SQLite database.

## 1. Install and sign in

```bash
npm ci
npx wrangler login
```

For automated deployment, provide `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` instead of using browser login.

## 2. Create the database

```bash
npx wrangler d1 create skeet-tracker
```

When Wrangler asks whether it should update `wrangler.jsonc`, answer **Yes**.
Confirm that the `DB` binding retains `"migrations_dir": "drizzle"` afterward.
The generated database ID belongs to your account and replaces the all-zero
local placeholder.

## 3. Deploy

```bash
npm run deploy:cloudflare
```

That command applies the schema migrations, creates a production build, and
deploys the Worker. Wrangler prints the resulting `workers.dev` address.

Future updates use the same command. Migrations are versioned and applied only
once.

## Local development

`npm run dev` always uses a separate database under `.wrangler/`. It does not
read or modify the production D1 database.

## Custom domain

After the first deployment, add a custom domain or route from the Worker's
settings in the Cloudflare dashboard. No source-code change is required.
