import React, { useMemo, useState } from 'react';
import { ExerciseEntry, UniversalActivity } from '../../models/types.ts';
import { mapUniversalToLegacyEntry } from '../../utils/mappers.ts';
import { CapacityChart } from './fitness/CapacityChart.tsx';
import { PaceEfficiencyChart } from './fitness/PaceEfficiencyChart.tsx';
import { RunningQuadrantChart } from './fitness/RunningQuadrantChart.tsx';
import { YearlyBestList } from './fitness/YearlyBestList.tsx';
import { BestEffortTrendChart } from './fitness/BestEffortTrendChart.tsx';
import { RefreshCw } from 'lucide-react';

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
    const [isSyncing, setIsSyncing] = useState(false);
    const [hoveredDate, setHoveredDate] = useState<string | null>(null);

    const handleSyncBestEfforts = async () => {
        setIsSyncing(true);
        try {
            const year = new Date().getFullYear();
            const res = await fetch('/api/strava/backfill-best-efforts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ year: year.toString() })
            });
            const data = await res.json();
            alert(`Synk klar! Uppdaterade ${data.updated} pass.`);
            window.location.reload();
        } catch (e) {
            console.error("Sync failed", e);
            alert("Synk misslyckades. Kontrollera din anslutning.");
        } finally {
            setIsSyncing(false);
        }
    };

    const allRuns = useMemo(() => {
        const legacy = exerciseEntries || [];
        const universal = universalActivities || [];
        const combined = [
            ...legacy.filter(e => {
                const isRunning = e.type && (e.type.toLowerCase() === 'löpning' || e.type.toLowerCase() === 'running');
                
                // Check if this legacy entry is a component of ANY merge in universalActivities
                const isMergedComponent = universal.some(master => {
                    if (!master.mergeInfo?.isMerged) return false;
                    const componentIds = master.mergeInfo.originalActivityIds || [];
                    return componentIds.includes(e.id) || (e.externalId && componentIds.includes(e.externalId));
                }) || universal.some(u => (u.id === e.id || u.performance?.source?.externalId === e.id) && u.mergedIntoId);

                return isRunning && !e.excludeFromStats && !isMergedComponent;
            }),
            ...universal
                .filter(u => {
                    const isRunning = u.performance?.activityType && 
                        (u.performance.activityType.toLowerCase() === 'löpning' || u.performance.activityType.toLowerCase() === 'running');
                    
                    // Exclude if it's explicitly marked as a component
                    if (u.mergedIntoId) return false;
                    
                    // Exclude if its ID is referenced as an originalActivityId in any OTHER activity
                    const isPartOfOtherMerge = universal.some(other => 
                        other.id !== u.id && 
                        other.mergeInfo?.isMerged &&
                        (other.mergeInfo.originalActivityIds?.includes(u.id) || (u.performance?.source?.externalId && other.mergeInfo.originalActivityIds?.includes(u.performance.source.externalId)))
                    );
                    
                    return isRunning && !u.performance?.excludeFromStats && !isPartOfOtherMerge;
                })
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
            <div className="flex justify-end">
                <button
                    onClick={handleSyncBestEfforts}
                    disabled={isSyncing}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-white/10 rounded-xl text-slate-400 hover:text-white hover:border-amber-400/50 transition-all text-xs font-bold uppercase tracking-wider disabled:opacity-50"
                >
                    <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                    {isSyncing ? 'Synkar...' : 'Synka kilometertider'}
                </button>
            </div>

            <CapacityChart
                allRuns={allRuns}
                calculationWindowDays={calculationWindowDays}
                setCalculationWindowDays={setCalculationWindowDays}
                onOpenActivity={onOpenActivity}
                hoveredDate={hoveredDate}
                onHoverDate={setHoveredDate}
            />

            <YearlyBestList 
                activities={universalActivities}
                onOpenActivity={onOpenActivity}
            />

            <BestEffortTrendChart
                activities={universalActivities}
                filterStartDate={filterStartDate}
                filterEndDate={filterEndDate}
                onOpenActivity={onOpenActivity}
            />

            <PaceEfficiencyChart
                allRuns={allRuns}
                hoveredDate={hoveredDate}
                onHoverDate={setHoveredDate}
            />

            <RunningQuadrantChart
                allRuns={allRuns}
                onOpenActivity={onOpenActivity}
                hoveredDate={hoveredDate}
                onHoverDate={setHoveredDate}
            />
        </div>
    );
}
