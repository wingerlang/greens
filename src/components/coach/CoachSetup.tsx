import React, { useState, useEffect } from 'react';
import { useData } from '../../context/DataContext.tsx';
import { CoachConfig, CoachGoal, generateId } from '../../models/types.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { CoachFineTuning } from './CoachFineTuning.tsx';

export function CoachSetup() {
    const { coachConfig, updateCoachConfig, generateCoachPlan, addCoachGoal, activateCoachGoal, deleteCoachGoal } = useData();
    const { token } = useAuth();

    // Helper to convert seconds to MM:SS for input display
    const formatSeconds = (totalSeconds: number) => {
        if (!totalSeconds || isNaN(totalSeconds)) return '';
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // Helper to parse MM:SS or seconds back to total seconds
    const parseTimeToSeconds = (val: string) => {
        if (!val) return 0;
        if (val.includes(':')) {
            const [mStr, sStr] = val.split(':');
            const m = parseInt(mStr) || 0;
            const s = parseInt(sStr) || 0;
            return (m * 60) + s;
        }
        return parseInt(val) || 0;
    };

    const [profile, setProfile] = useState(coachConfig?.userProfile || {
        maxHr: 190,
        restingHr: 60,
        currentForm: { distanceKm: 5, timeSeconds: 1500 }
    });

    const [prefs, setPrefs] = useState(coachConfig?.preferences || {
        weeklyVolumeKm: 30,
        longRunDay: 'Sunday',
        intervalDay: 'Tuesday',
        trainingDays: [2, 4, 0],
        weightGoal: 75
    });

    const goals = coachConfig?.goals || [];
    const activeGoal = goals.find(g => g.isActive) || goals[0];

    // For adding/editing goals
    const [newGoal, setNewGoal] = useState<Partial<CoachGoal>>({
        type: '10K',
        targetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        targetTimeSeconds: 3000
    });

    const [currentTimeStr, setCurrentTimeStr] = useState(formatSeconds(profile.currentForm?.timeSeconds || 0));
    const [newGoalTimeStr, setNewGoalTimeStr] = useState(formatSeconds(newGoal.targetTimeSeconds || 0));

    const [isGenerating, setIsGenerating] = useState(false);
    const [savedProfile, setSavedProfile] = useState(false);
    const [savedGoal, setSavedGoal] = useState(false);
    const [savedPrefs, setSavedPrefs] = useState(false);

    const handleSaveProfile = () => {
        const time = parseTimeToSeconds(currentTimeStr);
        const updatedProfile = { ...profile, currentForm: { ...profile.currentForm!, timeSeconds: time } };
        updateCoachConfig({ userProfile: updatedProfile });
        setSavedProfile(true);
        setTimeout(() => setSavedProfile(false), 2000);
    };

    const handleAddGoal = () => {
        const time = parseTimeToSeconds(newGoalTimeStr);
        addCoachGoal({
            type: newGoal.type as any,
            targetDate: newGoal.targetDate as string,
            targetTimeSeconds: time
        });
        setSavedGoal(true);
        setNewGoalTimeStr('');
        setTimeout(() => setSavedGoal(false), 2000);
    };

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            const res = await fetch('/api/strava/activities', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            generateCoachPlan(data.activities || []);
        } catch (err) {
            generateCoachPlan([]);
        } finally {
            setIsGenerating(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    return (
        <div className="coach-setup max-w-5xl mx-auto space-y-6 pb-12 text-white animate-in fade-in slide-in-from-bottom-8 duration-700">
            {/* Startkapacitet & Profil */}
            <section className="glass-card p-5 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent border-blue-500/20">
                <div className="flex items-center gap-4 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center text-xl shadow-lg shadow-blue-500/10">🚀</div>
                    <div>
                        <h3 className="text-lg font-black italic uppercase tracking-tighter">Profil & Kapacitet</h3>
                        <p className="text-[8px] text-slate-500 font-black uppercase tracking-[0.2em] opacity-80">Dina fysiologiska förutsättningar</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Nuv. Distans (km)</label>
                        <input
                            type="number"
                            step="0.1"
                            value={profile.currentForm?.distanceKm || ''}
                            onChange={e => setProfile({ ...profile, currentForm: { ...profile.currentForm!, distanceKm: Number(e.target.value) } })}
                            className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-4 text-white font-black focus:border-blue-500/50 outline-none transition-all text-lg shadow-inner"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Nuv. Tid (MM:SS)</label>
                        <input
                            type="text"
                            value={currentTimeStr}
                            onChange={e => setCurrentTimeStr(e.target.value)}
                            className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-4 text-white font-black focus:border-blue-500/50 outline-none transition-all text-lg shadow-inner"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Maxpuls</label>
                        <input
                            type="number"
                            value={profile.maxHr}
                            onChange={e => setProfile({ ...profile, maxHr: Number(e.target.value) })}
                            className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-4 text-white font-black focus:border-blue-500/50 outline-none transition-all text-lg shadow-inner"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Vilopuls</label>
                        <input
                            type="number"
                            value={profile.restingHr}
                            onChange={e => setProfile({ ...profile, restingHr: Number(e.target.value) })}
                            className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-4 text-white font-black focus:border-blue-500/50 outline-none transition-all text-lg shadow-inner"
                        />
                    </div>
                </div>
                <div className="flex items-center justify-end mt-6 gap-4">
                    {savedProfile && <span className="text-emerald-400 font-black uppercase text-[10px] animate-bounce">✓ Sparat!</span>}
                    <button onClick={handleSaveProfile} className="px-6 py-2.5 bg-blue-500/10 text-blue-400 font-black rounded-xl hover:bg-blue-500/20 transition-all uppercase tracking-widest text-[10px] border border-blue-500/20 shadow-xl shadow-blue-500/5">Spara Profil</button>
                </div>
            </section>

            {/* Träningsmål */}
            <section className="glass-card p-5 bg-gradient-to-br from-emerald-500/5 to-transparent border-emerald-500/10">
                <div className="flex items-center gap-4 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xl shadow-lg shadow-emerald-500/10">🎯</div>
                    <div>
                        <h3 className="text-lg font-black italic uppercase tracking-tighter">Dina Mål</h3>
                        <p className="text-[8px] text-slate-500 font-black uppercase tracking-[0.2em] opacity-80">Hantera dina framtida lopp</p>
                    </div>
                </div>

                <div className="space-y-3 mb-6">
                    {goals.map(goal => (
                        <div key={goal.id} className={`p-4 rounded-xl border transition-all ${goal.isActive ? 'bg-emerald-500/10 border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.1)] scale-[1.01]' : 'bg-slate-950/40 border-white/5'} flex items-center justify-between group`}>
                            <div>
                                <div className="flex items-center gap-3 mb-1">
                                    <h4 className="font-black text-xl tracking-tight uppercase italic">{goal.type}</h4>
                                    {goal.isActive && <span className="px-2 py-0.5 bg-emerald-500 text-slate-950 text-[9px] font-black rounded-full uppercase tracking-widest shadow-lg shadow-emerald-500/20 animate-pulse">Aktiv</span>}
                                </div>
                                <p className="text-sm text-slate-400 font-medium tracking-wide">
                                    <span className="text-slate-200">{goal.targetDate}</span>
                                    <span className="mx-2 text-slate-700">•</span>
                                    Måltid: <span className="text-emerald-400/80 font-black">{formatSeconds(goal.targetTimeSeconds || 0)}</span>
                                </p>
                            </div>
                            <div className="flex gap-3">
                                {!goal.isActive && (
                                    <button
                                        onClick={() => activateCoachGoal(goal.id)}
                                        className="px-4 py-2.5 bg-slate-900 border border-white/5 hover:border-emerald-500/40 hover:bg-emerald-500/5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl"
                                    >
                                        Aktivera
                                    </button>
                                )}
                                <button onClick={() => deleteCoachGoal(goal.id)} className="p-3 text-slate-600 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all">🗑️</button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className={`p-5 rounded-2xl bg-slate-950/40 border-2 border-dashed transition-all ${savedGoal ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-white/5'}`}>
                    <h4 className="font-black text-sm mb-4 flex items-center gap-2 uppercase italic tracking-tight">
                        <span className="text-emerald-400 text-xl">+</span> Lägg till nytt mål
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-2">Distans</label>
                            <select
                                value={newGoal.type}
                                onChange={e => setNewGoal({ ...newGoal, type: e.target.value as any })}
                                className="w-full bg-slate-900 border border-white/10 rounded-xl p-4 outline-none font-black text-white focus:border-emerald-500/50 transition-all appearance-none cursor-pointer text-sm"
                            >
                                <option value="5K">5 KM</option>
                                <option value="10K">10 KM</option>
                                <option value="HALF_MARATHON">Halvmaraton</option>
                                <option value="MARATHON">Maraton</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-2">Önskad Tid (MM:SS)</label>
                            <input
                                type="text"
                                placeholder="00:00"
                                value={newGoalTimeStr}
                                onChange={e => setNewGoalTimeStr(e.target.value)}
                                className="w-full bg-slate-900 border border-white/10 rounded-xl p-4 outline-none font-black text-white focus:border-emerald-500/50 transition-all text-sm"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-2">Tävlingsdatum</label>
                            <input
                                type="date"
                                value={newGoal.targetDate}
                                onChange={e => setNewGoal({ ...newGoal, targetDate: e.target.value })}
                                className="w-full bg-slate-900 border border-white/10 rounded-xl p-4 outline-none font-black text-white focus:border-emerald-500/50 transition-all text-sm"
                            />
                        </div>
                    </div>
                    <div className="flex items-center justify-end mt-4 gap-3">
                        {savedGoal && <span className="text-emerald-400 font-black uppercase text-[10px] animate-bounce">✓ Mål Tillagt!</span>}
                        <button type="button" onClick={handleAddGoal} className="px-5 py-2 bg-emerald-500 text-slate-950 font-black rounded-lg hover:bg-emerald-400 transition-all uppercase tracking-widest text-[9px] shadow-lg shadow-emerald-500/20 active:scale-95">Spara Mål</button>
                    </div>
                </div>
            </section>

            {/* Träningsschema */}
            <section className="glass-card p-4">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-lg">📅</div>
                    <div>
                        <h3 className="text-base font-black">Inställningar</h3>
                        <p className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Volym & Dagar</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Veckovolym (km)</label>
                        <input
                            type="number"
                            value={prefs.weeklyVolumeKm || ''}
                            onChange={e => setPrefs({ ...prefs, weeklyVolumeKm: Number(e.target.value) })}
                            className="w-full bg-slate-900/50 border border-white/5 rounded-2xl p-4 text-white font-black focus:border-emerald-500/50 outline-none transition-all"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Viktmål (kg)</label>
                        <input
                            type="number"
                            value={prefs.weightGoal || ''}
                            onChange={e => setPrefs({ ...prefs, weightGoal: Number(e.target.value) })}
                            className="w-full bg-slate-900/50 border border-white/5 rounded-2xl p-4 text-white font-black focus:border-emerald-500/50 outline-none transition-all"
                        />
                    </div>
                </div>
                <div className="flex items-center justify-start mt-4 gap-3">
                    <button type="button" onClick={() => { updateCoachConfig({ preferences: prefs }); setSavedPrefs(true); setTimeout(() => setSavedPrefs(false), 2000); }} className="px-5 py-2 bg-indigo-500/20 text-indigo-400 font-bold rounded-lg hover:bg-indigo-500/30 transition-all uppercase tracking-widest text-[9px] border border-indigo-500/20">Spara Preferenser</button>
                    {savedPrefs && <span className="text-emerald-400 font-black uppercase text-[10px] animate-pulse">✓ Sparat!</span>}
                </div>
            </section>

            {/* Fine-Tuning Engine */}
            <section className="glass-card p-4 bg-gradient-to-br from-amber-500/5 to-transparent border-amber-500/10">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center text-lg">⚙️</div>
                    <div>
                        <h3 className="text-base font-black uppercase tracking-tight">Finjustering</h3>
                        <p className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Avancerade kontroller</p>
                    </div>
                </div>
                <CoachFineTuning />
            </section>

            {/* Final Action */}
            <div className="flex flex-col items-center gap-2 pt-2">
                {!activeGoal && (
                    <p className="text-[9px] text-rose-400 font-black uppercase tracking-widest italic animate-pulse mb-1">⚠️ Välj ett mål ovan först</p>
                )}
                <button
                    type="button"
                    disabled={isGenerating || !activeGoal}
                    onClick={handleGenerate}
                    className="px-8 py-3 bg-emerald-500 text-slate-950 font-black rounded-xl hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-500/20 uppercase tracking-widest text-[10px] active:scale-95"
                >
                    {isGenerating ? 'Genererar Plan...' : 'Uppdatera & Beräkna Plan'}
                </button>
                {activeGoal && (
                    <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest italic">Mål: {activeGoal.type} ({activeGoal.targetDate})</p>
                )}
            </div>
        </div>
    );
}
