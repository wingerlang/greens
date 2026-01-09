// ============================================
// Phase 5: Social & Community Features
// ============================================

import { PlannedActivity } from './activity.ts';

export type PlanDifficulty = 'beginner' | 'intermediate' | 'advanced' | 'elite';
export type PlanGoalType = '5K' | '10K' | 'half_marathon' | 'marathon' | 'ultra' | 'base_building' | 'custom';

export interface PlanTemplate {
    id: string;
    title: string;
    description: string;
    creatorId: string;
    creatorName: string;
    // Plan metadata
    goalType: PlanGoalType;
    difficulty: PlanDifficulty;
    durationWeeks: number;
    weeklyVolumeRange: { min: number; max: number };
    sessionsPerWeek: number;
    // Template structure (relative days, not absolute dates)
    weekTemplates: {
        weekNumber: number;
        phase: 'base' | 'build' | 'peak' | 'taper';
        targetVolumeKm: number;
        sessions: {
            dayOfWeek: number; // 0-6
            category: PlannedActivity['category'];
            title: string;
            description: string;
            distanceKm: number;
            paceDescription: string;
        }[];
    }[];
    // Social
    visibility: 'private' | 'public';
    forkCount: number;
    likeCount: number;
    rating?: number;
    tags: string[];
    version: number;
    changelog?: string[];
    createdAt: string;
    updatedAt: string;
}

export interface LeaderboardEntry {
    userId: string;
    userName: string;
    avatarUrl?: string;
    rank: number;
    // Stats
    weeklyVolumeKm: number;
    monthlyVolumeKm: number;
    currentStreak: number;
    prCount: number;
    completionRate: number;
    // Badges
    badges: { type: string; name: string; icon: string }[];
    lastActiveDate: string;
}

// ============================================
// Competition Mode Types
// ============================================

export interface CompetitionRule {
    id: string;
    name: string;
    description: string;
    points: number;
    type: 'activity' | 'metric' | 'diet' | 'custom';
    presetId?: string;
}

export interface CompetitionParticipant {
    userId: string;
    name: string;
    scores: Record<string, number>; // date -> daily total points
}

export interface Competition {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    participants: CompetitionParticipant[];
    rules: CompetitionRule[];
    isDraft?: boolean;
    isPublic?: boolean;
    creatorId?: string;
    createdAt: string;
}
