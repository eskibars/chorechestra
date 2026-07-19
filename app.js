"use strict";

const DAYS = [
  { key: "mon", short: "Mon", long: "Monday" },
  { key: "tue", short: "Tue", long: "Tuesday" },
  { key: "wed", short: "Wed", long: "Wednesday" },
  { key: "thu", short: "Thu", long: "Thursday" },
  { key: "fri", short: "Fri", long: "Friday" },
  { key: "sat", short: "Sat", long: "Saturday" },
  { key: "sun", short: "Sun", long: "Sunday" },
];

const CHILD_COLORS = ["#f3b83f", "#75a7a0", "#ec8068", "#9a8bc1", "#88a95a"];
const STORAGE_KEY = "chore-club-family-v1";

const STARTER_DATA = {
  children: [
    { id: "esme", name: "Esme", color: "#f3b83f" },
    { id: "kieran", name: "Kieran", color: "#75a7a0" },
  ],
  chores: [
    { id: "toys", title: "Put away toys", childIds: ["esme", "kieran"], days: ["mon"], reward: null },
    { id: "food", title: "Try a new food", childIds: ["esme", "kieran"], days: DAYS.map((day) => day.key), reward: 0.1 },
    { id: "reading", title: "Read a chapter book", childIds: ["kieran"], days: DAYS.map((day) => day.key), reward: null },
    { id: "bedtime", title: "In bed before 9pm", childIds: ["esme"], days: DAYS.map((day) => day.key), reward: null },
  ],
  completions: {},
  notes: {},
};

const app = document.querySelector("#app");
const modal = document.querySelector("#modal");
const celebration = document.querySelector("#celebration");
let data = loadData();
let activeChildId = data.children[0]?.id || "";
let weekStart = mondayOf(new Date());
let draggedChoreId = "";
let draggedChildId = "";
let dropTargetId = "";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.children) && Array.isArray(saved.chores) && saved.completions) {
      saved.notes = saved.notes && typeof saved.notes === "object" ? saved.notes : {};
      return saved;
    }
  } catch (_) {}
  return clone(STARTER_DATA);
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function mondayOf(date) {
  const result = new Date(date);
  const day = result.getDay();
  result.setDate(result.getDate() + (day === 0 ? -6 : 1 - day));
  result.setHours(0, 0, 0, 0);
  return result;
}

function addDays(date, amount) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function dateKey(date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function occurrenceKey(childId, choreId, day) {
  return `${dateKey(weekStart)}:${childId}:${choreId}:${day}`;
}

function money(amount) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);
}

function scheduleLabel(days) {
  if (days.length === 7) return "Every day";
  if (days.length === 5 && DAYS.slice(0, 5).every((day) => days.includes(day.key))) return "Weekdays";
  return DAYS.filter((day) => days.includes(day.key)).map((day) => day.short).join(", ");
}

function childStats(child) {
  let assigned = 0;
  let completed = 0;
  let earned = 0;
  data.chores.filter((chore) => chore.childIds.includes(child.id)).forEach((chore) => {
    chore.days.forEach((day) => {
      assigned += 1;
      if (data.completions[occurrenceKey(child.id, chore.id, day)]) {
        completed += 1;
        earned += chore.reward || 0;
      }
    });
  });
  return { assigned, completed, earned };
}

function familyStats() {
  const combined = data.children.map(childStats).reduce((total, stats) => ({
    assigned: total.assigned + stats.assigned,
    completed: total.completed + stats.completed,
    earned: total.earned + stats.earned,
  }), { assigned: 0, completed: 0, earned: 0 });
  combined.percent = combined.assigned ? Math.round((combined.completed / combined.assigned) * 100) : 0;
  return combined;
}

function childTabs() {
  return data.children.map((child) => {
    const stats = childStats(child);
    const active = child.id === activeChildId;
    return `
      <button class="child-tab${active ? " active" : ""}" style="--child-color:${child.color}" data-action="select-child" data-child-id="${child.id}" role="tab" aria-selected="${active}">
        <span class="avatar">${escapeHTML(child.name.slice(0, 1).toUpperCase())}</span>
        <span>${escapeHTML(child.name)}</span>
        <small>${stats.completed}/${stats.assigned}</small>
      </button>`;
  }).join("");
}

