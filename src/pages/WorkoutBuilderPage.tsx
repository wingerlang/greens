import React, { useState, useEffect } from 'react';
import { WorkoutDefinition, WorkoutSection, WorkoutExercise } from '../models/workout.ts';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useData } from '../context/DataContext.tsx';
import { ExerciseSelector } from '../components/workouts/ExerciseSelector.tsx';
import { WorkoutAnalyzer } from '../components/workouts/WorkoutAnalyzer.tsx';
import { WorkoutComparisonView } from '../components/workouts/WorkoutComparisonView.tsx';
import { mapUniversalToLegacyEntry } from '../utils/mappers.ts';
import { MUSCLE_MAP, BODY_PARTS } from '../data/muscleMap.ts';
import { calculate1RM } from '../models/strengthTypes.ts';
import { StrengthSet } from '../models/strengthTypes.ts';

const SUBCATEGORIES: Record<string, string[]> = {
    'STRENGTH': ['Push', 'Pull', 'Ben', 'Överkropp', 'Underkropp', 'Hela Kroppen'],
    'RUNNING': ['Distans', 'Långpass', 'Intervall', 'Tempo', 'Backe', 'Återhämtning'],
    'HYROX': ['Simulering', 'Intervaller', 'Styrke-EMOM', 'Återhämtning'],
    'CROSSFIT': ['WOD', 'Metcon', 'Skills', 'Strength + WOD'],
};

// Initial Empty State (Swedish)
const INITIAL_WORKOUT: WorkoutDefinition = {
    id: crypto.randomUUID(),
    title: "Nytt Träningspass",
    category: 'STRENGTH',
    difficulty: 'Intermediate',
    durationMin: 60,
    tags: [],
    source: 'USER_CUSTOM',
    description: "",
    exercises: [
        { id: crypto.randomUUID(), title: "Uppvärmning", exercises: [] },
        { id: crypto.randomUUID(), title: "Huvuddel", exercises: [] },
    ]
};

