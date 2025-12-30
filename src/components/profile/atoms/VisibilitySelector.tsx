import React from 'react';
import { VisibilityLevel } from '../../../models/types.ts';

interface VisibilitySelectorProps {
    label: string;
    value: VisibilityLevel;
    onChange: (value: VisibilityLevel) => void;
    icon?: string;
}

export function VisibilitySelector({ label, value, onChange, icon }: VisibilitySelectorProps) {
    const options: { level: VisibilityLevel; label: string; icon: string; color: string }[] = [
        { level: 'PUBLIC', label: 'Publik', icon: '🌐', color: 'text-emerald-400' },
        { level: 'FRIENDS', label: 'Vänner', icon: '👥', color: 'text-blue-400' },
        { level: 'PRIVATE', label: 'Privat', icon: '🔒', color: 'text-slate-400' }
    ];

    return (
        <div className="bg-slate-800/50 rounded-xl p-3 flex flex-col gap-2">
            <div className="flex items-center gap-2">
                {icon && <span className="text-lg">{icon}</span>}
                <span className="text-white text-sm font-medium">{label}</span>
            </div>
            <div className="flex gap-1 p-1 bg-slate-900/50 rounded-lg">
                {options.map((opt) => (
                    <button
                        key={opt.level}
                        onClick={() => onChange(opt.level)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${value === opt.level
                                ? 'bg-slate-700 text-white shadow-lg'
                                : 'text-slate-500 hover:text-slate-400'
                            }`}
                    >
                        <span>{opt.icon}</span>
                        {opt.label}
                    </button>
                ))}
            </div>
        </div>
    );
}
