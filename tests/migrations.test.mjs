import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

test("ships schema-only migrations for a fresh empty database", async () => {
  const migrationDirectory = path.join(root, "drizzle");
  const migrationNames = (await readdir(migrationDirectory))
    .filter((name) => name.endsWith(".sql"))
    .sort();

  assert.ok(migrationNames.length > 0);

  const sql = (
    await Promise.all(
      migrationNames.map((name) =>
        readFile(path.join(migrationDirectory, name), "utf8"),
      ),
    )
  ).join("\n");

  assert.match(sql, /CREATE TABLE `shoots`/);
  assert.match(sql, /CREATE TABLE `event_scores`/);
  assert.doesNotMatch(sql, /\bINSERT\s+INTO\b/i);
});
