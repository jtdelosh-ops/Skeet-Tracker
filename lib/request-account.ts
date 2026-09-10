import { env } from "cloudflare:workers";
import { currentSession, type LoginEnv } from "./login";
import type { Account } from "./accounts";

export async function requestAccount(request: Request): Promise<Account | Response> {
  const runtime=env as unknown as LoginEnv;
  try {
    const account=await currentSession(request,runtime);
    if(!account) return Response.json({error:"Please sign in."},{status:401,headers:{"Cache-Control":"no-store"}});
    if(!["GET","HEAD"].includes(request.method) && request.headers.get("origin")!==runtime.APP_ORIGIN)
      return Response.json({error:"Invalid request origin."},{status:403});
    return account;
  } catch {
    return Response.json({error:"Account access is temporarily unavailable."},{status:503});
  }
}
