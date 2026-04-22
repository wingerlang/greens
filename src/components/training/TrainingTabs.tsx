import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface TrainingTabsProps {
    currentTab?: string;
}

export function TrainingTabs({ currentTab: propTab }: TrainingTabsProps) {
    const navigate = useNavigate();
    const location = useLocation();

    // Detect current tab from path if not provided
    const getActiveTab = () => {
        if (propTab) return propTab;
        const path = location.pathname;
        if (path === '/review' || path === '/summary' || path.includes('/training/analys')) return 'analys';
        if (path.includes('/planera/traning')) return 'planera';

        // For /training/:tab
        const parts = path.split('/');
        if (parts[1] === 'training' || parts[1] === 'träning' || parts[1] === 'traning') {
            return parts[2] || 'kalender';
        }
        return '';
    };

    const currentTab = getActiveTab();

    const tabs = [
        { id: 'kalender', label: '📅 Kalender', path: '/träning/kalender', color: 'emerald' },
        { id: 'planera', label: '🗓️ Planera', path: '/planera/traning', color: 'emerald' },
        { id: 'logg', label: '📜 Aktiviteter', path: '/logg', color: 'emerald' },
        { id: 'analytics', label: '📊 Dashboard', path: '/training/analytics', color: 'emerald' },
        { id: 'races', label: '🏆 Tävlingar', path: '/training/races', color: 'amber' },
        { id: 'lopstatistik', label: '⏱️ Rekord', path: '/training/lopstatistik', color: 'indigo' },
        { id: 'analys', label: '🔍 Analys', path: '/training/analys', color: 'indigo' },
        { id: 'form', label: '📈 Aktuell Form', path: '/training/form', color: 'emerald' },
    ];

    const getColorClasses = (color: string, active: boolean) => {
        if (!active) return 'text-slate-500 hover:text-slate-300';

        switch (color) {
            case 'sky': return 'bg-sky-500 text-white shadow-lg shadow-sky-500/25';
            case 'amber': return 'bg-amber-500 text-white shadow-lg shadow-amber-500/25';
            case 'indigo': return 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25';
            case 'emerald':
            default: return 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25';
        }
    };

    return (
        <div className="flex p-1 bg-slate-900 border border-white/5 rounded-sm mb-2 overflow-x-auto no-scrollbar">
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    onClick={() => navigate(tab.path)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${getColorClasses(tab.color, currentTab === tab.id)}`}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    );
}
