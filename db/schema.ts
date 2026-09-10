import { integer, sqliteTable, text, index, primaryKey } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  role: text("role", { enum: ["admin", "shooter"] }).notNull().default("shooter"),
  disabled: integer("disabled").notNull().default(0),
  createdAt: integer("created_at").notNull(),
});
export const userClassSettings = sqliteTable("user_class_settings", {
  userId: text("user_id").notNull().references(() => users.id),
  event: text("event", { enum: ["12", "20", "28", "410", "doubles"] }).notNull(),
  startingClass: text("starting_class").notNull(),
}, (table) => [primaryKey({columns:[table.userId,table.event]})]);
export const accountMigrations = sqliteTable("account_migrations", {
  key: text("key").primaryKey(), userId: text("user_id").notNull().references(() => users.id),
  completedAt: integer("completed_at").notNull(),
});

export const loginChallenges = sqliteTable("login_challenges", {
  id: text("id").primaryKey(), email: text("email").notNull(), digest: text("digest").notNull(),
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

export const shoots = sqliteTable("shoots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerId: text("owner_id").references(() => users.id),
  shootNumber: integer("shoot_number"),
  name: text("name").notNull(),
  date: text("date").notNull(),
  status: text("status", { enum: ["in_progress", "complete"] })
    .notNull()
    .default("complete"),
}, (table) => [index("idx_shoots_status_date_id").on(table.status, table.date, table.id), index("idx_shoots_owner_date_id").on(table.ownerId,table.date,table.id)]);

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
