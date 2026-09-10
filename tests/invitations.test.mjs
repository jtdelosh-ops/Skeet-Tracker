import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {createServer} from 'vite';
import {d1Adapter} from './helpers/d1.mjs';
const db=new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys=ON');
for(const name of readdirSync('drizzle').filter(n=>n.endsWith('.sql')).sort())db.exec(readFileSync(`drizzle/${name}`,'utf8'));
const runtime={DB:d1Adapter(db),AUTH_SECRET:'synthetic-invite-test',APP_ORIGIN:'https://test.example',RESEND_API_KEY:'synthetic'};
globalThis.inviteEnv=runtime;
const vite=await createServer({configFile:false,appType:'custom',resolve:{alias:{'@':process.cwd()}},optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false},plugins:[{name:'invite-env',resolveId(id){if(id==='cloudflare:workers')return '\0invite-env';},load(id){if(id==='\0invite-env')return 'export const env=globalThis.inviteEnv;';}}]});
const login=await vite.ssrLoadModule('/lib/login.ts');
const routes=await vite.ssrLoadModule('/app/api/invitations/route.ts');
const originalFetch=globalThis.fetch;
let mail=[];
globalThis.fetch=async(url,opts)=>{assert.equal(url,'https://api.resend.com/emails');mail.push(JSON.parse(opts.body));return new Response('{}');};
after(async()=>{globalThis.fetch=originalFetch;delete globalThis.inviteEnv;await vite.close();db.close();});
const ownerCookie='__Host-skeet-session='+ 'a'.repeat(64);
db.prepare("INSERT INTO users (id,email,display_name,role,created_at) VALUES ('james-delosh','jtdelosh@gmail.com','James','admin',0)").run();
db.prepare('INSERT INTO login_sessions (digest,email,expires_at,created_at) VALUES (?,?,?,0)').run(await login.digest('session:'+'a'.repeat(64),runtime.AUTH_SECRET),'jtdelosh@gmail.com',Date.now()+3600000);
const req=(path,body,cookie='',origin=runtime.APP_ORIGIN)=>new Request(runtime.APP_ORIGIN+path,{method:body===undefined?'GET':'POST',headers:{cookie,origin,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
async function invite(email){const r=await routes.POST(req('/api/invitations',{action:'create',email},ownerCookie));assert.equal(r.status,201,await r.clone().text());return r.json();}
const signupBody=(email,inv,extra={})=>({email,inviteCode:inv.code,displayName:'  Test Shooter  ',acceptSupportAccess:true,...extra});
async function challenge(email,inv){const r=await login.loginRoute(req('/api/auth/request',signupBody(email,inv)),runtime);assert.equal(r.status,200,await r.clone().text());return {challenge:(await r.json()).challenge,code:mail.at(-1).text.match(/code is (\d{6})/)[1]};}
const verify=c=>login.loginRoute(req('/api/auth/verify',c),runtime);
test('only James can create/list/revoke; creation hashes the code, expires in seven days and sends no invitation email',async()=>{
 const before=mail.length, start=Date.now(), inv=await invite(' FIRST@example.test ');
 assert.equal(inv.email,'first@example.test');assert.match(inv.code,/^[a-f0-9]{64}$/);assert.equal(new URL(inv.url).hash,'#invite='+inv.code);
 assert.ok(inv.expiresAt>=start+7*86400000 && inv.expiresAt<=Date.now()+7*86400000);assert.equal(mail.length,before);
 const stored=db.prepare('SELECT * FROM invitations WHERE id=?').get(inv.id);assert.notEqual(stored.digest,inv.code);assert.equal(stored.digest,await login.digest('invite:'+inv.code,runtime.AUTH_SECRET));
 const list=await (await routes.GET(req('/api/invitations',undefined,ownerCookie))).json();assert.equal(JSON.stringify(list).includes(inv.code),false);assert.equal('digest' in list.invitations[0],false);
 for(const method of ['GET','POST'])assert.equal((await routes[method](req('/api/invitations',method==='POST'?{action:'create',email:'x@example.test'}:undefined))).status,401);
 assert.equal((await routes.POST(req('/api/invitations',{action:'create',email:'x@example.test'},ownerCookie,'https://evil.example'))).status,403);
 assert.equal((await routes.POST(req('/api/invitations',{action:'create',email:'jtdelosh@gmail.com'},ownerCookie))).status,409);
});
test('signup verifies invited email, binds name and acknowledgement, issues a shooter session and cannot replay',async()=>{
 const email='joined@example.test',inv=await invite(email),c=await challenge(email,inv);
 assert.deepEqual(mail.at(-1).to,[email]);assert.equal(db.prepare('SELECT id FROM users WHERE email=?').get(email),undefined);
 const result=await verify({...c,displayName:'Attacker',role:'admin',email:'wrong@example.test'});assert.equal(result.status,200);
 const cookie=result.headers.get('set-cookie'),user=db.prepare('SELECT * FROM users WHERE email=?').get(email);
 assert.equal(user.display_name,'Test Shooter');assert.equal(user.role,'shooter');assert.ok(user.support_access_acknowledged_at>0);
 assert.equal((await login.currentSession(req('/',undefined,cookie),runtime)).id,user.id);
 assert.equal(db.prepare('SELECT redeemed_by FROM invitations WHERE id=?').get(inv.id).redeemed_by,user.id);
 assert.equal((await verify(c)).status,400);
 for(const method of ['GET','POST'])assert.equal((await routes[method](req('/api/invitations',method==='POST'?{action:'revoke',id:inv.id}:undefined,cookie))).status,403);
 db.exec('DELETE FROM login_limits');
 const signIn=await login.loginRoute(req('/api/auth/request',{email}),runtime);assert.equal(signIn.status,200);
 assert.equal((await verify({challenge:(await signIn.json()).challenge,code:mail.at(-1).text.match(/code is (\d{6})/)[1]})).status,200);
 db.prepare('UPDATE users SET disabled=1 WHERE id=?').run(user.id);assert.equal(await login.currentSession(req('/',undefined,cookie),runtime),null);
 const count=mail.length;await login.loginRoute(req('/api/auth/request',{email}),runtime);assert.equal(mail.length,count);
 assert.equal((await routes.POST(req('/api/invitations',{action:'create',email},ownerCookie))).status,409);
});
test('wrong email, missing consent/name, invalid, expired and revoked invitations cannot send codes',async()=>{
 const email='validation@example.test',inv=await invite(email),before=mail.length;
 for(const extra of [{email:'wrong@example.test'},{acceptSupportAccess:false},{displayName:' '},{displayName:'x'.repeat(81)},{inviteCode:'f'.repeat(64)}])assert.equal((await login.loginRoute(req('/api/auth/request',signupBody(email,inv,extra)),runtime)).status,400);
 db.prepare('UPDATE invitations SET expires_at=0 WHERE id=?').run(inv.id);assert.equal((await login.loginRoute(req('/api/auth/request',signupBody(email,inv)),runtime)).status,400);
 const rev=await invite(email);assert.equal((await routes.POST(req('/api/invitations',{action:'revoke',id:rev.id},ownerCookie))).status,200);
 assert.equal((await login.loginRoute(req('/api/auth/request',signupBody(email,rev)),runtime)).status,400);assert.equal(mail.length,before);
});
test('revocation, replacement and expiry after sending a code prevent account creation',async()=>{
 for(const action of ['revoke','replace','expire']){
   const email=action+'@example.test',inv=await invite(email),c=await challenge(email,inv);
   if(action==='revoke')await routes.POST(req('/api/invitations',{action:'revoke',id:inv.id},ownerCookie));
   if(action==='replace')await invite(email);
   if(action==='expire')db.prepare('UPDATE invitations SET expires_at=0 WHERE id=?').run(inv.id);
   assert.equal((await verify(c)).status,400);assert.equal(db.prepare('SELECT id FROM users WHERE email=?').get(email),undefined);
   assert.equal(db.prepare('SELECT digest FROM login_sessions WHERE email=?').get(email),undefined);
 }
});
test('concurrent redemption creates one account and session, while failed session insertion rolls back signup',async()=>{
 const email='concurrent@example.test',inv=await invite(email),c=await challenge(email,inv);
 const results=await Promise.all([verify(c),verify(c)]);assert.deepEqual(results.map(r=>r.status).sort(),[200,400]);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM users WHERE email=?').get(email).n,1);assert.equal(db.prepare('SELECT COUNT(*) n FROM login_sessions WHERE email=?').get(email).n,1);
 const broken='rollback@example.test',next=await invite(broken),d=await challenge(broken,next);
 db.exec("CREATE TRIGGER fail_signup_session BEFORE INSERT ON login_sessions WHEN NEW.email='rollback@example.test' BEGIN SELECT RAISE(ABORT,'synthetic failure'); END");
 await assert.rejects(()=>verify(d));
 assert.equal(db.prepare('SELECT id FROM users WHERE email=?').get(broken),undefined);assert.equal(db.prepare('SELECT redeemed_at FROM invitations WHERE id=?').get(next.id).redeemed_at,null);
 db.exec('DROP TRIGGER fail_signup_session');
});
test('email send throttles are per account with a shared daily cap',async()=>{
 db.exec('DELETE FROM login_limits');
 const a=await invite('limit-a@example.test'),b=await invite('limit-b@example.test');await challenge(a.email,a);
 assert.equal((await login.loginRoute(req('/api/auth/request',signupBody(a.email,a)),runtime)).status,429);
 await challenge(b.email,b);
 db.exec("UPDATE login_limits SET count=80 WHERE key='send-day'");
 const c=await invite('limit-c@example.test');assert.equal((await login.loginRoute(req('/api/auth/request',signupBody(c.email,c)),runtime)).status,429);
});
test('send invitation emails the bound recipient and saves acceptance; duplicate clicks are throttled',async()=>{
 db.exec('DELETE FROM login_limits');
 const previous=globalThis.fetch;let delivery;
 globalThis.fetch=async(url,opts)=>{assert.equal(url,'https://api.resend.com/emails');delivery={headers:opts.headers,body:JSON.parse(opts.body)};return new Response('{"id":"synthetic"}');};
 try {
   const email='send@example.test',r=await routes.POST(req('/api/invitations',{action:'send',email},ownerCookie));assert.equal(r.status,201);
   const result=await r.json();assert.equal(result.emailStatus,'sent');assert.deepEqual(delivery.body.to,[email]);assert.equal(delivery.body.reply_to,'jtdelosh@gmail.com');assert.match(delivery.body.subject,/TEST/);assert.ok(delivery.body.text.includes(result.url));assert.equal(delivery.headers['Idempotency-Key'],'invitation-'+result.id);
   const row=db.prepare('SELECT email_status,sent_at FROM invitations WHERE id=?').get(result.id);assert.equal(row.email_status,'sent');assert.ok(row.sent_at>0);
   const again=await routes.POST(req('/api/invitations',{action:'send',email},ownerCookie));assert.equal(again.status,429);assert.equal(db.prepare('SELECT revoked_at FROM invitations WHERE id=?').get(result.id).revoked_at,null);
   assert.equal((await routes.POST(req('/api/invitations',{action:'send',email:'anonymous@example.test'}))).status,401);
   db.exec("UPDATE login_limits SET count=80 WHERE key='send-day'");assert.equal((await routes.POST(req('/api/invitations',{action:'send',email:'daily@example.test'},ownerCookie))).status,429);
 } finally {globalThis.fetch=previous;}
});
test('rejected or uncertain email sends preserve a usable invitation and never claim success',async()=>{
 db.exec('DELETE FROM login_limits');const previous=globalThis.fetch;
 try {
   for(const [suffix,status,expected] of [['rejected',422,'failed'],['server',503,'unknown'],['timeout',0,'unknown']]) {
     globalThis.fetch=async()=>{if(!status)throw Error('synthetic timeout');return new Response('{}',{status});};
     const email=suffix+'-send@example.test',r=await routes.POST(req('/api/invitations',{action:'send',email},ownerCookie));assert.equal(r.status,201);
     const result=await r.json();assert.equal(result.emailStatus,expected);assert.ok(result.url.includes(result.code));
     const row=db.prepare('SELECT * FROM invitations WHERE id=?').get(result.id);assert.equal(row.email_status,expected);assert.equal(row.sent_at,null);assert.equal(row.revoked_at,null);assert.equal(row.redeemed_at,null);
     globalThis.fetch=previous;const c=await challenge(email,result);assert.equal((await verify(c)).status,200);
   }
 } finally {globalThis.fetch=previous;}
});
test('missing email configuration preserves existing invitations and allows link-only creation',async()=>{
 const inv=await invite('configuration@example.test');const key=runtime.RESEND_API_KEY;delete runtime.RESEND_API_KEY;
 try {
   const r=await routes.POST(req('/api/invitations',{action:'send',email:inv.email},ownerCookie));assert.equal(r.status,503);assert.equal(db.prepare('SELECT revoked_at FROM invitations WHERE id=?').get(inv.id).revoked_at,null);
   const other=await invite('link-only@example.test');assert.equal(other.emailStatus,'not_sent');
 } finally {runtime.RESEND_API_KEY=key;}
});
