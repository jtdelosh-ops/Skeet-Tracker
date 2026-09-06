import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getDb() {
  if (!env.DB) {
    throw new Error(
      "Database binding `DB` is unavailable. Run `npm run dev` locally, or configure the DB binding for your hosting provider."
    );
  }

  return drizzle(env.DB, { schema });
}
