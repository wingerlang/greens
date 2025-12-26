import React, { useState, useEffect } from 'react';
import { useSettings } from '../../context/SettingsContext.tsx';

interface CollapsibleSectionProps {
    id: string; // Unique ID for persistence
    title: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
    icon?: React.ReactNode;
    rightElement?: React.ReactNode;
    className?: string;
}

export function CollapsibleSection({ id, title, children, defaultOpen = true, icon, rightElement, className = '' }: CollapsibleSectionProps) {
    const { settings, updateSettings } = useSettings();
    const [isOpen, setIsOpen] = useState(defaultOpen);

    // Sync with settings on mount
    useEffect(() => {
        if (settings.expandedSections && settings.expandedSections[id] !== undefined) {
            setIsOpen(settings.expandedSections[id]);
        }
    }, [id]); // Only run on mount or id change, relying on local state afterwards to avoid jitter

    const toggle = () => {
        const newState = !isOpen;
        setIsOpen(newState);

        // Persist
        updateSettings({
            expandedSections: {
                ...settings.expandedSections,
                [id]: newState
            }
        });
    };

    return (
        <section className={`bg-slate-900/20 border border-white/5 rounded-3xl overflow-hidden transition-all duration-300 ${className}`}>
            <div
                onClick={toggle}
                className="p-5 flex items-center justify-between cursor-pointer group hover:bg-white/5 transition-colors select-none"
            >
                <div className="flex items-center gap-3">
                    <div className={`transition-transform duration-300 ${isOpen ? 'rotate-90' : 'rotate-0'}`}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500 group-hover:text-white">
                            <path d="M9 18l6-6-6-6" />
                        </svg>
                    </div>
                    {icon && <div className="text-xl">{icon}</div>}
                    <h2 className="text-sm font-black text-white uppercase tracking-wider group-hover:text-sky-400 transition-colors">
                        {title}
                    </h2>
                </div>
                <div className="flex items-center gap-4">
                    {rightElement && <div onClick={e => e.stopPropagation()}>{rightElement}</div>}
                    <span className="text-[10px] text-slate-600 font-bold uppercase opacity-0 group-hover:opacity-100 transition-opacity">
                        {isOpen ? 'Dölj' : 'Visa'}
                    </span>
                </div>
            </div>

            <div
                className={`transition-all duration-500 ease-in-out overflow-hidden ${isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}
            >
                <div className="p-5 pt-0">
                    {children}
                </div>
            </div>
        </section>
    );
}
