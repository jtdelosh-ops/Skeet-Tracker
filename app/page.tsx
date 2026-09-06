"use client";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Pencil,
  Plus,
  Settings2,
  Target,
  Trash2,
  Trophy,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
type EventKey = "12" | "20" | "28" | "410" | "doubles";
type Score = {
  id: number;
  event: EventKey;
  broken: number;
  targets: number;
  label: string;
  sequence: number;
  classShot: string | null;
};
type Shoot = { id: number; name: string; date: string; scores: Score[] };
type StartingClasses = Partial<Record<EventKey, string>>;
type EventStats = {
  active: (Score & { date: string; name: string })[];
  average: number;
  className: string;
  mathematicalClass: string;
};
type ClassChange = {
  event: EventKey;
  label: string;
  from: string;
  to: string;
  average: number;
  direction: "up" | "down";
};
type Entry = {
  event: EventKey;
  label: string;
  broken: string;
  targets: string;
  classShot: string;
};
const info: Record<
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
const keys = Object.keys(info) as EventKey[];
const hoa4: [string, number][] = [
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
const classOrder = ["AAA", "AA", "A", "B", "C", "D", "E"];
const round4 = (n: number) => Math.round((n + Number.EPSILON) * 10000) / 10000;
const cls = (a: number, t: [string, number][]) =>
    t.find(([, f]) => round4(a) >= f)?.[0] ?? "—",
  fmt = (n: number) => round4(n).toFixed(4).replace(/^0/, "");
const ruleClass = (
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
const hoaSafeguard = (mathematical: string, componentClasses: string[]) => {
  const lowestGun = Math.max(
    ...componentClasses.map((c) => classOrder.indexOf(c)),
  );
  return classOrder[Math.min(classOrder.indexOf(mathematical), lowestGun)];
};
const defaults = () =>
  keys.map((event) => ({
    event,
    label: "Main",
    broken: "",
    targets: "100",
    classShot: "",
  })) as Entry[];
const calculateStats = (
  shoots: Shoot[],
  startingClasses: StartingClasses,
) =>
  Object.fromEntries(
    keys.map((event) => {
      const active = shoots
          .flatMap((shoot) =>
            shoot.scores
              .filter((score) => score.event === event)
              .map((score) => ({
                ...score,
                date: shoot.date,
                name: shoot.name,
              })),
          )
          .slice(-5),
        broken = active.reduce((total, score) => total + score.broken, 0),
        targets = active.reduce((total, score) => total + score.targets, 0),
        average = targets ? broken / targets : 0,
        mathematicalClass = targets ? cls(average, info[event].t) : "—",
        className = targets
          ? ruleClass(event, mathematicalClass, startingClasses[event])
          : startingClasses[event] ?? "—";
      return [
        event,
        {
          active,
          average,
          mathematicalClass,
          className,
        },
      ];
    }),
  ) as Record<EventKey, EventStats>;

const findClassChanges = (
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
        average: after.average,
        direction: afterIndex < beforeIndex ? "up" : "down",
      },
    ];
  });

