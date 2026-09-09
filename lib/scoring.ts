export type EventKey = "12" | "20" | "28" | "410" | "doubles";
export type Score = {
  id: number;
  event: EventKey;
  broken: number;
  targets: number;
  label: string;
  sequence: number;
  classShot: string | null;
  shotDate: string | null;
};
export type ShootStatus = "in_progress" | "complete";
export type Shoot = {
  notes?: { content: string; createdAt: string; updatedAt: string } | null;
  id: number;
  name: string;
  date: string;
  status: ShootStatus;
  scores: Score[];
};

export function shootTotals(shoot: Shoot) {
  const main = shoot.scores.filter((score) => score.label.trim().toLowerCase() === "main");
  const gauges: EventKey[] = ["12", "20", "28", "410"];
  const complete = gauges.every((event) => main.some((score) => score.event === event));
  const sum = (events: EventKey[]) => main.filter((score) => events.includes(score.event))
    .reduce((total, score) => ({ broken: total.broken + score.broken, targets: total.targets + score.targets }), { broken: 0, targets: 0 });
  const doubles = main.some((score) => score.event === "doubles");
  return { hoa: complete ? sum(gauges) : null, hasDoubles: doubles,
    haa: complete && doubles ? sum([...gauges, "doubles"]) : null };
}
export type StartingClasses = Partial<Record<EventKey, string>>;
export type EventStats = {
  active: (Score & { date: string; name: string; status: ShootStatus })[];
  average: number;
  classificationAverage: number;
  className: string;
  mathematicalClass: string;
  provisional: boolean;
};
export type ClassChange = {
  event: EventKey;
  label: string;
  from: string;
  to: string;
  average: number;
  direction: "up" | "down";
};
export type Entry = {
  event: EventKey;
  label: string;
  broken: string;
  targets: string;
  classShot: string;
  shotDate: string;
  removable: boolean;
};
export const info: Record<
  EventKey,
  { label: string; short: string; t: [string, number][] }
> = {
  "12": {
    label: "12 Gauge",
    short: "12",
    t: [
      ["AAA", 0.985],
      ["AA", 0.975],
      ["A", 0.96],
      ["B", 0.935],
      ["C", 0.9],
      ["D", 0.855],
      ["E", 0],
    ],
  },
  "20": {
    label: "20 Gauge",
    short: "20",
    t: [
      ["AAA", 0.9825],
      ["AA", 0.97],
      ["A", 0.945],
      ["B", 0.91],
      ["C", 0.855],
      ["D", 0],
    ],
  },
  "28": {
    label: "28 Gauge",
    short: "28",
    t: [
      ["AAA", 0.98],
      ["AA", 0.965],
      ["A", 0.94],
      ["B", 0.905],
      ["C", 0.855],
      ["D", 0],
    ],
  },
  "410": {
    label: ".410 Bore",
    short: ".410",
    t: [
      ["AAA", 0.965],
      ["AA", 0.945],
      ["A", 0.91],
      ["B", 0.86],
      ["C", 0.8],
      ["D", 0],
    ],
  },
  doubles: {
    label: "Doubles",
    short: "DBLS",
    t: [
      ["AAA", 0.97],
      ["AA", 0.95],
      ["A", 0.91],
      ["B", 0.85],
      ["C", 0.8],
      ["D", 0],
    ],
  },
};
export const keys = Object.keys(info) as EventKey[];
export const hoa4: [string, number][] = [
    ["AAA", 0.9781],
    ["AA", 0.9638],
    ["A", 0.9388],
    ["B", 0.9025],
    ["C", 0.8525],
    ["D", 0.7925],
    ["E", 0],
  ],
  hoa5: [string, number][] = [
    ["AAA", 0.9764],
    ["AA", 0.961],
    ["A", 0.933],
    ["B", 0.892],
    ["C", 0.842],
    ["D", 0.782],
    ["E", 0],
  ];
export const classOrder = ["AAA", "AA", "A", "B", "C", "D", "E"];
export const round4 = (n: number) => Math.round((n + Number.EPSILON) * 10000) / 10000;
export const cls = (a: number, t: [string, number][]) =>
    t.find(([, f]) => round4(a) >= f)?.[0] ?? "—",
  fmt = (n: number) => round4(n).toFixed(4).replace(/^0/, "");
