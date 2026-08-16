"use client";

import { usePlanStore } from "@/lib/plan-store";
import { buildBudgetCategories, buildInitialTasks, mergePlanTasks } from "@/lib/plan-adapters";
import type { BudgetCategory } from "@/lib/types";

export function usePlan() {
  const store = usePlanStore();

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
  // The whole plan in one list. Adapter-derived tasks only land in the store
  // once touched, so `store.tasks` alone is never the full picture — anything
  // counting or listing plan items should read `allTasks`. Deleted items are
  // filtered out on both sides, seeds included.
  const allTasks = mergePlanTasks(store.tasks, defaultTasks, store.removedTaskIds);

  return {
    ...store,
    budgetCategories,
    baseBudgetCategories,
    defaultTasks,
    allTasks,
  };
}
