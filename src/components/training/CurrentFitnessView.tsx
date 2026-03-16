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
}

export function CurrentFitnessView({
    exerciseEntries,
    universalActivities,
    filterStartDate,
    filterEndDate
}: CurrentFitnessViewProps) {
    const [calculationWindowDays, setCalculationWindowDays] = useState<number>(60);
    const [selectedPaceRange, setSelectedPaceRange] = useState<string>('5:00-5:15');

    const allRuns = useMemo(() => {
        const legacy = exerciseEntries || [];
        const universal = universalActivities || [];
        const combined = [
            ...legacy.filter(e => e.type === 'Löpning'),
            ...universal
                .filter(u => u.performance?.activityType === 'Löpning')
                .map(mapUniversalToLegacyEntry)
                .filter(e => e !== null) as ExerciseEntry[]
        ];

        // Deduplicate
        const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());

        return unique.filter(run => {
            if (!run.distance || run.distance < 1) return false;
            if (!run.durationMinutes || run.durationMinutes < 1) return false;
            if (filterStartDate && run.date < filterStartDate) return false;
            if (filterEndDate && run.date > filterEndDate) return false;
            return true;
        }).sort((a, b) => a.date.localeCompare(b.date));
    }, [exerciseEntries, universalActivities, filterStartDate, filterEndDate]);

    return (
        <div className="space-y-6">
            <CapacityChart
                allRuns={allRuns}
                calculationWindowDays={calculationWindowDays}
                setCalculationWindowDays={setCalculationWindowDays}
            />

            <PaceEfficiencyChart
                allRuns={allRuns}
                selectedPaceRange={selectedPaceRange}
                setSelectedPaceRange={setSelectedPaceRange}
            />
        </div>
    );
}
