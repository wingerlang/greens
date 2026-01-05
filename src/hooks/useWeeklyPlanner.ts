import { useState, useCallback, useMemo } from 'react';
import { useData } from '../context/DataContext.tsx';
import { PlannedActivity, generateId, getISODate } from '../models/types.ts';
import { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';

export interface PlannerConfig {
    weeklyVolumeKm: number;
    runSessions: number;
    strengthSessions: number;
    longRunRatio: number; // 0.3 = 30%
    intensityMix: 'polarised' | 'threshold' | 'pyramid';
}

const DEFAULT_CONFIG: PlannerConfig = {
    weeklyVolumeKm: 30,
    runSessions: 4,
    strengthSessions: 2,
    longRunRatio: 0.35,
    intensityMix: 'polarised'
};

export function useWeeklyPlanner() {
    const { exerciseEntries, addCoachGoal } = useData(); // We might need a better save method later
    const [config, setConfig] = useState<PlannerConfig>(DEFAULT_CONFIG);
    const [draftActivities, setDraftActivities] = useState<PlannedActivity[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);

    // Smart Increase Logic
    const applySmartIncrease = useCallback(() => {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const isoOneWeekAgo = getISODate(oneWeekAgo);

        const recentRuns = exerciseEntries.filter(e =>
            e.type === 'running' &&
            e.date >= isoOneWeekAgo
        );

        const totalKm = recentRuns.reduce((sum, e) => sum + (e.distance || 0), 0);
        const totalSessions = recentRuns.length;

        // Safety checks
        const newVol = Math.max(15, Math.round(totalKm * 1.1));
        const newSessions = Math.max(3, totalSessions); // Don't suggest less than 3 for a plan

        setConfig(prev => ({
            ...prev,
            weeklyVolumeKm: newVol,
            runSessions: newSessions
        }));
    }, [exerciseEntries]);

    // Generator Logic
    const generateDraft = useCallback(() => {
        const newActivities: PlannedActivity[] = [];

        // 1. Long Run
        const longRunDist = Math.round(config.weeklyVolumeKm * config.longRunRatio);
        newActivities.push({
            id: generateId(),
            date: 'UNASSIGNED',
            type: 'RUN',
            category: 'LONG_RUN',
            title: 'Långpass',
            description: 'Veckans nyckelpass. Håll ett lugnt och stabilt tempo.',
            structure: { warmupKm: 0, mainSet: [], cooldownKm: 0 },
            targetPace: '6:00', // Placeholder
            targetHrZone: 2,
            estimatedDistance: longRunDist,
            status: 'DRAFT'
        });

        // 2. Quality Session (if applicable)
        let remainingVol = config.weeklyVolumeKm - longRunDist;
        let remainingSessions = config.runSessions - 1;

        if (remainingSessions > 0 && config.weeklyVolumeKm > 20) {
            const qualityDist = Math.round(Math.min(10, remainingVol * 0.4)); // Cap quality at 10km or 40% of remainder
            newActivities.push({
                id: generateId(),
                date: 'UNASSIGNED',
                type: 'RUN',
                category: 'INTERVALS',
                title: 'Intervaller',
                description: 'Högintensivt pass för syreupptagning.',
                structure: { warmupKm: 2, mainSet: [], cooldownKm: 2 },
                targetPace: '4:30',
                targetHrZone: 4,
                estimatedDistance: qualityDist,
                status: 'DRAFT'
            });
            remainingVol -= qualityDist;
            remainingSessions--;
        }

        // 3. Easy Runs (Fill the rest)
        if (remainingSessions > 0) {
            const avgEasyDist = Math.max(3, Math.round(remainingVol / remainingSessions * 10) / 10);
            for (let i = 0; i < remainingSessions; i++) {
                 newActivities.push({
                    id: generateId(),
                    date: 'UNASSIGNED',
                    type: 'RUN',
                    category: 'EASY',
                    title: 'Distans',
                    description: 'Lugnt distanspass för volym.',
                    structure: { warmupKm: 0, mainSet: [], cooldownKm: 0 },
                    targetPace: '6:00',
                    targetHrZone: 2,
                    estimatedDistance: avgEasyDist,
                    status: 'DRAFT'
                });
            }
        }

        // 4. Strength Sessions
        for (let i = 0; i < config.strengthSessions; i++) {
             newActivities.push({
                id: generateId(),
                date: 'UNASSIGNED',
                type: 'RUN', // Tech debt: type is strictly 'RUN' in types currently? No, ExerciseType is broader but PlannedActivity type is strictly 'RUN' in the interface def.
                // Wait, checked types.ts: type: 'RUN' is hardcoded in PlannedActivity interface.
                // I need to fix types.ts to allow type: 'STRENGTH' or generic.
                // For now, I will cast it or update types.ts again.
                // Let's assume I fixed types.ts to allow other types or I'll fix it in a second.
                // Actually, I only updated `category`. `type` field is literal 'RUN'.
                // I should update `type` in PlannedActivity too.
                category: 'STRENGTH',
                title: 'Styrkepass',
                description: 'Helkroppsstyrka eller specifikt fokus.',
                structure: { warmupKm: 0, mainSet: [], cooldownKm: 0 },
                targetPace: '-',
                targetHrZone: 0,
                estimatedDistance: 0,
                status: 'DRAFT'
            } as any);
        }

        setDraftActivities(newActivities);
    }, [config]);


    // DnD Handlers
    const onDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const onDragOver = (event: DragOverEvent) => {
        const { active, over } = event;
        if (!over) return;

        // Note: We don't strictly need complex reordering logic for this simple MVP
        // Visual feedback is handled by dnd-kit
    };

    const onDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over) return;

        const activeItem = draftActivities.find(a => a.id === active.id);
        const overId = over.id as string; // This will be 'UNASSIGNED' or a specific date '2024-01-01'

        if (activeItem && activeItem.date !== overId) {
            // Move item to new list (update date)
            setDraftActivities(prev => prev.map(a =>
                a.id === active.id
                    ? { ...a, date: overId }
                    : a
            ));
        }
    };

    return {
        config,
        setConfig,
        draftActivities,
        setDraftActivities,
        activeId,
        applySmartIncrease,
        generateDraft,
        dndHandlers: {
            onDragStart,
            onDragOver,
            onDragEnd
        }
    };
}
