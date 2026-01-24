// Quick action button or link

import React from "react";

interface QuickActionProps {
  icon: string;
  label: string;
  href?: string;
  onClick?: () => void;
  className?: string;
}

export function QuickAction(
  { icon, label, href, onClick, className = "" }: QuickActionProps,
) {
  const baseClass =
    `flex flex-col items-center gap-1 p-3 bg-slate-800/50 rounded-xl hover:bg-slate-700/50 transition-colors cursor-pointer ${className}`;

  if (href) {
    return (
      <a href={href} className={baseClass}>
        <span className="text-xl">{icon}</span>
        <span className="text-xs text-slate-400">{label}</span>
      </a>
    );
  }

  return (
    <button onClick={onClick} className={baseClass}>
      <span className="text-xl">{icon}</span>
      <span className="text-xs text-slate-400">{label}</span>
    </button>
  );
}
