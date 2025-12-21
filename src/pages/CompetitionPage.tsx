import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../context/DataContext.tsx';
import { COMPETITION_PRESETS, calculateDailyPoints } from '../utils/competitionEngine.ts';
import { Competition, CompetitionRule, CompetitionParticipant } from '../models/types.ts';
import './CompetitionPage.css';

type ViewMode = 'list' | 'details' | 'create' | 'edit';

export function CompetitionPage() {
    const { competitions, addCompetition, updateCompetition, deleteCompetition, currentUser, users, dailyVitals, exerciseEntries, mealEntries, calculateDailyNutrition, weightEntries } = useData();
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [activeCompId, setActiveCompId] = useState<string | null>(null);

    // Form State for Create/Edit
    const [formData, setFormData] = useState<{
        name: string;
        startDate: string;
        endDate: string;
        selectedRules: string[];
        selectedUsers: string[];
        isPublic: boolean;
    }>({
        name: '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        selectedRules: COMPETITION_PRESETS.map(p => p.presetId!),
        selectedUsers: [],
        isPublic: true
    });

    // Initialize participants when accessing context
    useEffect(() => {
        if (currentUser && formData.selectedUsers.length === 0 && viewMode === 'create') {
            setFormData(prev => ({ ...prev, selectedUsers: [currentUser.id] }));
        }
    }, [currentUser, viewMode]);

    // Handle ESC key to close modal
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && (viewMode === 'create' || viewMode === 'edit')) {
                setViewMode(activeCompId ? 'details' : 'list');
                resetForm();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [viewMode, activeCompId]);

    const activeComp = useMemo(() => competitions.find(c => c.id === activeCompId), [competitions, activeCompId]);

    const handleCreate = () => {
        if (!formData.name) return;

        const rules: CompetitionRule[] = COMPETITION_PRESETS
            .filter(p => formData.selectedRules.includes(p.presetId!))
            .map(p => ({
                id: Math.random().toString(36).substr(2, 9),
                ...p
            }));

        const participants: CompetitionParticipant[] = users
            .filter(u => formData.selectedUsers.includes(u.id))
            .map(u => ({
                userId: u.id,
                name: u.name,
                scores: {}
            }));

        addCompetition({
            name: formData.name,
            startDate: formData.startDate,
            endDate: formData.endDate,
            participants,
            rules,
            isDraft: false,
            isPublic: formData.isPublic,
            creatorId: currentUser?.id
        });

        setViewMode('list');
        resetForm();
    };

    const handleUpdate = () => {
        if (!activeCompId || !formData.name) return;

        // Re-construct rules and participants based on selection
        // Note: In a real app we might want to preserve existing participant scores if they remain in the list
        // Here we just map users to participants again. Ideally we should merge.

        const existingParticipants = activeComp?.participants || [];
        const participants: CompetitionParticipant[] = users
            .filter(u => formData.selectedUsers.includes(u.id))
            .map(u => {
                const existing = existingParticipants.find(p => p.userId === u.id);
                return existing ? existing : { userId: u.id, name: u.name, scores: {} };
            });

        const rules: CompetitionRule[] = COMPETITION_PRESETS
            .filter(p => formData.selectedRules.includes(p.presetId!))
            .map(p => ({
                id: Math.random().toString(36).substr(2, 9),
                ...p
            }));

        updateCompetition(activeCompId, {
            name: formData.name,
            startDate: formData.startDate,
            endDate: formData.endDate,
            participants,
            rules,
            isPublic: formData.isPublic
        });

        setViewMode('details');
    };

    const startEdit = () => {
        if (!activeComp) return;
        setFormData({
            name: activeComp.name,
            startDate: activeComp.startDate,
            endDate: activeComp.endDate,
            selectedRules: activeComp.rules.map(r => r.presetId!).filter(Boolean),
            selectedUsers: activeComp.participants.map(p => p.userId),
            isPublic: activeComp.isPublic ?? true
        });
        setViewMode('edit');
    };

    const resetForm = () => {
        setFormData({
            name: '',
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            selectedRules: COMPETITION_PRESETS.map(p => p.presetId!),
            selectedUsers: [currentUser?.id || ''],
            isPublic: true
        });
    };

    const getParticipantScore = (comp: Competition, userId: string) => {
        const participant = comp.participants.find(p => p.userId === userId);
        if (!participant) return 0;

        // In a real app, only calculate for self, or fetch others' synced scores.
        // For this local-first demo, we calculate for currentUser, and use stored scores for others (which are simulated as 0 usually unless we spoof them)
        // If we want to simulate full calculation for everyone we'd need access to everyone's data, which we technically do via DataContext if loaded.

        const userIsMe = userId === currentUser?.id;

        // Calculate points dynamically
        let total = 0;
        const start = new Date(comp.startDate);
        const end = new Date(comp.endDate);
        const now = new Date();
        const actualEnd = now < end ? now : end;

        for (let d = new Date(start); d <= actualEnd; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            // If userIsMe, use actual data. If not, we can't calculate dynamically without that user's local data in a real p2p app.
            // But since this app simulates all users in one storage for now:
            if (userIsMe) {
                const vitals = dailyVitals[dateStr] || { water: 0, sleep: 0, caffeine: 0 };
                const dayExercises = exerciseEntries.filter(e => e.date === dateStr);
                const nutrition = calculateDailyNutrition(dateStr);
                const weight = weightEntries.find(w => w.date === dateStr)?.weight || 70;
                total += calculateDailyPoints(dateStr, comp.rules, vitals, dayExercises, nutrition, weight);
            } else {
                // Fallback or random simulation for demo
                total += Math.floor(Math.random() * 5); // Simulation
            }
        }

        return total;
    };

    return (
        <div className="comp-page animate-in fade-in duration-500">
            {viewMode === 'list' && (
                <>
                    <header className="comp-header">
                        <div>
                            <h1>Tävlingsläge 🏆</h1>
                            <p className="text-slate-500 font-medium">Utmana dig själv eller dina vänner.</p>
                        </div>
                        <button className="btn-primary" onClick={() => { resetForm(); setViewMode('create'); }}>Skapa Tävling</button>
                    </header>

                    {competitions.length === 0 ? (
                        <div className="comp-empty glass">
                            <div className="text-4xl">🏅</div>
                            <div className="text-center">
                                <h2 className="text-xl font-bold text-white">Inga aktiva tävlingar</h2>
                                <p className="text-slate-500">Starta din första utmaning och samla poäng!</p>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {competitions.map(comp => (
                                <div key={comp.id} className="comp-card glass" onClick={() => { setActiveCompId(comp.id); setViewMode('details'); }}>
                                    <div className="comp-info">
                                        <div className="flex justify-between items-start">
                                            <h2>{comp.name}</h2>
                                            {!comp.isPublic && <span className="text-[10px] bg-white/10 px-2 py-1 rounded text-slate-300">🔒 Privat</span>}
                                        </div>
                                        <div className="comp-meta">
                                            <span>📅 {comp.startDate} — {comp.endDate}</span>
                                            <span>👥 {comp.participants.length} deltagare</span>
                                        </div>
                                    </div>
                                    {/* Mini Leaderboard Preview */}
                                    <div className="space-y-1 mt-4">
                                        {comp.participants.slice(0, 3).map((p, i) => (
                                            <div key={p.userId} className="flex justify-between text-xs text-slate-400">
                                                <span>{i + 1}. {p.name}</span>
                                                <span>{getParticipantScore(comp, p.userId)}p</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {viewMode === 'details' && activeComp && (
                <div className="animate-in slide-in-from-right duration-300">
                    <button onClick={() => setViewMode('list')} className="text-slate-400 hover:text-white mb-6 flex items-center gap-2">
                        ← Tillbaka till listan
                    </button>

                    <div className="flex justify-between items-start mb-8">
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-4xl font-black text-white">{activeComp.name}</h1>
                                {!activeComp.isPublic && <span className="text-xs bg-white/10 px-2 py-1 rounded text-slate-300">🔒 Privat</span>}
                            </div>
                            <p className="text-slate-500 mt-2">📅 {activeComp.startDate} till {activeComp.endDate}</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={startEdit} className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl font-bold transition-all">Redigera</button>
                            <button onClick={() => { deleteCompetition(activeComp.id); setViewMode('list'); }} className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 px-4 py-2 rounded-xl font-bold transition-all">Ta bort</button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2 space-y-6">
                            <div className="leaderboard glass p-6 rounded-3xl">
                                <h2 className="text-xl font-bold text-white mb-4">Leaderboard</h2>
                                {activeComp.participants
                                    .map(p => ({ ...p, totalScore: getParticipantScore(activeComp, p.userId) }))
                                    .sort((a, b) => b.totalScore - a.totalScore)
                                    .map((p, idx) => (
                                        <div key={p.userId} className="leader-row glass mb-2">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-8 h-8 flex items-center justify-center rounded-full font-black ${idx === 0 ? 'bg-amber-400 text-black' : idx === 1 ? 'bg-slate-300 text-black' : idx === 2 ? 'bg-amber-700 text-white' : 'bg-white/5 text-slate-500'}`}>
                                                    {idx + 1}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="leader-name">{p.name} {p.userId === currentUser?.id && '(Du)'}</span>
                                                    <span className="text-[10px] text-slate-500">Level {Math.floor(p.totalScore / 100) + 1}</span>
                                                </div>
                                            </div>
                                            <span className="leader-score text-2xl">{p.totalScore}</span>
                                        </div>
                                    ))}
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="glass p-6 rounded-3xl">
                                <h2 className="text-lg font-bold text-white mb-4">Regler & Poäng</h2>
                                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                                    {activeComp.rules.map(rule => (
                                        <div key={rule.id} className="p-3 bg-white/5 rounded-xl border border-white/5">
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="font-bold text-sm text-slate-200">{rule.name}</span>
                                                <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">+{rule.points}p</span>
                                            </div>
                                            <p className="text-[10px] text-slate-500">{rule.description}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {(viewMode === 'create' || viewMode === 'edit') && (
                <div className="comp-modal-overlay">
                    <div className="comp-modal glass overflow-hidden animate-in zoom-in-95 duration-200">
                        <h2 className="text-2xl font-black text-white mb-6">
                            {viewMode === 'create' ? 'Skapa ny Tävling' : 'Redigera Tävling'}
                        </h2>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Namn</label>
                                <input
                                    type="text"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-emerald-500/50 transition-all"
                                    placeholder="t.ex. Januari-fajt"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Startdatum</label>
                                    <input
                                        type="date"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-emerald-500/50 transition-all"
                                        value={formData.startDate}
                                        onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Slutdatum</label>
                                    <input
                                        type="date"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-emerald-500/50 transition-all"
                                        value={formData.endDate}
                                        onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/5 hover:border-white/10 cursor-pointer" onClick={() => setFormData(p => ({ ...p, isPublic: !p.isPublic }))}>
                                <div className={`w-5 h-5 rounded flex items-center justify-center border ${formData.isPublic ? 'bg-emerald-500 border-emerald-500' : 'border-slate-500'}`}>
                                    {formData.isPublic && '✓'}
                                </div>
                                <div>
                                    <div className="font-bold text-sm">Publik Tävling</div>
                                    <div className="text-[10px] text-slate-500">Synlig för alla användare (om avstängd, endast inbjudna)</div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Deltagare</label>
                                <div className="flex flex-wrap gap-2">
                                    {users.map(user => (
                                        <button
                                            key={user.id}
                                            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${formData.selectedUsers.includes(user.id) ? 'bg-indigo-500 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                                            onClick={() => {
                                                setFormData(prev => ({
                                                    ...prev,
                                                    selectedUsers: prev.selectedUsers.includes(user.id)
                                                        ? prev.selectedUsers.filter(id => id !== user.id)
                                                        : [...prev.selectedUsers, user.id]
                                                }));
                                            }}
                                        >
                                            {user.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Regler & Presets</label>
                                <div className="rule-grid max-h-[200px] overflow-y-auto pr-2">
                                    {COMPETITION_PRESETS.map(preset => (
                                        <div
                                            key={preset.presetId}
                                            className={`rule-item ${formData.selectedRules.includes(preset.presetId!) ? 'selected' : ''}`}
                                            onClick={() => {
                                                setFormData(prev => ({
                                                    ...prev,
                                                    selectedRules: prev.selectedRules.includes(preset.presetId!)
                                                        ? prev.selectedRules.filter(r => r !== preset.presetId)
                                                        : [...prev.selectedRules, preset.presetId!]
                                                }));
                                            }}
                                        >
                                            <div className="font-bold">{preset.name}</div>
                                            <div className="text-[9px] opacity-60">+{preset.points}p</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex justify-between items-center pt-4 border-t border-white/5">
                                <button className="text-slate-500 font-bold hover:text-white" onClick={() => { setViewMode(viewMode === 'create' ? 'list' : 'details'); resetForm(); }}>Avbryt</button>
                                <button className="btn-primary" onClick={viewMode === 'create' ? handleCreate : handleUpdate}>
                                    {viewMode === 'create' ? 'Starta Tävling' : 'Spara Ändringar'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
