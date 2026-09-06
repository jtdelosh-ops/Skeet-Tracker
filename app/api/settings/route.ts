import { getDb } from "../../../db";
import { classSettings } from "../../../db/schema";

const events = ["12", "20", "28", "410", "doubles"] as const;
type EventKey = (typeof events)[number];
type StartingClasses = Partial<Record<EventKey, string>>;

const validClasses: Record<EventKey, readonly string[]> = {
  "12": ["AAA", "AA", "A", "B", "C", "D", "E"],
  "20": ["AAA", "AA", "A", "B", "C", "D"],
  "28": ["AAA", "AA", "A", "B", "C", "D"],
  "410": ["AAA", "AA", "A", "B", "C", "D"],
  doubles: ["AAA", "AA", "A", "B", "C", "D"],
};

export async function GET() {
  try {
    const rows = await getDb().select().from(classSettings);
    return Response.json({
      startingClasses: Object.fromEntries(
        rows.map((row) => [row.event, row.startingClass]),
      ),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to load settings" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as { startingClasses?: StartingClasses };
    const submitted = body.startingClasses ?? {};
    const rows = events.flatMap((event) => {
      const startingClass = submitted[event];
      if (startingClass === undefined || startingClass === "") return [];
      if (!validClasses[event].includes(startingClass)) {
        throw new Error(`Invalid starting class for ${event}`);
      }
      return [{ event, startingClass }];
    });

    const db = getDb();
    await db.delete(classSettings);
    if (rows.length) await db.insert(classSettings).values(rows);

    return Response.json({ startingClasses: submitted });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save settings";
    return Response.json(
      { error: message },
      { status: message.startsWith("Invalid starting class") ? 400 : 500 },
    );
  }
}