function childMatrix(child, print = false) {
  const chores = data.chores.filter((chore) => chore.childIds.includes(child.id));
  const stats = childStats(child);
  if (!chores.length) {
    return `<div class="empty-board"><span>☀</span><h3>A fresh little slate</h3><p>${escapeHTML(child.name)} doesn’t have any chores yet.</p><button class="button button-sun" data-action="new-chore">Add a chore</button></div>`;
  }

  const dates = DAYS.map((_, index) => addDays(weekStart, index));
  const rows = chores.map((chore) => {
    let choreEarned = 0;
    const cells = DAYS.map((day) => {
      const scheduled = chore.days.includes(day.key);
      const key = occurrenceKey(child.id, chore.id, day.key);
      const checked = Boolean(data.completions[key]);
      if (checked) choreEarned += chore.reward || 0;
      if (!scheduled) return `<td class="check-cell inactive"><span class="not-scheduled">·</span></td>`;
      return `
        <td class="check-cell">
          <label class="check${checked ? " checked" : ""}">
            <input type="checkbox" data-action="toggle-chore" data-child-id="${child.id}" data-chore-id="${chore.id}" data-day="${day.key}" ${checked ? "checked" : ""} aria-label="${escapeHTML(chore.title)} on ${day.long}">
            <span aria-hidden="true">✓</span>
          </label>
        </td>`;
    }).join("");
    return `
      <tr data-chore-row data-chore-id="${chore.id}" data-child-id="${child.id}">
        <td class="task-cell">
          <div class="task-cell-inner">
            ${print ? "" : `<span class="drag-handle" draggable="true" tabindex="0" role="button" data-drag-handle data-chore-id="${chore.id}" data-child-id="${child.id}" aria-label="Reorder ${escapeHTML(chore.title)}. Use the up and down arrow keys, or drag." title="Drag to reorder">⠿</span>`}
            <button class="task-edit" data-action="edit-chore" data-chore-id="${chore.id}" ${print ? "disabled" : ""}>
              <span>${escapeHTML(chore.title)}</span>
              <small>${scheduleLabel(chore.days)}${chore.reward !== null ? ` · ${money(chore.reward)} each` : ""}</small>
            </button>
          </div>
        </td>
        ${cells}
        ${print ? "" : `<td class="earned-cell">${chore.reward !== null ? `<strong>${money(choreEarned)}</strong>` : "<span>—</span>"}</td>`}
      </tr>`;
  }).join("");

  return `
    <article class="matrix-card" style="--child-color:${child.color}">
      ${print ? `<div class="print-kid-title"><span class="avatar">${escapeHTML(child.name.slice(0, 1).toUpperCase())}</span><div><p>This week belongs to</p><h2>${escapeHTML(child.name)}</h2></div></div>` : ""}
      <div class="matrix-scroll">
        <table>
          <thead><tr>
            <th class="task-head"><span>My jobs</span><small>${chores.length} routines</small></th>
            ${DAYS.map((day, index) => `<th><span>${day.short}</span><small>${dates[index].getDate()}</small></th>`).join("")}
            ${print ? "" : `<th class="earned-head"><span>Earned</span><small>this week</small></th>`}
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="matrix-total"><span><i></i> Keep going, ${escapeHTML(child.name)}!</span>${print ? "" : `<strong>${money(stats.earned)} <small>earned this week</small></strong>`}</div>
      ${print ? `<div class="print-weekly-note${weeklyNote() ? "" : " empty"}"><strong>Note for the week</strong><p data-print-weekly-note>${escapeHTML(weeklyNote())}</p></div>` : ""}
    </article>`;
}

function weeklyNote() {
  return data.notes?.[dateKey(weekStart)] || "";
}

function weeklyNoteEditor() {
  return `
    <label class="weekly-note-editor">
      <span>Note for this week <small>optional</small></span>
      <textarea data-weekly-note maxlength="500" placeholder="A reminder, encouragement, or little family note…">${escapeHTML(weeklyNote())}</textarea>
      <small>Printed beneath every child’s chart</small>
    </label>`;
}

