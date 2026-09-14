import { asc, inArray, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { shoots, eventScores, userClassSettings } from "@/db/schema";
import { calculateStats } from "@/lib/scoring";
import type { Shoot, StartingClasses } from "@/lib/scoring";
import { attachNotes } from "@/lib/shoot-notes";

export async function attachScores(rows: (typeof shoots.$inferSelect)[]): Promise<Shoot[]> {
  if (!rows.length) return [];
  const scores = await getDb().select().from(eventScores)
    .where(inArray(eventScores.shootId, rows.map((row) => row.id)))
    .orderBy(asc(eventScores.sequence), asc(eventScores.id));
  return attachNotes(rows.map((row) => ({ ...row, scores: scores.filter((score) => score.shootId === row.id) })));
}

export async function dashboardData(ownerId: string) {
  const db = getDb();
  // All scoring happens on the server using the same pure calculations as before.
  // Only five active scores per gauge and current active shoots reach the browser.
  const [rows, scores, settings] = await Promise.all([
    db.select().from(shoots).where(eq(shoots.ownerId,ownerId)).orderBy(asc(shoots.date), asc(shoots.id)),
    db.select({id:eventScores.id,shootId:eventScores.shootId,event:eventScores.event,broken:eventScores.broken,targets:eventScores.targets,classShot:eventScores.classShot,shotDate:eventScores.shotDate,sequence:eventScores.sequence,label:eventScores.label}).from(eventScores).innerJoin(shoots,eq(eventScores.shootId,shoots.id)).where(eq(shoots.ownerId,ownerId)).orderBy(asc(eventScores.sequence), asc(eventScores.id)),
    db.select().from(userClassSettings).where(eq(userClassSettings.userId,ownerId)),
  ]);
  const grouped = new Map<number, typeof scores>();
  for (const score of scores) {
    const group = grouped.get(score.shootId) ?? [];
    group.push(score);
    grouped.set(score.shootId, group);
  }
  const allShoots = rows.map((row) => ({ ...row, scores: grouped.get(row.id) ?? [] }));
  const startingClasses = Object.fromEntries(settings.map((row) => [row.event, row.startingClass])) as StartingClasses;
  return { stats: calculateStats(allShoots, startingClasses), startingClasses,
    inProgressShoots: await attachNotes(allShoots.filter((row) => row.status === "in_progress").reverse()) };
}
