type BadgeVariant = "pink" | "green" | "yellow" | "gray" | "red" | "blue";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
}

const styles: Record<BadgeVariant, string> = {
  pink: "bg-[var(--accent)]/10 text-[var(--accent)]",
  green: "bg-green-50 text-green-700",
  yellow: "bg-yellow-50 text-yellow-700",
  gray: "bg-gray-100 text-gray-600",
  red: "bg-red-50 text-red-700",
  blue: "bg-blue-50 text-blue-700",
};

export function Badge({ children, variant = "gray" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${styles[variant]}`}
    >
      {children}
    </span>
  );
}
