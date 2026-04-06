import { ReactNode } from "react";

interface PanelProps {
  title?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}

export function Panel({ title, children, className = "", action }: PanelProps) {
  return (
    <div className={`bg-white border border-gray-200 rounded-xl ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          {title && (
            <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
          )}
          {action && <div>{action}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}
