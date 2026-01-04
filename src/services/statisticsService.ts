
import { UniversalActivity } from '../models/types.ts';
import { StrengthWorkout } from '../models/strengthTypes.ts';

export interface CommunityStats {
    updatedAt: string;
    global: {
        totalUsers: number;
        totalDistanceKm: number;
        totalTonnage: number;
        totalWorkouts: number;
        totalDurationMinutes: number;
        totalGoalsAchieved: number;
    };
    averages: {
        distancePerUserPerMonth: number;
        tonnagePerUserPerMonth: number;
        workoutsPerUserPerMonth: number;
        sessionDurationMinutes: number;
    };
    strength: {
        exercises: Record<string, {
            name: string;
            count: number;
            avg1RM: number;
            max1RM: number;
            avgTonnage: number;
        }>;
        topExercises: string[];
    };
    cardio: {
        distances: Record<string, {
            count: number;
            avgTimeSeconds: number;
            fastestTimeSeconds: number;
            distribution: { range: string; count: number }[];
        }>;
    };
}

export const statisticsService = {
    async getCommunityStats(): Promise<CommunityStats | null> {
        try {
            const res = await fetch('/api/stats/community');
            if (!res.ok) throw new Error('Failed to fetch stats');
            return await res.json();
        } catch (e) {
            console.error("Failed to load community stats:", e);
            return null;
        }
    }
};
