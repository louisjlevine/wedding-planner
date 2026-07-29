"use client";

import { useState } from "react";
import { usePlan } from "@/hooks/usePlan";
import { usePlanStore } from "@/lib/plan-store";
import { Badge } from "@/components/ui/Badge";
import { describeWeddingDate, formatDate, todayISO } from "@/lib/date-utils";
import type { Task } from "@/lib/types";

function priorityVariant(p: Task["priority"]) {
  return p === "high" ? "pink" : p === "medium" ? "yellow" : "gray";
}

// Milestones and tasks live in different store slices (derived timeline vs.
// user-editable tasks) but read as one plan on screen, so both are normalised
// into this shape before rendering.
interface PlanItem {
  key: string;
  id: string;
  kind: "milestone" | "task";
  title: string;
  date?: string;
  category: string;
  priority?: Task["priority"];
  flag?: string;
  done: boolean;
  monthsBefore?: number;
  removable?: boolean;
}

const PRIORITY_RANK: Record<Task["priority"], number> = { high: 0, medium: 1, low: 2 };

/** Undated items sort last; otherwise chronological, milestones ahead of tasks on a tie. */
function byDate(a: PlanItem, b: PlanItem): number {
  if (a.date && b.date && a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.date && !b.date) return -1;
  if (!a.date && b.date) return 1;
  if (a.kind !== b.kind) return a.kind === "milestone" ? -1 : 1;
  return PRIORITY_RANK[a.priority ?? "medium"] - PRIORITY_RANK[b.priority ?? "medium"];
}

function PlanItemRow({
  item,
  today,
  onToggle,
  onRemove,
}: {
  item: PlanItem;
  today: string;
  onToggle: (item: PlanItem) => void;
  onRemove: (item: PlanItem) => void;
}) {
  const isMilestone = item.kind === "milestone";
  const isToday = !!item.date && item.date === today;
  const isOverdue = !item.done && !!item.date && item.date < today;

  return (
    <div
      className={`bg-white border rounded-xl px-5 py-4 flex items-start gap-4 ${
        item.done
          ? "border-gray-100 bg-gray-50"
          : isToday
          ? "border-[var(--accent)] ring-1 ring-[var(--accent)]/20"
          : isOverdue
          ? "border-red-200 bg-red-50/30"
          : "border-gray-200"
      }`}
    >
      <div className="shrink-0 mt-0.5">
        <button
          onClick={() => onToggle(item)}
          title={item.done ? "Mark incomplete" : "Mark complete"}
          aria-label={
            item.done ? `Mark "${item.title}" incomplete` : `Mark "${item.title}" complete`
          }
          className={`relative w-4 h-4 border-2 transition-colors hover:opacity-70 after:content-[''] after:absolute after:-inset-2.5 ${
            // Round for milestones, square for tasks — the shape is the fastest
            // way to tell the two apart in a combined list.
            isMilestone ? "rounded-full" : "rounded"
          } ${
            item.done
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
              item.done ? "line-through text-gray-400" : "text-gray-900"
            }`}
          >
            {item.title}
          </p>
          <Badge variant={isMilestone ? "pink" : "gray"}>
            {isMilestone ? "Milestone" : "Task"}
          </Badge>
          {!isMilestone && item.priority && (
            <Badge variant={priorityVariant(item.priority)}>{item.priority}</Badge>
          )}
          <Badge variant="gray">{item.category}</Badge>
        </div>
        {item.flag && <p className="text-xs text-[var(--accent)] mt-1">{item.flag}</p>}
      </div>

      <div className="shrink-0 text-right flex items-start gap-3">
        <div>
          <p className={`text-xs font-medium ${isOverdue ? "text-red-500" : "text-gray-500"}`}>
            {item.date ? formatDate(item.date) : "No date"}
          </p>
          {isMilestone && item.monthsBefore != null && item.monthsBefore > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">{item.monthsBefore}mo before</p>
          )}
        </div>
        {item.removable && (
          <button
            onClick={() => onRemove(item)}
            className="text-gray-300 hover:text-red-400 text-xs transition-colors mt-0.5"
          >
            remove
          </button>
        )}
      </div>
    </div>
  );
}

function Group({
  label,
  tone = "muted",
  items,
  today,
  onToggle,
  onRemove,
}: {
  label: string;
  tone?: "muted" | "alert";
  items: PlanItem[];
  today: string;
  onToggle: (item: PlanItem) => void;
  onRemove: (item: PlanItem) => void;
}) {
  if (items.length === 0) return null;
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
        {items.map((item) => (
          <PlanItemRow
            key={item.key}
            item={item}
            today={today}
            onToggle={onToggle}
            onRemove={onRemove}
          />
        ))}
      </div>
    </div>
  );
}

