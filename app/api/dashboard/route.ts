import { dashboardData } from "@/lib/tracker-data";
export async function GET() {
  try {
    return Response.json(await dashboardData(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Unable to load dashboard." }, { status: 500 });
  }
}
