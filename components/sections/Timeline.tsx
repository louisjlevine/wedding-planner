"use client";

import { useState } from "react";
import { usePlan } from "@/hooks/usePlan";
import { usePlanStore } from "@/lib/plan-store";
import { Badge } from "@/components/ui/Badge";
import { describeSchedule, resolveDueDate } from "@/lib/plan-adapters";
import { describeWeddingDate, formatDate, todayISO } from "@/lib/date-utils";
import type { Task, WeddingAnswers } from "@/lib/types";

function priorityVariant(p: Task["priority"]) {
  return p === "high" ? "pink" : p === "medium" ? "yellow" : "gray";
}

const PRIORITY_RANK: Record<Task["priority"], number> = { high: 0, medium: 1, low: 2 };

/** A task plus the date it actually falls on, so sorting/grouping resolve once. */
interface DatedTask {
  task: Task;
  date?: string;
}

/** Undated items sort last; otherwise chronological, higher priority first on a tie. */
function byDate(a: DatedTask, b: DatedTask): number {
  if (a.date && b.date && a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.date && !b.date) return -1;
  if (!a.date && b.date) return 1;
  return PRIORITY_RANK[a.task.priority] - PRIORITY_RANK[b.task.priority];
}

// ── Date editing ──────────────────────────────────────────────────────────────

/** The three ways a task can be scheduled. `daysBefore` seeds land on "relative". */
type DateMode = "none" | "exact" | "relative";

/** The subset of Task the editor owns. Every field is written on save so
 *  switching modes clears the one that no longer applies. */
type DateFields = Pick<Task, "dueDate" | "monthsBefore" | "daysBefore">;

function modeOf(task: DateFields): DateMode {
  if (task.dueDate) return "exact";
  if (task.monthsBefore != null || task.daysBefore != null) return "relative";
  return "none";
}

const MODE_LABELS: { value: DateMode; label: string }[] = [
  { value: "exact", label: "Exact date" },
  { value: "relative", label: "Months before" },
  { value: "none", label: "No date" },
];

function fieldsFor(mode: DateMode, exact: string, months: string): DateFields {
  if (mode === "exact") {
    return { dueDate: exact || undefined, monthsBefore: undefined, daysBefore: undefined };
  }
  if (mode === "relative") {
    const n = Number(months);
    const safe = Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
    return { dueDate: undefined, monthsBefore: safe, daysBefore: undefined };
  }
  return { dueDate: undefined, monthsBefore: undefined, daysBefore: undefined };
}

const inputClass =
  "border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]";

/**
 * Mode switch + the input for the chosen mode. Used both by the add form
 * (uncontrolled parent state) and by the per-row editor.
 */
function DateModePicker({
  mode,
  onModeChange,
  exact,
  onExactChange,
  months,
  onMonthsChange,
  weddingDate,
  idPrefix,
}: {
  mode: DateMode;
  onModeChange: (mode: DateMode) => void;
  exact: string;
  onExactChange: (value: string) => void;
  months: string;
  onMonthsChange: (value: string) => void;
  weddingDate: string;
  idPrefix: string;
}) {
  const preview =
    mode === "relative"
      ? resolveDueDate(fieldsFor("relative", exact, months), weddingDate)
      : undefined;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {MODE_LABELS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            // Scoped to the item so the add form's picker and an open row
            // editor's picker stay separately addressable.
            aria-label={`${idPrefix}: ${label}`}
            onClick={() => onModeChange(value)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              mode === value
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "exact" && (
        <input
          type="date"
          value={exact}
          onChange={(e) => onExactChange(e.target.value)}
          aria-label={`${idPrefix} exact date`}
          className={inputClass}
        />
      )}

      {mode === "relative" && (
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={60}
            value={months}
            onChange={(e) => onMonthsChange(e.target.value)}
            aria-label={`${idPrefix} months before the wedding`}
            className={`${inputClass} w-20`}
          />
          <span className="text-xs text-gray-500">
            months before the wedding
            {preview && <span className="text-gray-400"> — {formatDate(preview)}</span>}
          </span>
        </div>
      )}
    </div>
  );
}

