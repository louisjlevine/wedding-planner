import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary:   "bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-40",
  secondary: "border border-gray-200 text-gray-700 hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50",
  ghost:     "text-gray-500 hover:text-gray-900 hover:bg-gray-50 disabled:opacity-50",
  danger:    "text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 hover:border-red-300 disabled:opacity-50",
};

const SIZES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs rounded-lg",
  md: "px-4 py-2 text-sm rounded-lg",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

// Shared button primitive. Focus rings come from the global `:focus-visible`
// rule in globals.css, so every button gets consistent keyboard focus without
// each caller re-declaring it.
export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 font-medium transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: ReactNode;
}

// Icon-only button. `label` is required and applied as both the accessible name
// and the hover tooltip, so icon buttons can never ship without a name. The
// min-w/min-h keeps the tap target at the 44px accessibility floor.
export function IconButton({ label, className = "", children, ...rest }: IconButtonProps) {
  return (
    <button
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
