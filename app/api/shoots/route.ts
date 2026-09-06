import { asc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { eventScores, shoots } from "../../../db/schema";
const seed = [
  [158427, "2020-05-02", "Monthly Targets", 86, 92, null, null, null],
  [158427, "2020-05-16", "Monthly Targets", null, null, 84, null, null],
  [158427, "2020-05-23", "Monthly Targets", null, null, null, 87, 84],
  [157342, "2020-06-21", "7th Elite Classic Open", 95, 92, 91, 88, 88],
  [156604, "2020-07-12", "Paratrooper Open", 89, 92, 85, 86, 80],
  [158346, "2020-07-25", "New Management Open 12 & 20", 91, 92, null, null, null],
  [158128, "2020-08-02", "Zone 4 iShoot", 93, 96, 95, 91, 93],
  [158347, "2020-08-22", "28 & 410 Open", null, null, 92, 93, null],
  [156642, "2020-08-30", "Pig Pickin", 95, 97, 97, 98, 93],
  [156605, "2020-09-13", "NC State Closed Championship", 97, 97, 99, 92, 92],
  [158348, "2020-09-26", "12 & 28 Open", null, 97, 93, null, null],
  [158528, "2020-11-15", "November Open", 92, 99, 94, 91, 93],
  [158684, "2021-04-11", "Pig Pickin Open", 95, 95, 93, 94, 89],
  [158679, "2021-04-25", "John Scott/Henry Grubb Azalea Open", 99, 98, 94, 97, 92],
  [158680, "2021-05-16", "General Pletcher Open", 97, 97, 94, 95, 83],
  [158681, "2021-05-21", "Armed Services Skeet Championship", [97, 97], 100, 98, 97, 91],
  [159813, "2021-06-06", "Tildon Downing Challenge", 98, 98, 98, 95, 87],
  [156929, "2021-06-27", "US Open iShoot", 96, 98, 96, 96, 94],
  [158682, "2021-07-11", "Paratrooper Open", 98, 94, 98, 94, 91],
  [159814, "2021-07-25", "Bull City Open", 99, 95, 99, 94, 99],
  [160357, "2021-08-15", "Zone 4 Championships", 100, 96, 93, 94, 96],
  [158683, "2021-09-12", "NC State Closed Skeet Championship", 99, 97, 96, 98, 94],
  [160689, "2022-04-10", "Pig Pickin", 92, 96, 97, 93, 87],
  [160686, "2022-04-24", "John Scott/Henry Grubb Azalea Open", 96, 94, 95, 95, null],
  [161603, "2022-05-20", "Armed Forces Skeet Championship", [96, 96], 96, 98, 93, 89],
  [160442, "2022-05-29", "Tildon Downing Challenge", 99, 96, 92, 93, 94],
  [160404, "2022-06-26", "US Open", 95, 96, 96, 92, 90],
  [160687, "2022-07-10", "Paratrooper Open", 99, 99, 94, 94, 92],
  [160443, "2022-07-31", "Bull City Open", 97, 98, 99, 97, 92],
  [160688, "2022-09-11", "NC State Closed Skeet Championship", 97, 97, 99, 97, 90],
  [162508, "2023-04-02", "Pig Pickin Open", 97, 98, 96, 96, 94],
  [163033, "2023-04-16", "John Scott/Henry Grubb Azalea Open", 96, 97, 92, 94, null],
  [163516, "2023-05-21", "Tildon Downing Challenge", 97, 99, 98, 93, 92],
  [162504, "2023-06-25", "Kolar US Open-iShoot", 99, 99, 97, 93, 95],
  [163034, "2023-07-09", "Paratrooper Open", 97, 97, 97, 99, 93],
  [163470, "2023-08-20", "87th Annual Pennsylvania State Skeet", 100, 97, 95, 97, 94],
  [163035, "2023-09-10", "North Carolina State Closed", 95, 98, 94, 94, 90],
  [164692, "2023-11-05", "Snowbird Open 4 Gun & Dbls", 100, 98, 93, 94, 95],
  [161797, "2024-04-07", "Pig Pickin", 92, 97, 97, 95, 89],
  [166096, "2024-06-02", "Tildon Downing Challenge", 98, 99, 98, 97, 92],
  [166240, "2024-06-23", "Kolar US Open", 99, 96, 98, 92, 89],
  [166116, "2024-07-14", "Paratrooper Open", 98, 97, 97, 95, null],
  [166117, "2024-09-08", "North Carolina State Skeet", 98, 98, 97, 95, 89],
  [166527, "2024-10-06", "Portsmouth Langley Open", 99, 97, 97, 96, null],
  [167638, "2024-11-17", "Autumn Open", 90, 97, 99, 91, null],
  [167838, "2025-04-06", "Pig Pickin", 94, 97, 91, 93, 90],
  [168761, "2025-06-01", "Tildon Downing Challenge", 92, 97, 98, 94, 92],
  [167601, "2025-06-22", "Kolar US Open", 93, 97, 96, 92, null],
  [168948, "2025-07-13", "Firecracker 400", 100, 100, 99, 89, null],
  [169053, "2025-08-10", "Zone 4 iShoot Championships", 91, 96, 98, 94, 87],
  [167769, "2025-09-07", "North Carolina State Open", 98, 95, 98, 95, 91],
  [
    170795,
    "2026-08-09",
    "Zone 4 Skeet Championships iShoot",
    95,
    96,
    98,
    96,
    null,
  ],
] as const;
const events = ["12", "20", "28", "410", "doubles"] as const;
async function ensureSeeded() {
  const db = getDb();
  const existing = new Set(
    (await db.select({ shootNumber: shoots.shootNumber, date: shoots.date }).from(shoots))
      .map((row) => `${row.shootNumber}|${row.date}`),
  );
  for (const row of seed) {
    if (existing.has(`${row[0]}|${row[1]}`)) continue;
    const [shoot] = await db
      .insert(shoots)
      .values({ shootNumber: row[0], date: row[1], name: row[2] })
      .returning();
    const values = events.flatMap((event, i) => {
      const score = row[i + 3] as number | readonly number[] | null;
      if (score == null) return [];
      const scores = Array.isArray(score) ? score : [score];
      return scores.map((broken, eventIndex) => ({
        shootId: shoot.id,
        event,
        broken,
        targets: 100,
        sequence: i * 10 + eventIndex,
        label: scores.length > 1 ? `Combined event ${eventIndex + 1}` : "Main",
      }));
    });
    await db.insert(eventScores).values(values);
  }
}
export async function GET() {
  try {
    await ensureSeeded();
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
