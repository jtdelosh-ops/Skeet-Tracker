import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { shootNotes } from "@/db/schema";
import type { Shoot } from "@/lib/scoring";

export function validateNotes(value: unknown) {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length > 5000) throw Error("Shoot notes must be text of 5,000 characters or fewer.");
  return value.trim();
}
export async function saveNotes(shootId: number, content: string | undefined) {
  if (content === undefined) return; // Older clients preserve existing notes.
  const db = getDb();
  const [previous] = await db.select().from(shootNotes).where(eq(shootNotes.shootId, shootId));
  if (previous?.content === content) return;
  if (!content) { await db.delete(shootNotes).where(eq(shootNotes.shootId, shootId)); return; }
  const now = new Date().toISOString();
  await db.insert(shootNotes).values({ shootId, content, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({ target: shootNotes.shootId, set: { content, updatedAt: now } });
}
export async function attachNotes(rows: Shoot[]): Promise<Shoot[]> {
  if (!rows.length) return [];
  const notes = await getDb().select().from(shootNotes).where(inArray(shootNotes.shootId, rows.map((row) => row.id)));
  const byId = new Map(notes.map(({ shootId, ...note }) => [shootId, note]));
  return rows.map((row) => ({ ...row, notes: byId.get(row.id) ?? null }));
}