type Filter = "all" | "milestones" | "tasks";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Everything" },
  { value: "milestones", label: "Milestones" },
  { value: "tasks", label: "Tasks" },
];

export function Timeline() {
  const { timeline, tasks, answers, defaultTasks } = usePlan();
  const { toggleTimelineItem, toggleTask, addTask, removeTask } = usePlanStore();
  const [filter, setFilter] = useState<Filter>("all");
  const [newTitle, setNewTitle] = useState("");

  if (!answers) return null;

  const today = todayISO();

  // Store tasks win over the adapter defaults with the same id (the store copy
  // carries the user's done state).
  const storeTaskIds = new Set(tasks.map((t) => t.id));
  const mergedTasks = [...tasks, ...defaultTasks.filter((t) => !storeTaskIds.has(t.id))];

  const milestoneItems: PlanItem[] = timeline.map((m) => ({
    key: `milestone-${m.id}`,
    id: m.id,
    kind: "milestone",
    title: m.title,
    date: m.targetDate || undefined,
    category: m.category,
    flag: m.flag,
    done: m.done,
    monthsBefore: m.monthsBefore,
  }));

  const taskItems: PlanItem[] = mergedTasks.map((t) => ({
    key: `task-${t.id}`,
    id: t.id,
    kind: "task",
    title: t.title,
    date: t.dueDate,
    category: t.category,
    priority: t.priority,
    flag: t.flag,
    done: t.done,
    removable: t.id.startsWith("custom-"),
  }));

  const allItems = [...milestoneItems, ...taskItems];
  const visible = allItems.filter((i) =>
    filter === "all" ? true : filter === "milestones" ? i.kind === "milestone" : i.kind === "task",
  );

  const overdue = visible.filter((i) => !i.done && i.date && i.date < today).sort(byDate);
  const upcoming = visible.filter((i) => !i.done && i.date && i.date >= today).sort(byDate);
  const undated = visible.filter((i) => !i.done && !i.date).sort(byDate);
  const done = visible.filter((i) => i.done).sort(byDate);

  const doneMilestones = milestoneItems.filter((i) => i.done).length;
  const doneTasks = taskItems.filter((i) => i.done).length;

  const summary = [
    "Everything on your plan, in date order",
    `${doneMilestones} of ${milestoneItems.length} milestones done`,
    `${doneTasks} of ${taskItems.length} tasks done`,
    `Wedding day ${describeWeddingDate(answers)}${answers.dateIsExact ? "" : " (date TBC)"}`,
  ].join(" · ");

  function handleToggle(item: PlanItem) {
    if (item.kind === "milestone") {
      toggleTimelineItem(item.id);
      return;
    }
    if (storeTaskIds.has(item.id)) {
      toggleTask(item.id);
      return;
    }
    // Adapter-derived tasks only exist in the store once they're touched —
    // toggleTask can't flip one that was never persisted, so materialise it.
    const seed = defaultTasks.find((t) => t.id === item.id);
    if (seed) addTask({ ...seed, done: !seed.done });
  }

  function handleRemove(item: PlanItem) {
    if (item.kind === "task") removeTask(item.id);
  }

  function handleAdd() {
    if (!newTitle.trim()) return;
    addTask({
      id: `custom-${Date.now()}`,
      title: newTitle.trim(),
      category: "Custom",
      priority: "medium",
      done: false,
    });
    setNewTitle("");
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Timeline &amp; Tasks</h1>
        <p className="text-sm text-gray-500 mt-0.5">{summary}</p>
      </div>

      {/* Add a task */}
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
          today={today}
          onToggle={handleToggle}
          onRemove={handleRemove}
        />
        <Group
          label="Upcoming"
          items={upcoming}
          today={today}
          onToggle={handleToggle}
          onRemove={handleRemove}
        />
        <Group
          label="No date yet"
          items={undated}
          today={today}
          onToggle={handleToggle}
          onRemove={handleRemove}
        />
        <Group
          label={`Done — ${done.length}`}
          items={done}
          today={today}
          onToggle={handleToggle}
          onRemove={handleRemove}
        />

        {visible.length === 0 && (
          <p className="text-sm text-gray-400">Nothing here yet.</p>
        )}
      </div>
    </div>
  );
}
