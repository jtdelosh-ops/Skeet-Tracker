import { asc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { eventScores, shoots } from "../../../db/schema";
const events = ["12", "20", "28", "410", "doubles"] as const;
export async function GET() {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(shoots)
      .orderBy(asc(shoots.date), asc(shoots.id));
    return Response.json({
      shoots: await Promise.all(
        rows.map(async (shoot) => ({
          ...shoot,
          scores: await db
            .select()
            .from(eventScores)
            .where(eq(eventScores.shootId, shoot.id))
            .orderBy(asc(eventScores.sequence), asc(eventScores.id)),
        })),
      ),
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Unable to load shoots" },
      { status: 500 },
    );
  }
}
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name: string;
      date: string;
      entries: {
        event: string;
        broken: number;
        targets: number;
        label?: string;
        classShot?: string;
      }[];
    };
    if (!body.name?.trim() || !body.date)
      return Response.json(
        { error: "Shoot name and date are required" },
        { status: 400 },
      );
    const entries = (body.entries ?? []).filter(
      (x) =>
        events.includes(x.event as (typeof events)[number]) &&
        Number.isInteger(x.broken) &&
        Number.isInteger(x.targets) &&
        x.broken >= 0 &&
        x.targets > 0 &&
        x.broken <= x.targets,
    );
    if (!entries.length)
      return Response.json(
        { error: "Add at least one valid event" },
        { status: 400 },
      );
    const db = getDb();
    const [shoot] = await db
      .insert(shoots)
      .values({ name: body.name.trim(), date: body.date })
      .returning();
    await db.insert(eventScores).values(
      entries.map((x, i) => ({
        shootId: shoot.id,
        event: x.event as (typeof events)[number],
        broken: x.broken,
        targets: x.targets,
        sequence: i,
        label: x.label?.trim() || "Main",
        classShot: x.classShot?.trim() || null,
      })),
    );
    return Response.json({ shoot }, { status: 201 });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Unable to save shoot" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      id: number;
      name: string;
      date: string;
      entries: {
        event: string;
        broken: number;
        targets: number;
        label?: string;
        classShot?: string;
      }[];
    };
    if (!Number.isInteger(body.id) || !body.name?.trim() || !body.date)
      return Response.json(
        { error: "Valid shoot, name, and date are required" },
        { status: 400 },
      );
    const entries = (body.entries ?? []).filter(
      (x) =>
        events.includes(x.event as (typeof events)[number]) &&
        Number.isInteger(x.broken) &&
        Number.isInteger(x.targets) &&
        x.broken >= 0 &&
        x.targets > 0 &&
        x.broken <= x.targets,
    );
    if (!entries.length)
      return Response.json(
        { error: "Add at least one valid event" },
        { status: 400 },
      );
    const db = getDb();
    await db
      .update(shoots)
      .set({ name: body.name.trim(), date: body.date })
      .where(eq(shoots.id, body.id));
    await db.delete(eventScores).where(eq(eventScores.shootId, body.id));
    await db.insert(eventScores).values(
      entries.map((x, i) => ({
        shootId: body.id,
        event: x.event as (typeof events)[number],
        broken: x.broken,
        targets: x.targets,
        sequence: i,
        label: x.label?.trim() || "Main",
        classShot: x.classShot?.trim() || null,
      })),
    );
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Unable to update shoot" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!Number.isInteger(id))
      return Response.json(
        { error: "Valid shoot is required" },
        { status: 400 },
      );
    const db = getDb();
    await db.delete(eventScores).where(eq(eventScores.shootId, id));
    await db.delete(shoots).where(eq(shoots.id, id));
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Unable to delete shoot" },
      { status: 500 },
    );
  }
}
