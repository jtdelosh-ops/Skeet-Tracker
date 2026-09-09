import assert from "node:assert/strict";
import test, { after } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const db = new DatabaseSync(":memory:");
db.exec("PRAGMA foreign_keys=ON");
for (const name of readdirSync(`${root}/drizzle`).filter((n) => n.endsWith('.sql')).sort()) db.exec(readFileSync(`${root}/drizzle/${name}`, 'utf8'));
globalThis.notesTestDB = { prepare(sql) {
  let values = [];
  return {
    bind(...args) { values = args; return this; },
    async run() { db.prepare(sql).run(...values); return { success: true }; },
    async all() { return { results: db.prepare(sql).all(...values) }; },
    async first() { return db.prepare(sql).get(...values); },
    async raw() { return db.prepare(sql).all(...values).map((r) => Object.values(r)); },
  };
} };
const vite = await createServer({ configFile: false, appType: 'custom', root,
  resolve: { alias: { '@': root } }, optimizeDeps: { noDiscovery: true }, cacheDir: '.sites-runtime/test-cache/notes',
  server: { middlewareMode: true, hmr: false },
  plugins: [{ name: 'notes-d1', resolveId(id) { if (id === 'cloudflare:workers') return '\0notes-d1'; },
    load(id) { if (id === '\0notes-d1') return 'export const env = {DB: globalThis.notesTestDB}'; } }],
});
after(async () => { await vite.close(); db.close(); delete globalThis.notesTestDB; });
const routes = await vite.ssrLoadModule('/app/api/shoots/route.ts');
const history = await vite.ssrLoadModule('/app/api/history/route.ts');
const { shootTotals } = await vite.ssrLoadModule('/lib/scoring.ts');
const body = (data, method = 'POST') => new Request('http://local/api/shoots', { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });

test('totals include four main gauges, conditional doubles, and exclude preliminaries', () => {
  const scores = ['12','20','28','410'].map((event) => ({ event, label: 'Main', broken: 96, targets: 100 }));
  scores.push({ event: '12', label: 'Preliminary', broken: 50, targets: 50 });
  assert.deepEqual(shootTotals({ scores }), { hoa: { broken:384, targets:400 }, hasDoubles:false, haa:null });
  scores.push({ event: 'doubles', label: 'Main', broken: 90, targets: 100 });
  assert.deepEqual(shootTotals({ scores }).haa, { broken:474, targets:500 });
  assert.equal(shootTotals({ scores: scores.filter((s) => s.event !== '410') }).hoa, null);
  assert.equal(shootTotals({ scores: scores.filter((s) => s.event !== '410') }).haa, null);
  assert.equal(shootTotals({ scores: [{ event:'doubles', label:'Preliminary',broken:50,targets:50 }] }).hasDoubles, false);
  assert.equal(shootTotals({ scores: [] }).hoa, null);
});

test('notes round trip, preserve timestamps and omitted fields, validate before writes, clear and cascade', async () => {
  const fixture = { name:'Synthetic notes test',date:'2026-01-01',status:'complete',notes:'Windy\nPractice station 4.',entries:[{event:'12',broken:96,targets:100}] };
  const created = await routes.POST(body(fixture));
  assert.equal(created.status, 201);
  const {shoot} = await created.json();
  const read = async () => (await (await routes.GET()).json()).shoots.find((s) => s.id === shoot.id);
  const first = await read();
  assert.equal(first.notes.content, fixture.notes);
  assert.equal(first.notes.createdAt, first.notes.updatedAt);
  const page = await (await history.GET(new Request('http://local/api/history?q=Synthetic'))).json();
  assert.deepEqual(page.shoots[0].notes, first.notes);
  const { notes: ignored, ...withoutNotes } = fixture;
  void ignored;
  assert.equal((await routes.PATCH(body({...withoutNotes,id:shoot.id},'PATCH'))).status,200);
  assert.deepEqual((await read()).notes, first.notes);
  db.prepare("UPDATE shoot_notes SET updated_at='2000-01-01T00:00:00.000Z' WHERE shoot_id=?").run(shoot.id);
  await routes.PATCH(body({...fixture,id:shoot.id,notes:'Updated practice notes'},'PATCH'));
  const updated = await read();
  assert.equal(updated.notes.createdAt,first.notes.createdAt);
  assert.notEqual(updated.notes.updatedAt,'2000-01-01T00:00:00.000Z');
  assert.equal(updated.notes.content,'Updated practice notes');
  for (const notes of [123, 'x'.repeat(5001), null]) assert.equal((await routes.PATCH(body({...fixture,id:shoot.id,notes},'PATCH'))).status,400);
  assert.equal((await read()).notes.content,'Updated practice notes');
  await routes.PATCH(body({...fixture,id:shoot.id,notes:'   '},'PATCH'));
  assert.equal((await read()).notes,null);
  await routes.PATCH(body({...fixture,id:shoot.id,notes:'Restored'},'PATCH'));
  assert.equal((await routes.DELETE(new Request(`http://local/api/shoots?id=${shoot.id}`))).status,200);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM shoot_notes').get().n,0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM event_scores').get().n,0);
});
