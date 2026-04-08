interface MetricCardProps {
  label: string;
  value: string | number;
  sub?: string;
}

export function MetricCard({ label, value, sub }: MetricCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 hover:-translate-y-1 transition-transform duration-200">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
        {label}
      </p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-sm text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}
