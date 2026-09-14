import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {createServer} from 'vite';
import {d1Adapter} from './helpers/d1.mjs';
const db=new DatabaseSync(':memory:');
for(const name of readdirSync('drizzle').filter(n=>n.endsWith('.sql')).sort())db.exec(readFileSync(`drizzle/${name}`,'utf8'));
const runtime={DB:d1Adapter(db),AUTH_SECRET:'synthetic-account-test',APP_ORIGIN:'https://test.example'};
globalThis.ownershipEnv=runtime;
const vite=await createServer({configFile:false,appType:'custom',resolve:{alias:{'@':process.cwd()}},optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false},plugins:[{name:'ownership-env',resolveId(id){if(id==='cloudflare:workers')return '\0ownership-env';},load(id){if(id==='\0ownership-env')return 'export const env=globalThis.ownershipEnv;';}}]});
after(async()=>{await vite.close();db.close();delete globalThis.ownershipEnv;});
const login=await vite.ssrLoadModule('/lib/login.ts');
const accounts=await vite.ssrLoadModule('/lib/accounts.ts');
const shoots=await vite.ssrLoadModule('/app/api/shoots/route.ts');
const history=await vite.ssrLoadModule('/app/api/history/route.ts');
const dashboard=await vite.ssrLoadModule('/app/api/dashboard/route.ts');
const settings=await vite.ssrLoadModule('/app/api/settings/route.ts');
const accountRoute=await vite.ssrLoadModule('/app/api/account/route.ts');
const cookies={};
for(const [id,email,role] of [['a','a@example.test','shooter'],['b','b@example.test','shooter'],['james-delosh','jtdelosh@gmail.com','admin']]){
 db.prepare('INSERT INTO users (id,email,display_name,role,created_at) VALUES (?,?,?,?,0)').run(id,email,id,role);
 const raw=({a:'a',b:'b','james-delosh':'c'}[id]).repeat(64);
 db.prepare('INSERT INTO login_sessions (digest,email,expires_at,created_at) VALUES (?,?,?,?)').run(await login.digest(`session:${raw}`,runtime.AUTH_SECRET),email,Date.now()+3600000,Date.now());
 cookies[id]=`__Host-skeet-session=${raw}`;
}
const req=(path,user='a',method='GET',body)=>new Request(runtime.APP_ORIGIN+path,{method,headers:{cookie:cookies[user]??'',Origin:runtime.APP_ORIGIN,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
async function create(user,name,broken=24){const response=await shoots.POST(req('/api/shoots',user,'POST',{ownerId:'b',name,date:'2026-09-10',status:'complete',entries:[{event:'12',broken,targets:25}],notes:`${name} private note`}));assert.equal(response.status,201,JSON.stringify(await response.clone().json()));return (await response.json()).shoot;}
test('real sessions isolate shoot CRUD, notes, history counts, search, and dashboard aggregates',async()=>{
 const a=await create('a','Alpha'),b=await create('b','Beta',10);
 assert.equal(a.ownerId,'a');assert.equal(b.ownerId,'b');
 for(const [actor,other,own] of [['a',b,a],['b',a,b]]){
  const list=await (await shoots.GET(req('/api/shoots?ownerId='+other.ownerId,actor))).json();assert.deepEqual(list.shoots.map(s=>s.id),[own.id]);assert.equal(list.shoots[0].notes.content,`${own.name} private note`);
  assert.equal((await shoots.PATCH(req('/api/shoots',actor,'PATCH',{id:other.id,name:'stolen',date:'2026-01-01',entries:[],notes:'stolen'}))).status,404);
  assert.equal((await shoots.DELETE(req(`/api/shoots?id=${other.id}`,actor,'DELETE'))).status,404);
  assert.equal((await (await history.GET(req('/api/history?q='+other.name,actor))).json()).total,0);
  const page=await (await history.GET(req('/api/history?page=99',actor))).json();assert.equal(page.total,1);assert.equal(page.page,1);
  const dash=await (await dashboard.GET(req('/api/dashboard',actor))).json();assert.equal(dash.inProgressShoots.length,0);assert.equal(dash.stats['12'].active.length,1);assert.equal(dash.stats['12'].active[0].broken,actor==='a'?24:10);
 }
 assert.equal((await shoots.PATCH(req('/api/shoots','a','PATCH',{id:a.id,name:'Alpha edited',date:'2026-09-10',notes:'Edited'}))).status,200);
 await shoots.PATCH(req('/api/shoots','b','PATCH',{id:b.id,name:'Beta',date:'2026-09-10',status:'in_progress'}));
 assert.equal((await (await dashboard.GET(req('/api/dashboard','a'))).json()).inProgressShoots.length,0);
 const pending=await (await dashboard.GET(req('/api/dashboard','b'))).json();assert.equal(pending.inProgressShoots.length,1);assert.equal(pending.inProgressShoots[0].id,b.id);
 assert.equal((await shoots.DELETE(req(`/api/shoots?id=${a.id}`,'a','DELETE'))).status,200);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM shoot_notes WHERE shoot_id=?').get(a.id).n,0);
 assert.equal(db.prepare('SELECT content FROM shoot_notes WHERE shoot_id=?').get(b.id).content,'Beta private note');
});
test('settings replacement is atomic and cannot delete or read another shooter settings',async()=>{
 for(const [who,value] of [['a','A'],['b','C']])assert.equal((await settings.PUT(req('/api/settings',who,'PUT',{userId:'b',startingClasses:{'12':value}}))).status,200);
 assert.deepEqual((await (await settings.GET(req('/api/settings?userId=b','a'))).json()).startingClasses,{'12':'A'});
 assert.equal((await settings.PUT(req('/api/settings','a','PUT',{startingClasses:{'12':'invalid'}}))).status,400);
 assert.deepEqual((await (await settings.GET(req('/api/settings','a'))).json()).startingClasses,{'12':'A'});
 await settings.PUT(req('/api/settings','a','PUT',{startingClasses:{}}));
 assert.deepEqual((await (await settings.GET(req('/api/settings','b'))).json()).startingClasses,{'12':'C'});
 const dash=await (await dashboard.GET(req('/api/dashboard','b'))).json();assert.deepEqual(dash.startingClasses,{'12':'C'});
});
test('anonymous, forged and disabled sessions fail inside each route, even without Worker middleware',async()=>{
 for(const [route,path,method,body] of [[shoots,'/api/shoots','GET'],[shoots,'/api/shoots','POST',{name:'x',date:'2026-09-10'}],[shoots,'/api/shoots','PATCH',{id:1,name:'x',date:'2026-09-10'}],[shoots,'/api/shoots?id=1','DELETE'],[history,'/api/history','GET'],[dashboard,'/api/dashboard','GET'],[settings,'/api/settings','GET'],[settings,'/api/settings','PUT',{}],[accountRoute,'/api/account','GET']]){
  assert.equal((await route[method](req(path,'unknown',method,body))).status,401);
  const forged=req(path,'unknown',method,body);forged.headers.set('oai-authenticated-user-email','jtdelosh@gmail.com');forged.headers.set('x-user-id','james-delosh');assert.equal((await route[method](forged)).status,401);
 }
 db.exec("UPDATE users SET disabled=1 WHERE id='a'");assert.equal((await shoots.GET(req('/api/shoots','a'))).status,401);db.exec("UPDATE users SET disabled=0 WHERE id='a'");
 db.exec("UPDATE users SET disabled=1 WHERE id='james-delosh'");assert.equal((await accountRoute.GET(req('/api/account','james-delosh'))).status,401);assert.equal(db.prepare("SELECT disabled FROM users WHERE id='james-delosh'").get().disabled,1);db.exec("UPDATE users SET disabled=0 WHERE id='james-delosh'");
 const csrf=req('/api/settings','a','PUT',{});csrf.headers.set('origin','https://evil.example');assert.equal((await settings.PUT(csrf)).status,403);
});
test('legacy migration belongs only to James, preserves linked records/settings, and is repeatable',async()=>{
 db.exec("INSERT INTO shoots (id,name,date) VALUES (100,'Legacy','2025-01-01'); INSERT INTO event_scores (shoot_id,event,broken,targets) VALUES (100,'12',99,100); INSERT INTO shoot_notes (shoot_id,content,created_at,updated_at) VALUES (100,'Legacy notes','old','old'); INSERT INTO class_settings (event,starting_class) VALUES ('20','B');");
 assert.equal((await accountRoute.POST(req('/api/account','a','POST',{action:'assign-legacy-records'}))).status,403);
 assert.equal((await (await history.GET(req('/api/history?q=Legacy','a'))).json()).total,0);
 const before=db.prepare('SELECT * FROM event_scores WHERE shoot_id=100').get();
 assert.equal((await accountRoute.POST(req('/api/account','james-delosh','POST',{action:'assign-legacy-records'}))).status,200);
 assert.equal(db.prepare('SELECT owner_id FROM shoots WHERE id=100').get().owner_id,'james-delosh');
 assert.deepEqual(db.prepare('SELECT * FROM event_scores WHERE shoot_id=100').get(),before);
 assert.equal(db.prepare('SELECT updated_at FROM shoot_notes WHERE shoot_id=100').get().updated_at,'old');
 assert.equal((await (await history.GET(req('/api/history?q=Legacy','james-delosh'))).json()).total,1);
 db.exec("UPDATE user_class_settings SET starting_class='AA' WHERE user_id='james-delosh' AND event='20'");
 await accounts.migrateLegacyRecords(runtime.DB,{id:'james-delosh',email:'jtdelosh@gmail.com',role:'admin'});
 assert.equal(db.prepare("SELECT starting_class FROM user_class_settings WHERE user_id='james-delosh' AND event='20'").get().starting_class,'AA');
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM account_migrations").get().n,1);
 const plan=db.prepare('EXPLAIN QUERY PLAN SELECT id FROM shoots WHERE owner_id=? ORDER BY date DESC,id DESC LIMIT 10').all('a');assert.ok(plan.some(r=>r.detail.includes('idx_shoots_owner_date_id')));
});
