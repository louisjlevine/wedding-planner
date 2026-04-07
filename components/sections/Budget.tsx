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
  totalBudget,
  onUpdate,
}: {
  cat: BudgetCategory;
  totalBudget: number;
  onUpdate: (id: string, pct: number, spent: number) => void;
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
    if (!editingAmt)   setDraftAmt(cat.amount.toString());
  }, [cat.amount, editingAmt]);

  useEffect(() => {
    if (!editingPct)   setDraftPct(cat.percentage.toString());
  }, [cat.percentage, editingPct]);

  useEffect(() => {
    if (!editingSpent) setDraftSpent(cat.spent.toString());
  }, [cat.spent, editingSpent]);

  useEffect(() => { if (editingAmt)   amtRef.current?.select(); },   [editingAmt]);
  useEffect(() => { if (editingPct)   pctRef.current?.select(); },   [editingPct]);
  useEffect(() => { if (editingSpent) spentRef.current?.select(); }, [editingSpent]);

  function commitAmt() {
    const raw = parseFloat(draftAmt.replace(/[$,]/g, ""));
    if (!isNaN(raw) && raw >= 0) {
      const newPct = Math.round((raw / totalBudget) * 1000) / 10;
      onUpdate(cat.id, newPct, cat.spent);
    } else {
      setDraftAmt(cat.amount.toString());
    }
    setEditingAmt(false);
  }

  function commitPct() {
    const raw = parseFloat(draftPct.replace(/%/g, ""));
    if (!isNaN(raw) && raw >= 0 && raw <= 100) {
      onUpdate(cat.id, raw, cat.spent);
    } else {
      setDraftPct(cat.percentage.toString());
    }
    setEditingPct(false);
  }

  function commitSpent() {
    const raw = parseFloat(draftSpent.replace(/[$,]/g, ""));
    if (!isNaN(raw) && raw >= 0) {
      onUpdate(cat.id, cat.percentage, raw);
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
      <div className="flex items-center gap-3">
        {/* Name + Why? toggle */}
        <div className="flex items-center gap-1 w-40 shrink-0">
          <span className="text-sm font-medium text-gray-700">{cat.name}</span>
          <button
            onClick={() => setShowWhy((v) => !v)}
            className="text-[10px] text-gray-400 hover:text-[#D4537E] transition-colors leading-none border border-gray-200 hover:border-[#D4537E] rounded px-1 py-0.5"
            title="Show how this allocation was calculated"
          >
            {showWhy ? "hide" : "why?"}
          </button>
        </div>

        {/* Dollar amount */}
        <div className="flex items-center gap-1 min-w-[90px]">
          <span className="text-xs text-gray-400">$</span>
          {editingAmt ? (
            <input
              ref={amtRef}
              value={draftAmt}
              onChange={(e) => setDraftAmt(e.target.value)}
              onBlur={commitAmt}
              onKeyDown={(e) => { if (e.key === "Enter") commitAmt(); if (e.key === "Escape") { setEditingAmt(false); setDraftAmt(cat.amount.toString()); } }}
              className="w-24 text-sm text-gray-900 border-b border-[#D4537E] outline-none bg-transparent"
            />
          ) : (
            <button
              onClick={() => setEditingAmt(true)}
              className="text-sm text-gray-900 hover:text-[#D4537E] transition-colors tabular-nums"
              title="Click to edit dollar amount"
            >
              {cat.amount.toLocaleString()}
            </button>
          )}
        </div>

        {/* Percentage */}
        <div className="flex items-center gap-1 min-w-[58px]">
          {editingPct ? (
            <input
              ref={pctRef}
              value={draftPct}
              onChange={(e) => setDraftPct(e.target.value)}
              onBlur={commitPct}
              onKeyDown={(e) => { if (e.key === "Enter") commitPct(); if (e.key === "Escape") { setEditingPct(false); setDraftPct(cat.percentage.toString()); } }}
              className="w-12 text-sm text-gray-500 border-b border-[#D4537E] outline-none bg-transparent"
            />
          ) : (
            <button
              onClick={() => setEditingPct(true)}
              className="text-sm text-gray-400 hover:text-[#D4537E] transition-colors tabular-nums"
              title="Click to edit percentage"
            >
              {cat.percentage}%
            </button>
          )}
        </div>

        {/* Spent */}
        <div className="flex items-center gap-1 ml-auto">
          <span className="text-xs text-gray-400">spent</span>
          <span className="text-xs text-gray-400">$</span>
          {editingSpent ? (
            <input
              ref={spentRef}
              value={draftSpent}
              onChange={(e) => setDraftSpent(e.target.value)}
              onBlur={commitSpent}
              onKeyDown={(e) => { if (e.key === "Enter") commitSpent(); if (e.key === "Escape") { setEditingSpent(false); setDraftSpent(cat.spent.toString()); } }}
              className="w-20 text-xs text-gray-700 border-b border-[#D4537E] outline-none bg-transparent"
            />
          ) : (
            <button
              onClick={() => setEditingSpent(true)}
              className={`text-xs tabular-nums transition-colors hover:text-[#D4537E] ${isOver ? "text-red-500 font-semibold" : "text-gray-700"}`}
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
          className={`h-full rounded-full transition-all ${isOver ? "bg-red-400" : "bg-[#D4537E]"}`}
          style={{ width: `${spentPct}%` }}
        />
      </div>

      {cat.tip && <p className="text-xs text-[#D4537E]">{cat.tip}</p>}

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
                <span className={`tabular-nums font-medium ${adj.delta > 0 ? "text-[#D4537E]" : "text-blue-500"}`}>
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
            <span className="text-gray-500">Final allocation (scaled to 100%)</span>
            <span className="tabular-nums font-semibold text-gray-800">{cat.percentage}%</span>
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

  const totalSpent   = budgetCategories.reduce((sum, c) => sum + c.spent, 0);
  const remaining    = answers.budget - totalSpent;
  const spentPct     = Math.round((totalSpent / answers.budget) * 100);
  const allocatedPct = Math.round(budgetCategories.reduce((sum, c) => sum + c.percentage, 0));
  const hasOverrides = Object.keys(budgetOverrides).length > 0;

  function handleUpdate(id: string, pct: number, spent: number) {
    setBudgetOverride(id, { percentage: pct, spent });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Budget</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            ${answers.budget.toLocaleString()} total &middot; click any amount or % to edit &middot; track spend per category
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

      <div className="grid grid-cols-3 gap-4">
        <MetricCard label="Total budget" value={`$${answers.budget.toLocaleString()}`} />
        <MetricCard
          label="Spent so far"
          value={`$${totalSpent.toLocaleString()}`}
          sub={`${spentPct}% of total`}
        />
        <MetricCard
          label="Remaining"
          value={`$${remaining.toLocaleString()}`}
          sub={remaining < 0 ? "Over budget!" : "available"}
        />
      </div>

      {allocatedPct !== 100 && (
        <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Allocations total {allocatedPct}% — adjust percentages to reach 100%
        </div>
      )}

      <Panel title="Budget breakdown">
        <p className="text-xs text-gray-400 mb-4">
          Click a dollar amount to set allocation by $, click a % to set by percentage. Click "spent" to track actuals.
        </p>
        <div className="space-y-5">
          {budgetCategories.map((cat) => (
            <BudgetRow
              key={cat.id}
              cat={cat}
              totalBudget={answers.budget}
              onUpdate={handleUpdate}
            />
          ))}
        </div>
      </Panel>
    </div>
  );
}
