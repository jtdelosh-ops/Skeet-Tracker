import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {createServer} from 'vite';
import {d1Adapter} from './helpers/d1.mjs';
const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');
for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())db.exec(readFileSync('drizzle/'+file,'utf8'));
const runtime={DB:d1Adapter(db),AUTH_SECRET:'synthetic-admin-test',APP_ORIGIN:'https://test.example'};
globalThis.adminEnv=runtime;
const vite=await createServer({configFile:false,appType:'custom',resolve:{alias:{'@':process.cwd()}},optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false},plugins:[{name:'admin-env',resolveId(id){if(id==='cloudflare:workers')return '\0admin-env';},load(id){if(id==='\0admin-env')return 'export const env=globalThis.adminEnv;';}}]});
after(async()=>{await vite.close();db.close();delete globalThis.adminEnv;});
const login=await vite.ssrLoadModule('/lib/login.ts'),admin=await vite.ssrLoadModule('/app/api/admin/route.ts'),shoots=await vite.ssrLoadModule('/app/api/shoots/route.ts'),settings=await vite.ssrLoadModule('/app/api/settings/route.ts'),dashboard=await vite.ssrLoadModule('/app/api/dashboard/route.ts'),history=await vite.ssrLoadModule('/app/api/history/route.ts'),profile=await vite.ssrLoadModule('/app/api/account/route.ts');
const cookies={};
for(const [id,email,role,char] of [['james-delosh','jtdelosh@gmail.com','admin','a'],['a','a@example.test','shooter','b'],['b','b@example.test','shooter','c']]){
 db.prepare('INSERT INTO users(id,email,display_name,role,created_at) VALUES (?,?,?,?,0)').run(id,email,id,role);
 const raw=char.repeat(64);cookies[id]='__Host-skeet-session='+raw;
 db.prepare('INSERT INTO login_sessions(digest,email,expires_at,created_at) VALUES (?,?,?,0)').run(await login.digest('session:'+raw,runtime.AUTH_SECRET),email,Date.now()+3600000);
}
const req=(path,actor='james-delosh',method='GET',body,target)=>new Request(runtime.APP_ORIGIN+path,{method,headers:{cookie:cookies[actor]??'',origin:runtime.APP_ORIGIN,'Content-Type':'application/json',...(target?{'x-skeet-shooter':target}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
const fixture={name:'Support shoot',date:'2026-09-10',status:'complete',entries:[{event:'12',broken:24,targets:25}],notes:'Original'};
const auditRows=()=>db.prepare('SELECT * FROM admin_audit ORDER BY rowid').all();
let shootId;
test('only James can administer accounts or select a support target, with no shared target state',async()=>{
 for(const actor of ['anonymous','a']){
  assert.equal((await admin.GET(req('/api/admin',actor))).status,actor==='a'?403:401);
  assert.equal((await admin.POST(req('/api/admin',actor,'POST',{action:'disable',userId:'b'}))).status,actor==='a'?403:401);
  for(const [route,path] of [[shoots,'/api/shoots'],[settings,'/api/settings'],[dashboard,'/api/dashboard'],[history,'/api/history'],[profile,'/api/account']])assert.equal((await route.GET(req(path,actor,'GET',undefined,'b'))).status,actor==='a'?403:401);
 }
 const bad=req('/api/admin','james-delosh','POST',{action:'disable',userId:'a'});bad.headers.set('origin','https://evil.example');assert.equal((await admin.POST(bad)).status,403);
 assert.equal((await admin.POST(req('/api/admin','james-delosh','POST',{action:'disable',userId:'james-delosh'}))).status,403);
 assert.equal((await shoots.GET(req('/api/shoots','james-delosh','GET',undefined,'missing'))).status,404);
 const response=await shoots.POST(req('/api/shoots','james-delosh','POST',{...fixture,ownerId:'b'},'a'));assert.equal(response.status,201,await response.clone().text());const shoot=(await response.json()).shoot;shootId=shoot.id;assert.equal(shoot.ownerId,'a');
 assert.equal((await (await shoots.GET(req('/api/shoots'))).json()).shoots.length,0);
 assert.equal((await (await shoots.GET(req('/api/shoots','b'))).json()).shoots.length,0);
 const p=await (await profile.GET(req('/api/account','james-delosh','GET',undefined,'a'))).json();assert.equal(p.email,'jtdelosh@gmail.com');assert.equal(p.support.email,'a@example.test');assert.equal(p.legacy,null);
 const row=auditRows()[0];assert.equal(row.actor_id,'james-delosh');assert.equal(row.target_id,'a');assert.equal(row.action,'shoot.create');assert.equal(row.before_json,null);assert.equal(JSON.parse(row.after_json).notes,'Original');assert.equal(JSON.parse(row.after_json).scores[0].broken,24);
});
test('support edits, settings and deletion are scoped and have complete before/after history',async()=>{
 const other=await shoots.POST(req('/api/shoots','b','POST',{...fixture,name:'Other shooter'}));const otherId=(await other.json()).shoot.id;
 assert.equal((await shoots.PATCH(req('/api/shoots','james-delosh','PATCH',{...fixture,id:otherId},'a'))).status,404);
 const result=await shoots.PATCH(req('/api/shoots','james-delosh','PATCH',{...fixture,id:shootId,notes:'Corrected',entries:[{event:'12',broken:25,targets:25}]},'a'));assert.equal(result.status,200);
 let row=auditRows().at(-1);assert.equal(row.action,'shoot.update');assert.equal(JSON.parse(row.before_json).scores[0].broken,24);assert.equal(JSON.parse(row.after_json).scores[0].broken,25);assert.equal(JSON.parse(row.after_json).notes,'Corrected');
 assert.equal((await settings.PUT(req('/api/settings','james-delosh','PUT',{startingClasses:{'12':'A'}},'a'))).status,200);
 row=auditRows().at(-1);assert.deepEqual(JSON.parse(row.before_json),{});assert.deepEqual(JSON.parse(row.after_json),{'12':'A'});
 assert.equal((await shoots.DELETE(req('/api/shoots?id='+shootId,'james-delosh','DELETE',undefined,'a'))).status,200);
 row=auditRows().at(-1);assert.equal(row.action,'shoot.delete');assert.equal(JSON.parse(row.before_json).notes,'Corrected');assert.equal(row.after_json,null);assert.equal(db.prepare('SELECT COUNT(*) n FROM shoots WHERE id=?').get(otherId).n,1);
 const list=await (await admin.GET(req('/api/admin?user=a&page=999'))).json();assert.equal(list.total,4);assert.equal(list.page,1);assert.ok(list.audit.every(x=>x.targetEmail==='a@example.test'));
});
test('audit failure rolls back parent, child, settings and account mutations',async()=>{
 db.exec("CREATE TRIGGER fail_audit BEFORE INSERT ON admin_audit BEGIN SELECT RAISE(ABORT,'synthetic audit failure'); END");
 const count=db.prepare('SELECT COUNT(*) n FROM shoots').get().n;
 assert.equal((await shoots.POST(req('/api/shoots','james-delosh','POST',fixture,'a'))).status,500);assert.equal(db.prepare('SELECT COUNT(*) n FROM shoots').get().n,count);
 const own=await shoots.POST(req('/api/shoots','a','POST',fixture));const id=(await own.json()).shoot.id;
 assert.equal((await shoots.PATCH(req('/api/shoots','james-delosh','PATCH',{...fixture,id,notes:'Should rollback'},'a'))).status,500);assert.equal(db.prepare('SELECT content FROM shoot_notes WHERE shoot_id=?').get(id).content,'Original');
 assert.equal((await shoots.DELETE(req('/api/shoots?id='+id,'james-delosh','DELETE',undefined,'a'))).status,500);assert.ok(db.prepare('SELECT id FROM shoots WHERE id=?').get(id));
 assert.equal((await settings.PUT(req('/api/settings','james-delosh','PUT',{startingClasses:{'12':'B'}},'a'))).status,500);assert.equal(db.prepare("SELECT starting_class FROM user_class_settings WHERE user_id='a'").get().starting_class,'A');
 assert.equal((await admin.POST(req('/api/admin','james-delosh','POST',{action:'disable',userId:'a'}))).status,503);assert.equal(db.prepare("SELECT disabled FROM users WHERE id='a'").get().disabled,0);assert.ok(await login.currentSession(req('/','a'),runtime));
 db.exec('DROP TRIGGER fail_audit');
 // Fail after changes have run, while capturing the after snapshot.
 db.exec("CREATE TRIGGER fail_after BEFORE UPDATE OF after_json ON admin_audit BEGIN SELECT RAISE(ABORT,'synthetic snapshot failure'); END");
 assert.equal((await shoots.PATCH(req('/api/shoots','james-delosh','PATCH',{...fixture,id,notes:'Also rollback'},'a'))).status,500);assert.equal(db.prepare('SELECT content FROM shoot_notes WHERE shoot_id=?').get(id).content,'Original');db.exec('DROP TRIGGER fail_after');
});
test('disable revokes sessions and outstanding codes; restore cannot revive old credentials',async()=>{
 const code='123456',challenge='e'.repeat(64);
 db.prepare('INSERT INTO login_challenges(id,email,digest,expires_at,created_at) VALUES (?,?,?,?,0)').run(challenge,'a@example.test',await login.digest(`code:${challenge}:${code}`,runtime.AUTH_SECRET),Date.now()+600000);
 assert.equal((await admin.POST(req('/api/admin','james-delosh','POST',{action:'disable',userId:'a'}))).status,200);
 assert.equal(await login.currentSession(req('/','a'),runtime),null);assert.equal((await shoots.GET(req('/api/shoots','a'))).status,401);
 assert.equal((await shoots.GET(req('/api/shoots','james-delosh','GET',undefined,'a'))).status,200);
 let row=auditRows().at(-1);assert.equal(JSON.parse(row.before_json).disabled,0);assert.equal(JSON.parse(row.after_json).disabled,1);
 assert.equal((await admin.POST(req('/api/admin','james-delosh','POST',{action:'enable',userId:'a'}))).status,200);
 assert.equal(await login.currentSession(req('/','a'),runtime),null);assert.equal((await login.loginRoute(req('/api/auth/verify','a','POST',{challenge,code}),runtime)).status,400);
 row=auditRows().at(-1);assert.equal(row.action,'account.enable');assert.equal(JSON.parse(row.after_json).disabled,0);
 const count=auditRows().length;await admin.POST(req('/api/admin','james-delosh','POST',{action:'enable',userId:'a'}));assert.equal(auditRows().length,count);
});
test('administrative history paginates without losing entries and filters by shooter',async()=>{
 for(let i=0;i<30;i++)db.prepare('INSERT INTO admin_audit(id,actor_id,target_id,action,created_at) VALUES (?,?,?,?,?)').run('page-'+String(i).padStart(2,'0'),'james-delosh','b','settings.update',1234);
 const first=await (await admin.GET(req('/api/admin?user=b&page=1'))).json(),second=await (await admin.GET(req('/api/admin?user=b&page=2'))).json();
 assert.equal(first.total,30);assert.equal(first.audit.length,25);assert.equal(second.audit.length,5);assert.equal(new Set([...first.audit,...second.audit].map(x=>x.id)).size,30);
 assert.ok(first.audit.every(x=>x.targetEmail==='b@example.test'));assert.equal((await (await admin.GET(req('/api/admin?user=b&page=999'))).json()).page,2);
});
