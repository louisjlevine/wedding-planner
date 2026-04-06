interface BudgetBarProps {
  label: string;
  amount: number;
  spent: number;
  percentage: number;
  tip?: string;
}

export function BudgetBar({ label, amount, spent, percentage, tip }: BudgetBarProps) {
  const spentPct = amount > 0 ? Math.min((spent / amount) * 100, 100) : 0;
  const isOver = spent > amount;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="text-gray-500">
          ${spent.toLocaleString()} / ${amount.toLocaleString()}
          <span className="text-gray-400 ml-1">({percentage}%)</span>
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            isOver ? "bg-red-500" : "bg-[#D4537E]"
          }`}
          style={{ width: `${spentPct}%` }}
        />
      </div>
      {tip && (
        <p className="text-xs text-[#D4537E]">{tip}</p>
      )}
    </div>
  );
}
