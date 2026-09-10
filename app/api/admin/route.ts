import { env } from "cloudflare:workers";
import { requestAccount } from "@/lib/request-account";
import { isOwner, type Account } from "@/lib/accounts";
import { auditMutation } from "@/lib/admin-audit";
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store"}});
async function owner(request:Request){const actor=await requestAccount(request);if(actor instanceof Response)return actor;return isOwner(actor)?actor:json({error:"Only James can manage accounts."},403);}
export async function GET(request:Request){
  const actor=await owner(request);if(actor instanceof Response)return actor;
  try {
    const params=new URL(request.url).searchParams, target=params.get("user")||null;
    const count=await env.DB.prepare("SELECT COUNT(*) AS total FROM admin_audit WHERE (? IS NULL OR target_id=?)").bind(target,target).first<{total:number}>();
    const total=count?.total??0,pages=Math.max(1,Math.ceil(total/25));
    const requested=Number(params.get("page")||1),page=Number.isSafeInteger(requested)?Math.max(1,Math.min(requested,pages)):1;
    const users=await env.DB.prepare("SELECT u.id,u.email,u.display_name AS displayName,u.role,u.disabled,u.created_at AS createdAt,(SELECT COUNT(*) FROM shoots WHERE owner_id=u.id) AS shoots FROM users u ORDER BY u.display_name,u.id").all();
    const audit=await env.DB.prepare("SELECT a.id,a.action,a.entity_id AS entityId,a.before_json AS beforeJson,a.after_json AS afterJson,a.created_at AS createdAt,actor.display_name AS actorName,target.display_name AS targetName,target.email AS targetEmail FROM admin_audit a JOIN users actor ON actor.id=a.actor_id JOIN users target ON target.id=a.target_id WHERE (? IS NULL OR a.target_id=?) ORDER BY a.created_at DESC,a.id DESC LIMIT 25 OFFSET ?").bind(target,target,(page-1)*25).all();
    return json({users:users.results,audit:audit.results,total,page,pages});
  }catch{return json({error:"Unable to load administration. Please retry."},503);}
}
export async function POST(request:Request){
  const actor=await owner(request);if(actor instanceof Response)return actor;
  if(!request.headers.get("content-type")?.includes("application/json"))return json({error:"JSON required."},415);
  const text=await request.text();if(text.length>2048)return json({error:"Request too large."},413);
  let body:{action?:string;userId?:string};try{body=JSON.parse(text);}catch{return json({error:"Invalid request."},400);}
  if(!body||!["disable","enable"].includes(body.action??"")||typeof body.userId!=="string")return json({error:"Invalid account action."},400);
  if(body.userId===actor.id)return json({error:"Your administrator account cannot be disabled."},403);
  try{
    const target=await env.DB.prepare("SELECT id,email,role,display_name AS displayName,disabled FROM users WHERE id=? AND role='shooter'").bind(body.userId).first<Account&{disabled:number}>();
    if(!target)return json({error:"Shooter account not found."},404);
    const disabled=body.action==="disable"?1:0;if(target.disabled===disabled)return json({ok:true});
    const audit=auditMutation(env.DB,{...target,actorId:actor.id},`account.${body.action}`,null,"account");
    await env.DB.batch([...audit.before,
      env.DB.prepare("UPDATE users SET disabled=? WHERE id=? AND role='shooter'").bind(disabled,target.id),
      env.DB.prepare("DELETE FROM login_sessions WHERE email=?").bind(target.email),
      env.DB.prepare("UPDATE login_challenges SET consumed=1 WHERE email=?").bind(target.email),...audit.after]);
    return json({ok:true});
  }catch{return json({error:"Unable to change account access. No changes were saved."},503);}
}
