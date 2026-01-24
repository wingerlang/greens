import React from "react";
import { Check } from "lucide-react";

interface DashboardCardWrapperProps {
  id: string;
  isDone: boolean;
  onToggle: (id: string, e: React.MouseEvent) => void;
  children: React.ReactNode;
  className?: string;
}

export const DashboardCardWrapper = ({
  id,
  isDone,
  onToggle,
  children,
  className = "",
}: DashboardCardWrapperProps) => {
  // Visual state: "Done" = slightly transparent, checkmark badge, grayscale
  const opacityClass = isDone
    ? "opacity-60 grayscale-[0.8] hover:opacity-100 hover:grayscale-0 transition-all duration-500"
    : "";

  return (
    <div className={`${className} ${opacityClass} relative group/card`}>
      {/* Manual Completion Toggle */}
      <button
        onClick={(e) => onToggle(id, e)}
        className={`absolute -top-3 -right-3 z-30 p-2 rounded-full shadow-lg transition-all transform hover:scale-110 ${
          isDone
            ? "bg-emerald-500 text-white"
            : "bg-slate-200 dark:bg-slate-800 text-slate-400 opacity-0 group-hover/card:opacity-100"
        }`}
        title={isDone ? "Markera som ej klar" : "Markera som klar"}
      >
        <Check size={14} strokeWidth={3} />
      </button>

      {children}
    </div>
  );
};
