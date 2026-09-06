import { integer, sqliteTable, text, index } from "drizzle-orm/sqlite-core";

export const shoots = sqliteTable("shoots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  shootNumber: integer("shoot_number"),
  name: text("name").notNull(),
  date: text("date").notNull(),
  status: text("status", { enum: ["in_progress", "complete"] })
    .notNull()
    .default("complete"),
});

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
