import { ensureOwnerAccount, OWNER_EMAIL, type Account } from "./accounts";
export interface LoginEnv {
  DB: D1Database;
  RESEND_API_KEY?: string;
  AUTH_SECRET?: string;
  APP_ORIGIN?: string;
}
const OWNER = OWNER_EMAIL;
const COOKIE = "__Host-skeet-session";
const json = (data: unknown, status = 200, headers: Record<string,string> = {}) => Response.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } });
const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2,"0")).join("");
export async function digest(value: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}
const token = () => hex(crypto.getRandomValues(new Uint8Array(32)).buffer);
const cookie = (value: string, age: number) => `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
export async function currentSession(request: Request, env: LoginEnv) {
  if (!env.AUTH_SECRET) return null;
  const raw = request.headers.get("cookie")?.split(";").map(s => s.trim()).find(s => s.startsWith(`${COOKIE}=`))?.slice(COOKIE.length+1);
  if (!raw || !/^[a-f0-9]{64}$/.test(raw)) return null;
  const sessionDigest=await digest(`session:${raw}`,env.AUTH_SECRET);
  const session=await env.DB.prepare("SELECT email, expires_at FROM login_sessions WHERE digest = ? AND expires_at > ?").bind(sessionDigest,Date.now()).first<{email:string;expires_at:number}>();
  if(!session) return null;
  if(session.email===OWNER) await ensureOwnerAccount(env.DB);
  return env.DB.prepare("SELECT u.id,u.email,u.role,u.display_name AS displayName,s.expires_at FROM users u JOIN login_sessions s ON s.email=u.email WHERE s.digest=? AND s.expires_at>? AND u.disabled=0")
    .bind(sessionDigest,Date.now()).first<Account>();
}
async function limit(env: LoginEnv, key: string, max: number, interval: number) {
  const now=Date.now();
  const row=await env.DB.prepare("INSERT INTO login_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_at <= ? THEN 1 ELSE count+1 END, expires_at=CASE WHEN expires_at <= ? THEN excluded.expires_at ELSE expires_at END RETURNING count").bind(key,now+interval,now,now).first<{count:number}>();
  return !!row && row.count<=max;
}
export async function loginRoute(request: Request, env: LoginEnv): Promise<Response> {
  const path=new URL(request.url).pathname;
  if (!env.AUTH_SECRET || !env.APP_ORIGIN) return json({error:"Sign-in is not configured yet."},503);
  if (path==="/api/auth/session" && request.method==="GET") {
    const session=await currentSession(request,env);
    return session ? json({email:session.email,displayName:session.displayName,role:session.role}) : json({error:"Please sign in."},401);
  }
  if (request.method!=="POST") return json({error:"Method not allowed."},405);
  if (request.headers.get("origin")!==env.APP_ORIGIN) return json({error:"Invalid request origin."},403);
  if(path==="/api/auth/logout") {
    const raw=request.headers.get("cookie")?.split(";").map(s=>s.trim()).find(s=>s.startsWith(`${COOKIE}=`))?.slice(COOKIE.length+1);
    if(raw) await env.DB.prepare("DELETE FROM login_sessions WHERE digest = ?").bind(await digest(`session:${raw}`,env.AUTH_SECRET)).run();
    return new Response(null,{status:303,headers:{Location:"/login","Set-Cookie":cookie("",0),"Cache-Control":"no-store"}});
  }
  if(!["/api/auth/request","/api/auth/verify"].includes(path)) return json({error:"Not found."},404);
  if(!request.headers.get("content-type")?.includes("application/json")) return json({error:"JSON required."},415);
  const input=await request.text();
  if(input.length>2048) return json({error:"Request too large."},413);
  let body: {email?:string; challenge?:string; code?:string; remember?:boolean};
  try {body=JSON.parse(input);} catch {return json({error:"Invalid request."},400);}
  if(!body || typeof body!=="object") return json({error:"Invalid request."},400);
  if(path==="/api/auth/request") {
    const email=typeof body.email==="string"?body.email.trim().toLowerCase():"";
    if(email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({error:"Enter a valid email address."},400);
    const id=token(), now=Date.now();
    // Initial milestone deliberately admits only the owner. No platform identity bypass.
    if(email!==OWNER) return json({challenge:id,message:"If this address has access, a code will arrive shortly."});
    const disabled=await env.DB.prepare("SELECT disabled FROM users WHERE email=?").bind(email).first<{disabled:number}>();
    if(disabled?.disabled) return json({challenge:id,message:"If this address has access, a code will arrive shortly."});
    if(!env.RESEND_API_KEY) return json({error:"Email delivery is not configured."},503);
    if(!await limit(env,"owner-minute",1,60000) || !await limit(env,"owner-hour",5,3600000) || !await limit(env,"send-day",80,86400000)) return json({error:"Please wait before requesting another code."},429);
    // Rejection sampling avoids modulo bias.
    let number: number; do {number=crypto.getRandomValues(new Uint32Array(1))[0];} while(number>=4294000000);
    const code=String(number%1000000).padStart(6,"0");
    await env.DB.batch([
      env.DB.prepare("UPDATE login_challenges SET consumed=1 WHERE email=?").bind(email),
      env.DB.prepare("INSERT INTO login_challenges (id,email,digest,expires_at,attempts,consumed,created_at) VALUES (?,?,?,?,0,0,?)").bind(id,email,await digest(`code:${id}:${code}`,env.AUTH_SECRET),now+600000,now),
      env.DB.prepare("DELETE FROM login_challenges WHERE expires_at < ?").bind(now-86400000),
      env.DB.prepare("DELETE FROM login_sessions WHERE expires_at < ?").bind(now),
    ]);
    try {
      const sent=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,"Content-Type":"application/json","Idempotency-Key":id},body:JSON.stringify({from:"Skeet Tracker <login@sk33t.net>",to:[email],reply_to:OWNER,subject:"Skeet Tracker TEST — your sign-in code",text:`Your test-site sign-in code is ${code}. It expires in 10 minutes and can be used once.\n\nEnter it at ${env.APP_ORIGIN}/login.\n\nThis is the separate test tracker. Your live records are unchanged. If you did not request this code, ignore this email.`}),signal:AbortSignal.timeout(15000)});
      if(!sent.ok) throw new Error("Delivery failed");
    } catch {
      await env.DB.prepare("UPDATE login_challenges SET consumed=1 WHERE id=?").bind(id).run();
      return json({error:"We could not send your code. Please try again later."},502);
    }
    return json({challenge:id,message:"If this address has access, a code will arrive shortly."});
  }
  if(typeof body.challenge!=="string" || !/^[a-f0-9]{64}$/.test(body.challenge) || typeof body.code!=="string" || !/^\d{6}$/.test(body.code)) return json({error:"Enter the six-digit code."},400);
  const now=Date.now(), expected=await digest(`code:${body.challenge}:${body.code}`,env.AUTH_SECRET);
  // One atomic statement counts attempts and consumes a valid challenge under concurrent requests.
  const found=await env.DB.prepare("UPDATE login_challenges SET attempts=attempts+1, consumed=CASE WHEN digest=? THEN 1 ELSE 0 END WHERE id=? AND email=? AND expires_at>? AND consumed=0 AND attempts<5 RETURNING email,consumed").bind(expected,body.challenge,OWNER,now).first<{email:string;consumed:number}>();
  if(!found?.consumed) return json({error:"Code is invalid, expired, or already used. Request a new code if needed."},400);
  await ensureOwnerAccount(env.DB);
  const user=await env.DB.prepare("SELECT id FROM users WHERE email=? AND disabled=0").bind(found.email).first();
  if(!user) return json({error:"Account is unavailable."},403);
  const raw=token(), age=body.remember===true?2592000:43200;
  await env.DB.prepare("INSERT INTO login_sessions (digest,email,expires_at,created_at) VALUES (?,?,?,?)").bind(await digest(`session:${raw}`,env.AUTH_SECRET),found.email,now+age*1000,now).run();
  return json({ok:true},200,{"Set-Cookie":cookie(raw,age)});
}

export async function authGate(request: Request, env: LoginEnv): Promise<Response|null> {
  const path=new URL(request.url).pathname;
  if(path.startsWith("/api/auth/")) return loginRoute(request,env);
  if(path==="/login" && request.method==="GET") return null;
  if(!await currentSession(request,env)) return path.startsWith("/api/")?json({error:"Please sign in."},401):new Response(null,{status:303,headers:{Location:"/login","Cache-Control":"no-store"}});
  if(!["GET","HEAD"].includes(request.method) && request.headers.get("origin")!==env.APP_ORIGIN) return json({error:"Invalid request origin."},403);
  return null;
}
