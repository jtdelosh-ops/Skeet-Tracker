import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {createServer} from 'vite';
import {d1Adapter} from './helpers/d1.mjs';
const vite=await createServer({configFile:false,appType:'custom',optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false}});
after(()=>vite.close());
const rollout=await vite.ssrLoadModule('/lib/rollout.ts');
function database(){const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');for(const name of readdirSync('drizzle').filter(n=>n.endsWith('.sql')).sort())db.exec(readFileSync('drizzle/'+name,'utf8'));return db;}
function live(){const db=database();db.exec("INSERT INTO shoots(id,name,date) VALUES(20,'Existing shoot','2026-01-01'); INSERT INTO event_scores(id,shoot_id,event,broken,targets) VALUES(40,20,'12',98,100); INSERT INTO shoot_notes VALUES(20,'Keep this note','old','old'); INSERT INTO class_settings VALUES('12','AA');");return db;}
function source(){return {tables:{
 users:[{id:'james-delosh',email:'jtdelosh@gmail.com',display_name:'James',role:'admin',disabled:0,created_at:1,support_access_acknowledged_at:null},{id:'friend',email:'friend@example.test',display_name:'Friend',role:'shooter',disabled:0,created_at:2,support_access_acknowledged_at:2}],
 shoots:[{id:2,name:'Imported shoot',date:'2025-01-01',status:'complete',owner_id:'friend',shoot_number:10,import_batch_id:'batch',import_key:'nssa:10'}],
 event_scores:[{id:1,shoot_id:2,event:'doubles',broken:37,targets:50,class_shot:'N',shot_date:'2025-01-01',sequence:0,label:'Main'}],
 shoot_notes:[{shoot_id:2,content:'Friend note',created_at:'then',updated_at:'then'}],
 import_batches:[{id:'batch',owner_id:'friend',actor_id:'friend',source:'image.png',digest:'digest',created_at:3,undone_at:null,total:1}],
 import_records:[{batch_id:'batch',shoot_id:2,snapshot:'{"name":"original"}'}],
 admin_audit:[{id:'audit',actor_id:'james-delosh',target_id:'friend',action:'shoot.delete',entity_id:'99',before_json:'{"name":"Deleted"}',after_json:null,created_at:4}],
 user_class_settings:[{user_id:'james-delosh',event:'12',starting_class:'C'},{user_id:'friend',event:'12',starting_class:'B'}],
 invitations:[{id:'invite',email:'future@example.test',digest:'old-digest',created_by:'james-delosh',created_at:1,expires_at:9999999999999,revoked_at:null,redeemed_at:null,email_status:'sent',sent_at:1,redeemed_by:null}],
 login_sessions:[{digest:'old-session',email:'friend@example.test',expires_at:9999999999999,created_at:1}],
 }};}
test('transfer preserves production scores, notes and classes, maps historical IDs, and is repeatable',async()=>{
 const db=live(),d1=d1Adapter(db);try{
 const before=await rollout.exportSnapshot(d1);const hash=await rollout.fingerprint(before);
 const result=await rollout.applyTransfer(d1,source(),hash,500);assert.equal(result.shootOffset,20);
 assert.deepEqual(db.prepare('SELECT * FROM event_scores WHERE id=40').get(),before.tables.event_scores[0]);
 assert.equal(db.prepare('SELECT owner_id FROM shoots WHERE id=20').get().owner_id,'james-delosh');
 assert.equal(db.prepare('SELECT content FROM shoot_notes WHERE shoot_id=20').get().content,'Keep this note');
 assert.equal(db.prepare('SELECT owner_id FROM shoots WHERE id=22').get().owner_id,'friend');
 assert.equal(db.prepare('SELECT shoot_id FROM import_records').get().shoot_id,22);
 assert.equal(db.prepare('SELECT entity_id FROM admin_audit').get().entity_id,'119');
 assert.equal(db.prepare("SELECT seq FROM sqlite_sequence WHERE name='shoots'").get().seq,119);
 assert.equal(db.prepare("SELECT starting_class FROM user_class_settings WHERE user_id='james-delosh'").get().starting_class,'AA');
 assert.equal(db.prepare('SELECT revoked_at FROM invitations').get().revoked_at,500);
 assert.equal(db.prepare('SELECT count(*) AS n FROM login_sessions').get().n,0);
 assert.equal((await rollout.applyTransfer(d1,source(),hash)).alreadyApplied,true);
 assert.equal(db.prepare('SELECT count(*) AS n FROM shoots').get().n,2);
 assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{db.close();}
});
test('stale backups and broken ownership roll back without partially creating accounts',async()=>{
 const db=live(),d1=d1Adapter(db);try{
 const before=await rollout.exportSnapshot(d1),hash=await rollout.fingerprint(before);
 await assert.rejects(()=>rollout.applyTransfer(d1,source(),'stale'),/changed/);
 const invalid=source();invalid.tables.shoots[0].owner_id='missing';
 await assert.rejects(()=>rollout.applyTransfer(d1,invalid,hash));
 assert.equal(await rollout.fingerprint(await rollout.exportSnapshot(d1)),hash);
 assert.throws(()=>rollout.transferPlan({tables:{'users; DROP TABLE shoots':[]}},before,1),/Invalid/);
 }finally{db.close();}
});
test('maintenance access requires an enabled mode, an unexpired secret and the pinned source',async()=>{
 const env={DB:{},APP_ORIGIN:'https://sk33t.net',ROLLOUT_TOKEN:'x'.repeat(64),ROLLOUT_MODE:'locked',ROLLOUT_EXPIRES_AT:new Date(Date.now()+100000).toISOString()};
 const get=()=>new Request('https://sk33t.net/api/maintenance/config');
 assert.equal((await rollout.rolloutGate(get(),env)).status,401);
 const req=get();req.headers.set('authorization','Bearer '+env.ROLLOUT_TOKEN);
 assert.equal((await rollout.rolloutGate(req,env)).status,200);
 assert.equal((await rollout.rolloutGate(req,{...env,ROLLOUT_EXPIRES_AT:'2000-01-01'})).status,404);
 assert.equal((await rollout.rolloutGate(req,{...env,ROLLOUT_MODE:undefined})).status,404);
 assert.equal((await rollout.rolloutGate(new Request('https://sk33t.net/api/shoots',{method:'POST'}),env)).status,503);
 const moved=await rollout.rolloutGate(new Request('https://test.example/'),{...env,ROLLOUT_MODE:'moved'});assert.equal(moved.headers.get('location'),'https://sk33t.net/login');
 const request=new Request('https://sk33t.net/api/maintenance/transfer',{method:'POST',headers:{authorization:'Bearer '+env.ROLLOUT_TOKEN,'content-type':'application/json'},body:JSON.stringify({source:source(),expectedTarget:'stale'})});
 assert.equal((await rollout.rolloutGate(request,env)).status,409);
});
