"use client";

import { usePlanStore } from "@/lib/plan-store";
import { buildTimeline, buildBudgetCategories, buildInitialTasks } from "@/lib/plan-adapters";

export function usePlan() {
  const store = usePlanStore();

  const timeline = store.answers ? buildTimeline(store.answers) : [];

  const budgetCategories = store.answers
    ? buildBudgetCategories(store.answers).map((cat) => {
        const override = store.budgetOverrides[cat.id];
        if (!override) return cat;
        const pct = override.percentage;
        return {
          ...cat,
          percentage: pct,
          amount: Math.round((pct / 100) * store.answers!.budget),
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
