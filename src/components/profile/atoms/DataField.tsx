// Data field with label, input, and optional suffix
// Supports text, number, date, and select types

import React from "react";

interface DataFieldProps {
  label: string;
  value: string;
  type?: "text" | "number" | "date" | "select";
  suffix?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
  onChange?: (value: string) => void;
  readonly?: boolean;
}

export function DataField({
  label,
  value,
  type = "text",
  suffix,
  placeholder,
  options,
  onChange,
  readonly,
}: DataFieldProps) {
  const baseInputClass =
    "w-full bg-slate-900/50 rounded-lg p-2 text-white border border-white/5 focus:border-emerald-500 outline-none text-sm";

  return (
    <div className="bg-slate-800/50 rounded-xl p-3">
      <label className="text-xs text-slate-500 uppercase font-bold mb-1 block">
        {label}
      </label>
      <div className="flex items-center gap-2">
        {type === "select" && options
          ? (
            <select
              value={value}
              onChange={(e) => onChange?.(e.target.value)}
              disabled={readonly}
              className={baseInputClass}
            >
              {options.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          )
          : (
            <input
              type={type}
              value={value}
              placeholder={placeholder}
              onChange={(e) => onChange?.(e.target.value)}
              readOnly={readonly}
              className={baseInputClass}
            />
          )}
        {suffix && <span className="text-slate-500 text-sm">{suffix}</span>}
      </div>
    </div>
  );
}