export default function Home() {
  const [shoots, setShoots] = useState<Shoot[]>([]),
    [loading, setLoading] = useState(true),
    [show, setShow] = useState(false),
    [showSettings, setShowSettings] = useState(false),
    [saving, setSaving] = useState(false),
    [savingSettings, setSavingSettings] = useState(false),
    [editingId, setEditingId] = useState<number | null>(null),
    [error, setError] = useState("");
  const [rankUps, setRankUps] = useState<ClassChange[]>([]),
    [rankDowns, setRankDowns] = useState<ClassChange[]>([]);
  const [startingClasses, setStartingClasses] = useState<StartingClasses>({}),
    [draftStartingClasses, setDraftStartingClasses] = useState<StartingClasses>({});
  const [name, setName] = useState(""),
    [date, setDate] = useState(""),
    [entries, setEntries] = useState<Entry[]>(defaults());
  const requestTrackerData = () =>
    Promise.all([fetch("/api/shoots"), fetch("/api/settings")]).then(
      async ([shootResponse, settingsResponse]) => {
        const [shootData, settingsData] = await Promise.all([
          shootResponse.json(),
          settingsResponse.json(),
        ]);
        if (!shootResponse.ok) throw Error(shootData.error);
        if (!settingsResponse.ok) throw Error(settingsData.error);
        return {
          shoots: shootData.shoots as Shoot[],
          startingClasses: settingsData.startingClasses as StartingClasses,
        };
      },
    );
  const load = () =>
    requestTrackerData()
      .then((data) => {
        setShoots(data.shoots);
        setStartingClasses(data.startingClasses);
        setDraftStartingClasses(data.startingClasses);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  useEffect(load, []);
  useEffect(() => {
    if (!rankDowns.length || rankUps.length) return;
    const timeout = window.setTimeout(() => setRankDowns([]), 7000);
    return () => window.clearTimeout(timeout);
  }, [rankDowns, rankUps]);
  const stats = useMemo(
    () => calculateStats(shoots, startingClasses),
    [shoots, startingClasses],
  );
  const hoaReady = (["12", "20", "28", "410"] as EventKey[]).every(
      (event) => stats[event].active.length > 0,
    ),
    haaReady = hoaReady && stats.doubles.active.length > 0,
    hoa =
      (stats["12"].average +
        stats["20"].average +
        stats["28"].average +
        stats["410"].average) /
      4,
    haa = (hoa * 4 + stats.doubles.average) / 5,
    hoaClass = hoaReady
      ? hoaSafeguard(cls(hoa, hoa4), [
          stats["12"].className,
          stats["20"].className,
          stats["28"].className,
          stats["410"].className,
        ])
      : "—",
    haaClass = haaReady
      ? hoaSafeguard(
          cls(haa, hoa5),
          keys.map((k) => stats[k].className),
        )
      : "—";
  const displayScore = (shoot: Shoot, event: EventKey) => {
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
        }
      : null;
  };
  const setEntry = (i: number, p: Partial<Entry>) =>
    setEntries((v) => v.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const closeForm = () => {
    setShow(false);
    setEditingId(null);
    setName("");
    setDate("");
    setEntries(defaults());
  };
  const currentClassFor = (event: EventKey) =>
    classOrder.includes(stats[event].className) ? stats[event].className : "";
  const newShoot = () => {
    setEditingId(null);
    setName("");
    setDate("");
    setEntries(
      defaults().map((entry) => ({
        ...entry,
        classShot: currentClassFor(entry.event),
      })),
    );
    setShow(true);
  };
  const editShoot = (shoot: Shoot) => {
    setEditingId(shoot.id);
    setName(shoot.name);
    setDate(shoot.date);
    setEntries(
      shoot.scores.map((x) => ({
        event: x.event,
        label: x.label,
        broken: String(x.broken),
        targets: String(x.targets),
        classShot: x.classShot ?? "",
      })),
    );
    setShow(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const deleteShoot = async (shoot: Shoot) => {
    if (!window.confirm(`Delete ${shoot.name}? This cannot be undone.`)) return;
    const r = await fetch(`/api/shoots?id=${shoot.id}`, { method: "DELETE" });
    const d = await r.json();
    if (!r.ok) return setError(d.error);
    await load();
  };
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = entries
        .filter((x) => x.broken !== "")
        .map((x) => ({
          ...x,
          broken: Number(x.broken),
          targets: Number(x.targets),
        }));
      const r = await fetch("/api/shoots", {
          method: editingId ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: editingId, name, date, entries: payload }),
        }),
        d = await r.json();
      if (!r.ok) throw Error(d.error);
      closeForm();
      const nextData = await requestTrackerData(),
        nextStats = calculateStats(
          nextData.shoots,
          nextData.startingClasses,
        ),
        changes = findClassChanges(stats, nextStats, startingClasses);
      setShoots(nextData.shoots);
      setStartingClasses(nextData.startingClasses);
      setDraftStartingClasses(nextData.startingClasses);
      setRankUps(changes.filter((change) => change.direction === "up"));
      setRankDowns(changes.filter((change) => change.direction === "down"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save");
    } finally {
      setSaving(false);
    }
  }
  const openSettings = () => {
    setDraftStartingClasses(startingClasses);
    setShowSettings(true);
    setShow(false);
  };
  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingSettings(true);
    setError("");
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ startingClasses: draftStartingClasses }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      setStartingClasses(data.startingClasses);
      setShowSettings(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save settings");
    } finally {
      setSavingSettings(false);
    }
  }
  return (
    <main>
      <header>
        <div>
          <p className="eyebrow">NSSA SKEET TRACKER</p>
          <h1>Skeet record</h1>
          <p className="sub">Rolling averages · classes · tournament history</p>
        </div>
        <div className="header-actions">
          <Button variant="outline" onClick={openSettings} className="settings-button">
            <Settings2 /> Class settings
          </Button>
          <Button
            disabled={loading}
            onClick={() => {
              setShowSettings(false);
              if (show) closeForm();
              else newShoot();
            }}
            className="add"
          >
            <Plus /> Add shoot
          </Button>
        </div>
      </header>
      {error && <div className="error">{error}</div>}
      {rankDowns.length > 0 && rankUps.length === 0 && (
        <div className="rank-down-notice" role="status" aria-live="polite">
          <ArrowDown aria-hidden="true" />
          <div>
            <strong>Classification updated</strong>
            {rankDowns.map((change) => (
              <span key={change.event}>
                {change.label}: {change.from} → {change.to}
              </span>
            ))}
          </div>
        </div>
      )}
      <Dialog open={rankUps.length > 0} onOpenChange={(open) => !open && setRankUps([])}>
        <DialogContent className="rank-up-dialog">
          <div className="rank-up-emblem" aria-hidden="true">
            <Trophy />
          </div>
          <DialogHeader>
            <p className="eyebrow">NEW CLASSIFICATION</p>
            <DialogTitle>You ranked up!</DialogTitle>
            <DialogDescription>
              Your latest result moved your rolling classification.
            </DialogDescription>
          </DialogHeader>
          <div className="rank-up-list">
            {rankUps.map((change) => (
              <div className="rank-up-result" key={change.event}>
                <span>{change.label}</span>
                <strong>
                  {change.from} <ArrowUp aria-label="to" /> {change.to}
                </strong>
                <small>New average {fmt(change.average)}</small>
              </div>
            ))}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button>Continue</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {showSettings && (
        <form className="entry settings" onSubmit={saveSettings}>
          <div className="entry-head">
            <div>
              <h2>Annual starting classes</h2>
              <p>
                Optional. A configured class limits downgrades to one class below
                where you started the year. Leave an event unset to use only its
                rolling average.
              </p>
            </div>
            <button type="button" aria-label="Close settings" onClick={() => setShowSettings(false)}>
              <X />
            </button>
          </div>
          <div className="settings-grid">
            {keys.map((event) => (
              <label key={event}>
                {info[event].label}
                <select
                  value={draftStartingClasses[event] ?? ""}
                  onChange={(e) =>
                    setDraftStartingClasses((current) => ({
                      ...current,
                      [event]: e.target.value || undefined,
                    }))
                  }
                >
                  <option value="">No annual floor</option>
                  {classOrder.slice(0, event === "12" ? 7 : 6).map((className) => (
                    <option key={className}>{className}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <Button disabled={savingSettings}>
            {savingSettings ? "Saving…" : "Save class settings"}
          </Button>
        </form>
      )}
      {show && (
        <form className="entry" onSubmit={submit}>
          <div className="entry-head">
            <div>
              <h2>
                {editingId ? "Edit registered shoot" : "New registered shoot"}
              </h2>
              <p>
                Use one row for a multi-day event total, or separate rows for
                separately registered preliminaries.
              </p>
            </div>
            <button type="button" aria-label="Close" onClick={closeForm}>
              <X />
            </button>
          </div>
          <div className="form-grid">
            <label>
              Shoot name
              <Input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              Date completed
              <Input
                required
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
          </div>
          <div className="entry-labels">
            <span>Event</span>
            <span>Event type</span>
            <span>Broken</span>
            <span>Targets</span>
            <span>Class shot</span>
          </div>
          <div className="event-entries">
            {entries.map((x, i) => (
              <div className="event-entry" key={i}>
                <select
                  aria-label="Event"
                  value={x.event}
                  onChange={(e) => {
                    const event = e.target.value as EventKey;
                    setEntry(i, {
                      event,
                      classShot: currentClassFor(event),
                    });
                  }}
                >
                  {keys.map((k) => (
                    <option value={k} key={k}>
                      {info[k].label}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Event type"
                  value={x.label}
                  onChange={(e) => setEntry(i, { label: e.target.value })}
                >
                  <option>Main</option>
                  <option>Preliminary</option>
                </select>
                <Input
                  aria-label="Targets broken"
                  min="0"
                  type="number"
                  placeholder="—"
                  value={x.broken}
                  onChange={(e) => setEntry(i, { broken: e.target.value })}
                />
                <Input
                  aria-label="Targets scheduled"
                  min="1"
                  type="number"
                  value={x.targets}
                  onChange={(e) => setEntry(i, { targets: e.target.value })}
                />
                <select
                  aria-label="Class shot"
                  value={x.classShot}
                  onChange={(e) => setEntry(i, { classShot: e.target.value })}
                >
                  <option value="">Not recorded</option>
                  {currentClassFor(x.event) && (
                    <option value={currentClassFor(x.event)}>
                      Current class ({currentClassFor(x.event)})
                    </option>
                  )}
                  {classOrder
                    .slice(0, x.event === "12" ? 7 : 6)
                    .filter((className) => className !== currentClassFor(x.event))
                    .map((className) => (
                      <option key={className}>{className}</option>
                    ))}
                </select>
                <button
                  type="button"
                  aria-label="Remove event"
                  onClick={() => setEntries((v) => v.filter((_, j) => j !== i))}
                >
                  <Trash2 />
                </button>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            className="another"
            onClick={() =>
              setEntries((v) => [
                ...v,
                {
                  event: "12",
                  label: "Preliminary",
                  broken: "",
                  targets: "100",
                  classShot: currentClassFor("12"),
                },
              ])
            }
          >
            <Plus /> Add another event
          </Button>
          <Button disabled={saving}>
            {saving ? "Saving…" : editingId ? "Update shoot" : "Save shoot"}
          </Button>
        </form>
      )}
      <section className="overview">
        <div className="overall">
          <span>
            <Trophy /> HOA
          </span>
          <strong>{loading || !hoaReady ? "—" : fmt(hoa)}</strong>
          <b>{loading ? "—" : hoaClass === "—" ? "N/C" : hoaClass}</b>
          <small>4-gun</small>
        </div>
        <div className="overall">
          <span>
            <Trophy /> HAA
          </span>
          <strong>{loading || !haaReady ? "—" : fmt(haa)}</strong>
          <b>{loading ? "—" : haaClass === "—" ? "N/C" : haaClass}</b>
          <small>5-gun</small>
        </div>
      </section>
      <section className="event-grid">
        {keys.map((k) => {
          const s = stats[k];
          return (
            <article className="event-card" key={k}>
              <div className="event-top">
                <div>
                  <p>{info[k].label}</p>
                  <strong>
                    {loading || !s.active.length ? "—" : fmt(s.average)}
                  </strong>
                </div>
                <span>
                  {loading
                    ? "—"
                    : s.className === "—"
                      ? "Unclassified"
                      : s.className}
                </span>
              </div>
              <div className="five">
                {s.active.map((x) => (
                  <div
                    key={x.id}
                    title={`${x.name} · ${x.label}${x.classShot ? ` · Class ${x.classShot}` : ""}`}
                  >
                    <b>
                      {x.broken}
                      <i>/{x.targets}</i>
                    </b>
                    <small>
                      {new Date(x.date + "T12:00:00").toLocaleDateString(
                        "en-US",
                        { month: "short", year: "2-digit" },
                      )}
                    </small>
                  </div>
                ))}
              </div>
              <p className="count">
                Last {s.active.length} registered events
                {startingClasses[k] &&
                s.mathematicalClass !== "—" &&
                s.className !== s.mathematicalClass
                  ? ` · average places ${s.mathematicalClass}, annual floor ${s.className}`
                  : ""}
              </p>
            </article>
          );
        })}
      </section>
      <section className="history">
        <div className="section-title">
          <div>
            <p className="eyebrow">TOURNAMENT HISTORY</p>
            <h2>{shoots.length} registered shoots</h2>
          </div>
          <Target />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date / shoot</TableHead>
              {keys.map((k) => (
                <TableHead key={k}>{info[k].short}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...shoots].reverse().map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <strong>
                    {new Date(s.date + "T12:00:00").toLocaleDateString(
                      "en-US",
                      { month: "short", day: "numeric", year: "numeric" },
                    )}
                  </strong>
                  <div className="shoot-name-row">
                    <span>{s.name}</span>
                    <div className="row-actions">
                      <button
                        aria-label={`Edit ${s.name}`}
                        onClick={() => editShoot(s)}
                      >
                        <Pencil />
                      </button>
                      <button
                        className="delete"
                        aria-label={`Delete ${s.name}`}
                        onClick={() => deleteShoot(s)}
                      >
                        <Trash2 />
                      </button>
                    </div>
                  </div>
                </TableCell>
                {keys.map((k) => {
                  const total = displayScore(s, k);
                  return (
                    <TableCell key={k}>
                      {total ? (
                        <span className="score-line">
                          {total.broken}/{total.targets}
                          {total.count > 1 && (
                            <small>
                              {total.count} events
                              {total.classes.length
                                ? ` · Class ${total.classes.join("/")}`
                                : ""}
                            </small>
                          )}
                          {total.count === 1 && total.classes.length > 0 && (
                            <small>Class {total.classes[0]}</small>
                          )}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
      <footer>
        Classes calculated with the 2026 NSSA Universal Classification Tables.
      </footer>
    </main>
  );
}
