import { env } from "cloudflare:workers";
import { currentSession, type LoginEnv } from "./login";
import { isOwner, type Account } from "./accounts";

export async function requestAccount(request: Request, allowSupport=false): Promise<Account | Response> {
  const runtime=env as unknown as LoginEnv;
  try {
    const account=await currentSession(request,runtime);
    if(!account) return Response.json({error:"Please sign in."},{status:401,headers:{"Cache-Control":"no-store"}});
    if(!["GET","HEAD"].includes(request.method) && request.headers.get("origin")!==runtime.APP_ORIGIN)
      return Response.json({error:"Invalid request origin."},{status:403});
    const target=request.headers.get("x-skeet-shooter");
    if(allowSupport && target) {
      if(!isOwner(account)) return Response.json({error:"Administrator access required."},{status:403});
      if(target===account.id) return account;
      const shooter=await runtime.DB.prepare("SELECT id,email,role,display_name AS displayName FROM users WHERE id=? AND role='shooter'").bind(target).first<Account>();
      if(!shooter) return Response.json({error:"Shooter account not found."},{status:404});
      return {...shooter,expires_at:account.expires_at,actorId:account.id,actorName:account.displayName,actorEmail:account.email};
    }
    return account;
  } catch {
    return Response.json({error:"Account access is temporarily unavailable."},{status:503});
  }
}
