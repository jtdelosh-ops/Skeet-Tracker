import { env } from "cloudflare:workers";
import { parseHistoryQuery, historyPage, PAGE_SIZE } from "@/lib/history-query";
import { attachScores } from "@/lib/tracker-data";
import type { shoots } from "@/db/schema";
import { requestAccount } from "@/lib/request-account";

export async function GET(request: Request) {
  const account=await requestAccount(request,true); if(account instanceof Response) return account;
  let parsed;
  try { parsed = parseHistoryQuery(new URL(request.url).searchParams); }
  catch (error) { return Response.json({ error: (error as Error).message }, { status: 400 }); }
  try {
    // Shared predicate is also the integration point for future selected-shooter authorization.
    // Identifiers are static; every user-supplied value is bound.
    const { where, bindings, query } = parsed;
    const count = await env.DB.prepare(`SELECT COUNT(*) AS total FROM shoots WHERE owner_id = ? AND (${where})`).bind(account.id,...bindings).first<{ total: number }>();
    const total = count?.total ?? 0;
    const { page, pages, offset } = historyPage(parsed.page, total);
    const result = await env.DB.prepare(`SELECT id, owner_id AS ownerId, shoot_number AS shootNumber, name, date, status FROM shoots WHERE owner_id = ? AND (${where}) ORDER BY date DESC, id DESC LIMIT ? OFFSET ?`)
      .bind(account.id,...bindings, PAGE_SIZE, offset).all<typeof shoots.$inferSelect>();
    return Response.json({ shoots: await attachScores(result.results), total, page, pages, pageSize: PAGE_SIZE, query }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Unable to load tournament history. Please retry." }, { status: 500 });
  }
}