export function WorkoutBuilderPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { exerciseEntries, strengthSessions, universalActivities } = useData();
    const [workout, setWorkout] = useState<WorkoutDefinition>(INITIAL_WORKOUT);
    const [activeTab, setActiveTab] = useState<'BUILD' | 'ANALYZE' | 'COMPARE'>('BUILD');

    // ACTION: Derive Muscles from Exercises
    const deriveMuscles = (currentWorkout: WorkoutDefinition) => {
        const muscles = new Set<string>();
        currentWorkout.exercises?.forEach(section => {
            section.exercises.forEach(ex => {
                const map = MUSCLE_MAP[ex.name];
                if (map) {
                    muscles.add(map.primary);
                    map.secondary.forEach(m => muscles.add(m));
                }
            });
        });
        const filtered = Array.from(muscles).filter(m => m !== 'Cardio');
        setWorkout(prev => ({ ...prev, targetedMuscles: filtered }));
    };

    // IMPORT LOGIC
    useEffect(() => {
        const fromActivityId = searchParams.get('fromActivity') || searchParams.get('activityId');
        if (fromActivityId) {
            let activity = exerciseEntries.find(e => e.id === fromActivityId);
            if (!activity) {
                const ua = universalActivities.find(u => u.id === fromActivityId);
                if (ua) activity = mapUniversalToLegacyEntry(ua) || undefined;
            }

            if (activity) {
                const isRun = activity.type === 'running';
                const intensityMap: Record<string, string> = { low: 'RPE 3', moderate: 'RPE 5', high: 'RPE 8', ultra: 'RPE 10' };
                const rpe = intensityMap[activity.intensity as string] || 'RPE 5';

                let title = isRun ? `Pass: ${activity.distance}km` : `${activity.type} Session`;
                if (activity.subType && activity.subType !== 'default') {
                    const sub = activity.subType.charAt(0).toUpperCase() + activity.subType.slice(1);
                    title = `${sub}: ${activity.distance}km`;
                }

                const imported: WorkoutDefinition = {
                    ...INITIAL_WORKOUT,
                    id: crypto.randomUUID(),
                    title: title,
                    durationMin: activity.durationMinutes || 60,
                    category: isRun ? 'RUNNING' : 'CROSSFIT',
                    subCategory: isRun && activity.subType && activity.subType !== 'default' ? (activity.subType.charAt(0).toUpperCase() + activity.subType.slice(1)) : undefined,
                    description: activity.notes || `Importerat från aktivitet den ${activity.date}`,
                    exercises: isRun ? [
                        { id: crypto.randomUUID(), title: "Uppvärmning", exercises: [] },
                        {
                            id: crypto.randomUUID(),
                            title: "Löpning",
                            exercises: [{
                                id: crypto.randomUUID(),
                                exerciseId: 'run',
                                name: activity.subType === 'interval' ? 'Intervaller' : 'Löpning',
                                sets: 1,
                                reps: `${activity.distance} km`,
                                weight: rpe,
                                rest: 0
                            }]
                        },
                        { id: crypto.randomUUID(), title: "Nedjogg", exercises: [] },
                    ] : INITIAL_WORKOUT.exercises
                };
                setWorkout(imported);
                setActiveTab('COMPARE');
                return;
            }

            const strengthSession = strengthSessions.find(s => s.id === fromActivityId);
            if (strengthSession) {
                const sections: WorkoutSection[] = [];
                const muscles = new Set<string>();
                if (strengthSession.exercises && strengthSession.exercises.length > 0) {
                    const mainSection: WorkoutSection = {
                        id: crypto.randomUUID(),
                        title: "Huvuddel",
                        exercises: strengthSession.exercises.map(ex => {
                            const map = MUSCLE_MAP[ex.name];
                            if (map) { muscles.add(map.primary); map.secondary.forEach(m => muscles.add(m)); }
                            return {
                                id: crypto.randomUUID(),
                                exerciseId: ex.name,
                                name: ex.name,
                                sets: ex.sets || 3,
                                reps: ex.reps?.toString() || "10",
                                weight: ex.weight ? `${ex.weight}kg` : "-",
                                rest: 60
                            };
                        })
                    };
                    sections.push(mainSection);
                } else {
                    sections.push({ id: crypto.randomUUID(), title: "Styrka", exercises: [] });
                }

                const imported: WorkoutDefinition = {
                    ...INITIAL_WORKOUT,
                    id: crypto.randomUUID(),
                    title: strengthSession.title || "Styrkepass",
                    category: 'STRENGTH',
                    subCategory: strengthSession.title?.toLowerCase().includes('push') ? 'Push' :
                        strengthSession.title?.toLowerCase().includes('pull') ? 'Pull' :
                            strengthSession.title?.toLowerCase().includes('ben') ? 'Ben' : undefined,
                    durationMin: strengthSession.durationMinutes || 60,
                    description: `Importerat från ${strengthSession.date}`,
                    exercises: sections,
                    targetedMuscles: Array.from(muscles).filter(m => m !== 'Cardio')
                };
                setWorkout(imported);
                setActiveTab('COMPARE');
            }
        }
    }, [searchParams, exerciseEntries, strengthSessions, universalActivities]);

    const [activeSectionId, setActiveSectionId] = useState<string>(workout.exercises?.[0]?.id || INITIAL_WORKOUT.exercises![0].id);

    const handleSubCategoryChange = (sub: string) => {
        let updatedWorkout = { ...workout, subCategory: sub };
        const totalEx = workout.exercises?.reduce((sum, s) => sum + s.exercises.length, 0) || 0;
        if (totalEx <= 1) {
            if (workout.category === 'RUNNING') {
                const needsKm = ['Långpass', 'Intervall', 'Tempo', 'Backe'].includes(sub);
                const warmupKm = needsKm ? "2 km" : "-";
                updatedWorkout.exercises = [
                    {
                        id: crypto.randomUUID(), title: "Uppvärmning",
                        exercises: [{ id: crypto.randomUUID(), exerciseId: 'run-wu', name: 'Löpning (Uppvärmning)', sets: 1, reps: warmupKm, weight: 'Lugnt', rest: 0 }]
                    },
                    {
                        id: crypto.randomUUID(), title: sub === 'Intervall' ? "Intervaller" : "Huvuddel",
                        exercises: [{ id: crypto.randomUUID(), exerciseId: 'run-main', name: sub === 'Intervall' ? 'Intervaller' : 'Löpning', sets: 1, reps: sub === 'Långpass' ? '15-20 km' : '5-10 km', weight: sub === 'Tempo' ? 'Progressiv' : 'RPE 5', rest: 0 }]
                    },
                    {
                        id: crypto.randomUUID(), title: "Nedjogg",
                        exercises: [{ id: crypto.randomUUID(), exerciseId: 'run-cd', name: 'Nerjogg', sets: 1, reps: warmupKm, weight: 'Lugnt', rest: 0 }]
                    },
                ];
            }
        }
        setWorkout(updatedWorkout);
    };

    const update = (field: keyof WorkoutDefinition, value: any) => {
        setWorkout(prev => ({ ...prev, [field]: value }));
    };

    const addExercise = (name: string) => {
        if (!activeSectionId) return;
        const newExercise: WorkoutExercise = { id: crypto.randomUUID(), exerciseId: name, name: name, sets: 3, reps: "10", weight: "RPE 7", rest: 60 };
        const newSections = (workout.exercises || []).map(section => {
            if (section.id === activeSectionId) return { ...section, exercises: [...section.exercises, newExercise] };
            return section;
        });
        const next = { ...workout, exercises: newSections };
        setWorkout(next);
        deriveMuscles(next);
    };

    const removeExercise = (sectionId: string, exerciseId: string) => {
        const newSections = workout.exercises!.map(section => {
            if (section.id === sectionId) return { ...section, exercises: section.exercises.filter(e => e.id !== exerciseId) };
            return section;
        });
        const next = { ...workout, exercises: newSections };
        setWorkout(next);
        deriveMuscles(next);
    }

    // Overload Engine: Find the ideal progression target from history
    const getProgressionTarget = (exerciseName: string) => {
        if (!strengthSessions || strengthSessions.length === 0) return null;

        // Find the LATEST session containing this exercise
        const sortedSessions = [...strengthSessions].sort((a: any, b: any) => b.date.localeCompare(a.date));
        const relevantSessions = sortedSessions.filter((s: any) =>
            s.exercises.some((e: any) => (e.exerciseName || e.name).toLowerCase() === exerciseName.toLowerCase())
        );

        if (relevantSessions.length === 0) return null;

        const lastSession = relevantSessions[0];
        const lastEx = (lastSession.exercises as any[]).find(e => (e.exerciseName || e.name).toLowerCase() === exerciseName.toLowerCase());
        if (!lastEx || (!lastEx.sets && (lastEx as any).weight === undefined)) return null;

        // Calculate Plateau (Sessions since last PR)
        let sessionsSincePR = 0;
        let highestRMFound = 0;

        for (const session of relevantSessions) {
            const ex = (session.exercises as any[]).find(e => (e.exerciseName || e.name).toLowerCase() === exerciseName.toLowerCase());
            if (!ex) continue;

            let sessionMax = 0;
            if (Array.isArray(ex.sets)) {
                sessionMax = ex.sets.reduce((max: number, s: any) => Math.max(max, calculate1RM(s.weight, s.reps)), 0);
            } else {
                sessionMax = calculate1RM((ex as any).weight || 0, (ex as any).reps || 0);
            }

            if (sessionMax > highestRMFound * 1.01) { // 1% buffer
                if (highestRMFound > 0) break; // We found the PR that ended the previous plateau
                highestRMFound = sessionMax;
            } else {
                sessionsSincePR++;
            }
        }

        // If it's the summarized model (StrengthSession), it only has one set/rep/weight
        if (!Array.isArray(lastEx.sets)) {
            const weight = (lastEx as any).weight || 0;
            const reps = (lastEx as any).reps || 0;
            if (weight <= 0 && reps <= 0) return null;

            const powerWeight = Math.ceil((weight * 1.025) / 2.5) * 2.5;
            const volumeReps = reps + 1;

            return {
                lastWeight: weight,
                lastReps: reps,
                powerTarget: { weight: powerWeight, reps: reps },
                volumeTarget: { weight: weight, reps: volumeReps },
                date: lastSession.date,
                sessionsSincePR
            };
        }

        if (lastEx.sets.length === 0) return null;

        // Detailed model (StrengthWorkout)
        const bestSet = lastEx.sets.reduce((best: StrengthSet, current: StrengthSet) => {
            const current1RM = calculate1RM(current.weight, current.reps);
            const best1RM = calculate1RM(best.weight, best.reps);
            return current1RM > best1RM ? current : best;
        }, lastEx.sets[0]);

        if (bestSet.weight <= 0 && bestSet.reps <= 0) return null;

        // Calculate targets
        // 1. Power Target: Same reps, +2.5% weight (rounded to nearest 2.5kg)
        const powerWeight = Math.ceil((bestSet.weight * 1.025) / 2.5) * 2.5;

        // 2. Volume Target: Same weight, +1-2 reps
        const volumeReps = bestSet.reps + 1;

        return {
            lastWeight: bestSet.weight,
            lastReps: bestSet.reps,
            powerTarget: { weight: powerWeight, reps: bestSet.reps },
            volumeTarget: { weight: bestSet.weight, reps: volumeReps },
            date: lastSession.date,
            sessionsSincePR
        };
    };

    const applyTarget = (sectionId: string, exerciseId: string, weight: number | string, reps: number | string) => {
        const sIdx = workout.exercises!.findIndex(s => s.id === sectionId);
        if (sIdx === -1) return;

        const newW = JSON.parse(JSON.stringify(workout));
        const eIdx = newW.exercises[sIdx].exercises.findIndex((x: any) => x.id === exerciseId);
        if (eIdx === -1) return;

        newW.exercises[sIdx].exercises[eIdx].weight = typeof weight === 'number' ? `${weight}kg` : weight;
        newW.exercises[sIdx].exercises[eIdx].reps = reps.toString();
        setWorkout(newW);
    };

    return (
        <div className="h-full flex flex-col bg-[#050510] text-white overflow-hidden font-sans">
            {/* HEADER TOOLBAR */}
            <div className="h-20 border-b border-white/5 bg-slate-900/20 flex items-center justify-between px-8 backdrop-blur-2xl">
                <div className="flex items-center gap-6">
                    <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-white transition-all hover:scale-110">
                        <span className="text-2xl">←</span>
                    </button>
                    <div className="h-8 w-px bg-white/10"></div>
                    <div className="flex flex-col">
                        <label className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-1">Passets titel</label>
                        <input
                            type="text"
                            value={workout.title}
                            onChange={(e) => update('title', e.target.value)}
                            className="bg-transparent text-2xl font-black focus:outline-none focus:ring-0 rounded placeholder-white/20"
                            placeholder="Namnge ditt pass..."
                        />
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="hidden md:flex flex-col items-end">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status</span>
                        <span className="text-xs font-mono text-emerald-400 font-bold uppercase">Redigerar</span>
                    </div>
                    <button className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-400 text-white px-8 py-3 rounded-2xl font-black text-sm transition-all shadow-xl shadow-indigo-500/20 active:scale-95">
                        Spara Pass
                    </button>
                </div>
            </div>

            {/* MAIN WORKSPACE */}
            <div className="flex-1 flex overflow-hidden">
                {/* LEFT: CANVAS */}
                <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
                    <div className="max-w-4xl mx-auto space-y-12 pb-48">

                        {/* PREMIUM METADATA CARD */}
                        <div className="bg-slate-900/40 border border-white/10 rounded-[2.5rem] p-10 grid grid-cols-3 gap-10 relative overflow-hidden backdrop-blur-xl">
                            <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none select-none">
                                <span className="text-9xl text-white font-black italic tracking-tighter">GENUS</span>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.15em]">Kategori</label>
                                <select
                                    value={workout.category}
                                    onChange={(e) => update('category', e.target.value)}
                                    className="w-full bg-slate-950/50 border border-white/10 rounded-2xl px-5 py-4 text-sm font-bold focus:border-indigo-500 outline-none hover:bg-slate-950 transition-all cursor-pointer appearance-none"
                                >
                                    {['STRENGTH', 'HYROX', 'RUNNING', 'HYBRID', 'CROSSFIT', 'RECOVERY'].map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.15em]">Typ av pass</label>
                                <select
                                    value={workout.subCategory || ''}
                                    onChange={(e) => handleSubCategoryChange(e.target.value)}
                                    className="w-full bg-slate-950/50 border border-white/10 rounded-2xl px-5 py-4 text-sm font-bold focus:border-indigo-500 outline-none hover:bg-slate-950 transition-all cursor-pointer appearance-none"
                                >
                                    <option value="">Välj typ...</option>
                                    {SUBCATEGORIES[workout.category]?.map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.15em]">Nivå</label>
                                <select
                                    value={workout.difficulty}
                                    onChange={(e) => update('difficulty', e.target.value)}
                                    className="w-full bg-slate-950/50 border border-white/10 rounded-2xl px-5 py-4 text-sm font-bold focus:border-indigo-500 outline-none hover:bg-slate-950 transition-all cursor-pointer appearance-none"
                                >
                                    {['Beginner', 'Intermediate', 'Advanced', 'Elite'].map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>

                            <div className="col-span-3 space-y-3">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.15em]">Beskrivning & Mål</label>
                                <textarea
                                    value={workout.description}
                                    onChange={(e) => update('description', e.target.value)}
                                    className="w-full bg-slate-950/50 border border-white/10 rounded-[2rem] px-6 py-5 text-sm leading-relaxed focus:border-indigo-500 outline-none min-h-[120px] resize-none hover:bg-slate-950 transition-all"
                                    placeholder="Vad är målet med dagens pass?"
                                />
                            </div>

                            <div className="col-span-3 flex flex-wrap gap-2 pt-2 border-t border-white/5">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest self-center mr-4">Tränar:</span>
                                {workout.targetedMuscles && workout.targetedMuscles.length > 0 ? (
                                    workout.targetedMuscles.map(m => (
                                        <span key={m} className="px-4 py-1.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] font-black rounded-full uppercase tracking-wider">
                                            {m}
                                        </span>
                                    ))
                                ) : (
                                    <span className="text-[10px] text-slate-600 italic">Lägg till övningar för att se muskelgrupper...</span>
                                )}
                            </div>
                        </div>

                        {/* SECTIONS */}
                        <div className="space-y-8">
                            {workout.exercises?.map((section, idx) => (
                                <div
                                    key={section.id}
                                    onClick={() => setActiveSectionId(section.id)}
                                    className={`group transition-all duration-500 rounded-[2.5rem] p-8 border ${activeSectionId === section.id ? 'border-indigo-500/40 bg-indigo-500/5 shadow-3xl shadow-indigo-500/10' : 'border-white/5 bg-slate-900/20'}`}
                                >
                                    <div className="flex items-center justify-between mb-8">
                                        <div className="flex flex-col">
                                            <input
                                                value={section.title}
                                                onChange={(e) => {
                                                    const newEx = [...(workout.exercises || [])];
                                                    newEx[idx].title = e.target.value;
                                                    update('exercises', newEx);
                                                }}
                                                className="bg-transparent text-2xl font-black text-white focus:outline-none placeholder-white/10"
                                            />
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Sektion {idx + 1}</span>
                                        </div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); const newEx = workout.exercises!.filter(s => s.id !== section.id); update('exercises', newEx); }}
                                            className="opacity-0 group-hover:opacity-100 p-3 hover:bg-rose-500/20 rounded-2xl text-rose-500 transition-all"
                                        >
                                            <span className="font-bold">Ta bort</span>
                                        </button>
                                    </div>

                                    <div className="space-y-3">
                                        {section.exercises.map((ex, i) => (
                                            <div key={ex.id} className="flex items-center gap-6 bg-slate-950/40 border border-white/5 p-6 rounded-3xl hover:border-white/20 transition-all hover:translate-x-1 group/ex">
                                                <div className="w-10 h-10 rounded-2xl bg-slate-900 flex items-center justify-center text-xs font-black text-slate-500 border border-white/5">
                                                    {i + 1}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="font-black text-lg text-white mb-1">{ex.name}</div>
                                                    <div className="flex gap-8">
                                                        <div className="flex flex-col">
                                                            <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.1em] mb-1">Set</span>
                                                            <input className="bg-transparent font-mono text-indigo-400 font-bold outline-none" defaultValue={ex.sets} onBlur={(e) => { const sIdx = workout.exercises!.findIndex(s => s.id === section.id); const eIdx = section.exercises.findIndex(x => x.id === ex.id); const newW = JSON.parse(JSON.stringify(workout)); newW.exercises[sIdx].exercises[eIdx].sets = parseInt(e.target.value); setWorkout(newW); }} />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.1em] mb-1">Rep / Sträcka</span>
                                                            <input className="bg-transparent font-mono text-indigo-400 font-bold outline-none" defaultValue={ex.reps} onBlur={(e) => { const sIdx = workout.exercises!.findIndex(s => s.id === section.id); const eIdx = section.exercises.findIndex(x => x.id === ex.id); const newW = JSON.parse(JSON.stringify(workout)); newW.exercises[sIdx].exercises[eIdx].reps = e.target.value; setWorkout(newW); }} />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.1em] mb-1">Last / Tempo</span>
                                                            <input className="bg-transparent font-mono text-indigo-400 font-bold outline-none" defaultValue={ex.weight} onBlur={(e) => { const sIdx = workout.exercises!.findIndex(s => s.id === section.id); const eIdx = section.exercises.findIndex(x => x.id === ex.id); const newW = JSON.parse(JSON.stringify(workout)); newW.exercises[sIdx].exercises[eIdx].weight = e.target.value; setWorkout(newW); }} />
                                                        </div>
                                                    </div>

                                                    {/* Overload Engine Nudge */}
                                                    {(() => {
                                                        const target = getProgressionTarget(ex.name);
                                                        if (!target) return null;
                                                        return (
                                                            <div className="mt-3 space-y-3">
                                                                {target.sessionsSincePR >= 3 && (
                                                                    <div className="flex items-center gap-3 px-4 py-2 bg-rose-500/10 border border-rose-500/20 rounded-2xl">
                                                                        <span className="text-lg">⚠️</span>
                                                                        <div className="flex flex-col">
                                                                            <span className="text-[10px] font-black text-rose-400 uppercase tracking-wider">Platå-varning ({target.sessionsSincePR} pass utan PR!)</span>
                                                                            <span className="text-[9px] text-rose-500/70 font-bold uppercase tracking-widest">Rekommendation: Deload eller Byt Variant</span>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">🎯 Mål (vs {target.date}):</span>
                                                                    <button
                                                                        onClick={() => applyTarget(section.id, ex.id, target.powerTarget.weight, target.powerTarget.reps)}
                                                                        className="px-2 py-1 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded text-[10px] font-bold text-indigo-400 transition-all flex items-center gap-1"
                                                                        title="Öka vikt (+2.5%)"
                                                                    >
                                                                        ⚡ Power: {target.powerTarget.weight}kg x {target.powerTarget.reps}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => applyTarget(section.id, ex.id, target.volumeTarget.weight, target.volumeTarget.reps)}
                                                                        className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded text-[10px] font-bold text-emerald-400 transition-all flex items-center gap-1"
                                                                        title="Öka repetitioner (+1)"
                                                                    >
                                                                        📈 Volym: {target.volumeTarget.weight}kg x {target.volumeTarget.reps}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                                <button onClick={() => removeExercise(section.id, ex.id)} className="opacity-0 group-hover/ex:opacity-100 p-2 text-slate-600 hover:text-rose-500 transition-all">✕</button>
                                            </div>
                                        ))}
                                        {section.exercises.length === 0 && (
                                            <div className="py-12 text-center border-2 border-dashed border-white/5 rounded-[2.5rem] bg-slate-900/10">
                                                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-4">Sektionen är tom</p>
                                                <button className="text-sm text-indigo-400 font-black uppercase tracking-widest hover:text-indigo-300 transition-colors">+ Sök i övningsarkivet</button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={() => update('exercises', [...(workout.exercises || []), { id: crypto.randomUUID(), title: "Ny Sektion", exercises: [] }])}
                            className="w-full py-8 border-2 border-dashed border-white/5 hover:border-white/10 hover:bg-white/5 rounded-[2.5rem] text-slate-500 hover:text-white transition-all font-black uppercase tracking-[0.2em] text-xs"
                        >
                            + Lägg till sektion
                        </button>
                    </div>
                </div>

                {/* RIGHT: SMART TOOLBOX */}
                <div className="w-[450px] border-l border-white/5 bg-[#080815] hidden xl:flex flex-col shadow-2xl">
                    <div className="p-6 border-b border-white/5 flex gap-2">
                        {[
                            { id: 'BUILD', label: 'Bygg' },
                            { id: 'ANALYZE', label: 'Analysera' },
                            { id: 'COMPARE', label: 'Jämför' }
                        ].map(t => (
                            <button
                                key={t.id}
                                onClick={() => setActiveTab(t.id as any)}
                                className={`flex-1 py-3 text-[11px] font-black uppercase tracking-widest rounded-2xl transition-all ${activeTab === t.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-900/50 text-slate-500 hover:text-slate-300'}`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {activeTab === 'BUILD' ? (<ExerciseSelector onSelect={addExercise} />)
                            : activeTab === 'ANALYZE' ? (<WorkoutAnalyzer workout={workout} />)
                                : (<WorkoutComparisonView workout={workout} />)}
                    </div>
                </div>
            </div>
        </div>
    );
}

