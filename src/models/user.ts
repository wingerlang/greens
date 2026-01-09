import { MealType } from './common.ts';

// ============================================
// User Settings
// ============================================

/** User preferences and settings */
export interface UserSettings {
    theme: 'light' | 'dark'; // explicit instead of importing Theme to avoid circular dep if Theme moves
    visibleMeals: MealType[];
    dailyCalorieGoal: number;
    dailyProteinGoal: number;
    dailyCarbsGoal: number;
    dailyFatGoal: number;
    // Physical Profile
    birthYear?: number;
    height?: number; // cm
    gender?: 'male' | 'female' | 'other';
    trainingGoal?: 'neutral' | 'deff' | 'bulk';
    weight?: number; // kg
    dailySleepGoal?: number;
    dailyWaterGoal?: number;
    showSleep?: boolean;
    showWater?: boolean;
    dailyCaffeineLimit?: number;
    dailyTrainingGoal?: number; // minutes
    dailyAlcoholLimitWeekday?: number;
    dailyAlcoholLimitWeekend?: number;
    densityMode?: 'compact' | 'slim' | 'cozy';
    expandedSections?: Record<string, boolean>; // Persisted UI state
    // Calorie Mode: 'tdee' = TDEE-based, 'fixed' = fixed base + exercise calories
    calorieMode?: 'tdee' | 'fixed';
    fixedCalorieBase?: number; // Base calories when calorieMode === 'fixed'
    incompleteDays?: Record<string, boolean>; // Map of date (YYYY-MM-DD) -> isIncomplete
    noccoOClockEnabled?: boolean;
}

/** User roles for permissions */
export type UserRole = 'admin' | 'user' | 'coach' | 'athlete';

/** Subscription plans for monetization */
export type SubscriptionPlan = 'free' | 'evergreen';

export type VisibilityLevel = 'PUBLIC' | 'FRIENDS' | 'PRIVATE' | 'INDIVIDUAL';

export interface UserPrivacy {
    isPublic: boolean; // Base profile visibility
    allowFollowers: boolean;

    // Granular Category Sharing
    sharing: {
        training: VisibilityLevel;
        nutrition: VisibilityLevel;
        health: VisibilityLevel;
        social: VisibilityLevel;
        body: VisibilityLevel;
    };

    // Whitelisted user IDs for individual or exclusive sharing
    whitelistedUsers: string[];

    // NEW: Per-person overrides for specific categories
    // Key = userId, Value = which categories they have access to (true = allow, false = deny)
    categoryOverrides?: {
        [userId: string]: {
            training?: boolean;
            nutrition?: boolean;
            health?: boolean;
            social?: boolean;
            body?: boolean;
        };
    };

    // Specific Detail Toggles
    showWeight: boolean;
    showHeight: boolean;
    showBirthYear: boolean;
    showDetailedTraining: boolean; // Full workout vs summary
}

/** User model */
export interface User {
    id: string;
    username: string;
    name: string;
    email: string;
    role: UserRole;
    plan: SubscriptionPlan;
    settings: UserSettings;
    householdId?: string; // For shared plans
    createdAt: string;

    // Social & Privacy (Phase 6)
    handle?: string; // Unique @handle
    bio?: string;
    location?: string;
    website?: string;
    avatarUrl?: string; // Explicit field for social
    followersCount?: number;
    followingCount?: number;
    privacy?: UserPrivacy;
}

export const DEFAULT_PRIVACY: UserPrivacy = {
    isPublic: true,
    allowFollowers: true,
    sharing: {
        training: 'FRIENDS',
        nutrition: 'FRIENDS',
        health: 'PRIVATE',
        social: 'FRIENDS',
        body: 'PRIVATE'
    },
    whitelistedUsers: [],
    showWeight: false,
    showHeight: false,
    showBirthYear: false,
    showDetailedTraining: true
};

export const DEFAULT_USER_SETTINGS: UserSettings = {
    theme: 'dark',
    visibleMeals: ['breakfast', 'lunch', 'dinner', 'snack'],
    dailyCalorieGoal: 2000,
    dailyProteinGoal: 150,
    dailyCarbsGoal: 50,
    dailyFatGoal: 30,
    trainingGoal: 'neutral',
    weight: 80,
    dailySleepGoal: 8,
    dailyWaterGoal: 8,
    dailyCaffeineLimit: 400,
    dailyTrainingGoal: 60,
    dailyAlcoholLimitWeekday: 0,
    dailyAlcoholLimitWeekend: 2,
    showSleep: true,
    showWater: true,
    densityMode: 'cozy',
    expandedSections: {
        'recent-workouts': true,
        'top-exercises': true
    },
    noccoOClockEnabled: true
};
