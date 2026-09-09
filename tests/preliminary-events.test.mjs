import assert from "node:assert/strict";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  cacheDir: ".sites-runtime/test-cache/preliminary",
  optimizeDeps: { noDiscovery: true },
  server: { middlewareMode: true, hmr: false },
});

after(async () => {
  await vite.close();
});

const score = (id, broken, targets = 100, label = "Main", sequence = id) => ({
  id,
  event: "12",
  broken,
  targets,
  label,
  sequence,
  classShot: "C",
  shotDate: null,
});

const shoot = (id, status, scores) => ({
  id,
  name: `Shoot ${id}`,
  date: `2026-0${id}-01`,
  status,
  scores,
});

test("combines preliminary and main targets in shoot history", async () => {
  const { summarizeShootGauge } = await vite.ssrLoadModule("/lib/scoring.ts");
  const event = shoot(1, "complete", [
    score(1, 96, 100, "Main", 0),
    score(2, 48, 50, "Preliminary", 1),
  ]);

  assert.deepEqual(summarizeShootGauge(event, "12"), {
    broken: 144,
    targets: 150,
    count: 2,
    classes: ["C"],
    dates: ["2026-01-01"],
  });
});

test("keeps a preliminary and main as separate rolling events in shoot order", async () => {
  const { calculateStats } = await vite.ssrLoadModule("/lib/scoring.ts");
  const shoots = [1, 2, 3, 4].map((id) =>
    shoot(id, "complete", [score(id, 93)]),
  );
  shoots.push(
    shoot(5, "complete", [
      score(5, 96, 100, "Main", 0),
      score(6, 48, 50, "Preliminary", 1),
    ]),
  );

  const stats = calculateStats(shoots, {})["12"];
  assert.equal(stats.active.length, 5);
  assert.deepEqual(
    stats.active.slice(-2).map((entry) => entry.label),
    ["Preliminary", "Main"],
  );
  assert.equal(stats.active.reduce((total, entry) => total + entry.targets, 0), 450);
  assert.equal(stats.average, 423 / 450);
});

test("defers an in-progress preliminary class change and notification", async () => {
  const { calculateStats, findClassChanges } = await vite.ssrLoadModule(
    "/lib/scoring.ts",
  );
  const history = [1, 2, 3, 4, 5].map((id) =>
    shoot(id, "complete", [score(id, 93)]),
  );
  const before = calculateStats(history, {});
  const preliminary = shoot(6, "in_progress", [
    score(6, 50, 50, "Preliminary", 0),
  ]);
  const inProgress = calculateStats([...history, preliminary], {});

  assert.equal(before["12"].className, "C");
  assert.equal(inProgress["12"].className, "C");
  assert.equal(inProgress["12"].provisional, true);
  assert.ok(inProgress["12"].average > before["12"].average);
  assert.deepEqual(findClassChanges(before, inProgress, {}), []);

  preliminary.status = "complete";
  const completed = calculateStats([...history, preliminary], {});
  const changes = findClassChanges(inProgress, completed, {});
  assert.equal(completed["12"].className, "B");
  assert.equal(completed["12"].provisional, false);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].direction, "up");
  assert.equal(changes[0].event, "12");
});
