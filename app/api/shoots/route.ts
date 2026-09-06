import { asc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { eventScores, shoots } from "../../../db/schema";
const events = ["12", "20", "28", "410", "doubles"] as const;
const statuses = ["in_progress", "complete"] as const;
type ShootStatus = (typeof statuses)[number];
type SubmittedEntry = {
  event: string;
  broken: number;
  targets: number;
  label?: string;
  classShot?: string;
  shotDate?: string;
};

const validEntries = (entries: SubmittedEntry[] | undefined) =>
  (entries ?? []).filter(
    (entry) =>
      events.includes(entry.event as (typeof events)[number]) &&
      Number.isInteger(entry.broken) &&
      Number.isInteger(entry.targets) &&
      entry.broken >= 0 &&
      entry.targets > 0 &&
      entry.broken <= entry.targets,
  );

const validStatus = (status: string | undefined, fallback: ShootStatus) =>
  statuses.includes(status as ShootStatus) ? (status as ShootStatus) : fallback;
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
      status?: string;
      entries?: SubmittedEntry[];
    };
    if (!body.name?.trim() || !body.date)
      return Response.json(
        { error: "Shoot name and date are required" },
        { status: 400 },
      );
    const entries = validEntries(body.entries);
    const db = getDb();
    const [shoot] = await db
      .insert(shoots)
      .values({
        name: body.name.trim(),
        date: body.date,
        status: validStatus(body.status, "in_progress"),
      })
      .returning();
    if (entries.length)
      await db.insert(eventScores).values(
        entries.map((entry, sequence) => ({
          shootId: shoot.id,
          event: entry.event as (typeof events)[number],
          broken: entry.broken,
          targets: entry.targets,
          sequence,
          label: entry.label?.trim() || "Main",
          classShot: entry.classShot?.trim() || null,
          shotDate: entry.shotDate || body.date,
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
      status?: string;
      entries?: SubmittedEntry[];
    };
    if (!Number.isInteger(body.id) || !body.name?.trim() || !body.date)
      return Response.json(
        { error: "Valid shoot, name, and date are required" },
        { status: 400 },
      );
    const entries = validEntries(body.entries);
    const db = getDb();
    await db
      .update(shoots)
      .set({
        name: body.name.trim(),
        date: body.date,
        status: validStatus(body.status, "complete"),
      })
      .where(eq(shoots.id, body.id));
    if (body.entries !== undefined) {
      await db.delete(eventScores).where(eq(eventScores.shootId, body.id));
      if (entries.length)
        await db.insert(eventScores).values(
          entries.map((entry, sequence) => ({
            shootId: body.id,
            event: entry.event as (typeof events)[number],
            broken: entry.broken,
            targets: entry.targets,
            sequence,
            label: entry.label?.trim() || "Main",
            classShot: entry.classShot?.trim() || null,
            shotDate: entry.shotDate || body.date,
          })),
        );
    }
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
