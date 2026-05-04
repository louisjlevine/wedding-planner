"use client";

import { usePlanStore } from "@/lib/plan-store";
import { buildTimeline, buildBudgetCategories, buildInitialTasks } from "@/lib/plan-adapters";

export function usePlan() {
  const store = usePlanStore();

  const doneSet = new Set(store.timelineDoneIds);
  const timeline = store.answers
    ? buildTimeline(store.answers).map((item) =>
        doneSet.has(item.id) ? { ...item, done: true } : item
      )
    : [];

  const startingBudget = store.answers?.budget ?? 0;
  const budgetCategories = store.answers
    ? buildBudgetCategories(store.answers).map((cat) => {
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
      })
    : [];

  const defaultTasks = store.answers ? buildInitialTasks(store.answers) : [];

  return {
    ...store,
    timeline,
    budgetCategories,
    defaultTasks,
  };
}
