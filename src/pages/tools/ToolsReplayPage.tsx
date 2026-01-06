import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useData } from '../../context/DataContext.tsx';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
    ReferenceDot
} from 'recharts';
import {
    Play,
    Pause,
    Rewind,
    FastForward,
    Calendar,
    Trophy,
    Dumbbell,
    Activity,
    Scale
} from 'lucide-react';
import { ExerciseEntry, WeightEntry, EXERCISE_TYPES } from '../../models/types.ts';

// --- Types ---

interface ReplayEvent {
    id: string;
    date: string;
    type: 'weight' | 'exercise' | 'pb' | 'race';
    data: any; // ExerciseEntry | WeightEntry
    isGold?: boolean; // For PBs and Races
    title: string;
    subtitle?: string;
    value?: string; // "85 kg" or "10 km"
}

interface DailySnapshot {
    date: string; // YYYY-MM-DD
    weight: number | null;
    events: ReplayEvent[];
}

export function ToolsReplayPage() {
    return (
        <div className="max-w-7xl mx-auto px-4 py-8 animate-fade-in space-y-8">
            <div className="text-center space-y-2">
                <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
                    Replay Mode
                </h1>
                <p className="text-slate-400 max-w-xl mx-auto">
                    Återupplev din resa. Se framstegen, rekorden och slitet dag för dag.
                </p>
            </div>

            <div className="p-12 border border-dashed border-white/10 rounded-3xl flex items-center justify-center text-slate-500">
                Work in progress...
            </div>
        </div>
    );
}
