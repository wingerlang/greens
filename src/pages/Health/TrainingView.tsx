import React from 'react';
import { TrainingOverview } from '../../components/training/TrainingOverview.tsx';
import { ExerciseEntry } from '../../models/types.ts';

interface TrainingViewProps {
    exerciseEntries: ExerciseEntry[];
}

export function TrainingView({ exerciseEntries }: TrainingViewProps) {
    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <section>
                <h2 className="text-xl font-black text-white mb-6 flex items-center gap-3">
                    <span className="text-2xl">⚡</span>
                    Total Träningsanalys
                </h2>
                <TrainingOverview exercises={exerciseEntries} />
            </section>
        </div>
    );
}
