import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext.tsx';

interface Experiment {
    id: string;
    variant: 'A' | 'B';
}

interface ExperimentContextType {
    getVariant: (experimentId: string) => 'A' | 'B';
    trackConversion: (experimentId: string, goalId: string) => void;
}

const ExperimentContext = createContext<ExperimentContextType | undefined>(undefined);

export function ExperimentProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [assignments, setAssignments] = useState<Record<string, 'A' | 'B'>>({});

    useEffect(() => {
        if (!user) return;

        // Load assignments from localStorage or simulate deterministic assignment
        const saved = localStorage.getItem(`experiments_${user.id}`);
        if (saved) {
            setAssignments(JSON.parse(saved));
        }
    }, [user]);

    const getVariant = (experimentId: string): 'A' | 'B' => {
        if (assignments[experimentId]) return assignments[experimentId];

        // Assign deterministically based on hash of userId + experimentId
        const hash = (user?.id || 'anon') + experimentId;
        let charCodeSum = 0;
        for (let i = 0; i < hash.length; i++) charCodeSum += hash.charCodeAt(i);

        const variant = charCodeSum % 2 === 0 ? 'A' : 'B';
        const newAssignments: Record<string, 'A' | 'B'> = { ...assignments, [experimentId]: variant };
        setAssignments(newAssignments);

        if (user) {
            localStorage.setItem(`experiments_${user.id}`, JSON.stringify(newAssignments));
        }

        // Log assignment to analytics
        fetch('/api/usage/event', {
            method: 'POST',
            body: JSON.stringify({
                userId: user?.id || 'anon',
                sessionId: 'exp-init',
                type: 'other',
                target: 'experiment',
                label: `Assignment: ${experimentId}=${variant}`,
                path: window.location.pathname,
                timestamp: new Date().toISOString(),
                metadata: { experimentId, variant }
            })
        });

        return variant;
    };

    const trackConversion = (experimentId: string, goalId: string) => {
        const variant = getVariant(experimentId);
        fetch('/api/usage/event', {
            method: 'POST',
            body: JSON.stringify({
                userId: user?.id || 'anon',
                sessionId: 'exp-conv',
                type: 'other',
                target: 'experiment_goal',
                label: `Conversion: ${experimentId}=${variant}`,
                path: window.location.pathname,
                timestamp: new Date().toISOString(),
                metadata: { experimentId, variant, goalId }
            })
        });
    };

    return (
        <ExperimentContext.Provider value={{ getVariant, trackConversion }}>
            {children}
        </ExperimentContext.Provider>
    );
}

export function useExperiment() {
    const context = useContext(ExperimentContext);
    if (!context) throw new Error('useExperiment must be used within ExperimentProvider');
    return context;
}
