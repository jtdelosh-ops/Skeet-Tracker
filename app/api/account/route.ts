import { env } from "cloudflare:workers";
import { requestAccount } from "@/lib/request-account";
import { migrateLegacyRecords, OWNER_ID, OWNER_EMAIL } from "@/lib/accounts";

export async function GET(request: Request) {
  const account=await requestAccount(request); if(account instanceof Response) return account;
  try {
    let legacy = null;
    if(account.id===OWNER_ID && account.email===OWNER_EMAIL && account.role==="admin") {
      const completed=await env.DB.prepare("SELECT key FROM account_migrations WHERE key='legacy-owner-v1'").first();
      if(!completed) {
        const shoots=await env.DB.prepare("SELECT COUNT(*) AS count FROM shoots WHERE owner_id IS NULL").first<{count:number}>();
        const settings=await env.DB.prepare("SELECT COUNT(*) AS count FROM class_settings").first<{count:number}>();
        legacy={shoots:shoots?.count??0,settings:settings?.count??0};
      }
    }
    return Response.json({email:account.email,displayName:account.displayName,role:account.role,legacy},{headers:{"Cache-Control":"no-store"}});
  } catch {return Response.json({error:"Unable to load account."},{status:503});}
}

export async function POST(request: Request) {
  const account=await requestAccount(request); if(account instanceof Response) return account;
  if(account.id!==OWNER_ID || account.email!==OWNER_EMAIL || account.role!=="admin") return Response.json({error:"Administrator access required."},{status:403});
  try {
    const body=await request.json() as {action?:unknown} | null;
    if(body?.action!=="assign-legacy-records") return Response.json({error:"Unknown action."},{status:400});
    await migrateLegacyRecords(env.DB,account);
    return Response.json({ok:true},{headers:{"Cache-Control":"no-store"}});
  } catch {return Response.json({error:"Unable to assign existing records. Please retry."},{status:503});}
}
