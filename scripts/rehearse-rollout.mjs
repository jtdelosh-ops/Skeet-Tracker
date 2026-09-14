import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {d1Adapter} from '../tests/helpers/d1.mjs';
const [liveFile,testFile,reportFile]=process.argv.slice(2);
if(!reportFile)throw Error('Expected production backup, test backup and report paths.');
const prod=JSON.parse(readFileSync(liveFile,'utf8')),source=JSON.parse(readFileSync(testFile,'utf8'));
if(prod.issues?.length || source.issues?.length)throw Error('Backup contains truncated data.');
const vite=await createServer({configFile:false,appType:'custom',optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false}});
const rollout=await vite.ssrLoadModule('/lib/rollout.ts');
const migrationNames=readdirSync('drizzle').filter(n=>n.endsWith('.sql')).sort();
function restore(snapshot,file){
 const db=new DatabaseSync(file);db.exec('PRAGMA foreign_keys=ON');
 for(const name of migrationNames)db.exec(readFileSync('drizzle/'+name,'utf8'));
 for(const table of Object.keys(rollout.columns))for(const row of snapshot.tables[table]??[]){const keys=Object.keys(row);db.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')})`).run(...Object.values(row));}
 assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');return db;
}
const live=restore(prod,':memory:'),test=restore(source,':memory:');
try{
 const d1=d1Adapter(live),before=await rollout.exportSnapshot(d1),testRestored=await rollout.exportSnapshot(d1Adapter(test));
 for(const [table,rows] of Object.entries(source.tables))assert.equal(rollout.canonical(rows.map(rollout.canonical).sort()),rollout.canonical(testRestored.tables[table].map(rollout.canonical).sort()),'Restore mismatch: '+table);
 const hash=await rollout.fingerprint(before),sourceHash=await rollout.fingerprint(source);
 const outcome=await rollout.applyTransfer(d1,source,hash);
 const after=await rollout.exportSnapshot(d1);
 for(const name of ['event_scores','shoot_notes','class_settings'])for(const row of before.tables[name])assert.ok(after.tables[name].some(r=>rollout.canonical(r)===rollout.canonical(row)),name+' preservation');
 assert.equal(after.tables.shoots.length,prod.tables.shoots.length+source.tables.shoots.length);
 const fk=live.prepare('PRAGMA foreign_key_check').all();assert.deepEqual(fk,[]);
 assert.equal(live.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
 const totals=live.prepare('SELECT s.owner_id,e.event,count(*) AS events,sum(e.broken) AS broken,sum(e.targets) AS targets FROM event_scores e JOIN shoots s ON s.id=e.shoot_id GROUP BY s.owner_id,e.event ORDER BY s.owner_id,e.event').all();
 const report={outcome,sourceHash,targetBeforeHash:hash,afterHash:await rollout.fingerprint(after),counts:Object.fromEntries(Object.entries(after.tables).map(([k,v])=>[k,v.length])),shootsByOwner:live.prepare('SELECT owner_id,count(*) AS shoots FROM shoots GROUP BY owner_id').all(),totals,restorationVerified:true,foreignKeysVerified:true};
 writeFileSync(reportFile,JSON.stringify(report,null,2));writeFileSync(reportFile+'.expected.json',JSON.stringify(after));
 console.log(JSON.stringify(report,null,2));
}finally{live.close();test.close();await vite.close();}
