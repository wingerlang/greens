// Stat display badge (value + label)

import React from 'react';

interface StatBadgeProps {
    value: string | number;
    label: string;
    className?: string;
}

export function StatBadge({ value, label, className = '' }: StatBadgeProps) {
    return (
        <div className={`text-center ${className}`}>
            <div className="text-2xl font-black text-white">{value}</div>
            <div className="text-xs text-slate-500">{label}</div>
        </div>
    );
}
