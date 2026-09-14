import assert from "node:assert/strict";
import test, { after } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const db = new DatabaseSync(":memory:");
for (const name of readdirSync(`${root}/drizzle`).filter((name) => name.endsWith(".sql")).sort()) {
  db.exec(readFileSync(`${root}/drizzle/${name}`, "utf8"));
}
// Exercise the actual route SQL against SQLite through D1's prepared-statement contract.
globalThis.historyTestDB = {
  prepare(sql) {
    return { bind(...args) { return {
      async first() { return db.prepare(sql).get(...args); },
      async all() { return { results: db.prepare(sql).all(...args) }; },
    }; } };
  },
};
globalThis.historyTestScores = async (rows) => rows.map((row) => ({
  ...row, scores: db.prepare('SELECT id, event, broken, targets, label, sequence, class_shot AS classShot, shot_date AS shotDate FROM event_scores WHERE shoot_id = ? ORDER BY sequence, id').all(row.id),
}));
const vite = await createServer({ appType: "custom", configFile: false, root,
  resolve: { alias: { "@": root } }, cacheDir: ".sites-runtime/test-cache/history", optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false },
  plugins: [{ name: "history-test-runtime", enforce: "pre",
    resolveId(id) {
      if (id === "@/lib/request-account" || id.endsWith("/lib/request-account")) return "\0history-account";
      if (id === "cloudflare:workers") return "\0test-d1";
      if (id.endsWith("/lib/tracker-data") || id === "@/lib/tracker-data") return "\0test-scores";
    },
    load(id) {
      if (id === "\0history-account") return 'export async function requestAccount(){ return {id:"history-fixture",email:"fixture@example.test",role:"shooter"}; }';
      if (id === "\0test-d1") return 'export const env = { DB: globalThis.historyTestDB };';
      if (id === "\0test-scores") return 'export const attachScores = globalThis.historyTestScores;';
    },
  }],
});
after(async () => { await vite.close(); db.close(); delete globalThis.historyTestDB; delete globalThis.historyTestScores; });
const { GET } = await vite.ssrLoadModule("/app/api/history/route.ts");
const { calculateStats, summarizeShootGauge } = await vite.ssrLoadModule("/lib/scoring.ts");
const { createRequestGate } = await vite.ssrLoadModule("/lib/request-gate.ts");

test("superseded requests cannot commit results, including the typing debounce gap", async () => {
  const gate = createRequestGate();
  const old = gate.start();
  gate.cancel();
  assert.equal(old.signal.aborted, true);
  assert.equal(old.isCurrent(), false);
  const newer = gate.start();
  let result = "previous results";
  await Promise.resolve().then(() => { if (newer.isCurrent()) result = "new query"; });
  await Promise.resolve().then(() => { if (old.isCurrent()) result = "stale query"; });
  assert.equal(result, "new query");
  gate.cancel();
  assert.equal(newer.isCurrent(), false);
});
const query = async (q = "", page = 1) => {
  const response = await GET(new Request(`http://local/api/history?${new URLSearchParams({ q, page: String(page) })}`));
  return { status: response.status, ...await response.json() };
};
function seed() {
  db.exec("INSERT OR IGNORE INTO users (id,email,display_name,created_at) VALUES ('history-fixture','history@example.test','Fixture',0)");
  db.exec("DELETE FROM event_scores; DELETE FROM shoots;");
  for (let id = 1; id <= 23; id++) {
    db.prepare("INSERT INTO shoots (id, name, date, status, owner_id) VALUES (?, ?, ?, 'complete', 'history-fixture')").run(id, id === 1 ? "North State 100%_ O'Brien\\Open" : `Open ${id}`, id <= 3 ? "2025-01-01" : "2026-01-01");
    db.prepare("INSERT INTO event_scores (id, shoot_id, event, broken, targets, label, sequence) VALUES (?, ?, '12', 96, 100, 'Main', 0)").run(id, id);
  }
  db.prepare("INSERT INTO event_scores (id, shoot_id, event, broken, targets, label, sequence) VALUES (24, 1, '12', 48, 50, 'Preliminary', 1)").run();
}

test("23 shoots paginate 10/10/3 with stable date ties and complete event totals", async () => {
  seed();
  const pages = await Promise.all([1, 2, 3].map((p) => query("", p)));
  assert.deepEqual(pages.map((p) => p.shoots.length), [10, 10, 3]);
  assert.ok(pages.every((p) => p.total === 23 && p.pages === 3 && p.pageSize === 10));
  assert.deepEqual(pages.flatMap((p) => p.shoots.map((s) => s.id)), Array.from({ length: 23 }, (_, i) => 23 - i));
  assert.equal(pages[2].shoots[2].scores.length, 2);
  const total = summarizeShootGauge(pages[2].shoots[2], "12");
  assert.equal(total.broken, 144); assert.equal(total.targets, 150);
});
test("search finds old records, combines case-insensitive tokens and exact years, escapes literals", async () => {
  seed();
  for (const q of ["state", "  nOrTh   STATE  2025 ", "100%_", "O'Brien", "\\Open"]) {
    const result = await query(q);
    assert.equal(result.total, 1, q); assert.equal(result.shoots[0].id, 1);
  }
  assert.equal((await query("2025")).total, 3);
  assert.equal((await query("state 2026")).total, 0);
  assert.equal((await query("2025 2026")).total, 0);
  assert.equal((await query("%_missing")).total, 0);
  assert.equal((await query("' OR 1=1 --")).total, 0);
  assert.equal((await query("  ")).total, 23);
  assert.equal((await query("x".repeat(201))).status, 400);
});
test("invalid and out-of-range pages, empty data, and deletion of the last page clamp predictably", async () => {
  seed();
  for (const page of [0, -1, "oops", "1.5", "1e2", "9007199254740992"]) assert.equal((await query("", page)).page, 1);
  assert.equal((await query("", 999)).page, 3);
  db.exec("DELETE FROM event_scores WHERE shoot_id <= 3; DELETE FROM shoots WHERE id <= 3;");
  assert.equal((await query("", 3)).page, 2);
  db.exec("DELETE FROM event_scores; DELETE FROM shoots;");
  const empty = await query("", 3);
  assert.equal(empty.page, 1); assert.equal(empty.total, 0); assert.equal(empty.shoots.length, 0);
});
test("history browsing cannot change full-history stats, including older relevant gauges", async () => {
  seed();
  db.exec("UPDATE event_scores SET event='20' WHERE shoot_id <= 5;");
  const all = await globalThis.historyTestScores(db.prepare("SELECT * FROM shoots ORDER BY date, id").all());
  const before = calculateStats(all, { "20": "AA" });
  assert.equal(before["20"].active.length, 5);
  for (const [q, page] of [["", 1], ["", 3], ["state 2025", 1]]) {
    await query(q, page);
    const after = calculateStats(await globalThis.historyTestScores(db.prepare("SELECT * FROM shoots ORDER BY date, id").all()), { "20": "AA" });
    assert.deepEqual(after, before);
  }
  const plan = db.prepare("EXPLAIN QUERY PLAN SELECT id FROM shoots WHERE status=? ORDER BY date DESC,id DESC LIMIT 10").all("complete");
  assert.ok(plan.some((r) => r.detail.includes("idx_shoots_status_date_id")));
});
