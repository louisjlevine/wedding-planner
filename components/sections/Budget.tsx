"use client";

import { useState } from "react";
import { usePlan } from "@/hooks/usePlan";
import { usePlanStore } from "@/lib/plan-store";
import { Panel } from "@/components/ui/Panel";
import { MetricCard } from "@/components/ui/MetricCard";
import { EditableMoneyCell, EditableNumberCell } from "@/components/ui/EditableMoneyCell";
import type { BudgetCategory } from "@/lib/types";

// One table row per category. All numeric cells share the same spinner-free
// editable-input plumbing as the Compare page, with currency formatting.
function BudgetTableRow({
  cat,
  estimate,
  startingBudget,
  onUpdate,
  onRemove,
}: {
  cat: BudgetCategory;
  estimate: number | null;
  startingBudget: number;
  onUpdate: (id: string, amount: number, spent: number) => void;
  onRemove?: (id: string, name: string) => void;
}) {
  const isOver = cat.spent > cat.amount;

  function commitAmount(next: number | undefined) {
    const amount = next === undefined ? 0 : Math.max(0, Math.round(next));
    onUpdate(cat.id, amount, cat.spent);
  }

  function commitPct(next: number | undefined) {
    if (next === undefined) return;
    const amount = Math.max(0, Math.round((next / 100) * startingBudget));
    onUpdate(cat.id, amount, cat.spent);
  }

  function commitSpent(next: number | undefined) {
    const spent = next === undefined ? 0 : Math.max(0, Math.round(next));
    onUpdate(cat.id, cat.amount, spent);
  }

  return (
    <tr className="border-t border-gray-100 align-top">
      <td className="sticky left-0 z-10 bg-white border-r border-gray-200 px-3 py-3 text-sm font-medium text-gray-800 whitespace-nowrap">
        {cat.name}
        {cat.isCustom && (
          <span className="ml-2 text-[10px] font-normal uppercase tracking-wide text-gray-400">added</span>
        )}
      </td>
      <td className="px-3 py-3 text-right text-sm text-gray-500 tabular-nums whitespace-nowrap">
        {estimate === null ? "—" : `$${estimate.toLocaleString()}`}
      </td>
      <td className="px-3 py-2 text-right">
        <EditableMoneyCell
          value={cat.amount}
          onCommit={commitAmount}
          ariaLabel={`${cat.name} revised estimate`}
          className="text-sm"
        />
      </td>
      <td className="px-3 py-2 text-right">
        <EditableNumberCell
          value={cat.percentage}
          onCommit={commitPct}
          ariaLabel={`${cat.name} revised percentage`}
          suffix="%"
          className="text-sm"
        />
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex flex-col items-end gap-1">
          <EditableMoneyCell
            value={cat.spent}
            onCommit={commitSpent}
            ariaLabel={`${cat.name} spent`}
            className={`text-sm ${isOver ? "text-red-600 font-semibold" : ""}`}
            fadeEmpty
          />
          {isOver && <span className="text-[10px] text-red-500 font-medium">over budget</span>}
        </div>
      </td>
      <td className="px-3 py-3 text-xs text-gray-500 leading-relaxed min-w-[260px]">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {cat.description ?? ""}
            {cat.tip && <span className="block text-[var(--accent)] mt-1">{cat.tip}</span>}
          </div>
          {cat.isCustom && onRemove && (
            <button
              type="button"
              onClick={() => onRemove(cat.id, cat.name)}
              className="shrink-0 text-gray-300 hover:text-red-400 transition-colors p-1 -m-1"
              aria-label={`Remove ${cat.name} line item`}
              title="Remove line item"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M1 1l10 10M11 1L1 11" />
              </svg>
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

export function Budget() {
  const { answers, budgetCategories, baseBudgetCategories } = usePlan();
  const {
    setBudgetOverride,
    resetBudgetOverrides,
    budgetOverrides,
    customBudgetCategories,
    addCustomBudgetCategory,
    updateCustomBudgetCategory,
    removeCustomBudgetCategory,
  } = usePlanStore();
  const [draftName, setDraftName] = useState("");

  const customIds = new Set(customBudgetCategories.map((c) => c.id));

  if (!answers) return null;

  const startingBudget = answers.budget;
  const allocated      = budgetCategories.reduce((sum, c) => sum + c.amount, 0);
  const allocationDiff = allocated - startingBudget;
  const totalSpent     = budgetCategories.reduce((sum, c) => sum + c.spent, 0);
  const remaining      = allocated - totalSpent;
  const spentPct       = allocated > 0 ? Math.round((totalSpent / allocated) * 100) : 0;
  const hasOverrides   = Object.keys(budgetOverrides).length > 0;

  // Map original (pre-override) amounts by id so the Estimate column can show
  // them next to the Revised Estimate.
  const estimateById = new Map(baseBudgetCategories.map((c) => [c.id, c.amount]));

  function handleUpdate(id: string, amount: number, spent: number) {
    // Custom lines own their numbers directly — routing them through
    // budgetOverrides would let "Reset to defaults" silently zero them out.
    if (customIds.has(id)) {
      updateCustomBudgetCategory(id, { amount, spent });
      return;
    }
    setBudgetOverride(id, { amount, spent });
  }

  function handleAddLineItem() {
    const trimmed = draftName.trim();
    if (!trimmed) return;
    addCustomBudgetCategory(trimmed);
    setDraftName("");
  }

  function handleRemoveLineItem(id: string, name: string) {
    const confirmed = window.confirm(
      `Remove "${name}" from the budget?\n\nIts allocation and spend will be deleted. There's no undo.`,
    );
    if (!confirmed) return;
    removeCustomBudgetCategory(id);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Budget</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            ${startingBudget.toLocaleString()} starting &middot; click any cell to edit
          </p>
        </div>
        {hasOverrides && (
          <button
            onClick={resetBudgetOverrides}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors mt-1"
          >
            Reset to defaults
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          label="Current allocation"
          value={`$${allocated.toLocaleString()}`}
          sub={
            allocationDiff === 0
              ? `matches starting $${startingBudget.toLocaleString()}`
              : `${allocationDiff > 0 ? "+" : "−"}$${Math.abs(allocationDiff).toLocaleString()} vs starting $${startingBudget.toLocaleString()}`
          }
        />
        <MetricCard
          label="Spent so far"
          value={`$${totalSpent.toLocaleString()}`}
          sub={`${spentPct}% of allocation`}
        />
        <MetricCard
          label="Remaining"
          value={`$${remaining.toLocaleString()}`}
          sub={remaining < 0 ? "Over budget!" : "available"}
        />
      </div>

      {allocationDiff !== 0 && (
        <div
          className={`text-xs rounded-lg px-3 py-2 border ${
            allocationDiff > 0
              ? "text-amber-700 bg-amber-50 border-amber-200"
              : "text-blue-700 bg-blue-50 border-blue-200"
          }`}
        >
          {allocationDiff > 0
            ? `Allocations total $${allocated.toLocaleString()} — $${allocationDiff.toLocaleString()} over your starting $${startingBudget.toLocaleString()}.`
            : `Allocations total $${allocated.toLocaleString()} — $${Math.abs(allocationDiff).toLocaleString()} under your starting $${startingBudget.toLocaleString()}.`}
        </div>
      )}

      <Panel title="Budget breakdown">
        {/* The border + rounding live on the scroll container, not the table.
            `overflow-hidden` on the <table> would make the table itself the
            sticky scrollport, which silently kills the frozen first column. */}
        <div className="overflow-x-auto border border-gray-200 rounded-xl">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="sticky left-0 z-20 bg-gray-50 border-r border-gray-200 px-3 py-2 font-medium text-gray-500 whitespace-nowrap">Type</th>
                <th className="px-3 py-2 font-medium text-gray-500 text-right whitespace-nowrap">Estimate</th>
                <th className="px-3 py-2 font-medium text-gray-500 text-right whitespace-nowrap">Revised Estimate</th>
                <th className="px-3 py-2 font-medium text-gray-500 text-right whitespace-nowrap">Revised %</th>
                <th className="px-3 py-2 font-medium text-gray-500 text-right whitespace-nowrap">Spent</th>
                {/* Floor the width so the prose column can't be squeezed to a
                    sliver on narrow screens — it scrolls into view instead. */}
                <th className="px-3 py-2 font-medium text-gray-500 whitespace-nowrap min-w-[260px]">Explanation</th>
              </tr>
            </thead>
            <tbody>
              {budgetCategories.map((cat) => (
                <BudgetTableRow
                  key={cat.id}
                  cat={cat}
                  estimate={cat.isCustom ? null : estimateById.get(cat.id) ?? cat.amount}
                  startingBudget={startingBudget}
                  onUpdate={handleUpdate}
                  onRemove={handleRemoveLineItem}
                />
              ))}
              <tr className="border-t-2 border-gray-300 bg-[var(--accent)]/5">
                <td className="sticky left-0 z-10 bg-[var(--accent-wash)] border-r border-gray-200 px-3 py-2.5 font-semibold text-gray-900">Total</td>
                <td className="px-3 py-2.5 text-right font-semibold text-gray-900 tabular-nums">
                  ${baseBudgetCategories.reduce((s, c) => s + c.amount, 0).toLocaleString()}
                </td>
                <td className="px-3 py-2.5 text-right font-semibold text-gray-900 tabular-nums">
                  ${allocated.toLocaleString()}
                </td>
                <td className="px-3 py-2.5 text-right text-gray-500 tabular-nums">
                  {startingBudget > 0
                    ? `${Math.round((allocated / startingBudget) * 1000) / 10}%`
                    : "—"}
                </td>
                <td className="px-3 py-2.5 text-right font-semibold text-gray-900 tabular-nums">
                  ${totalSpent.toLocaleString()}
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && draftName.trim()) {
                  e.preventDefault();
                  handleAddLineItem();
                }
              }}
              placeholder="New line item (e.g. rehearsal dinner, welcome bags)"
              aria-label="New budget line item name"
              className="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
            />
            <button
              type="button"
              onClick={handleAddLineItem}
              disabled={!draftName.trim()}
              className="shrink-0 px-4 py-2 text-xs font-medium rounded-lg bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-40 disabled:hover:opacity-40 transition-opacity"
            >
              Add line item
            </button>
          </div>
          <p className="text-[11px] text-gray-400 mt-2">
            Added lines have no industry estimate — set the amount yourself. They count toward your
            allocation and spend totals.
          </p>
        </div>
      </Panel>
    </div>
  );
}
