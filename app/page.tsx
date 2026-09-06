"use client";
import { useEffect, useMemo, useState } from "react";
import { Plus, Target, Trophy, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
};
type Shoot = { id: number; name: string; date: string; scores: Score[] };
type Entry = {
  event: EventKey;
  label: string;
  broken: string;
  targets: string;
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
const cls = (a: number, t: [string, number][]) =>
    t.find(([, f]) => a >= f)?.[0] ?? "—",
  fmt = (n: number) => n.toFixed(4).replace(/^0/, "");
const defaults = () =>
  keys.map((event) => ({
    event,
    label: "Main",
    broken: "",
    targets: "100",
  })) as Entry[];
export default function Home() {
  const [shoots, setShoots] = useState<Shoot[]>([]),
    [loading, setLoading] = useState(true),
    [show, setShow] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const [name, setName] = useState(""),
    [date, setDate] = useState(""),
    [entries, setEntries] = useState<Entry[]>(defaults());
  const load = () =>
    fetch("/api/shoots")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw Error(d.error);
        setShoots(d.shoots);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  useEffect(load, []);
  const stats = useMemo(
    () =>
      Object.fromEntries(
        keys.map((k) => {
          const active = shoots
              .flatMap((s) =>
                s.scores
                  .filter((x) => x.event === k)
                  .map((x) => ({ ...x, date: s.date, name: s.name })),
              )
              .slice(-5),
            b = active.reduce((a, x) => a + x.broken, 0),
            t = active.reduce((a, x) => a + x.targets, 0),
            average = t ? b / t : 0;
          return [k, { active, average, className: cls(average, info[k].t) }];
        }),
      ) as Record<
        EventKey,
        {
          active: (Score & { date: string; name: string })[];
          average: number;
          className: string;
        }
      >,
    [shoots],
  );
  const hoa =
      (stats["12"].average +
        stats["20"].average +
        stats["28"].average +
        stats["410"].average) /
      4,
    haa = (hoa * 4 + stats.doubles.average) / 5;
  const displayScore = (shoot: Shoot, event: EventKey) => {
    const rows = shoot.scores.filter((score) => score.event === event);
    return rows.length
      ? {
          broken: rows.reduce((total, score) => total + score.broken, 0),
          targets: rows.reduce((total, score) => total + score.targets, 0),
          count: rows.length,
        }
      : null;
  };
  const setEntry = (i: number, p: Partial<Entry>) =>
    setEntries((v) => v.map((x, j) => (j === i ? { ...x, ...p } : x)));
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
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name, date, entries: payload }),
        }),
        d = await r.json();
      if (!r.ok) throw Error(d.error);
      setName("");
      setDate("");
      setEntries(defaults());
      setShow(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save");
    } finally {
      setSaving(false);
    }
  }
  return (
    <main>
      <header>
        <div>
          <p className="eyebrow">NSSA MEMBER 309049</p>
          <h1>Skeet record</h1>
          <p className="sub">James Delosh · 2026 shooting year</p>
        </div>
        <Button onClick={() => setShow(!show)} className="add">
          <Plus /> Add shoot
        </Button>
      </header>
      {error && <div className="error">{error}</div>}
      {show && (
        <form className="entry" onSubmit={submit}>
          <div className="entry-head">
            <div>
              <h2>New registered shoot</h2>
              <p>
                Use one row for a multi-day event total, or separate rows for
                separately registered preliminaries.
              </p>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setShow(false)}
            >
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
            <span>Type</span>
            <span>Broken</span>
            <span>Targets</span>
          </div>
          <div className="event-entries">
            {entries.map((x, i) => (
              <div className="event-entry" key={i}>
                <select
                  aria-label="Event"
                  value={x.event}
                  onChange={(e) =>
                    setEntry(i, { event: e.target.value as EventKey })
                  }
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
                  <option>Championship</option>
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
                },
              ])
            }
          >
            <Plus /> Add another event
          </Button>
          <Button disabled={saving}>{saving ? "Saving…" : "Save shoot"}</Button>
        </form>
      )}
      <section className="overview">
        <div className="overall">
          <span>
            <Trophy /> HOA
          </span>
          <strong>{loading ? "—" : fmt(hoa)}</strong>
          <b>{loading ? "—" : cls(hoa, hoa4)}</b>
          <small>4-gun</small>
        </div>
        <div className="overall">
          <span>
            <Trophy /> HAA
          </span>
          <strong>{loading ? "—" : fmt(haa)}</strong>
          <b>{loading ? "—" : cls(haa, hoa5)}</b>
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
                  <strong>{loading ? "—" : fmt(s.average)}</strong>
                </div>
                <span>{loading ? "—" : s.className}</span>
              </div>
              <div className="five">
                {s.active.map((x) => (
                  <div key={x.id} title={`${x.name} · ${x.label}`}>
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
              <p className="count">Last {s.active.length} registered events</p>
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
                  <span>{s.name}</span>
                </TableCell>
                {keys.map((k) => {
                  const total = displayScore(s, k);
                  return (
                    <TableCell key={k}>
                      {total ? (
                        <span className="score-line">
                          {total.broken}/{total.targets}
                          {total.count > 1 && <small>{total.count} events</small>}
                        </span>
                      ) : "—"}
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
