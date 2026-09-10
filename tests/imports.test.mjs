import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {createServer} from 'vite';
import {d1Adapter} from './helpers/d1.mjs';
const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())db.exec(readFileSync('drizzle/'+file,'utf8'));
const runtime={DB:d1Adapter(db),AUTH_SECRET:'synthetic-import-test',APP_ORIGIN:'https://test.example'};globalThis.importEnv=runtime;
const vite=await createServer({configFile:false,appType:'custom',resolve:{alias:{'@':process.cwd()}},optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false},plugins:[{name:'import-env',resolveId(id){if(id==='cloudflare:workers')return '\0import-env';},load(id){if(id==='\0import-env')return 'export const env=globalThis.importEnv;';}}]});
after(async()=>{await vite.close();db.close();delete globalThis.importEnv;});
const format=await vite.ssrLoadModule('/lib/import-format.ts'),login=await vite.ssrLoadModule('/lib/login.ts'),routes=await vite.ssrLoadModule('/app/api/imports/route.ts'),extract=await vite.ssrLoadModule('/app/api/imports/extract/route.ts'),shoots=await vite.ssrLoadModule('/app/api/shoots/route.ts');
const cookies={};for(const [id,email,role,char] of [['james-delosh','jtdelosh@gmail.com','admin','a'],['a','a@example.test','shooter','b'],['b','b@example.test','shooter','c']]){db.prepare('INSERT INTO users(id,email,display_name,role,created_at) VALUES (?,?,?,?,0)').run(id,email,id,role);const raw=char.repeat(64);cookies[id]='__Host-skeet-session='+raw;db.prepare('INSERT INTO login_sessions(digest,email,expires_at,created_at) VALUES (?,?,?,0)').run(await login.digest('session:'+raw,runtime.AUTH_SECRET),email,Date.now()+3600000);}
const req=(body,actor='a',target,path='/api/imports')=>new Request(runtime.APP_ORIGIN+path,{method:body===undefined?'GET':'POST',headers:{cookie:cookies[actor]??'',origin:runtime.APP_ORIGIN,'Content-Type':'application/json',...(target?{'x-skeet-shooter':target}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
const sample=`Shoot,Date,12,20,28,410,Dbls,Shoot Name,Event Type\n167838,04/06/2025,94/100 A,97/100 AA,91/100 AA,93/100 A,90/100 B,PIG PICKIN,Main\n168761,06/01/2025,92/100 B,97/100 AA,98/100 A,94/100 A,92/100 B,TILDON DOWNING CHALLENGE,Main\n167601,06/22/2025,93/100 B,97/100 AA,96/100 A,92/100 A,,KOLAR US OPEN,Main\n168948,07/13/2025,100/100 B,100/100 AA,99/100 A,89/100 A,,FIRECRACKER 400,Main\n169053,08/10/2025,91/100 B,96/100 AA,98/100 AA,94/100 A,87/100 B,ZONE 4 ISHOOT CHAMPIONSHIPS,Main\n167769,09/07/2025,98/100 B,95/100 AA,98/100 A,95/100 A,91/100 B,NORTH CAROLINA STATE OPEN,Main`;
const draft=format.csvDraft(sample);
const commit=(rows,actor='a',target,id=crypto.randomUUID())=>routes.POST(req({action:'commit',rows,source:'test.csv',reviewed:true,id},actor,target));
test('NSSA-style CSV matches the six-shoot screenshot totals and leaves blank doubles unshot',()=>{
 const rows=draft.map(format.validateImportRow);assert.equal(rows.length,6);assert.equal(rows.flatMap(r=>r.entries).length,28);
 const totals=Object.fromEntries(format.importEvents.map(e=>[e,rows.flatMap(r=>r.entries).filter(s=>s.event===e).reduce((n,s)=>n+s.broken,0)]));assert.deepEqual(totals,{'12':568,'20':582,'28':580,'410':557,doubles:360});
 assert.equal(rows[0].date,'2025-04-06');assert.equal(rows[0].shootNumber,167838);
 const split=format.csvDraft('Date,Shoot Name,Event Type,12 Broken,12 Targets,12 Class\n2025-01-01,"Quoted, Shoot",Main,94,100,A');assert.equal(split[0].scores['12'],'94/100 A');assert.equal(split[0].name,'Quoted, Shoot');
 assert.deepEqual(format.parseCsv('\uFEFFA,B\r\n"two\nlines","a""b"'),[['A','B'],['two\nlines','a"b']]);
 assert.throws(()=>format.csvDraft('Date,Date,12\n2025-01-01,x,1/1'),/duplicate/);assert.throws(()=>format.parseCsv('a,b\n"unclosed'),/unclosed/);
 for(const change of [{label:''},{date:'2025-02-30'},{shootNumber:'-1'},{scores:{...draft[0].scores,'12':'101/100'}},{scores:{...draft[0].scores,'20':'94/100 E'}}])assert.throws(()=>format.validateImportRow({...draft[0],...change}));
});
let batchId;
test('review is mandatory, commit is scoped and idempotent, duplicates never overwrite records',async()=>{
 const id=crypto.randomUUID();assert.equal((await routes.POST(req({action:'commit',id,rows:draft}))).status,400);
 const result=await commit(draft,'a',undefined,id);assert.equal(result.status,200,await result.clone().text());batchId=id;assert.equal((await result.json()).total,6);
 assert.equal(db.prepare("SELECT COUNT(*) n FROM shoots WHERE owner_id='a'").get().n,6);assert.equal(db.prepare('SELECT COUNT(*) n FROM event_scores').get().n,28);
 assert.equal((await commit(draft,'a',undefined,id)).status,200);assert.equal(db.prepare('SELECT COUNT(*) n FROM shoots').get().n,6);
 assert.equal((await commit(draft)).status,400);const check=await (await routes.POST(req({action:'inspect',rows:draft}))).json();assert.ok(check.checks.every(r=>r.duplicate));
 assert.equal((await commit([{...draft[0],name:'Changed'}],'a',undefined,id)).status,400);
 assert.equal((await commit(draft,'b')).status,200);assert.equal((await (await routes.GET(req(undefined,'b'))).json()).batches.length,1);
 assert.equal((await routes.POST(req({action:'undo',id},'b'))).status,400);
});
test('support imports and undo are audited; unchanged undo permits a later reimport',async()=>{
 const row={...draft[0],shootNumber:'999001',name:'Support import'};const result=await commit([row],'james-delosh','a');assert.equal(result.status,200);const {id}=await result.json();
 const created=db.prepare("SELECT * FROM admin_audit WHERE target_id='a' ORDER BY rowid DESC").get();assert.equal(created.actor_id,'james-delosh');assert.equal(JSON.parse(created.after_json).scores.length,5);
 assert.equal((await routes.POST(req({action:'undo',id},'james-delosh','a'))).status,200);assert.equal(db.prepare('SELECT COUNT(*) n FROM shoots WHERE import_batch_id=?').get(id).n,0);assert.equal(db.prepare('SELECT action FROM admin_audit ORDER BY rowid DESC').get().action,'shoot.delete');
 assert.equal((await routes.POST(req({action:'undo',id},'james-delosh','a'))).status,200);assert.equal((await commit([row],'a')).status,200);
});
test('undo blocks changed scores or notes and preserves the entire batch',async()=>{
 const shoot=db.prepare('SELECT id FROM shoots WHERE import_batch_id=? ORDER BY id').get(batchId);
 db.prepare('UPDATE event_scores SET broken=0 WHERE shoot_id=?').run(shoot.id);
 const result=await routes.POST(req({action:'undo',id:batchId}));assert.equal(result.status,400);assert.match((await result.json()).error,/edited/);assert.equal(db.prepare('SELECT COUNT(*) n FROM shoots WHERE import_batch_id=?').get(batchId).n,6);
});
test('batch failures roll back all shoots and audits, including concurrent duplicate races',async()=>{
 const row={...draft[0],shootNumber:'999002',name:'Rollback import'},id=crypto.randomUUID();db.exec("CREATE TRIGGER fail_import_snapshot BEFORE INSERT ON import_records BEGIN SELECT RAISE(ABORT,'synthetic failure'); END");
 assert.equal((await commit([row],'james-delosh','a',id)).status,400);assert.equal(db.prepare('SELECT id FROM import_batches WHERE id=?').get(id),undefined);assert.equal(db.prepare("SELECT id FROM shoots WHERE shoot_number=999002").get(),undefined);db.exec('DROP TRIGGER fail_import_snapshot');
 // Insert a duplicate after the initial read, before the atomic write guard.
 const realBatch=runtime.DB.batch;runtime.DB.batch=async statements=>{db.prepare("INSERT INTO shoots(owner_id,shoot_number,name,date,status) VALUES ('a',999002,'Existing','2020-01-01','complete')").run();runtime.DB.batch=realBatch;return realBatch(statements);};
 assert.equal((await commit([row],'a',undefined,id)).status,400);assert.equal(db.prepare('SELECT id FROM import_batches WHERE id=?').get(id),undefined);assert.equal(db.prepare("SELECT COUNT(*) n FROM shoots WHERE shoot_number=999002").get().n,1);
});
test('anonymous, cross-account and disabled users cannot import or undo',async()=>{
 for(const [actor,target,expected] of [['missing',undefined,401],['a','b',403]]){assert.equal((await routes.GET(req(undefined,actor,target))).status,expected);assert.equal((await commit(draft,actor,target)).status,expected);}
 const csrf=req({action:'inspect',rows:draft});csrf.headers.set('origin','https://evil.example');assert.equal((await routes.POST(csrf)).status,403);
 db.exec("UPDATE users SET disabled=1 WHERE id='b'");assert.equal((await routes.GET(req(undefined,'b'))).status,401);db.exec("UPDATE users SET disabled=0 WHERE id='b'");
});
test('image extraction fails closed without configuration and uses bounded structured output without saving records',async()=>{
 assert.equal((await extract.POST(req({},'a',undefined,'/api/imports/extract'))).status,503);
 runtime.OPENAI_API_KEY='synthetic-only';const original=globalThis.fetch;let sent;
 const imageReq=()=>{const form=new FormData();form.set('file',new File([new Uint8Array([137,80,78,71,0,0])],'sample.png',{type:'image/png'}));return new Request(runtime.APP_ORIGIN+'/api/imports/extract',{method:'POST',headers:{cookie:cookies.a,origin:runtime.APP_ORIGIN},body:form});};
 try{globalThis.fetch=async(url,opts)=>{assert.equal(url,'https://api.openai.com/v1/responses');sent=JSON.parse(opts.body);return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({rows:draft,warnings:['Event type not specified'],startingClasses:{},totals:{}})}]}]});};
   const count=db.prepare('SELECT COUNT(*) n FROM shoots').get().n;const result=await extract.POST(imageReq());assert.equal(result.status,200);assert.equal((await result.json()).rows.length,6);assert.equal(sent.store,false);assert.equal(sent.max_output_tokens,8000);assert.equal(sent.text.format.strict,true);assert.equal(db.prepare('SELECT COUNT(*) n FROM shoots').get().n,count);
   globalThis.fetch=async()=>Response.json({status:'incomplete',output:[]});assert.equal((await extract.POST(imageReq())).status,502);
   db.exec("UPDATE login_limits SET count=10 WHERE key='image-user:a'");assert.equal((await extract.POST(imageReq())).status,429);
 }finally{globalThis.fetch=original;delete runtime.OPENAI_API_KEY;}
});

test('combined image previews detect overlapping shoots and enforce the batch limit',async()=>{
 const first={...draft[0],shootNumber:'888001',name:'Multi-image first shoot',sourceId:'image-2024',selected:true};
 const overlap={...first,sourceId:'image-overlap'};
 const nextYear={...draft[1],shootNumber:'888002',name:'Multi-image next year',sourceId:'image-2025',selected:true};
 const response=await routes.POST(req({action:'inspect',rows:[first,overlap,nextYear]}));
 assert.equal(response.status,200);const {checks}=await response.json();
 assert.equal(checks[0].duplicate,null);assert.ok(checks[1].duplicate);assert.equal(checks[2].duplicate,null);
 const oversized=await routes.POST(req({action:'inspect',rows:Array.from({length:101},(_,i)=>({...first,shootNumber:String(880000+i)}))}));
 assert.equal(oversized.status,400);
});
