"use client";
import { trackerFetch } from "@/lib/tracker-fetch";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Pencil,
  StickyNote,
  Plus,
  Settings2,
  Target,
  Trash2,
  Trophy,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import { calculateStats, findClassChanges, summarizeShootGauge, shootTotals, defaults, keys, info, classOrder, hoa4, hoa5, hoaSafeguard, cls, fmt } from "@/lib/scoring";
import type { Shoot, ShootStatus, EventKey, Entry, StartingClasses, ClassChange, EventStats } from "@/lib/scoring";
import { TrackerBrand } from "@/components/tracker-brand";
import { useHistory } from "@/hooks/use-history";

export default function Home() {
  const [inProgressShoots, setInProgressShoots] = useState<Shoot[]>([]),
    [loading, setLoading] = useState(true),
    [show, setShow] = useState(false),
    [showSettings, setShowSettings] = useState(false),
    [saving, setSaving] = useState(false),
    [savingSettings, setSavingSettings] = useState(false),
    [editingId, setEditingId] = useState<number | null>(null),
    [formStatus, setFormStatus] = useState<ShootStatus>("in_progress"),
    [error, setError] = useState("");
  const [rankUps, setRankUps] = useState<ClassChange[]>([]),
    [rankDowns, setRankDowns] = useState<ClassChange[]>([]);
  const [startingClasses, setStartingClasses] = useState<StartingClasses>({}),
    [draftStartingClasses, setDraftStartingClasses] = useState<StartingClasses>({});
  const [notes, setNotes] = useState("");
  const [notesShoot, setNotesShoot] = useState<Shoot | null>(null);
  const [name, setName] = useState(""),
    [date, setDate] = useState(""),
    [entries, setEntries] = useState<Entry[]>(defaults());
  const [stats, setStats] = useState<Record<EventKey, EventStats>>(() => calculateStats([], {}));
  const history = useHistory();
  const requestTrackerData = async () => {
    const response = await trackerFetch("/api/dashboard");
    const data = await response.json() as { error?: string; stats: Record<EventKey, EventStats>; startingClasses: StartingClasses; inProgressShoots: Shoot[] };
    if (!response.ok) throw Error(data.error);
    return data as { stats: Record<EventKey, EventStats>; startingClasses: StartingClasses; inProgressShoots: Shoot[] };
  };
  const load = useCallback(() => requestTrackerData().then((data) => {
    setStats(data.stats);
    setInProgressShoots(data.inProgressShoots);
    setStartingClasses(data.startingClasses);
    setDraftStartingClasses(data.startingClasses);
  }).catch((e) => setError(e.message)).finally(() => setLoading(false)), []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!rankDowns.length || rankUps.length) return;
    const timeout = window.setTimeout(() => setRankDowns([]), 7000);
    return () => window.clearTimeout(timeout);
  }, [rankDowns, rankUps]);
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
  const setEntry = (i: number, p: Partial<Entry>) =>
    setEntries((v) => v.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const closeForm = () => {
    setShow(false);
    setEditingId(null);
    setFormStatus("in_progress");
    setName("");
    setNotes("");
    setDate("");
    setEntries(defaults());
  };
  const currentClassFor = (event: EventKey) =>
    classOrder.includes(stats[event].className) ? stats[event].className : "";
  const newShoot = () => {
    setEditingId(null);
    setFormStatus("in_progress");
    setName("");
    setNotes("");
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
    setFormStatus(shoot.status);
    setName(shoot.name);
    setNotes(shoot.notes?.content ?? "");
    setDate(shoot.date);
    const seenEvents = new Set<EventKey>();
    const savedEntries = shoot.scores.map((x) => {
      const removable = seenEvents.has(x.event);
      seenEvents.add(x.event);
      return {
        event: x.event,
        label: x.label,
        broken: String(x.broken),
        targets: String(x.targets),
        classShot: x.classShot ?? "",
        shotDate: x.shotDate ?? shoot.date,
        removable,
      };
    });
    const missingEntries = defaults(shoot.date)
      .filter(
        (entry) =>
          !shoot.scores.some((score) => score.event === entry.event),
      )
      .map((entry) => ({
        ...entry,
        classShot: currentClassFor(entry.event),
      }));
    setEntries(
      [...savedEntries, ...missingEntries],
    );
    setShow(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const deleteShoot = async (shoot: Shoot) => {
    if (!window.confirm(`Delete ${shoot.name}? This cannot be undone.`)) return;
    const r = await trackerFetch(`/api/shoots?id=${shoot.id}`, { method: "DELETE" });
    const d = await r.json() as {error: string};
    if (!r.ok) return setError(d.error);
    await load();
    history.refresh();
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
      const submitter = (e.nativeEvent as SubmitEvent)
          .submitter as HTMLButtonElement | null,
        requestedStatus = submitter?.value,
        nextStatus: ShootStatus =
          requestedStatus === "complete" || requestedStatus === "in_progress"
            ? requestedStatus
            : formStatus;
      const r = await trackerFetch("/api/shoots", {
          method: editingId ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            id: editingId,
            name,
            notes,
            date,
            status: nextStatus,
            entries: payload,
          }),
        }),
        d = await r.json() as {error: string};
      if (!r.ok) throw Error(d.error);
      closeForm();
      const nextData = await requestTrackerData(),
        nextStats = nextData.stats,
        changes = findClassChanges(stats, nextStats, startingClasses);
      setStats(nextStats);
      setInProgressShoots(nextData.inProgressShoots);
      history.refresh();
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
      const response = await trackerFetch("/api/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ startingClasses: draftStartingClasses }),
      });
      const data = await response.json() as { error?: string; stats: Record<EventKey, EventStats>; startingClasses: StartingClasses; inProgressShoots: Shoot[] };
      if (!response.ok) throw Error(data.error);
      setStartingClasses(data.startingClasses);
      setShowSettings(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save settings");
    } finally {
      setSavingSettings(false);
    }
  }
  return (
    <main>
      <header>
        <TrackerBrand />
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
      <Dialog open={Boolean(notesShoot)} onOpenChange={(open) => !open && setNotesShoot(null)}>
        <DialogContent className="shoot-notes-dialog">
          <DialogHeader><DialogTitle>Shoot notes</DialogTitle><DialogDescription>{notesShoot?.name}</DialogDescription></DialogHeader>
          <p className="shoot-notes-content">{notesShoot?.notes?.content}</p>
          <DialogFooter><Button variant="outline" onClick={() => { if (notesShoot) editShoot(notesShoot); setNotesShoot(null); }}>Edit notes</Button></DialogFooter>
        </DialogContent>
      </Dialog>
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
                onChange={(e) => {
                  const nextDate = e.target.value;
                  setDate(nextDate);
                  if (!editingId)
                    setEntries((current) =>
                      current.map((entry) => ({
                        ...entry,
                        shotDate: entry.shotDate || nextDate,
                      })),
                    );
                }}
              />
            </label>
          </div>
          <label className="shoot-notes-field">
            Shoot notes (optional)
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={5000} rows={3} placeholder="Conditions, missed stations, equipment changes, what worked, or what to practice." />
            <small>{notes.length}/5,000 characters</small>
          </label>
          <div className="entry-labels">
            <span>Event</span>
            <span>Event type</span>
            <span>Date shot</span>
            <span>Broken</span>
            <span>Targets</span>
            <span>Class shot</span>
          </div>
          <div className="event-entries">
            {entries.map((x, i) => (
              <div className="event-entry" key={i}>
                {x.removable ? (
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
                ) : (
                  <span className="event-name-fixed">{info[x.event].label}</span>
                )}
                <select
                  aria-label="Event type"
                  value={x.label}
                  onChange={(e) => setEntry(i, { label: e.target.value })}
                >
                  <option>Main</option>
                  <option>Preliminary</option>
                </select>
                <Input
                  aria-label="Date shot"
                  type="date"
                  value={x.shotDate}
                  onChange={(e) => setEntry(i, { shotDate: e.target.value })}
                />
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
                {x.removable && (
                  <button
                    type="button"
                    aria-label="Remove event"
                    onClick={() =>
                      setEntries((v) => v.filter((_, j) => j !== i))
                    }
                  >
                    <Trash2 />
                  </button>
                )}
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
                  shotDate: date,
                  removable: true,
                },
              ])
            }
          >
            <Plus /> Add another event
          </Button>
          <div className="form-actions">
            {formStatus === "in_progress" && (
              <Button
                type="submit"
                variant="outline"
                value="in_progress"
                disabled={saving}
              >
                {saving ? "Saving…" : editingId ? "Save progress" : "Start shoot"}
              </Button>
            )}
            <Button type="submit" value="complete" disabled={saving}>
              {saving
                ? "Saving…"
                : formStatus === "complete"
                  ? "Save changes"
                  : "Finish shoot"}
            </Button>
          </div>
        </form>
      )}
      {inProgressShoots.length > 0 && (
        <section className="active-shoots" aria-labelledby="active-shoots-title">
          <div className="active-section-title">
            <div>
              <p className="eyebrow">IN PROGRESS</p>
              <h2 id="active-shoots-title">
                {inProgressShoots.length === 1
                  ? "Current shoot"
                  : "Current shoots"}
              </h2>
            </div>
            <span>{inProgressShoots.length}</span>
          </div>
          {inProgressShoots.map((shoot) => (
            <article className="active-shoot" key={shoot.id}>
              <div className="active-shoot-head">
                <div>
                  <h3>{shoot.name}</h3>
                  <p>
                    Started {new Date(shoot.date + "T12:00:00").toLocaleDateString(
                      "en-US",
                      { month: "short", day: "numeric", year: "numeric" },
                    )}
                  </p>
                </div>
                <div className="active-actions">
                  <Button variant="outline" onClick={() => editShoot(shoot)}>
                    <Pencil /> Continue
                  </Button>
                  <button
                    aria-label={`Delete ${shoot.name}`}
                    onClick={() => deleteShoot(shoot)}
                  >
                    <Trash2 />
                  </button>
                </div>
              </div>
              <div className="active-event-grid">
                {keys.map((event) => {
                  const score = summarizeShootGauge(shoot, event);
                  return (
                    <div className={score ? "recorded" : "pending"} key={event}>
                      <span>{info[event].short}</span>
                      <strong>
                        {score ? `${score.broken}/${score.targets}` : "Pending"}
                      </strong>
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </section>
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
                {s.provisional ? " · class updates when shoot is finished" : ""}
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
            <h2>Tournament history</h2>
          </div>
          <Target />
        </div>
        <div className="history-search">
          <label htmlFor="history-query">Search tournament history</label>
          <div className="search-field">
            <Input id="history-query" type="search" placeholder="Search shoot name or year" value={history.query} maxLength={200} onChange={(e) => history.search(e.target.value)} />
            {history.query && <Button variant="outline" aria-label="Clear search" onClick={() => history.search("")}><X aria-hidden="true" /></Button>}
          </div>
        </div>
        {history.error && <div className="error" role="alert">{history.error} <Button variant="outline" onClick={history.refresh}>Retry</Button></div>}
        <p className="history-status" role="status" aria-live="polite">{history.loading ? "Loading shoots…" : history.data ? history.data.total ? `Showing ${(history.data.page - 1) * 10 + 1}–${Math.min(history.data.page * 10, history.data.total)} of ${history.data.total} shoots` : history.query.trim() ? "No shoots match your search." : "No shoots yet." : ""}</p>
        {!history.loading && history.data?.total === 0 && history.query.trim() && <Button variant="outline" onClick={() => history.search("")}>Clear search</Button>}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date / shoot</TableHead>
              <TableHead>Totals</TableHead>
              {keys.map((k) => (
                <TableHead key={k}>{info[k].short}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {(history.data?.shoots ?? []).map((s) => (
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
                      {s.notes?.content && <button aria-label={`View notes for ${s.name}`} onClick={() => setNotesShoot(s)}><StickyNote /></button>}
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
                <TableCell className="shoot-totals">{(() => {
                  const totals = shootTotals(s);
                  return <><strong>{totals.hoa ? `HOA ${totals.hoa.broken}/${totals.hoa.targets}` : "HOA incomplete"}</strong>
                    {totals.hasDoubles && <span>{totals.haa ? `HAA ${totals.haa.broken}/${totals.haa.targets}` : "HAA incomplete"}</span>}</>;
                })()}</TableCell>
                {keys.map((k) => {
                  const total = summarizeShootGauge(s, k);
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
        <nav className="history-pagination" aria-label="Tournament history pages">
          <Button variant="outline" disabled={history.loading || !history.data || history.data.page <= 1} onClick={() => history.navigate((history.data?.page ?? 1) - 1)}>Previous</Button>
          <span>Page {history.data?.page ?? 1} of {history.data?.pages ?? 1}</span>
          <Button variant="outline" disabled={history.loading || !history.data || history.data.page >= history.data.pages} onClick={() => history.navigate((history.data?.page ?? 1) + 1)}>Next</Button>
        </nav>
      </section>
      <footer>
        Classes calculated with the 2026 NSSA Universal Classification Tables.
      </footer>
    </main>
  );
}