function render() {
  if (!data.children.some((child) => child.id === activeChildId)) activeChildId = data.children[0]?.id || "";
  const activeChild = data.children.find((child) => child.id === activeChildId);
  const stats = familyStats();
  const weekLabel = `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${addDays(weekStart, 6).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  app.innerHTML = `
    <header class="topbar">
      <button class="brand" data-action="today" aria-label="Chore Club home"><span class="brand-mark">✓</span><span>Chore Club</span></button>
      <div class="topbar-actions">
        <span class="local-pill"><span class="status-dot"></span> Saved on this device</span>
        <button class="icon-button desktop-label" data-action="manage"><span aria-hidden="true">⚙</span> Manage</button>
        <button class="button button-dark" data-action="print"><span aria-hidden="true">↗</span> Print week</button>
      </div>
    </header>

    <section class="hero">
      <div>
        <p class="eyebrow">The family weekly rhythm</p>
        <h1>Small jobs.<br><em>Big wins.</em></h1>
        <p class="hero-copy">One cheerful place for routines, rewards, and all those little moments worth celebrating.</p>
      </div>
      <div class="week-card">
        <div class="week-card-top">
          <div><span class="mini-label">This week</span><strong>${weekLabel}</strong></div>
          <div class="week-controls">
            <button data-action="previous-week" aria-label="Previous week">←</button>
            <button class="today-button" data-action="today">Today</button>
            <button data-action="next-week" aria-label="Next week">→</button>
          </div>
        </div>
        <div class="progress-track" aria-label="${stats.percent}% of family chores complete"><span style="width:${stats.percent}%"></span></div>
        <div class="week-stats">
          <div><strong>${stats.completed}<small> / ${stats.assigned}</small></strong><span>jobs done</span></div>
          <div><strong>${stats.percent}%</strong><span>complete</span></div>
          <div><strong>${money(stats.earned)}</strong><span>earned</span></div>
        </div>
      </div>
    </section>

    <section class="board-section">
      <div class="board-heading">
        <div><p class="eyebrow">Weekly board</p><h2>Who’s on deck?</h2></div>
        <button class="button button-sun" data-action="new-chore"><span aria-hidden="true">＋</span> Add a chore</button>
      </div>
      <div class="child-tabs" role="tablist" aria-label="Choose a child">
        ${childTabs()}
        <button class="add-child-tab" data-action="manage">＋ Add child</button>
      </div>
      <div class="screen-board">${activeChild ? `${childMatrix(activeChild)}${weeklyNoteEditor()}` : `<div class="empty-board"><span>☀</span><h3>A fresh little slate</h3><p>Add your first child to get started.</p><button class="button button-sun" data-action="manage">Add a child</button></div>`}</div>
      <div class="print-boards">${data.children.map((child) => childMatrix(child, true)).join("")}</div>
    </section>

    <footer><p><span>♥</span> Make it yours. Everything stays private on this device.</p><button data-action="reset">Reset example board</button></footer>`;
}

function showCelebration() {
  const messages = ["Nice one!", "High five!", "You did it!", "Tiny win!"];
  showStatus(`✦ ${messages[Math.floor(Math.random() * messages.length)]}`);
}

function showStatus(message) {
  celebration.textContent = message;
  celebration.classList.remove("show");
  void celebration.offsetWidth;
  celebration.classList.add("show");
}

function reorderChore(sourceId, targetId) {
  if (!sourceId || !targetId || sourceId === targetId) return false;
  const sourceIndex = data.chores.findIndex((chore) => chore.id === sourceId);
  const targetIndex = data.chores.findIndex((chore) => chore.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0) return false;
  const [moved] = data.chores.splice(sourceIndex, 1);
  const adjustedTargetIndex = data.chores.findIndex((chore) => chore.id === targetId);
  const insertIndex = sourceIndex < targetIndex ? adjustedTargetIndex + 1 : adjustedTargetIndex;
  data.chores.splice(insertIndex, 0, moved);
  saveData();
  return true;
}

function markDropTarget(row) {
  app.querySelectorAll("[data-chore-row].drag-over").forEach((item) => item.classList.remove("drag-over"));
  dropTargetId = "";
  if (!row || row.dataset.choreId === draggedChoreId || row.dataset.childId !== draggedChildId) return;
  row.classList.add("drag-over");
  dropTargetId = row.dataset.choreId;
}

function finishDrag() {
  const sourceId = draggedChoreId;
  const targetId = dropTargetId;
  const movedChore = data.chores.find((chore) => chore.id === sourceId);
  draggedChoreId = "";
  draggedChildId = "";
  dropTargetId = "";
  if (reorderChore(sourceId, targetId)) {
    render();
    showStatus(`${movedChore?.title || "Chore"} moved`);
  } else {
    app.querySelectorAll(".dragging, .drag-over").forEach((item) => item.classList.remove("dragging", "drag-over"));
  }
}

function openDialog(content) {
  modal.innerHTML = content;
  modal.showModal();
}

function closeDialog() {
  modal.close();
  modal.innerHTML = "";
}

function dialogHeader(title, subtitle) {
  return `<div class="modal-header"><div><p class="eyebrow">Chore Club</p><h2>${title}</h2><p>${subtitle}</p></div><button class="modal-close" data-action="close-modal" aria-label="Close">×</button></div>`;
}

function openManager() {
  const children = data.children.map((child) => `
    <div class="manage-row">
      <span class="avatar" style="background:${child.color}">${escapeHTML(child.name.slice(0, 1).toUpperCase())}</span>
      <input value="${escapeHTML(child.name)}" data-child-name="${child.id}" aria-label="${escapeHTML(child.name)}’s name">
      <button class="trash-button" data-action="remove-child" data-child-id="${child.id}" aria-label="Remove ${escapeHTML(child.name)}">×</button>
    </div>`).join("");
  const chores = data.chores.map((chore) => `
    <div class="manage-row chore-manage-row">
      <button data-action="edit-chore" data-chore-id="${chore.id}"><strong>${escapeHTML(chore.title)}</strong><small>${scheduleLabel(chore.days)} · ${chore.childIds.length} ${chore.childIds.length === 1 ? "child" : "children"}</small></button>
      <button class="trash-button" data-action="remove-chore" data-chore-id="${chore.id}" aria-label="Delete ${escapeHTML(chore.title)}">×</button>
    </div>`).join("");
  openDialog(`${dialogHeader("Manage your family", "Names and routines can change. Your board should too.")}
    <div class="manager-grid">
      <div><h3>Children</h3><div class="manage-list">${children}</div>
        <form id="add-child-form" class="inline-add"><input name="name" placeholder="Child’s name" aria-label="New child name" required><button class="button button-sun">Add</button></form>
      </div>
      <div><h3>Chore library</h3><div class="manage-list chore-list">${chores || "<p>No chores yet.</p>"}</div></div>
    </div>`);
  modal.classList.add("wide");
}

function openChoreForm(choreId = "") {
  const chore = data.chores.find((item) => item.id === choreId);
  const selectedChildren = chore?.childIds || (activeChildId ? [activeChildId] : []);
  const selectedDays = chore?.days || DAYS.map((day) => day.key);
  const daily = selectedDays.length === 7;
  const hasReward = chore?.reward !== null && chore?.reward !== undefined;
  modal.classList.remove("wide");
  openDialog(`${dialogHeader(chore ? "Edit this chore" : "Add a new chore", "Keep it simple, specific, and easy to celebrate.")}
    <form id="chore-form" class="chore-form" data-chore-id="${chore?.id || ""}">
      <label class="field"><span>What needs doing?</span><input name="title" value="${escapeHTML(chore?.title || "")}" placeholder="e.g. Feed the dog" required autofocus></label>
      <fieldset><legend>Who is it for?</legend><div class="choice-row">
        ${data.children.map((child) => `<label class="choice-chip${selectedChildren.includes(child.id) ? " selected" : ""}"><input type="checkbox" name="child" value="${child.id}" ${selectedChildren.includes(child.id) ? "checked" : ""}><span class="avatar" style="background:${child.color}">${escapeHTML(child.name.slice(0, 1).toUpperCase())}</span>${escapeHTML(child.name)}</label>`).join("")}
      </div></fieldset>
      <fieldset><legend>When does it happen?</legend>
        <div class="segmented">
          <label><input type="radio" name="schedule" value="daily" ${daily ? "checked" : ""}>Every day</label>
          <label><input type="radio" name="schedule" value="specific" ${daily ? "" : "checked"}>Specific days</label>
        </div>
        <div class="day-picker${daily ? " disabled" : ""}">${DAYS.map((day) => `<label class="${selectedDays.includes(day.key) ? "selected" : ""}"><input type="checkbox" name="day" value="${day.key}" ${selectedDays.includes(day.key) ? "checked" : ""} ${daily ? "disabled" : ""}>${day.short.slice(0, 1)}</label>`).join("")}</div>
      </fieldset>
      <fieldset><legend>Reward <small>optional</small></legend>
        <label class="reward-toggle"><input type="checkbox" name="hasReward" ${hasReward ? "checked" : ""}><span>Attach a little money reward</span></label>
        <label class="money-field${hasReward ? "" : " hidden"}"><span>$</span><input type="number" name="reward" min="0" step="0.05" value="${Number(chore?.reward ?? 0.1).toFixed(2)}"><small>each time</small></label>
      </fieldset>
      <p class="form-error" aria-live="polite"></p>
      <div class="modal-actions"><button type="button" class="button button-ghost" data-action="close-modal">Cancel</button><button class="button button-dark">${chore ? "Save changes" : "Add to the board"}</button></div>
    </form>`);
}

app.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  if (action === "select-child") { activeChildId = button.dataset.childId; render(); }
  if (action === "previous-week") { weekStart = addDays(weekStart, -7); render(); }
  if (action === "next-week") { weekStart = addDays(weekStart, 7); render(); }
  if (action === "today") { weekStart = mondayOf(new Date()); render(); }
  if (action === "print") window.print();
  if (action === "manage") openManager();
  if (action === "new-chore") openChoreForm();
  if (action === "edit-chore") openChoreForm(button.dataset.choreId);
  if (action === "reset" && confirm("Reset the board to the Esme and Kieran example?")) {
    data = clone(STARTER_DATA); activeChildId = data.children[0].id; weekStart = mondayOf(new Date()); saveData(); render();
  }
});

app.addEventListener("change", (event) => {
  const input = event.target.closest('[data-action="toggle-chore"]');
  if (!input) return;
  data.completions[occurrenceKey(input.dataset.childId, input.dataset.choreId, input.dataset.day)] = input.checked;
  saveData();
  if (input.checked) showCelebration();
  render();
});

app.addEventListener("input", (event) => {
  const note = event.target.closest("[data-weekly-note]");
  if (!note) return;
  const key = dateKey(weekStart);
  const value = note.value;
  if (value.trim()) data.notes[key] = value;
  else delete data.notes[key];
  saveData();
  app.querySelectorAll("[data-print-weekly-note]").forEach((printedNote) => {
    printedNote.textContent = value;
    printedNote.closest(".print-weekly-note").classList.toggle("empty", !value.trim());
  });
});

app.addEventListener("dragstart", (event) => {
  const handle = event.target.closest("[data-drag-handle]");
  if (!handle) return;
  draggedChoreId = handle.dataset.choreId;
  draggedChildId = handle.dataset.childId;
  handle.closest("[data-chore-row]").classList.add("dragging");
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", draggedChoreId);
});

app.addEventListener("dragover", (event) => {
  if (!draggedChoreId) return;
  const row = event.target.closest("[data-chore-row]");
  if (!row) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  markDropTarget(row);
});

app.addEventListener("drop", (event) => {
  if (!draggedChoreId) return;
  event.preventDefault();
  markDropTarget(event.target.closest("[data-chore-row]"));
  finishDrag();
});

app.addEventListener("dragend", () => finishDrag());

app.addEventListener("pointerdown", (event) => {
  const handle = event.target.closest("[data-drag-handle]");
  if (!handle || event.pointerType === "mouse") return;
  event.preventDefault();
  draggedChoreId = handle.dataset.choreId;
  draggedChildId = handle.dataset.childId;
  handle.closest("[data-chore-row]").classList.add("dragging");
  handle.setPointerCapture(event.pointerId);
});

app.addEventListener("pointermove", (event) => {
  if (!draggedChoreId || event.pointerType === "mouse") return;
  event.preventDefault();
  markDropTarget(document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-chore-row]"));
});

app.addEventListener("pointerup", (event) => {
  if (!draggedChoreId || event.pointerType === "mouse") return;
  finishDrag();
});

app.addEventListener("keydown", (event) => {
  const handle = event.target.closest("[data-drag-handle]");
  if (!handle || !["ArrowUp", "ArrowDown"].includes(event.key)) return;
  event.preventDefault();
  const assigned = data.chores.filter((chore) => chore.childIds.includes(handle.dataset.childId));
  const currentIndex = assigned.findIndex((chore) => chore.id === handle.dataset.choreId);
  const direction = event.key === "ArrowUp" ? -1 : 1;
  const target = assigned[currentIndex + direction];
  if (!target || !reorderChore(handle.dataset.choreId, target.id)) return;
  const moved = data.chores.find((chore) => chore.id === handle.dataset.choreId);
  render();
  app.querySelector(`[data-drag-handle][data-chore-id="${handle.dataset.choreId}"]`)?.focus();
  showStatus(`${moved?.title || "Chore"} moved ${direction < 0 ? "up" : "down"}`);
});

modal.addEventListener("click", (event) => {
  if (event.target === modal) closeDialog();
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  if (action === "close-modal") closeDialog();
  if (action === "edit-chore") openChoreForm(button.dataset.choreId);
  if (action === "remove-chore" && confirm("Delete this chore from the family board?")) {
    data.chores = data.chores.filter((chore) => chore.id !== button.dataset.choreId); saveData(); openManager(); render();
  }
  if (action === "remove-child") {
    if (data.children.length === 1) return alert("Keep at least one child on the board.");
    if (!confirm("Remove this child and their assignments?")) return;
    const id = button.dataset.childId;
    data.children = data.children.filter((child) => child.id !== id);
    data.chores = data.chores.map((chore) => ({ ...chore, childIds: chore.childIds.filter((childId) => childId !== id) })).filter((chore) => chore.childIds.length);
    activeChildId = data.children[0].id; saveData(); openManager(); render();
  }
});

modal.addEventListener("change", (event) => {
  if (event.target.matches("[data-child-name]")) {
    const name = event.target.value.trim();
    if (name) {
      const child = data.children.find((item) => item.id === event.target.dataset.childName);
      if (child) child.name = name;
      saveData(); render();
    }
  }
  if (event.target.matches('input[name="child"]')) event.target.closest(".choice-chip").classList.toggle("selected", event.target.checked);
  if (event.target.matches('input[name="day"]')) event.target.closest("label").classList.toggle("selected", event.target.checked);
  if (event.target.matches('input[name="schedule"]')) {
    const daily = event.target.value === "daily";
    modal.querySelector(".day-picker").classList.toggle("disabled", daily);
    modal.querySelectorAll('input[name="day"]').forEach((input) => { input.disabled = daily; });
  }
  if (event.target.matches('input[name="hasReward"]')) modal.querySelector(".money-field").classList.toggle("hidden", !event.target.checked);
});

modal.addEventListener("submit", (event) => {
  event.preventDefault();
  if (event.target.id === "add-child-form") {
    const name = new FormData(event.target).get("name").trim();
    if (!name) return;
    const child = { id: makeId("child"), name, color: CHILD_COLORS[data.children.length % CHILD_COLORS.length] };
    data.children.push(child); activeChildId = child.id; saveData(); openManager(); render(); return;
  }
  if (event.target.id === "chore-form") {
    const formData = new FormData(event.target);
    const title = formData.get("title").trim();
    const childIds = formData.getAll("child");
    const daily = formData.get("schedule") === "daily";
    const days = daily ? DAYS.map((day) => day.key) : formData.getAll("day");
    if (!title || !childIds.length || !days.length) {
      event.target.querySelector(".form-error").textContent = "Give the chore a name, at least one child, and at least one day.";
      return;
    }
    const id = event.target.dataset.choreId || makeId("chore");
    const chore = { id, title, childIds, days, reward: formData.get("hasReward") ? Math.max(0, Number(formData.get("reward")) || 0) : null };
    const index = data.chores.findIndex((item) => item.id === id);
    if (index >= 0) data.chores[index] = chore; else data.chores.push(chore);
    saveData(); closeDialog(); render();
  }
});

modal.addEventListener("close", () => modal.classList.remove("wide"));
render();

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
