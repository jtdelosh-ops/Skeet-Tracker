import { validateNotes, saveNotes } from "@/lib/shoot-notes";
import { attachScores } from "@/lib/tracker-data";
import { asc, eq, and } from "drizzle-orm";
import { requestAccount } from "@/lib/request-account";
import { getDb } from "../../../db";
import { eventScores, shoots, shootNotes } from "../../../db/schema";
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
export async function GET(request: Request) {
  const account=await requestAccount(request); if(account instanceof Response) return account;
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(shoots)
      .where(eq(shoots.ownerId,account.id))
      .orderBy(asc(shoots.date), asc(shoots.id));
    return Response.json({
      shoots: await attachScores(rows),
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Unable to load shoots" },
      { status: 500 },
    );
  }
}
export async function POST(request: Request) {
  const account=await requestAccount(request); if(account instanceof Response) return account;
  try {
    const body = (await request.json()) as {
      name: string;
      date: string;
      status?: string;
      entries?: SubmittedEntry[];
      notes?: string;
    };
    if (!body.name?.trim() || !body.date)
      return Response.json(
        { error: "Shoot name and date are required" },
        { status: 400 },
      );
    let notes;
    try { notes = validateNotes(body.notes); } catch (error) { return Response.json({ error: (error as Error).message }, { status: 400 }); }
    const entries = validEntries(body.entries);
    const db = getDb();
    const [shoot] = await db
      .insert(shoots)
      .values({
        ownerId: account.id,
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
    await saveNotes(shoot.id, notes);
    return Response.json({ shoot }, { status: 201 });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Unable to save shoot" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const account=await requestAccount(request); if(account instanceof Response) return account;
  try {
    const body = (await request.json()) as {
      id: number;
      name: string;
      date: string;
      status?: string;
      entries?: SubmittedEntry[];
      notes?: string;
    };
    if (!Number.isInteger(body.id) || !body.name?.trim() || !body.date)
      return Response.json(
        { error: "Valid shoot, name, and date are required" },
        { status: 400 },
      );
    let notes;
    try { notes = validateNotes(body.notes); } catch (error) { return Response.json({ error: (error as Error).message }, { status: 400 }); }
    const entries = validEntries(body.entries);
    const db = getDb();
    const [owned]=await db.select({id:shoots.id}).from(shoots).where(and(eq(shoots.id,body.id),eq(shoots.ownerId,account.id)));
    if(!owned) return Response.json({error:"Shoot not found."},{status:404});
    await db
      .update(shoots)
      .set({
        name: body.name.trim(),
        date: body.date,
        status: validStatus(body.status, "complete"),
      })
      .where(and(eq(shoots.id, body.id),eq(shoots.ownerId,account.id)));
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
    await saveNotes(body.id, notes);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Unable to update shoot" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const account=await requestAccount(request); if(account instanceof Response) return account;
  try {
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!Number.isInteger(id))
      return Response.json(
        { error: "Valid shoot is required" },
        { status: 400 },
      );
    const db = getDb();
    const [owned]=await db.select({id:shoots.id}).from(shoots).where(and(eq(shoots.id,id),eq(shoots.ownerId,account.id)));
    if(!owned) return Response.json({error:"Shoot not found."},{status:404});
    await db.batch([db.delete(shootNotes).where(eq(shootNotes.shootId,id)),db.delete(eventScores).where(eq(eventScores.shootId,id)),db.delete(shoots).where(and(eq(shoots.id,id),eq(shoots.ownerId,account.id)))]);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Unable to delete shoot" },
      { status: 500 },
    );
  }
}