function DateEditor({
  task,
  weddingDate,
  onSave,
  onCancel,
}: {
  task: Task;
  weddingDate: string;
  onSave: (fields: DateFields) => void;
  onCancel: () => void;
}) {
  const initialMode = modeOf(task);
  const [mode, setMode] = useState<DateMode>(initialMode);
  const [exact, setExact] = useState(
    task.dueDate ?? (initialMode === "relative" ? resolveDueDate(task, weddingDate) ?? "" : ""),
  );
  const [months, setMonths] = useState(
    task.monthsBefore != null ? String(task.monthsBefore) : task.daysBefore != null ? "0" : "6",
  );

  return (
    <div className="mt-3 border-t border-gray-100 pt-3 space-y-3">
      <DateModePicker
        mode={mode}
        onModeChange={setMode}
        exact={exact}
        onExactChange={setExact}
        months={months}
        onMonthsChange={setMonths}
        weddingDate={weddingDate}
        idPrefix={task.title}
      />
      <div className="flex gap-2">
        <button
          onClick={() => onSave(fieldsFor(mode, exact, months))}
          className="px-3 py-1.5 bg-[var(--accent)] text-white text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity"
        >
          Save date
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Rows ──────────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  date,
  today,
  weddingDate,
  editing,
  onEdit,
  onToggle,
  onSaveDate,
  onRemove,
}: {
  task: Task;
  date?: string;
  today: string;
  weddingDate: string;
  editing: boolean;
  onEdit: (id: string | null) => void;
  onToggle: (task: Task) => void;
  onSaveDate: (task: Task, fields: DateFields) => void;
  onRemove: (task: Task) => void;
}) {
  const isToday = !!date && date === today;
  const isOverdue = !task.done && !!date && date < today;
  const schedule = describeSchedule(task);
  const removable = task.id.startsWith("custom-");

  return (
    <div
      className={`bg-white border rounded-xl px-5 py-4 ${
        task.done
          ? "border-gray-100 bg-gray-50"
          : isToday
          ? "border-[var(--accent)] ring-1 ring-[var(--accent)]/20"
          : isOverdue
          ? "border-red-200 bg-red-50/30"
          : "border-gray-200"
      }`}
    >
      <div className="flex items-start gap-4">
        <div className="shrink-0 mt-0.5">
          <button
            onClick={() => onToggle(task)}
            title={task.done ? "Mark incomplete" : "Mark complete"}
            aria-label={
              task.done ? `Mark "${task.title}" incomplete` : `Mark "${task.title}" complete`
            }
            className={`relative w-4 h-4 rounded border-2 transition-colors hover:opacity-70 after:content-[''] after:absolute after:-inset-2.5 ${
              task.done
                ? "bg-[var(--accent)] border-[var(--accent)]"
                : isToday
                ? "border-[var(--accent)]"
                : isOverdue
                ? "border-red-400 hover:border-red-500"
                : "border-gray-300 hover:border-[var(--accent)]"
            }`}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p
              className={`text-sm font-medium ${
                task.done ? "line-through text-gray-400" : "text-gray-900"
              }`}
            >
              {task.title}
            </p>
            <Badge variant={priorityVariant(task.priority)}>{task.priority}</Badge>
            <Badge variant="gray">{task.category}</Badge>
          </div>
          {task.flag && <p className="text-xs text-[var(--accent)] mt-1">{task.flag}</p>}
        </div>

        <div className="shrink-0 text-right flex items-start gap-3">
          <button
            onClick={() => onEdit(editing ? null : task.id)}
            aria-label={`Edit date for "${task.title}"`}
            className="text-right group"
          >
            <span
              className={`block text-xs font-medium group-hover:text-[var(--accent)] transition-colors ${
                isOverdue ? "text-red-500" : "text-gray-500"
              }`}
            >
              {date ? formatDate(date) : "No date"}
            </span>
            {schedule && (
              <span className="block text-xs text-gray-400 mt-0.5">{schedule}</span>
            )}
          </button>
          {removable && (
            <button
              onClick={() => onRemove(task)}
              className="text-gray-300 hover:text-red-400 text-xs transition-colors mt-0.5"
            >
              remove
            </button>
          )}
        </div>
      </div>

      {editing && (
        <DateEditor
          task={task}
          weddingDate={weddingDate}
          onSave={(fields) => onSaveDate(task, fields)}
          onCancel={() => onEdit(null)}
        />
      )}
    </div>
  );
}

