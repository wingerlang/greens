// Clickable info badge with icon and editable value

import React from "react";

interface InfoBadgeProps {
  icon: string;
  value: string;
  placeholder: string;
  field: string;
  editingField: string | null;
  onEdit: (field: string | null) => void;
  onChange: (field: string, value: string) => void;
  onBlur?: () => void;
}

export function InfoBadge({
  icon,
  value,
  placeholder,
  field,
  editingField,
  onEdit,
  onChange,
  onBlur,
}: InfoBadgeProps) {
  const isEditing = editingField === field;

  if (isEditing) {
    return (
      <div className="bg-slate-800 rounded-lg px-3 py-1.5 flex items-center gap-2">
        <span>{icon}</span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(field, e.target.value)}
          onBlur={() => {
            onEdit(null);
            onBlur?.();
          }}
          onKeyDown={(e) => e.key === "Enter" && onEdit(null)}
          placeholder={placeholder}
          autoFocus
          className="bg-transparent border-b border-emerald-500 outline-none text-white text-sm w-24"
        />
      </div>
    );
  }

  return (
    <div
      onClick={() => onEdit(field)}
      className="bg-slate-800 rounded-lg px-3 py-1.5 flex items-center gap-2 cursor-pointer hover:bg-slate-700 transition-colors"
    >
      <span>{icon}</span>
      <span className={value ? "text-white text-sm" : "text-slate-500 text-sm"}>
        {value || placeholder}
      </span>
    </div>
  );
}
