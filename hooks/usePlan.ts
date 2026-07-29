"use client";

import { usePlanStore } from "@/lib/plan-store";
import { buildTimeline, buildBudgetCategories, buildInitialTasks } from "@/lib/plan-adapters";
import type { BudgetCategory } from "@/lib/types";

export function usePlan() {
  const store = usePlanStore();

  const doneSet = new Set(store.timelineDoneIds);
  const timeline = store.answers
    ? buildTimeline(store.answers).map((item) =>
        doneSet.has(item.id) ? { ...item, done: true } : item
      )
    : [];

  const startingBudget = store.answers?.budget ?? 0;
  // The "estimate" view — what the adapter would suggest with zero user
  // overrides. Exposed alongside the revised view so the Budget page can
  // show "Estimate vs. Revised Estimate" side-by-side.
  const baseBudgetCategories = store.answers
    ? buildBudgetCategories(store.answers)
    : [];
  // User-added lines have no adapter estimate, so they're appended to the
  // revised view only — the Estimate column and its total stay adapter-derived.
  const customCategories: BudgetCategory[] = store.customBudgetCategories.map((c) => ({
    id: c.id,
    name: c.name,
    amount: Math.max(0, Math.round(c.amount)),
    spent: Math.max(0, Math.round(c.spent)),
    percentage:
      startingBudget > 0
        ? Math.round((Math.max(0, c.amount) / startingBudget) * 1000) / 10
        : 0,
    description: c.description,
    baselinePercentage: 0,
    adjustments: [],
    isCustom: true,
  }));

  const adaptedCategories = baseBudgetCategories.map((cat) => {
    const override = store.budgetOverrides[cat.id];
    if (!override) return cat;
    const amount = Math.max(0, Math.round(override.amount));
    const percentage =
      startingBudget > 0
        ? Math.round((amount / startingBudget) * 1000) / 10
        : 0;
    return {
      ...cat,
      amount,
      percentage,
      spent: override.spent,
    };
  });

  const budgetCategories = [...adaptedCategories, ...customCategories];

  const defaultTasks = store.answers ? buildInitialTasks(store.answers) : [];

  return {
    ...store,
    timeline,
    budgetCategories,
    baseBudgetCategories,
    defaultTasks,
  };
}
