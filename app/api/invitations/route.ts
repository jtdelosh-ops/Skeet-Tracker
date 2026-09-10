import { env } from "cloudflare:workers";
import { requestAccount } from "@/lib/request-account";
import { OWNER_ID, OWNER_EMAIL } from "@/lib/accounts";
import { digest, limit, type LoginEnv } from "@/lib/login";

const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
async function owner(request:Request) {
  const account=await requestAccount(request);
  if(account instanceof Response) return account;
  return account.id===OWNER_ID && account.email===OWNER_EMAIL && account.role==="admin" ? account : json({error:"Only James can manage invitations."},403);
}
export async function GET(request:Request) {
  const account=await owner(request); if(account instanceof Response) return account;
  try {
    const rows=await env.DB.prepare("SELECT id,email,created_at AS createdAt,expires_at AS expiresAt,revoked_at AS revokedAt,redeemed_at AS redeemedAt,email_status AS emailStatus,sent_at AS sentAt FROM invitations ORDER BY created_at DESC LIMIT 100").all();
    return json({invitations:rows.results});
  } catch {return json({error:"Unable to load invitations. Please retry."},503);}
}
export async function POST(request:Request) {
  const account=await owner(request); if(account instanceof Response) return account;
  if(!request.headers.get("content-type")?.includes("application/json")) return json({error:"JSON required."},415);
  const input=await request.text(); if(input.length>2048) return json({error:"Request too large."},413);
  let body:{action?:string;email?:string;id?:string};
  try {body=JSON.parse(input);} catch {return json({error:"Invalid request."},400);}
  if(!body || typeof body!=="object") return json({error:"Invalid request."},400);
  try {
    if(body.action==="revoke") {
      if(typeof body.id!=="string" || body.id.length>80) return json({error:"Invalid invitation."},400);
      const result=await env.DB.prepare("UPDATE invitations SET revoked_at=? WHERE id=? AND revoked_at IS NULL AND redeemed_at IS NULL RETURNING id").bind(Date.now(),body.id).first();
      return result?json({ok:true}):json({error:"Invitation was already used, revoked, or not found. Refresh the list."},409);
    }
    if(body.action!=="create" && body.action!=="send") return json({error:"Unknown action."},400);
    const email=typeof body.email==="string"?body.email.trim().toLowerCase():"";
    if(email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({error:"Enter a valid email address."},400);
    if(email===OWNER_EMAIL || await env.DB.prepare("SELECT id FROM users WHERE email=?").bind(email).first()) return json({error:"This email already has an account. Use sign in instead."},409);
    const runtime=env as unknown as LoginEnv;
    if(!runtime.AUTH_SECRET || !runtime.APP_ORIGIN) return json({error:"Invitations are not configured."},503);
    const send=body.action==="send";
    if(send) {
      if(!runtime.RESEND_API_KEY) return json({error:"Email delivery is not configured. You can create a link instead."},503);
      const rateKey=await digest(`invite-email:${email}`,runtime.AUTH_SECRET);
      if(!await limit(runtime,`${rateKey}:minute`,1,60000) || !await limit(runtime,"send-day",80,86400000)) return json({error:"Email sending is temporarily limited. Wait before trying again, or create a link instead."},429);
    }
    const code=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,"0")).join("");
    const id=crypto.randomUUID(), now=Date.now(), expiresAt=now+7*86400000;
    await env.DB.batch([
      env.DB.prepare("UPDATE invitations SET revoked_at=? WHERE email=? AND revoked_at IS NULL AND redeemed_at IS NULL").bind(now,email),
      env.DB.prepare("INSERT INTO invitations (id,email,digest,created_by,created_at,expires_at,email_status) VALUES (?,?,?,?,?,?,?)").bind(id,email,await digest(`invite:${code}`,runtime.AUTH_SECRET),account.id,now,expiresAt,send?"sending":"not_sent"),
    ]);
    const url=`${runtime.APP_ORIGIN}/login#invite=${code}`;
    let emailStatus=send?"sending":"not_sent";
    if(send) {
      // A fresh invitation has a unique delivery key. Duplicate transport attempts
      // cannot send that same invitation twice through Resend.
      try {
        const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${runtime.RESEND_API_KEY}`,"Content-Type":"application/json","Idempotency-Key":`invitation-${id}`},body:JSON.stringify({
          from:"Skeet Tracker <login@sk33t.net>",to:[email],reply_to:OWNER_EMAIL,
          subject:"Skeet Tracker TEST — you’re invited",
          text:`James has invited you to the Skeet Tracker test site.\n\nCreate your account here:\n${url}\n\nUse ${email}, enter your display name, and verify your email with the six-digit code we send you. This invitation works once and expires ${new Date(expiresAt).toUTCString()}.\n\nThis is the separate test tracker. Access to the private test site must also be enabled by James. Your live records are unchanged.\n\nJames can assist with uploading records and correcting issues. If you need help or were not expecting this invitation, reply to this email.`,
        }),signal:AbortSignal.timeout(15000)});
        emailStatus=response.ok?"sent":response.status>=500?"unknown":"failed";
      } catch {emailStatus="unknown";}
      // Report provider acceptance, never claim inbox delivery. If persisting the
      // result fails, retain the usable link and accurately report uncertainty.
      try {await env.DB.prepare("UPDATE invitations SET email_status=?,sent_at=? WHERE id=?").bind(emailStatus,emailStatus==="sent"?Date.now():null,id).run();}
      catch {emailStatus="unknown";}
    }
    // Fragments stay out of server request logs and referrers. The code is shown
    // once and only its HMAC digest is stored.
    return json({id,email,code,expiresAt,url,emailStatus},201);
  } catch {return json({error:"Unable to update invitations. Please retry."},503);}
}