export const ruleClass = (
  event: EventKey,
  mathematical: string,
  startingClass?: string,
) => {
  if (!startingClass) return mathematical;
  const floor =
    classOrder[
      Math.min(
        classOrder.indexOf(startingClass) + 1,
        event === "12" ? 6 : 5,
      )
    ];
  return classOrder[
    Math.min(classOrder.indexOf(mathematical), classOrder.indexOf(floor))
  ];
};
export const hoaSafeguard = (mathematical: string, componentClasses: string[]) => {
  const lowestGun = Math.max(
    ...componentClasses.map((c) => classOrder.indexOf(c)),
  );
  return classOrder[Math.min(classOrder.indexOf(mathematical), lowestGun)];
};
export const defaults = (shotDate = "") =>
  keys.map((event) => ({
    event,
    label: "Main",
    broken: "",
    targets: "100",
    classShot: "",
    shotDate,
    removable: false,
  })) as Entry[];
export const isPreliminary = (score: Pick<Score, "label">) =>
  score.label.trim().toLowerCase() === "preliminary";

export const orderedScores = (shoot: Shoot, event: EventKey) =>
  shoot.scores
    .filter((score) => score.event === event)
    .sort((a, b) => {
      const eventOrder = Number(isPreliminary(b)) - Number(isPreliminary(a));
      return eventOrder || a.sequence - b.sequence || a.id - b.id;
    })
    .map((score) => ({
      ...score,
      date: score.shotDate ?? shoot.date,
      name: shoot.name,
      status: shoot.status,
    }));

export const calculateStats = (
  shoots: Shoot[],
  startingClasses: StartingClasses,
) =>
  Object.fromEntries(
    keys.map((event) => {
      const scoredEvents = shoots.flatMap((shoot) =>
          orderedScores(shoot, event),
        ),
        active = scoredEvents
          .slice(-5),
        broken = active.reduce((total, score) => total + score.broken, 0),
        targets = active.reduce((total, score) => total + score.targets, 0),
        average = targets ? broken / targets : 0,
        classificationActive = scoredEvents
          .filter(
            (score) => score.status === "complete" || !isPreliminary(score),
          )
          .slice(-5),
        classificationBroken = classificationActive.reduce(
          (total, score) => total + score.broken,
          0,
        ),
        classificationTargets = classificationActive.reduce(
          (total, score) => total + score.targets,
          0,
        ),
        classificationAverage = classificationTargets
          ? classificationBroken / classificationTargets
          : 0,
        mathematicalClass = classificationTargets
          ? cls(classificationAverage, info[event].t)
          : "—",
        className = classificationTargets
          ? ruleClass(event, mathematicalClass, startingClasses[event])
          : startingClasses[event] ?? "—";
      return [
        event,
        {
          active,
          average,
          classificationAverage,
          mathematicalClass,
          className,
          provisional: scoredEvents.some(
            (score) => score.status === "in_progress" && isPreliminary(score),
          ),
        },
      ];
    }),
  ) as Record<EventKey, EventStats>;

export const findClassChanges = (
  previous: Record<EventKey, EventStats>,
  next: Record<EventKey, EventStats>,
  startingClasses: StartingClasses,
) =>
  keys.flatMap((event): ClassChange[] => {
    const before = previous[event],
      after = next[event],
      beforeIndex = classOrder.indexOf(before.className),
      afterIndex = classOrder.indexOf(after.className);
    if (
      before.className === after.className ||
      beforeIndex < 0 ||
      afterIndex < 0 ||
      (!before.active.length && !startingClasses[event])
    )
      return [];
    return [
      {
        event,
        label: info[event].label,
        from: before.className,
        to: after.className,
        average: after.classificationAverage,
        direction: afterIndex < beforeIndex ? "up" : "down",
      },
    ];
  });

export const summarizeShootGauge = (shoot: Shoot, event: EventKey) => {
  const rows = shoot.scores.filter((score) => score.event === event);
  return rows.length
    ? {
        broken: rows.reduce((total, score) => total + score.broken, 0),
        targets: rows.reduce((total, score) => total + score.targets, 0),
        count: rows.length,
        classes: [
          ...new Set(
            rows
              .map((score) => score.classShot)
              .filter((classShot): classShot is string => Boolean(classShot)),
          ),
        ],
        dates: [
          ...new Set(rows.map((score) => score.shotDate ?? shoot.date)),
        ],
      }
    : null;
};
