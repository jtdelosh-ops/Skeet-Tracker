import { integer, sqliteTable, text, index, primaryKey, uniqueIndex, check } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  role: text("role", { enum: ["admin", "shooter"] }).notNull().default("shooter"),
  disabled: integer("disabled").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  supportAccessAcknowledgedAt: integer("support_access_acknowledged_at"),
});
export const invitations = sqliteTable("invitations", {
  id: text("id").primaryKey(), email: text("email").notNull(),
  digest: text("digest").notNull().unique(),
  createdBy: text("created_by").notNull().references(() => users.id),
  createdAt: integer("created_at").notNull(), expiresAt: integer("expires_at").notNull(),
  revokedAt: integer("revoked_at"), redeemedAt: integer("redeemed_at"),
  emailStatus: text("email_status").notNull().default("not_sent"),
  sentAt: integer("sent_at"),
  redeemedBy: text("redeemed_by").references(() => users.id),
}, table => [index("idx_invitations_email_created").on(table.email,table.createdAt)]);
export const userClassSettings = sqliteTable("user_class_settings", {
  userId: text("user_id").notNull().references(() => users.id),
  event: text("event", { enum: ["12", "20", "28", "410", "doubles"] }).notNull(),
  startingClass: text("starting_class").notNull(),
}, (table) => [primaryKey({columns:[table.userId,table.event]})]);
export const adminAudit = sqliteTable("admin_audit", {
  id: text("id").primaryKey(), actorId: text("actor_id").notNull().references(()=>users.id),
  targetId: text("target_id").notNull().references(()=>users.id),
  action: text("action").notNull(), entityId: text("entity_id"),
  beforeJson: text("before_json"), afterJson: text("after_json"),
  createdAt: integer("created_at").notNull(),
},table=>[index("idx_admin_audit_created_id").on(table.createdAt,table.id),index("idx_admin_audit_target_created").on(table.targetId,table.createdAt)]);
export const accountMigrations = sqliteTable("account_migrations", {
  key: text("key").primaryKey(), userId: text("user_id").notNull().references(() => users.id),
  completedAt: integer("completed_at").notNull(),
});

export const loginChallenges = sqliteTable("login_challenges", {
  id: text("id").primaryKey(), email: text("email").notNull(), digest: text("digest").notNull(),
  invitationId: text("invitation_id").references(() => invitations.id),
  displayName: text("display_name"),
  expiresAt: integer("expires_at").notNull(), attempts: integer("attempts").notNull().default(0),
  consumed: integer("consumed").notNull().default(0), createdAt: integer("created_at").notNull(),
});
export const loginSessions = sqliteTable("login_sessions", {
  digest: text("digest").primaryKey(), email: text("email").notNull(),
  expiresAt: integer("expires_at").notNull(), createdAt: integer("created_at").notNull(),
});
export const loginLimits = sqliteTable("login_limits", {
  key: text("key").primaryKey(), count: integer("count").notNull(), expiresAt: integer("expires_at").notNull(),
});
export const importBatches=sqliteTable("import_batches",{
  id:text("id").primaryKey(),ownerId:text("owner_id").notNull().references(()=>users.id),
  actorId:text("actor_id").notNull().references(()=>users.id),source:text("source").notNull(),
  digest:text("digest").notNull(),
  createdAt:integer("created_at").notNull(),undoneAt:integer("undone_at"),total:integer("total").notNull(),
},table=>[check("import_total_nonnegative",sql`${table.total} >= 0`),index("idx_import_batches_owner_created").on(table.ownerId,table.createdAt)]);
export const importRecords=sqliteTable("import_records",{
  batchId:text("batch_id").notNull().references(()=>importBatches.id),shootId:integer("shoot_id").notNull(),snapshot:text("snapshot").notNull(),
},table=>[primaryKey({columns:[table.batchId,table.shootId]})]);

export const shoots = sqliteTable("shoots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerId: text("owner_id").references(() => users.id),
  importBatchId:text("import_batch_id").references(()=>importBatches.id),
  importKey:text("import_key"),
  shootNumber: integer("shoot_number"),
  name: text("name").notNull(),
  date: text("date").notNull(),
  status: text("status", { enum: ["in_progress", "complete"] })
    .notNull()
    .default("complete"),
}, (table) => [index("idx_shoots_status_date_id").on(table.status, table.date, table.id), index("idx_shoots_owner_date_id").on(table.ownerId,table.date,table.id),uniqueIndex("idx_shoots_owner_import_key").on(table.ownerId,table.importKey),index("idx_shoots_import_batch").on(table.importBatchId)]);

export const eventScores = sqliteTable(
  "event_scores",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    shootId: integer("shoot_id")
      .notNull()
      .references(() => shoots.id, { onDelete: "cascade" }),
    event: text("event", {
      enum: ["12", "20", "28", "410", "doubles"],
    }).notNull(),
    broken: integer("broken").notNull(),
    targets: integer("targets").notNull(),
    classShot: text("class_shot"),
    shotDate: text("shot_date"),
    sequence: integer("sequence").notNull().default(0),
    label: text("label").notNull().default("Main"),
  },
  (table) => [
    index("idx_event_scores_shoot_sequence").on(
      table.shootId,
      table.sequence,
    ),
  ],
);
export const classSettings = sqliteTable("class_settings", {
  event: text("event", { enum: ["12", "20", "28", "410", "doubles"] }).primaryKey(),
  startingClass: text("starting_class").notNull(),
});

export const shootNotes = sqliteTable("shoot_notes", {
  shootId: integer("shoot_id").primaryKey().references(() => shoots.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