function Group({
  label,
  tone = "muted",
  items,
  ...rowProps
}: {
  label: string;
  tone?: "muted" | "alert";
  items: DatedTask[];
  today: string;
  weddingDate: string;
  editingId: string | null;
  onEdit: (id: string | null) => void;
  onToggle: (task: Task) => void;
  onSaveDate: (task: Task, fields: DateFields) => void;
  onRemove: (task: Task) => void;
}) {
  if (items.length === 0) return null;
  const { editingId, ...rest } = rowProps;
  return (
    <div>
      <p
        className={`text-xs font-semibold uppercase tracking-widest mb-2 ${
          tone === "alert" ? "text-red-500" : "text-gray-400"
        }`}
      >
        {label}
      </p>
      <div className="space-y-2">
        {items.map(({ task, date }) => (
          <TaskRow
            key={task.id}
            task={task}
            date={date}
            editing={editingId === task.id}
            {...rest}
          />
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Filter = "all" | "todo" | "done";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Everything" },
  { value: "todo", label: "To do" },
  { value: "done", label: "Done" },
];

function summaryLine(answers: WeddingAnswers, done: number, total: number): string {
  return [
    "Every milestone and task on your plan, in date order",
    `${done} of ${total} done`,
    `Wedding day ${describeWeddingDate(answers)}${answers.dateIsExact ? "" : " (date TBC)"}`,
  ].join(" · ");
}

export function Timeline() {
  const { allTasks, tasks, answers } = usePlan();
  const { updateTask, addTask, removeTask } = usePlanStore();
  const [filter, setFilter] = useState<Filter>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newMode, setNewMode] = useState<DateMode>("none");
  const [newExact, setNewExact] = useState("");
  const [newMonths, setNewMonths] = useState("6");

  if (!answers) return null;

  const today = todayISO();
  const weddingDate = answers.date;
  const storeTaskIds = new Set(tasks.map((t) => t.id));

  const dated: DatedTask[] = allTasks.map((task) => ({
    task,
    date: resolveDueDate(task, weddingDate),
  }));

  const visible = dated.filter((i) =>
    filter === "all" ? true : filter === "done" ? i.task.done : !i.task.done,
  );

  const overdue = visible.filter((i) => !i.task.done && i.date && i.date < today).sort(byDate);
  const upcoming = visible.filter((i) => !i.task.done && i.date && i.date >= today).sort(byDate);
  const undated = visible.filter((i) => !i.task.done && !i.date).sort(byDate);
  const done = visible.filter((i) => i.task.done).sort(byDate);

  const doneCount = dated.filter((i) => i.task.done).length;

  /**
   * Writes to a task whether or not it's been persisted yet. Adapter-derived
   * tasks only exist in the store once touched, so `updateTask` alone is a
   * no-op for them — they have to be materialised with `addTask` first.
   */
  function applyUpdate(task: Task, updates: Partial<Task>) {
    if (storeTaskIds.has(task.id)) {
      updateTask(task.id, updates);
    } else {
      addTask({ ...task, ...updates });
    }
  }

  function handleToggle(task: Task) {
    applyUpdate(task, { done: !task.done });
  }

  function handleSaveDate(task: Task, fields: DateFields) {
    applyUpdate(task, fields);
    setEditingId(null);
  }

  function handleRemove(task: Task) {
    removeTask(task.id);
    if (editingId === task.id) setEditingId(null);
  }

  function handleAdd() {
    if (!newTitle.trim()) return;
    addTask({
      id: `custom-${Date.now()}`,
      title: newTitle.trim(),
      category: "Custom",
      priority: "medium",
      done: false,
      ...fieldsFor(newMode, newExact, newMonths),
    });
    setNewTitle("");
    setNewMode("none");
    setNewExact("");
    setNewMonths("6");
  }

  const rowProps = {
    today,
    weddingDate,
    editingId,
    onEdit: setEditingId,
    onToggle: handleToggle,
    onSaveDate: handleSaveDate,
    onRemove: handleRemove,
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Timeline</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {summaryLine(answers, doneCount, dated.length)}
        </p>
      </div>

      {/* Add a task — title plus an optional date, either exact or relative */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Add a task..."
            aria-label="New task title"
            className="flex-1 border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <button
            onClick={handleAdd}
            className="px-4 py-2 bg-[var(--accent)] text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity"
          >
            Add
          </button>
        </div>
        <DateModePicker
          mode={newMode}
          onModeChange={setNewMode}
          exact={newExact}
          onExactChange={setNewExact}
          months={newMonths}
          onMonthsChange={setNewMonths}
          weddingDate={weddingDate}
          idPrefix="New task"
        />
      </div>

      {/* Filter — narrows the single list, it does not split it into pages */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {FILTERS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === value
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* One combined list */}
      <div className="space-y-6">
        <Group
          label={`Overdue — ${overdue.length} item${overdue.length !== 1 ? "s" : ""}`}
          tone="alert"
          items={overdue}
          {...rowProps}
        />
        <Group label="Upcoming" items={upcoming} {...rowProps} />
        <Group label="No date yet" items={undated} {...rowProps} />
        <Group label={`Done — ${done.length}`} items={done} {...rowProps} />

        {visible.length === 0 && <p className="text-sm text-gray-400">Nothing here yet.</p>}
      </div>
    </div>
  );
}
