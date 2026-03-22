import React, { useMemo, useState } from 'react';
import { ExerciseEntry, UniversalActivity } from '../../models/types.ts';
import { mapUniversalToLegacyEntry } from '../../utils/mappers.ts';
import { CapacityChart } from './fitness/CapacityChart.tsx';
import { PaceEfficiencyChart } from './fitness/PaceEfficiencyChart.tsx';

interface CurrentFitnessViewProps {
    exerciseEntries: ExerciseEntry[];
    universalActivities: UniversalActivity[];
    filterStartDate?: string | null;
    filterEndDate?: string | null;
    onOpenActivity?: (id: string) => void;
}

export function CurrentFitnessView({
    exerciseEntries,
    universalActivities,
    filterStartDate,
    filterEndDate,
    onOpenActivity
}: CurrentFitnessViewProps) {
    const [calculationWindowDays, setCalculationWindowDays] = useState<number>(60);

    const allRuns = useMemo(() => {
        const legacy = exerciseEntries || [];
        const universal = universalActivities || [];
        const combined = [
            ...legacy.filter(e => e.type && (e.type.toLowerCase() === 'löpning' || e.type.toLowerCase() === 'running') && !e.excludeFromStats),
            ...universal
                .filter(u => u.performance?.activityType &&
                    (u.performance.activityType.toLowerCase() === 'löpning' || u.performance.activityType.toLowerCase() === 'running') &&
                    !u.performance?.excludeFromStats)
                .map(mapUniversalToLegacyEntry)
                .filter(e => e !== null) as ExerciseEntry[]
        ];

        // Deduplicate
        const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());

        console.log("CurrentFitnessView - combined runs:", combined.length);
        console.log("CurrentFitnessView - unique runs:", unique.length);
        console.log("CurrentFitnessView - filtering with dates:", filterStartDate, "to", filterEndDate);

        const filtered = unique.filter(run => {
            if (!run.distance || run.distance < 1) return false;
            if (!run.durationMinutes || run.durationMinutes < 1) return false;
            if (filterStartDate && run.date < filterStartDate) return false;
            if (filterEndDate && run.date > filterEndDate) return false;
            return true;
        }).sort((a, b) => a.date.localeCompare(b.date));

        console.log("CurrentFitnessView - final runs in view:", filtered.length);
        if (filtered.length > 0) {
            console.log("CurrentFitnessView - Dates:", filtered[0].date, "to", filtered[filtered.length - 1].date);
        }

        return filtered;
    }, [exerciseEntries, universalActivities, filterStartDate, filterEndDate]);

    return (
        <div className="space-y-6">
            <CapacityChart
                allRuns={allRuns}
                calculationWindowDays={calculationWindowDays}
                setCalculationWindowDays={setCalculationWindowDays}
                onOpenActivity={onOpenActivity}
            />

            <PaceEfficiencyChart
                allRuns={allRuns}
            />
        </div>
    );
}
