import React, { useState } from 'react';
import { PlanTemplate, PlanDifficulty, PlanGoalType } from '../../models/types.ts';

interface PlanMarketplaceProps {
    onForkPlan?: (template: PlanTemplate) => void;
}

const DIFFICULTY_STYLES: Record<PlanDifficulty, { label: string; color: string }> = {
    beginner: { label: 'Nybörjare', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20' },
    intermediate: { label: 'Medel', color: 'bg-blue-500/20 text-blue-400 border-blue-500/20' },
    advanced: { label: 'Avancerad', color: 'bg-amber-500/20 text-amber-400 border-amber-500/20' },
    elite: { label: 'Elit', color: 'bg-rose-500/20 text-rose-400 border-rose-500/20' }
};

const GOAL_LABELS: Record<PlanGoalType, string> = {
    '5K': '5K',
    '10K': '10K',
    'half_marathon': 'Halvmaraton',
    'marathon': 'Maraton',
    'ultra': 'Ultra',
    'base_building': 'Basträning',
    'custom': 'Anpassad'
};

// Mock data for demonstration
const SAMPLE_TEMPLATES: PlanTemplate[] = [
    {
        id: '1',
        title: 'Sub-50 10K Plan',
        description: 'En 12-veckors plan för att springa 10K under 50 minuter. Fokus på fart och uthållighet.',
        creatorId: 'coach1',
        creatorName: 'Coach Erik',
        goalType: '10K',
        difficulty: 'intermediate',
        durationWeeks: 12,
        weeklyVolumeRange: { min: 30, max: 50 },
        sessionsPerWeek: 4,
        weekTemplates: [],
        visibility: 'public',
        forkCount: 234,
        likeCount: 567,
        rating: 4.7,
        tags: ['10K', 'fart', 'intervaller'],
        version: 3,
        createdAt: '2024-01-15',
        updatedAt: '2024-03-20'
    },
    {
        id: '2',
        title: 'Första Maratonen',
        description: '16 veckor till din första maraton. Säker progression och fokus på att nå mållinjen.',
        creatorId: 'coach2',
        creatorName: 'Anna Löpare',
        goalType: 'marathon',
        difficulty: 'beginner',
        durationWeeks: 16,
        weeklyVolumeRange: { min: 40, max: 80 },
        sessionsPerWeek: 5,
        weekTemplates: [],
        visibility: 'public',
        forkCount: 891,
        likeCount: 1243,
        rating: 4.9,
        tags: ['maraton', 'nybörjare', 'första'],
        version: 5,
        createdAt: '2023-09-01',
        updatedAt: '2024-02-15'
    },
    {
        id: '3',
        title: 'Elite 5K Program',
        description: 'Intensivt program för att ta sig under 18 minuter på 5K. Kräver god basform.',
        creatorId: 'coach3',
        creatorName: 'Magnus Elitlöpare',
        goalType: '5K',
        difficulty: 'elite',
        durationWeeks: 10,
        weeklyVolumeRange: { min: 70, max: 100 },
        sessionsPerWeek: 6,
        weekTemplates: [],
        visibility: 'public',
        forkCount: 156,
        likeCount: 423,
        rating: 4.8,
        tags: ['5K', 'elit', 'snabb'],
        version: 2,
        createdAt: '2024-02-01',
        updatedAt: '2024-03-10'
    }
];

export function PlanMarketplace({ onForkPlan }: PlanMarketplaceProps) {
    const [selectedGoal, setSelectedGoal] = useState<PlanGoalType | 'all'>('all');
    const [selectedDifficulty, setSelectedDifficulty] = useState<PlanDifficulty | 'all'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPlan, setSelectedPlan] = useState<PlanTemplate | null>(null);

    const filteredTemplates = SAMPLE_TEMPLATES.filter(t => {
        if (selectedGoal !== 'all' && t.goalType !== selectedGoal) return false;
        if (selectedDifficulty !== 'all' && t.difficulty !== selectedDifficulty) return false;
        if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
    });

    return (
        <div className="plan-marketplace text-white">
            {/* Header */}
            <div className="mb-6">
                <h2 className="text-2xl font-black uppercase italic tracking-tighter">📦 Plan-Marknaden</h2>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Upptäck och forka träningsplaner</p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4 mb-6 p-4 bg-slate-900/40 rounded-2xl border border-white/5">
                <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Sök planer..."
                    className="flex-1 min-w-[200px] bg-slate-950 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:border-indigo-500/50 outline-none"
                />
                <select
                    value={selectedGoal}
                    onChange={e => setSelectedGoal(e.target.value as PlanGoalType | 'all')}
                    className="bg-slate-950 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:border-indigo-500/50 outline-none"
                >
                    <option value="all">Alla mål</option>
                    {Object.entries(GOAL_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                    ))}
                </select>
                <select
                    value={selectedDifficulty}
                    onChange={e => setSelectedDifficulty(e.target.value as PlanDifficulty | 'all')}
                    className="bg-slate-950 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:border-indigo-500/50 outline-none"
                >
                    <option value="all">Alla nivåer</option>
                    {Object.entries(DIFFICULTY_STYLES).map(([key, { label }]) => (
                        <option key={key} value={key}>{label}</option>
                    ))}
                </select>
            </div>

            {/* Plan Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTemplates.map(template => (
                    <div
                        key={template.id}
                        className="p-5 bg-slate-900/60 border border-white/5 rounded-2xl hover:border-indigo-500/30 transition-all cursor-pointer group"
                        onClick={() => setSelectedPlan(template)}
                    >
                        <div className="flex justify-between items-start mb-3">
                            <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg border ${DIFFICULTY_STYLES[template.difficulty].color}`}>
                                {DIFFICULTY_STYLES[template.difficulty].label}
                            </span>
                            <div className="flex items-center gap-1 text-amber-400">
                                <span className="text-sm">⭐</span>
                                <span className="text-xs font-bold">{template.rating}</span>
                            </div>
                        </div>
                        <h3 className="text-lg font-black text-white mb-1 group-hover:text-indigo-400 transition-colors">{template.title}</h3>
                        <p className="text-[10px] text-slate-500 mb-3">av {template.creatorName}</p>
                        <p className="text-xs text-slate-400 line-clamp-2 mb-4">{template.description}</p>

                        <div className="grid grid-cols-3 gap-2 text-center mb-4">
                            <div className="p-2 bg-slate-950 rounded-lg">
                                <div className="text-sm font-black text-indigo-400">{template.durationWeeks}</div>
                                <div className="text-[8px] text-slate-500 uppercase">Veckor</div>
                            </div>
                            <div className="p-2 bg-slate-950 rounded-lg">
                                <div className="text-sm font-black text-emerald-400">{template.sessionsPerWeek}</div>
                                <div className="text-[8px] text-slate-500 uppercase">Pass/v</div>
                            </div>
                            <div className="p-2 bg-slate-950 rounded-lg">
                                <div className="text-sm font-black text-amber-400">{template.weeklyVolumeRange.max}</div>
                                <div className="text-[8px] text-slate-500 uppercase">Max km</div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex gap-3 text-[10px] text-slate-500">
                                <span>🔀 {template.forkCount}</span>
                                <span>❤️ {template.likeCount}</span>
                            </div>
                            <span className="px-2 py-1 bg-indigo-500/10 text-indigo-400 rounded-lg text-[9px] font-bold uppercase">
                                {GOAL_LABELS[template.goalType]}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Empty state */}
            {filteredTemplates.length === 0 && (
                <div className="text-center py-16 text-slate-500">
                    <p className="text-4xl mb-3">🔍</p>
                    <p className="text-sm font-bold">Inga planer hittades</p>
                    <p className="text-[10px]">Prova andra filter</p>
                </div>
            )}

            {/* Plan Detail Modal */}
            {selectedPlan && (
                <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center z-50 p-4" onClick={() => setSelectedPlan(null)}>
                    <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg border ${DIFFICULTY_STYLES[selectedPlan.difficulty].color}`}>
                                    {DIFFICULTY_STYLES[selectedPlan.difficulty].label}
                                </span>
                                <h3 className="text-xl font-black text-white mt-2">{selectedPlan.title}</h3>
                                <p className="text-xs text-slate-500">av {selectedPlan.creatorName}</p>
                            </div>
                            <button onClick={() => setSelectedPlan(null)} className="text-slate-500 hover:text-white">✕</button>
                        </div>

                        <p className="text-sm text-slate-300 mb-4">{selectedPlan.description}</p>

                        <div className="grid grid-cols-4 gap-3 mb-4">
                            <div className="p-3 bg-slate-950 rounded-xl text-center">
                                <div className="text-lg font-black text-indigo-400">{selectedPlan.durationWeeks}</div>
                                <div className="text-[9px] text-slate-500 uppercase">Veckor</div>
                            </div>
                            <div className="p-3 bg-slate-950 rounded-xl text-center">
                                <div className="text-lg font-black text-emerald-400">{selectedPlan.sessionsPerWeek}</div>
                                <div className="text-[9px] text-slate-500 uppercase">Pass/v</div>
                            </div>
                            <div className="p-3 bg-slate-950 rounded-xl text-center">
                                <div className="text-lg font-black text-amber-400">{selectedPlan.weeklyVolumeRange.min}-{selectedPlan.weeklyVolumeRange.max}</div>
                                <div className="text-[9px] text-slate-500 uppercase">km/v</div>
                            </div>
                            <div className="p-3 bg-slate-950 rounded-xl text-center">
                                <div className="text-lg font-black text-rose-400">v{selectedPlan.version}</div>
                                <div className="text-[9px] text-slate-500 uppercase">Version</div>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5 mb-4">
                            {selectedPlan.tags.map(tag => (
                                <span key={tag} className="px-2 py-1 bg-slate-800 text-slate-400 rounded-lg text-[9px] font-bold">
                                    #{tag}
                                </span>
                            ))}
                        </div>

                        <div className="flex gap-3 pt-4 border-t border-white/5">
                            <button
                                onClick={() => { onForkPlan?.(selectedPlan); setSelectedPlan(null); }}
                                className="flex-1 py-3 bg-emerald-500 text-slate-950 font-black rounded-xl text-[10px] uppercase tracking-widest hover:bg-emerald-400 transition-all"
                            >
                                🔀 Forka & Anpassa
                            </button>
                            <button className="px-4 py-3 bg-slate-800 text-slate-400 font-bold rounded-xl text-[10px] uppercase hover:text-white transition-all">
                                ❤️ Gilla
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
