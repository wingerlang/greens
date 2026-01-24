// Privacy toggle switch row

import React from "react";

interface PrivacyToggleProps {
  label: string;
  desc?: string;
  active: boolean;
  onToggle: () => void;
  className?: string;
}

export function PrivacyToggle(
  { label, desc, active, onToggle, className = "" }: PrivacyToggleProps,
) {
  return (
    <div
      className={`bg-slate-800/50 rounded-xl p-3 flex items-center justify-between cursor-pointer hover:bg-slate-800 transition-colors ${className}`}
      onClick={onToggle}
    >
      <div>
        <span className="text-white text-sm font-medium">{label}</span>
        {desc && <p className="text-slate-500 text-xs">{desc}</p>}
      </div>
      <div
        className={`w-10 h-6 rounded-full relative transition-colors ${
          active ? "bg-emerald-500" : "bg-slate-700"
        }`}
      >
        <div
          className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
            active ? "right-1" : "left-1"
          }`}
        />
      </div>
    </div>
  );
}
