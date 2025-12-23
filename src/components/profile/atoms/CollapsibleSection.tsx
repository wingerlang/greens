// Collapsible section wrapper with expand/collapse functionality

import React, { useState } from 'react';

interface CollapsibleSectionProps {
    id: string;
    title: string;
    icon: string;
    defaultOpen?: boolean;
    children: React.ReactNode;
}

export function CollapsibleSection({
    id,
    title,
    icon,
    defaultOpen = true,
    children
}: CollapsibleSectionProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    const toggle = () => setIsOpen(prev => !prev);

    return (
        <section id={id} className="bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-white/5 overflow-hidden">
            <button
                onClick={toggle}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <span className="text-xl">{icon}</span>
                    <span className="text-white font-bold">{title}</span>
                </div>
                <span className={`text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
            </button>
            {isOpen && (
                <div className="p-4 pt-0 border-t border-white/5">
                    {children}
                </div>
            )}
        </section>
    );
}
