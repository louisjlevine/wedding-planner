type BadgeVariant = "pink" | "green" | "yellow" | "gray" | "red" | "blue";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
}

const styles: Record<BadgeVariant, string> = {
  pink: "bg-pink-50 text-[#D4537E] border-pink-200",
  green: "bg-green-50 text-green-700 border-green-200",
  yellow: "bg-yellow-50 text-yellow-700 border-yellow-200",
  gray: "bg-gray-50 text-gray-600 border-gray-200",
  red: "bg-red-50 text-red-700 border-red-200",
  blue: "bg-blue-50 text-blue-700 border-blue-200",
};

export function Badge({ children, variant = "gray" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${styles[variant]}`}
    >
      {children}
    </span>
  );
}
