"use client";

import { useState, useRef, useEffect } from "react";
import { usePlan } from "@/hooks/usePlan";
import { usePlanStore } from "@/lib/plan-store";
import { Panel } from "@/components/ui/Panel";
import { MetricCard } from "@/components/ui/MetricCard";
import type { BudgetCategory } from "@/lib/types";

// ── Editable budget row ───────────────────────────────────────────────────────

function BudgetRow({
  cat,
  startingBudget,
  onUpdate,
}: {
  cat: BudgetCategory;
  startingBudget: number;
  onUpdate: (id: string, amount: number, spent: number) => void;
}) {
  const [editingAmt, setEditingAmt]     = useState(false);
  const [editingPct, setEditingPct]     = useState(false);
  const [editingSpent, setEditingSpent] = useState(false);
  const [showWhy, setShowWhy]           = useState(false);

  const [draftAmt,   setDraftAmt]   = useState(cat.amount.toString());
  const [draftPct,   setDraftPct]   = useState(cat.percentage.toString());
  const [draftSpent, setDraftSpent] = useState(cat.spent.toString());

  const amtRef   = useRef<HTMLInputElement>(null);
  const pctRef   = useRef<HTMLInputElement>(null);
  const spentRef = useRef<HTMLInputElement>(null);

  // Keep drafts in sync when parent updates (e.g. after a different field commits)
  useEffect(() => {
    if (!editingAmt)   setDraftAmt(cat.amount.toString()); // eslint-disable-line react-hooks/set-state-in-effect
  }, [cat.amount, editingAmt]);

  useEffect(() => {
    if (!editingPct)   setDraftPct(cat.percentage.toString()); // eslint-disable-line react-hooks/set-state-in-effect
  }, [cat.percentage, editingPct]);

  useEffect(() => {
    if (!editingSpent) setDraftSpent(cat.spent.toString()); // eslint-disable-line react-hooks/set-state-in-effect
  }, [cat.spent, editingSpent]);

  useEffect(() => { if (editingAmt)   amtRef.current?.select(); },   [editingAmt]);
  useEffect(() => { if (editingPct)   pctRef.current?.select(); },   [editingPct]);
  useEffect(() => { if (editingSpent) spentRef.current?.select(); }, [editingSpent]);

  function commitAmt() {
    const raw = parseFloat(draftAmt.replace(/[$,]/g, ""));
    if (!isNaN(raw) && raw >= 0) {
      onUpdate(cat.id, Math.round(raw), cat.spent);
    } else {
      setDraftAmt(cat.amount.toString());
    }
    setEditingAmt(false);
  }

  function commitPct() {
    const raw = parseFloat(draftPct.replace(/%/g, ""));
    if (!isNaN(raw) && raw >= 0) {
      const amount = Math.round((raw / 100) * startingBudget);
      onUpdate(cat.id, amount, cat.spent);
    } else {
      setDraftPct(cat.percentage.toString());
    }
    setEditingPct(false);
  }

  function commitSpent() {
    const raw = parseFloat(draftSpent.replace(/[$,]/g, ""));
    if (!isNaN(raw) && raw >= 0) {
      onUpdate(cat.id, cat.amount, raw);
    } else {
      setDraftSpent(cat.spent.toString());
    }
    setEditingSpent(false);
  }

  const spentPct = cat.amount > 0 ? Math.min((cat.spent / cat.amount) * 100, 100) : 0;
  const isOver   = cat.spent > cat.amount;

  const hasAdjustments = cat.adjustments && cat.adjustments.length > 0;
  const adjustedBaseline = cat.baselinePercentage + (cat.adjustments ?? []).reduce((s, a) => s + a.delta, 0);

  return (
    <div className="space-y-2">
      {/* Line 1: category name + why? */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-800 flex-1 min-w-0 truncate">{cat.name}</span>
        <button
          onClick={() => setShowWhy((v) => !v)}
          className="text-[10px] text-gray-400 hover:text-[var(--accent)] transition-colors leading-none border border-gray-200 hover:border-[var(--accent)] rounded px-1.5 py-0.5 shrink-0"
          title="Show how this allocation was calculated"
        >
          {showWhy ? "hide" : "how?"}
        </button>
      </div>

      {/* Always-visible description — what this category covers */}
      {cat.description && (
        <p className="text-xs text-gray-500 leading-relaxed -mt-0.5">{cat.description}</p>
      )}

      {/* Line 2: dollar | % | spent (pushed right) */}
      <div className="flex items-center gap-4">
        {/* Dollar amount */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-400">$</span>
          {editingAmt ? (
            <input
              ref={amtRef}
              value={draftAmt}
              onChange={(e) => setDraftAmt(e.target.value)}
              onBlur={commitAmt}
              onKeyDown={(e) => { if (e.key === "Enter") commitAmt(); if (e.key === "Escape") { setEditingAmt(false); setDraftAmt(cat.amount.toString()); } }}
              className="w-20 text-sm text-gray-900 border-b border-[var(--accent)] outline-none bg-transparent"
            />
          ) : (
            <button
              onClick={() => setEditingAmt(true)}
              className="text-sm font-medium text-gray-900 hover:text-[var(--accent)] transition-colors tabular-nums"
              title="Click to edit dollar amount"
            >
              {cat.amount.toLocaleString()}
            </button>
          )}
        </div>

        {/* Percentage */}
        <div className="flex items-center gap-1">
          {editingPct ? (
            <input
              ref={pctRef}
              value={draftPct}
              onChange={(e) => setDraftPct(e.target.value)}
              onBlur={commitPct}
              onKeyDown={(e) => { if (e.key === "Enter") commitPct(); if (e.key === "Escape") { setEditingPct(false); setDraftPct(cat.percentage.toString()); } }}
              className="w-10 text-sm text-gray-500 border-b border-[var(--accent)] outline-none bg-transparent"
            />
          ) : (
            <button
              onClick={() => setEditingPct(true)}
              className="text-sm text-gray-400 hover:text-[var(--accent)] transition-colors tabular-nums"
              title="Click to edit percentage"
            >
              {cat.percentage}%
            </button>
          )}
        </div>

        {/* Spent — pushed right */}
        <div className="flex items-center gap-1 ml-auto">
          <span className="text-xs text-gray-400">spent $</span>
          {editingSpent ? (
            <input
              ref={spentRef}
              value={draftSpent}
              onChange={(e) => setDraftSpent(e.target.value)}
              onBlur={commitSpent}
              onKeyDown={(e) => { if (e.key === "Enter") commitSpent(); if (e.key === "Escape") { setEditingSpent(false); setDraftSpent(cat.spent.toString()); } }}
              className="w-16 text-xs text-gray-700 border-b border-[var(--accent)] outline-none bg-transparent"
            />
          ) : (
            <button
              onClick={() => setEditingSpent(true)}
              className={`text-xs tabular-nums transition-colors hover:text-[var(--accent)] ${isOver ? "text-red-500 font-semibold" : "text-gray-700"}`}
              title="Click to update amount spent"
            >
              {cat.spent.toLocaleString()}
            </button>
          )}
          {isOver && <span className="text-xs text-red-500 font-medium ml-1">over!</span>}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isOver ? "bg-red-400" : "bg-[var(--accent)]"}`}
          style={{ width: `${spentPct}%` }}
        />
      </div>

      {cat.tip && <p className="text-xs text-[var(--accent)]">{cat.tip}</p>}

      {showWhy && (
        <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2.5 text-xs text-gray-600 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Industry default</span>
            <span className="tabular-nums font-medium">{cat.baselinePercentage}%</span>
          </div>
          {(cat.adjustments ?? []).map((adj, i) => (
            <div key={i} className="flex items-center justify-between">
              <span className="text-gray-500">{adj.reason}</span>
              {adj.delta !== 0 && (
                <span className={`tabular-nums font-medium ${adj.delta > 0 ? "text-[var(--accent)]" : "text-blue-500"}`}>
                  {adj.delta > 0 ? "+" : ""}{adj.delta}%
                </span>
              )}
            </div>
          ))}
          {hasAdjustments && (
            <div className="flex items-center justify-between border-t border-gray-200 pt-1 mt-1">
              <span className="text-gray-500">Pre-scaling total</span>
              <span className="tabular-nums font-medium">{adjustedBaseline}%</span>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-gray-200 pt-1 mt-1">
            <span className="text-gray-500">Current allocation</span>
            <span className="tabular-nums font-semibold text-gray-800">
              ${cat.amount.toLocaleString()} ({cat.percentage}% of starting)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Budget page ───────────────────────────────────────────────────────────────

export function Budget() {
  const { answers, budgetCategories } = usePlan();
  const { setBudgetOverride, resetBudgetOverrides, budgetOverrides } = usePlanStore();

  if (!answers) return null;

  const startingBudget = answers.budget;
  const allocated      = budgetCategories.reduce((sum, c) => sum + c.amount, 0);
  const allocationDiff = allocated - startingBudget;
  const totalSpent     = budgetCategories.reduce((sum, c) => sum + c.spent, 0);
  const remaining      = allocated - totalSpent;
  const spentPct       = allocated > 0 ? Math.round((totalSpent / allocated) * 100) : 0;
  const hasOverrides   = Object.keys(budgetOverrides).length > 0;

  function handleUpdate(id: string, amount: number, spent: number) {
    setBudgetOverride(id, { amount, spent });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Budget</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            ${startingBudget.toLocaleString()} starting &middot; click any value to edit
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
        <p className="text-xs text-gray-400 mb-4">
          Percentages set the initial split of your starting budget. After that, edit dollar amounts directly — they don&rsquo;t need to add up to your starting total.
        </p>
        <div className="space-y-5">
          {budgetCategories.map((cat) => (
            <BudgetRow
              key={cat.id}
              cat={cat}
              startingBudget={startingBudget}
              onUpdate={handleUpdate}
            />
          ))}
        </div>
      </Panel>
    </div>
  );
}
