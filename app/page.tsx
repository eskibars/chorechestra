"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
type Child = { id: string; name: string; color: string };
type Chore = {
  id: string;
  title: string;
  childIds: string[];
  days: DayKey[];
  reward: number | null;
};
type AppData = {
  children: Child[];
  chores: Chore[];
  completions: Record<string, boolean>;
};

const DAYS: { key: DayKey; short: string; long: string }[] = [
  { key: "mon", short: "Mon", long: "Monday" },
  { key: "tue", short: "Tue", long: "Tuesday" },
  { key: "wed", short: "Wed", long: "Wednesday" },
  { key: "thu", short: "Thu", long: "Thursday" },
  { key: "fri", short: "Fri", long: "Friday" },
  { key: "sat", short: "Sat", long: "Saturday" },
  { key: "sun", short: "Sun", long: "Sunday" },
];

const CHILD_COLORS = ["#F3B83F", "#75A7A0", "#EC8068", "#9A8BC1", "#88A95A"];
const STORAGE_KEY = "chore-club-family-v1";

const STARTER_DATA: AppData = {
  children: [
    { id: "esme", name: "Esme", color: "#F3B83F" },
    { id: "kieran", name: "Kieran", color: "#75A7A0" },
  ],
  chores: [
    {
      id: "toys",
      title: "Put away toys",
      childIds: ["esme", "kieran"],
      days: ["mon"],
      reward: null,
    },
    {
      id: "food",
      title: "Try a new food",
      childIds: ["esme", "kieran"],
      days: DAYS.map((day) => day.key),
      reward: 0.1,
    },
    {
      id: "reading",
      title: "Read a chapter book",
      childIds: ["kieran"],
      days: DAYS.map((day) => day.key),
      reward: null,
    },
    {
      id: "bedtime",
      title: "In bed before 9pm",
      childIds: ["esme"],
      days: DAYS.map((day) => day.key),
      reward: null,
    },
  ],
  completions: {},
};

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function mondayOf(date: Date) {
  const next = new Date(date);
  const day = next.getDay();
  const distance = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + distance);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function dateKey(date: Date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function money(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function occurrenceKey(week: Date, childId: string, choreId: string, day: DayKey) {
  return `${dateKey(week)}:${childId}:${choreId}:${day}`;
}

function scheduleLabel(days: DayKey[]) {
  if (days.length === 7) return "Every day";
  if (days.length === 5 && DAYS.slice(0, 5).every((day) => days.includes(day.key))) return "Weekdays";
  return DAYS.filter((day) => days.includes(day.key)).map((day) => day.short).join(", ");
}

export default function Home() {
  const [data, setData] = useState<AppData>(STARTER_DATA);
  const [ready, setReady] = useState(false);
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [activeChildId, setActiveChildId] = useState("esme");
  const [showFamily, setShowFamily] = useState(false);
  const [showChoreForm, setShowChoreForm] = useState(false);
  const [editingChore, setEditingChore] = useState<Chore | null>(null);
  const [celebration, setCelebration] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as AppData;
        if (parsed.children?.length && Array.isArray(parsed.chores)) {
          setData(parsed);
          setActiveChildId(parsed.children[0].id);
        }
      }
    } catch {
      // If saved data is malformed, the friendly starter board remains available.
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data, ready]);

  useEffect(() => {
    if (!data.children.some((child) => child.id === activeChildId) && data.children[0]) {
      setActiveChildId(data.children[0].id);
    }
  }, [activeChildId, data.children]);

  const weekDates = useMemo(() => DAYS.map((_, index) => addDays(weekStart, index)), [weekStart]);
  const activeChild = data.children.find((child) => child.id === activeChildId) ?? data.children[0];

  const stats = useMemo(() => {
    let assigned = 0;
    let completed = 0;
    let earned = 0;
    data.children.forEach((child) => {
      data.chores.filter((chore) => chore.childIds.includes(child.id)).forEach((chore) => {
        chore.days.forEach((day) => {
          assigned += 1;
          if (data.completions[occurrenceKey(weekStart, child.id, chore.id, day)]) {
            completed += 1;
            earned += chore.reward ?? 0;
          }
        });
      });
    });
    return { assigned, completed, earned, percent: assigned ? Math.round((completed / assigned) * 100) : 0 };
  }, [data, weekStart]);

  const weekLabel = `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${addDays(weekStart, 6).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  function toggleComplete(childId: string, choreId: string, day: DayKey) {
    const key = occurrenceKey(weekStart, childId, choreId, day);
    setData((current) => ({
      ...current,
      completions: { ...current.completions, [key]: !current.completions[key] },
    }));
    if (!data.completions[key]) {
      setCelebration(["Nice one!", "High five!", "You did it!", "Tiny win!"][Math.floor(Math.random() * 4)]);
      window.setTimeout(() => setCelebration(null), 1300);
    }
  }

  function addChild(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const child: Child = {
      id: makeId("child"),
      name: trimmed,
      color: CHILD_COLORS[data.children.length % CHILD_COLORS.length],
    };
    setData((current) => ({ ...current, children: [...current.children, child] }));
    setActiveChildId(child.id);
  }

  function renameChild(id: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setData((current) => ({
      ...current,
      children: current.children.map((child) => child.id === id ? { ...child, name: trimmed } : child),
    }));
  }

  function removeChild(id: string) {
    if (data.children.length === 1 || !window.confirm("Remove this child and their assignments?")) return;
    setData((current) => ({
      ...current,
      children: current.children.filter((child) => child.id !== id),
      chores: current.chores
        .map((chore) => ({ ...chore, childIds: chore.childIds.filter((childId) => childId !== id) }))
        .filter((chore) => chore.childIds.length > 0),
    }));
  }

  function saveChore(chore: Chore) {
    setData((current) => ({
      ...current,
      chores: current.chores.some((item) => item.id === chore.id)
        ? current.chores.map((item) => item.id === chore.id ? chore : item)
        : [...current.chores, chore],
    }));
    setEditingChore(null);
    setShowChoreForm(false);
  }

  function removeChore(id: string) {
    if (!window.confirm("Delete this chore from the family board?")) return;
    setData((current) => ({ ...current, chores: current.chores.filter((chore) => chore.id !== id) }));
  }

  function resetDemo() {
    if (!window.confirm("Reset the board to the Esme and Kieran example?")) return;
    setData(STARTER_DATA);
    setActiveChildId("esme");
    setWeekStart(mondayOf(new Date()));
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setWeekStart(mondayOf(new Date()))} aria-label="Chore Club home">
          <span className="brand-mark">✓</span>
          <span>Chore Club</span>
        </button>
        <div className="topbar-actions">
          <span className="local-pill"><span className="status-dot" /> Saved on this device</span>
          <button className="icon-button desktop-label" onClick={() => setShowFamily(true)} aria-label="Open family settings">
            <span aria-hidden="true">⚙</span> Manage
          </button>
          <button className="button button-dark" onClick={() => window.print()}>
            <span aria-hidden="true">↗</span> Print week
          </button>
        </div>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">The family weekly rhythm</p>
          <h1>Small jobs.<br /><em>Big wins.</em></h1>
          <p className="hero-copy">One cheerful place for routines, rewards, and all those little moments worth celebrating.</p>
        </div>
        <div className="week-card">
          <div className="week-card-top">
            <div>
              <span className="mini-label">This week</span>
              <strong>{weekLabel}</strong>
            </div>
            <div className="week-controls">
              <button aria-label="Previous week" onClick={() => setWeekStart(addDays(weekStart, -7))}>←</button>
              <button className="today-button" onClick={() => setWeekStart(mondayOf(new Date()))}>Today</button>
              <button aria-label="Next week" onClick={() => setWeekStart(addDays(weekStart, 7))}>→</button>
            </div>
          </div>
          <div className="progress-track" aria-label={`${stats.percent}% of family chores complete`}>
            <span style={{ width: `${stats.percent}%` }} />
          </div>
          <div className="week-stats">
            <div><strong>{stats.completed}<small> / {stats.assigned}</small></strong><span>jobs done</span></div>
            <div><strong>{stats.percent}%</strong><span>complete</span></div>
            <div><strong>{money(stats.earned)}</strong><span>earned</span></div>
          </div>
        </div>
      </section>

      <section className="board-section">
        <div className="board-heading">
          <div>
            <p className="eyebrow">Weekly board</p>
            <h2>Who&apos;s on deck?</h2>
          </div>
          <button className="button button-sun" onClick={() => { setEditingChore(null); setShowChoreForm(true); }}>
            <span aria-hidden="true">＋</span> Add a chore
          </button>
        </div>

        <div className="child-tabs" role="tablist" aria-label="Choose a child">
          {data.children.map((child) => {
            const selected = child.id === activeChild?.id;
            return (
              <button
                key={child.id}
                role="tab"
                aria-selected={selected}
                className={selected ? "child-tab active" : "child-tab"}
                style={{ "--child-color": child.color } as React.CSSProperties}
                onClick={() => setActiveChildId(child.id)}
              >
                <span className="avatar">{child.name.slice(0, 1).toUpperCase()}</span>
                <span>{child.name}</span>
                <ChildMiniProgress child={child} chores={data.chores} completions={data.completions} weekStart={weekStart} />
              </button>
            );
          })}
          <button className="add-child-tab" onClick={() => setShowFamily(true)}>＋ Add child</button>
        </div>

        <div className="screen-board">
          {activeChild ? (
            <ChildMatrix
              child={activeChild}
              chores={data.chores}
              completions={data.completions}
              weekStart={weekStart}
              weekDates={weekDates}
              onToggle={toggleComplete}
              onEdit={(chore) => { setEditingChore(chore); setShowChoreForm(true); }}
            />
          ) : <EmptyBoard onAdd={() => setShowFamily(true)} />}
        </div>

        <div className="print-boards">
          {data.children.map((child) => (
            <ChildMatrix
              key={child.id}
              child={child}
              chores={data.chores}
              completions={data.completions}
              weekStart={weekStart}
              weekDates={weekDates}
              onToggle={toggleComplete}
              onEdit={() => undefined}
              printing
            />
          ))}
        </div>
      </section>

      <footer>
        <p><span>♥</span> Make it yours. Everything stays private on this device.</p>
        <button onClick={resetDemo}>Reset example board</button>
      </footer>

      {celebration && <div className="celebration" role="status">✦ {celebration}</div>}

      {showFamily && (
        <FamilyPanel
          children={data.children}
          chores={data.chores}
          onClose={() => setShowFamily(false)}
          onAdd={addChild}
          onRename={renameChild}
          onRemove={removeChild}
          onEditChore={(chore) => { setEditingChore(chore); setShowFamily(false); setShowChoreForm(true); }}
          onRemoveChore={removeChore}
        />
      )}

      {showChoreForm && (
        <ChoreForm
          children={data.children}
          chore={editingChore}
          initialChildId={activeChild?.id}
          onCancel={() => { setShowChoreForm(false); setEditingChore(null); }}
          onSave={saveChore}
        />
      )}
    </main>
  );
}

function ChildMiniProgress({ child, chores, completions, weekStart }: {
  child: Child; chores: Chore[]; completions: Record<string, boolean>; weekStart: Date;
}) {
  let total = 0;
  let done = 0;
  chores.filter((chore) => chore.childIds.includes(child.id)).forEach((chore) => chore.days.forEach((day) => {
    total += 1;
    if (completions[occurrenceKey(weekStart, child.id, chore.id, day)]) done += 1;
  }));
  return <small>{done}/{total}</small>;
}

function ChildMatrix({ child, chores, completions, weekStart, weekDates, onToggle, onEdit, printing = false }: {
  child: Child;
  chores: Chore[];
  completions: Record<string, boolean>;
  weekStart: Date;
  weekDates: Date[];
  onToggle: (childId: string, choreId: string, day: DayKey) => void;
  onEdit: (chore: Chore) => void;
  printing?: boolean;
}) {
  const assigned = chores.filter((chore) => chore.childIds.includes(child.id));
  let earned = 0;
  assigned.forEach((chore) => chore.days.forEach((day) => {
    if (completions[occurrenceKey(weekStart, child.id, chore.id, day)]) earned += chore.reward ?? 0;
  }));

  if (!assigned.length) return <EmptyBoard onAdd={() => undefined} childName={child.name} />;

  return (
    <article className="matrix-card" style={{ "--child-color": child.color } as React.CSSProperties}>
      {printing && (
        <div className="print-kid-title">
          <span className="avatar">{child.name.slice(0, 1).toUpperCase()}</span>
          <div><p>This week belongs to</p><h2>{child.name}</h2></div>
          <strong>{money(earned)} earned</strong>
        </div>
      )}
      <div className="matrix-scroll">
        <table>
          <thead>
            <tr>
              <th className="task-head"><span>My jobs</span><small>{assigned.length} routines</small></th>
              {DAYS.map((day, index) => (
                <th key={day.key}>
                  <span>{day.short}</span>
                  <small>{weekDates[index].getDate()}</small>
                </th>
              ))}
              <th className="earned-head"><span>Earned</span><small>this week</small></th>
            </tr>
          </thead>
          <tbody>
            {assigned.map((chore) => {
              const choreEarned = chore.days.reduce((total, day) => total + (completions[occurrenceKey(weekStart, child.id, chore.id, day)] ? chore.reward ?? 0 : 0), 0);
              return (
                <tr key={chore.id}>
                  <td className="task-cell">
                    <button className="task-edit" onClick={() => onEdit(chore)} aria-label={`Edit ${chore.title}`} disabled={printing}>
                      <span>{chore.title}</span>
                      <small>{scheduleLabel(chore.days)}{chore.reward !== null ? ` · ${money(chore.reward)} each` : ""}</small>
                    </button>
                  </td>
                  {DAYS.map((day) => {
                    const active = chore.days.includes(day.key);
                    const checked = completions[occurrenceKey(weekStart, child.id, chore.id, day.key)] ?? false;
                    return (
                      <td key={day.key} className={active ? "check-cell" : "check-cell inactive"}>
                        {active ? (
                          <label className={checked ? "check checked" : "check"}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => onToggle(child.id, chore.id, day.key)}
                              aria-label={`${chore.title} on ${day.long}`}
                            />
                            <span aria-hidden="true">✓</span>
                          </label>
                        ) : <span className="not-scheduled">·</span>}
                      </td>
                    );
                  })}
                  <td className="earned-cell">
                    {chore.reward !== null ? <strong>{money(choreEarned)}</strong> : <span>—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="matrix-total">
        <span><i /> Keep going, {child.name}!</span>
        <strong>{money(earned)} <small>earned this week</small></strong>
      </div>
    </article>
  );
}

function EmptyBoard({ onAdd, childName }: { onAdd: () => void; childName?: string }) {
  return (
    <div className="empty-board">
      <span>☀</span>
      <h3>A fresh little slate</h3>
      <p>{childName ? `${childName} doesn’t have any chores yet.` : "Add your first child to get the family moving."}</p>
      <button className="button button-sun" onClick={onAdd}>Get started</button>
    </div>
  );
}

function Modal({ title, subtitle, children, onClose, wide = false }: {
  title: string; subtitle: string; children: React.ReactNode; onClose: () => void; wide?: boolean;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={wide ? "modal wide" : "modal"} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-header">
          <div><p className="eyebrow">Chore Club</p><h2 id="modal-title">{title}</h2><p>{subtitle}</p></div>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        {children}
      </section>
    </div>
  );
}

function FamilyPanel({ children, chores, onClose, onAdd, onRename, onRemove, onEditChore, onRemoveChore }: {
  children: Child[];
  chores: Chore[];
  onClose: () => void;
  onAdd: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
  onEditChore: (chore: Chore) => void;
  onRemoveChore: (id: string) => void;
}) {
  const [newName, setNewName] = useState("");
  return (
    <Modal title="Manage your family" subtitle="Names and routines can change. Your board should too." onClose={onClose} wide>
      <div className="manager-grid">
        <div>
          <h3>Children</h3>
          <div className="manage-list">
            {children.map((child) => (
              <div className="manage-row" key={child.id}>
                <span className="avatar" style={{ background: child.color }}>{child.name.slice(0, 1).toUpperCase()}</span>
                <input defaultValue={child.name} aria-label={`${child.name}'s name`} onBlur={(event) => onRename(child.id, event.target.value)} />
                <button className="trash-button" onClick={() => onRemove(child.id)} aria-label={`Remove ${child.name}`}>×</button>
              </div>
            ))}
          </div>
          <form className="inline-add" onSubmit={(event) => { event.preventDefault(); onAdd(newName); setNewName(""); }}>
            <input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Child’s name" aria-label="New child name" />
            <button className="button button-sun">Add</button>
          </form>
        </div>
        <div>
          <h3>Chore library</h3>
          <div className="manage-list chore-list">
            {chores.map((chore) => (
              <div className="manage-row chore-manage-row" key={chore.id}>
                <button onClick={() => onEditChore(chore)}>
                  <strong>{chore.title}</strong>
                  <small>{scheduleLabel(chore.days)} · {chore.childIds.length} {chore.childIds.length === 1 ? "child" : "children"}</small>
                </button>
                <button className="trash-button" onClick={() => onRemoveChore(chore.id)} aria-label={`Delete ${chore.title}`}>×</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function ChoreForm({ children, chore, initialChildId, onCancel, onSave }: {
  children: Child[];
  chore: Chore | null;
  initialChildId?: string;
  onCancel: () => void;
  onSave: (chore: Chore) => void;
}) {
  const [title, setTitle] = useState(chore?.title ?? "");
  const [childIds, setChildIds] = useState<string[]>(chore?.childIds ?? (initialChildId ? [initialChildId] : children[0] ? [children[0].id] : []));
  const [daily, setDaily] = useState((chore?.days.length ?? 7) === 7);
  const [days, setDays] = useState<DayKey[]>(chore?.days ?? DAYS.map((day) => day.key));
  const [hasReward, setHasReward] = useState(chore?.reward !== null && chore?.reward !== undefined);
  const [reward, setReward] = useState(chore?.reward?.toFixed(2) ?? "0.10");
  const [error, setError] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    const selectedDays = daily ? DAYS.map((day) => day.key) : days;
    if (!title.trim() || !childIds.length || !selectedDays.length) {
      setError("Give the chore a name, at least one child, and at least one day.");
      return;
    }
    onSave({
      id: chore?.id ?? makeId("chore"),
      title: title.trim(),
      childIds,
      days: selectedDays,
      reward: hasReward ? Math.max(0, Number(reward) || 0) : null,
    });
  }

  return (
    <Modal title={chore ? "Edit this chore" : "Add a new chore"} subtitle="Keep it simple, specific, and easy to celebrate." onClose={onCancel}>
      <form className="chore-form" onSubmit={submit}>
        <label className="field">
          <span>What needs doing?</span>
          <input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Feed the dog" />
        </label>

        <fieldset>
          <legend>Who is it for?</legend>
          <div className="choice-row">
            {children.map((child) => {
              const selected = childIds.includes(child.id);
              return (
                <label key={child.id} className={selected ? "choice-chip selected" : "choice-chip"}>
                  <input type="checkbox" checked={selected} onChange={() => setChildIds((current) => selected ? current.filter((id) => id !== child.id) : [...current, child.id])} />
                  <span className="avatar" style={{ background: child.color }}>{child.name.slice(0, 1).toUpperCase()}</span>{child.name}
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend>When does it happen?</legend>
          <div className="segmented">
            <button type="button" className={daily ? "active" : ""} onClick={() => setDaily(true)}>Every day</button>
            <button type="button" className={!daily ? "active" : ""} onClick={() => setDaily(false)}>Specific days</button>
          </div>
          {!daily && (
            <div className="day-picker">
              {DAYS.map((day) => {
                const selected = days.includes(day.key);
                return (
                  <label key={day.key} className={selected ? "selected" : ""}>
                    <input type="checkbox" checked={selected} onChange={() => setDays((current) => selected ? current.filter((item) => item !== day.key) : [...current, day.key])} />
                    {day.short.slice(0, 1)}
                  </label>
                );
              })}
            </div>
          )}
        </fieldset>

        <fieldset>
          <legend>Reward <small>optional</small></legend>
          <label className="reward-toggle">
            <input type="checkbox" checked={hasReward} onChange={(event) => setHasReward(event.target.checked)} />
            <span>Attach a little money reward</span>
          </label>
          {hasReward && (
            <label className="money-field">
              <span>$</span>
              <input type="number" min="0" step="0.05" value={reward} onChange={(event) => setReward(event.target.value)} aria-label="Reward amount" />
              <small>each time</small>
            </label>
          )}
        </fieldset>

        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="button button-ghost" onClick={onCancel}>Cancel</button>
          <button className="button button-dark">{chore ? "Save changes" : "Add to the board"}</button>
        </div>
      </form>
    </Modal>
  );
}
