export const OWNER_EMAIL = "jtdelosh@gmail.com";
export const OWNER_ID = "james-delosh";
export interface Account { id: string; email: string; role: "admin" | "shooter"; displayName: string; expires_at: number; }

// Only called after proving a pre-existing owner session or redeeming an owner email code.
// A disabled account is never re-enabled by bootstrap; unknown users are never created here.
export async function ensureOwnerAccount(db: D1Database) {
  await db.prepare("INSERT INTO users (id,email,display_name,role,disabled,created_at) VALUES (?,?,?,'admin',0,?) ON CONFLICT DO NOTHING")
    .bind(OWNER_ID,OWNER_EMAIL,"James Delosh",Date.now()).run();
}

export async function migrateLegacyRecords(db: D1Database, account: Pick<Account,"id"|"email"|"role">) {
  if(account.id!==OWNER_ID || account.email!==OWNER_EMAIL || account.role!=="admin") throw Error("Only the designated owner can assign legacy records.");
  // An atomic, repeatable data operation, separate from schema-only migrations.
  // Leave old settings intact for rollback inspection. Never overwrite newer owner settings.
  await db.batch([
    db.prepare("INSERT INTO user_class_settings (user_id,event,starting_class) SELECT ?,event,starting_class FROM class_settings WHERE NOT EXISTS (SELECT 1 FROM account_migrations WHERE key='legacy-owner-v1') ON CONFLICT(user_id,event) DO NOTHING").bind(OWNER_ID),
    db.prepare("UPDATE shoots SET owner_id=? WHERE owner_id IS NULL AND NOT EXISTS (SELECT 1 FROM account_migrations WHERE key='legacy-owner-v1')").bind(OWNER_ID),
    db.prepare("INSERT INTO account_migrations (key,user_id,completed_at) VALUES ('legacy-owner-v1',?,?) ON CONFLICT(key) DO NOTHING").bind(OWNER_ID,Date.now()),
  ]);
}
