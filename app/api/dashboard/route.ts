import { dashboardData } from "@/lib/tracker-data";
import { requestAccount } from "@/lib/request-account";
export async function GET(request: Request) {
  const account=await requestAccount(request,true); if(account instanceof Response) return account;
  try {
    return Response.json(await dashboardData(account.id), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Unable to load dashboard." }, { status: 500 });
  }
}

