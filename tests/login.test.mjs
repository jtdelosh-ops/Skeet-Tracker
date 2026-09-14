import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {createServer} from 'vite';
const db=new DatabaseSync(':memory:');
for(const name of readdirSync('drizzle').filter(n=>n.endsWith('.sql')).sort()) db.exec(readFileSync(`drizzle/${name}`,'utf8'));
const DB={prepare(sql){let args=[];return {bind(...a){args=a;return this;},async first(){return db.prepare(sql).get(...args)||null;},async run(){db.prepare(sql).run(...args);return {success:true};}};},async batch(statements){db.exec('BEGIN');try{const r=[];for(const s of statements)r.push(await s.run());db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}};
const vite=await createServer({configFile:false,appType:'custom',server:{middlewareMode:true,hmr:false},optimizeDeps:{noDiscovery:true}});
const {loginRoute,currentSession,authGate}=await vite.ssrLoadModule('/lib/login.ts');
const env={DB,AUTH_SECRET:'synthetic-test-secret-only',APP_ORIGIN:'https://test.example',RESEND_API_KEY:'synthetic'};
const originalFetch=globalThis.fetch;
let sent, fail=false;
globalThis.fetch=async(url,opts)=>{assert.equal(url,'https://api.resend.com/emails');sent=JSON.parse(opts.body);return new Response('{}',{status:fail?503:200});};
after(async()=>{globalThis.fetch=originalFetch;await vite.close();db.close();});
const request=(path,body,headers={})=>new Request(env.APP_ORIGIN+path,{method:'POST',headers:{Origin:env.APP_ORIGIN,'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
const clear=()=>{for(const t of ['login_limits','login_challenges','login_sessions'])db.exec(`DELETE FROM ${t}`);fail=false;sent=null;};
async function challenge(){const res=await loginRoute(request('/api/auth/request',{email:'jtdelosh@gmail.com'}),env);assert.equal(res.status,200);return {challenge:(await res.json()).challenge,code:sent.text.match(/code is (\d{6})/)[1]};}
test('owner login sets secure session, prevents replay, revokes logout, and guards every data route',async()=>{
 clear();const c=await challenge();const r=await loginRoute(request('/api/auth/verify',{...c,remember:true}),env);assert.equal(r.status,200);
 const cookie=r.headers.get('set-cookie');for(const flag of ['HttpOnly','Secure','SameSite=Lax','Max-Age=2592000','Path=/'])assert.ok(cookie.includes(flag));
 assert.equal(db.prepare('SELECT digest FROM login_challenges').get().digest.includes(c.code),false);
 const signed=new Request(env.APP_ORIGIN+'/',{headers:{cookie}});assert.equal((await currentSession(signed,env)).email,'jtdelosh@gmail.com');assert.equal(await authGate(signed,env),null);
 assert.equal((await loginRoute(request('/api/auth/verify',c),env)).status,400);
 for(const p of ['/api/dashboard','/api/history','/api/shoots','/api/settings'])assert.equal((await authGate(new Request(env.APP_ORIGIN+p),env)).status,401);
 assert.equal((await authGate(request('/api/settings',{}, {cookie,Origin:'https://evil.example'}),env)).status,403);
 assert.equal((await loginRoute(request('/api/auth/logout',{}, {cookie}),env)).status,303);assert.equal(await currentSession(signed,env),null);
});
test('five failed guesses exhaust challenge and expired challenges fail',async()=>{
 clear();let c=await challenge();const wrong=c.code==='000000'?'000001':'000000';for(let i=0;i<5;i++)assert.equal((await loginRoute(request('/api/auth/verify',{...c,code:wrong}),env)).status,400);assert.equal((await loginRoute(request('/api/auth/verify',c),env)).status,400);
 clear();c=await challenge();db.exec('UPDATE login_challenges SET expires_at=0');assert.equal((await loginRoute(request('/api/auth/verify',c),env)).status,400);
});
test('concurrent redemption succeeds once, and expired sessions fail',async()=>{
 clear();const c=await challenge();const results=await Promise.all([loginRoute(request('/api/auth/verify',c),env),loginRoute(request('/api/auth/verify',c),env)]);assert.deepEqual(results.map(r=>r.status).sort(),[200,400]);
 const cookie=results.find(r=>r.status===200).headers.get('set-cookie');db.exec('UPDATE login_sessions SET expires_at=0');assert.equal(await currentSession(new Request(env.APP_ORIGIN,{headers:{cookie}}),env),null);
});
test('non-owner never receives email, resend is throttled, delivery failure invalidates code, CSRF fails',async()=>{
 clear();assert.equal((await loginRoute(request('/api/auth/request',{email:'other@example.com'}),env)).status,200);assert.equal(sent,null);await challenge();assert.equal((await loginRoute(request('/api/auth/request',{email:'jtdelosh@gmail.com'}),env)).status,429);
 clear();fail=true;assert.equal((await loginRoute(request('/api/auth/request',{email:'jtdelosh@gmail.com'}),env)).status,502);assert.equal(db.prepare('SELECT consumed FROM login_challenges').get().consumed,1);
 assert.equal((await loginRoute(request('/api/auth/request',{email:'jtdelosh@gmail.com'},{Origin:'https://evil.example'}),env)).status,403);
 assert.equal((await authGate(new Request(env.APP_ORIGIN+'/api/history'),{DB})).status,401);
});

