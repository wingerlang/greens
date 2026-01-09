// ============================================
// Smart Coach Types
// ============================================

export interface CoachGoal {
    id: string;
    type: 'MARATHON' | 'HALF_MARATHON' | '10K' | '5K' | 'MAINTENANCE';
    targetDate: string; // ISO date string
    targetTimeSeconds?: number;
    isActive: boolean;
    createdAt: string;
}

export interface CoachConfig {
    userProfile: {
        maxHr: number;
        restingHr: number;
        recentRaceTime?: { distance: number; timeSeconds: number }; // Used for VDOT
        currentForm?: { distanceKm: number; timeSeconds: number }; // User's assessment of current 5k/10k form
    };
    preferences: {
        weeklyVolumeKm: number; // Target volume
        longRunDay: string;
        intervalDay: string;
        trainingDays: number[]; // 0-6 (Sun-Sat)
        weightGoal?: number; // Target weight for performance/health
    };
    goals: CoachGoal[];
    fineTuning?: FineTuningConfig;
}

// ============================================
// Phase 1: Fine-Tuning Configuration
// ============================================

export interface FineTuningConfig {
    sessionsPerWeek: number;           // 2-7
    loadIndex: number;                 // 1-10 intensity scale
    longRunPercentage: number;         // 15-40% of weekly volume
    easyPaceAdjustmentSec: number;     // +/- seconds per km for easy pace
    qualitySessionRatio: number;       // 0.1-0.4 (% of sessions that are hard)
    includeStrength: boolean;
    strengthDays: number[];            // 0-6 for days of week
    longRunMaxKm?: number;             // Cap for long run distance
    tempoIntensity?: 'conservative' | 'moderate' | 'aggressive';
}

export const DEFAULT_FINE_TUNING: FineTuningConfig = {
    sessionsPerWeek: 4,
    loadIndex: 5,
    longRunPercentage: 30,
    easyPaceAdjustmentSec: 0,
    qualitySessionRatio: 0.25,
    includeStrength: false,
    strengthDays: [],
    tempoIntensity: 'moderate'
};

// ============================================
// Phase 4: Coach-Athlete Mode
// ============================================

export interface CoachAthleteRelation {
    id: string;
    coachId: string;
    athleteId: string;
    coachName?: string;
    athleteName?: string;
    status: 'pending' | 'active' | 'declined' | 'removed';
    sharedPlanIds: string[];
    permissions: {
        canViewPlan: boolean;
        canEditPlan: boolean;
        canViewProgress: boolean;
        canComment: boolean;
    };
    createdAt: string;
    updatedAt: string;
}

export interface Comment {
    id: string;
    parentId?: string;        // For nested replies
    targetType: 'activity' | 'plan' | 'goal';
    targetId: string;
    authorId: string;
    authorName: string;
    authorRole: 'coach' | 'athlete';
    content: string;
    reactions?: { emoji: string; count: number; userIds: string[] }[];
    createdAt: string;
    updatedAt?: string;
    isEdited?: boolean;
}

export interface Notification {
    id: string;
    userId: string;
    type: 'comment' | 'feedback' | 'plan_shared' | 'plan_updated' | 'invitation' | 'reminder';
    title: string;
    message: string;
    relatedId?: string;
    relatedType?: 'activity' | 'plan' | 'goal' | 'athlete';
    isRead: boolean;
    createdAt: string;
}

export interface SharedPlan {
    id: string;
    planOwnerId: string;
    sharedWithIds: string[];
    visibility: 'private' | 'shared' | 'public';
    allowComments: boolean;
    allowForks: boolean;
    createdAt: string;
}
