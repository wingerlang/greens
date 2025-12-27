import React, { useState } from 'react';
import { WorkoutDefinition, WorkoutSection, WorkoutExercise } from '../models/workout.ts';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext.tsx';
import { ExerciseSelector } from '../components/workouts/ExerciseSelector.tsx';
import { WorkoutAnalyzer } from '../components/workouts/WorkoutAnalyzer.tsx';

// Initial Empty State
const INITIAL_WORKOUT: WorkoutDefinition = {
    id: crypto.randomUUID(),
    title: "New Workout",
    category: 'STRENGTH',
    difficulty: 'Intermediate',
    durationMin: 60,
    tags: [],
    source: 'USER_CUSTOM',
    description: "",
    exercises: [
        { id: crypto.randomUUID(), title: "Warmup", exercises: [] },
        { id: crypto.randomUUID(), title: "Main Lift", exercises: [] },
    ]
};

export function WorkoutBuilderPage() {
    const navigate = useNavigate();
    const { exerciseEntries } = useData();
    const [workout, setWorkout] = useState<WorkoutDefinition>(INITIAL_WORKOUT);
    const [activeTab, setActiveTab] = useState<'BUILD' | 'ANALYZE'>('BUILD');

    // Track which section receives new exercises
    const [activeSectionId, setActiveSectionId] = useState<string>(INITIAL_WORKOUT.exercises![0].id);

    // HELPER: Update top-level fields
    const update = (field: keyof WorkoutDefinition, value: any) => {
        setWorkout(prev => ({ ...prev, [field]: value }));
    };

    // ACTION: Add Exercise
    const addExercise = (name: string) => {
        if (!activeSectionId) return;

        const newExercise: WorkoutExercise = {
            id: crypto.randomUUID(),
            exerciseId: name, // For now using name as ID
            name: name,
            sets: 3,
            reps: "10",
            weight: "RPE 7",
            rest: 60,
        };

        const newSections = workout.exercises!.map(section => {
            if (section.id === activeSectionId) {
                return { ...section, exercises: [...section.exercises, newExercise] };
            }
            return section;
        });

        update('exercises', newSections);
    };

    // ACTION: Remove Exercise
    const removeExercise = (sectionId: string, exerciseId: string) => {
        const newSections = workout.exercises!.map(section => {
            if (section.id === sectionId) {
                return { ...section, exercises: section.exercises.filter(e => e.id !== exerciseId) };
            }
            return section;
        });
        update('exercises', newSections);
    }

    return (
        <div className="h-full flex flex-col bg-slate-950 text-white overflow-hidden">
            {/* HEADER TOOLBAR */}
            <div className="h-16 border-b border-white/10 bg-slate-900/50 flex items-center justify-between px-6 backdrop-blur-md">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-white transition-colors">
                        ← Back
                    </button>
                    <div className="h-6 w-px bg-white/10"></div>
                    <input
                        type="text"
                        value={workout.title}
                        onChange={(e) => update('title', e.target.value)}
                        className="bg-transparent text-xl font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded px-2 -ml-2"
                        placeholder="Workout Title"
                    />
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-slate-500 uppercase tracking-widest hidden md:inline">
                        {workout.exercises?.reduce((sum, s) => sum + s.exercises.length, 0)} Exercises
                    </span>
                    <button className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-bold text-sm transition-all shadow-lg shadow-indigo-500/20">
                        Save Workout
                    </button>
                </div>
            </div>

            {/* MAIN WORKSPACE */}
            <div className="flex-1 flex overflow-hidden">

                {/* LEFT: CANVAS (SCROLLABLE) */}
                <div className="flex-1 overflow-y-auto p-8 relative">
                    <div className="max-w-3xl mx-auto space-y-8 pb-32">

                        {/* METADATA CARD */}
                        <div className="bg-slate-900 border border-white/5 rounded-2xl p-6 grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Category</label>
                                <select
                                    value={workout.category}
                                    onChange={(e) => update('category', e.target.value)}
                                    className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none"
                                >
                                    {['STRENGTH', 'HYROX', 'RUNNING', 'HYBRID', 'CROSSFIT', 'RECOVERY'].map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Difficulty</label>
                                <select
                                    value={workout.difficulty}
                                    onChange={(e) => update('difficulty', e.target.value)}
                                    className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none"
                                >
                                    {['Beginner', 'Intermediate', 'Advanced', 'Elite'].map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div className="col-span-2 space-y-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Description</label>
                                <textarea
                                    value={workout.description}
                                    onChange={(e) => update('description', e.target.value)}
                                    className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none h-20 resize-none"
                                    placeholder="What is the goal of this session?"
                                />
                            </div>
                        </div>

                        {/* SECTIONS */}
                        {workout.exercises?.map((section, idx) => (
                            <div
                                key={section.id}
                                onClick={() => setActiveSectionId(section.id)}
                                className={`animate-in fade-in slide-in-from-bottom-4 duration-500 transition-all border rounded-2xl p-4 ${activeSectionId === section.id ? 'border-indigo-500/50 bg-indigo-500/5 shadow-2xl shadow-indigo-500/10' : 'border-transparent hover:border-white/5'}`}
                                style={{ animationDelay: `${idx * 100}ms` }}
                            >
                                <div className="flex items-center justify-between mb-4 group">
                                    <input
                                        value={section.title}
                                        onChange={(e) => {
                                            const newEx = [...(workout.exercises || [])];
                                            newEx[idx].title = e.target.value;
                                            update('exercises', newEx);
                                        }}
                                        className="bg-transparent text-lg font-black text-slate-300 focus:text-white focus:outline-none border-b border-transparent focus:border-indigo-500 transition-all w-full max-w-xs"
                                    />
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const newEx = workout.exercises!.filter(s => s.id !== section.id);
                                                update('exercises', newEx);
                                            }}
                                            className="p-1 hover:bg-white/5 rounded text-slate-500 hover:text-rose-400"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>

                                {/* EXERCISE LIST */}
                                <div className="space-y-2">
                                    {section.exercises.map((ex, i) => (
                                        <div key={ex.id} className="group flex items-center gap-3 bg-slate-900 border border-white/5 p-3 rounded-lg hover:border-white/20 transition-all">
                                            <span className="text-slate-600 font-mono text-xs w-6">{i + 1}</span>
                                            <div className="flex-1">
                                                <div className="font-bold text-sm text-white">{ex.name}</div>
                                                <div className="flex gap-4 text-[10px] text-slate-400 mt-1">
                                                    <div className="flex gap-1 items-center">
                                                        <span className="uppercase font-bold tracking-wider text-slate-600">Sets</span>
                                                        <input
                                                            className="w-8 bg-transparent border-b border-slate-700 text-center focus:border-indigo-500 outline-none text-white"
                                                            defaultValue={ex.sets}
                                                            onBlur={(e) => {
                                                                const sIdx = workout.exercises!.findIndex(s => s.id === section.id);
                                                                const eIdx = section.exercises.findIndex(x => x.id === ex.id);
                                                                const newW = JSON.parse(JSON.stringify(workout));
                                                                newW.exercises[sIdx].exercises[eIdx].sets = parseInt(e.target.value);
                                                                setWorkout(newW);
                                                            }}
                                                        />
                                                    </div>
                                                    <div className="flex gap-1 items-center">
                                                        <span className="uppercase font-bold tracking-wider text-slate-600">Reps</span>
                                                        <input
                                                            className="w-12 bg-transparent border-b border-slate-700 text-center focus:border-indigo-500 outline-none text-white"
                                                            defaultValue={ex.reps}
                                                            onBlur={(e) => {
                                                                const sIdx = workout.exercises!.findIndex(s => s.id === section.id);
                                                                const eIdx = section.exercises.findIndex(x => x.id === ex.id);
                                                                const newW = JSON.parse(JSON.stringify(workout));
                                                                newW.exercises[sIdx].exercises[eIdx].reps = e.target.value;
                                                                setWorkout(newW);
                                                            }}
                                                        />
                                                    </div>
                                                    <div className="flex gap-1 items-center">
                                                        <span className="uppercase font-bold tracking-wider text-slate-600">Load</span>
                                                        <input
                                                            className="w-16 bg-transparent border-b border-slate-700 text-center focus:border-indigo-500 outline-none text-white"
                                                            defaultValue={ex.weight}
                                                            onBlur={(e) => {
                                                                const sIdx = workout.exercises!.findIndex(s => s.id === section.id);
                                                                const eIdx = section.exercises.findIndex(x => x.id === ex.id);
                                                                const newW = JSON.parse(JSON.stringify(workout));
                                                                newW.exercises[sIdx].exercises[eIdx].weight = e.target.value;
                                                                setWorkout(newW);
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                            <button onClick={() => removeExercise(section.id, ex.id)} className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-rose-500 p-2">✕</button>
                                        </div>
                                    ))}

                                    {/* EMPTY STATE */}
                                    {section.exercises.length === 0 && (
                                        <div className="py-8 text-center border-2 border-dashed border-white/5 rounded-xl">
                                            <p className="text-[10px] text-slate-500 mb-2">Section Empty</p>
                                            <button className="text-xs text-indigo-400 font-bold uppercase tracking-widest">+ Select from Library</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* ADD SECTION BTN */}
                        <button
                            onClick={() => update('exercises', [...(workout.exercises || []), { id: crypto.randomUUID(), title: "New Section", exercises: [] }])}
                            className="w-full py-4 border border-white/5 hover:border-white/20 hover:bg-white/5 rounded-xl border-dashed text-slate-500 hover:text-white transition-all font-bold uppercase tracking-widest text-xs"
                        >
                            + Add Section
                        </button>

                    </div>
                </div>

                {/* RIGHT: SMART TOOLBOX */}
                <div className="w-96 border-l border-white/10 bg-slate-900 hidden xl:flex flex-col">
                    <div className="p-4 border-b border-white/5 flex gap-2">
                        <button
                            onClick={() => setActiveTab('BUILD')}
                            className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-colors ${activeTab === 'BUILD' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-500 hover:text-slate-300'}`}
                        >
                            Builder Tools
                        </button>
                        <button
                            onClick={() => setActiveTab('ANALYZE')}
                            className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-colors ${activeTab === 'ANALYZE' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-500 hover:text-slate-300'}`}
                        >
                            Smart Analysis
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {activeTab === 'BUILD' ? (
                            <ExerciseSelector onSelect={addExercise} />
                        ) : (
                            <WorkoutAnalyzer workout={workout} />
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
}
