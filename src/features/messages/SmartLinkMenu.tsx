import React from 'react';
import { User, Dumbbell, Calendar, Heart, Award } from 'lucide-react';

interface SmartLinkMenuProps {
    onSelect: (link: string, text: string) => void;
    onClose: () => void;
}

export function SmartLinkMenu({ onSelect, onClose }: SmartLinkMenuProps) {
    const links = [
        { icon: User, label: 'Min Profil', path: '/profile', text: 'Kolla in min profil!' },
        { icon: Dumbbell, label: 'Senaste Pass', path: '/logg', text: 'Här är mitt senaste pass.' },
        { icon: Calendar, label: 'Veckan', path: '/veckan', text: 'Min vecka så här långt.' },
        { icon: Heart, label: 'Hälsa', path: '/health', text: 'Mina hälsodata.' },
        { icon: Award, label: 'PB & Statistik', path: '/statistics', text: 'Mina personbästa.' },
    ];

    return (
        <div className="absolute bottom-16 left-4 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-2 min-w-[200px] z-50 animate-in slide-in-from-bottom-2 fade-in duration-200">
            <div className="text-xs font-bold text-slate-500 uppercase px-3 py-2">Infoga Länk</div>
            <div className="space-y-1">
                {links.map((link) => (
                    <button
                        key={link.path}
                        onClick={() => {
                            onSelect(link.path, link.text);
                            onClose();
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        <link.icon size={16} className="text-emerald-500" />
                        <span>{link.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}
