import { z } from "zod";

/**
 * Shared schemas for API validation
 */

export const LoginSchema = z.object({
    username: z.string().min(3).max(50),
    password: z.string().min(6),
});

export const RegisterSchema = z.object({
    username: z.string().min(3).max(50),
    password: z.string().min(6),
    email: z.string().email().optional().or(z.literal("")),
});

export const UserUpdateSchema = z.object({
    name: z.string().max(100).optional(),
    handle: z.string().min(3).max(30).optional(),
    bio: z.string().max(500).optional(),
    location: z.string().max(100).optional(),
    website: z.string().url().optional().or(z.literal("")),
    avatarUrl: z.string().url().optional().or(z.literal("")),
    birthYear: z.number().int().min(1900).max(new Date().getFullYear()).optional(),
    gender: z.enum(["male", "female", "other", "prefer_not_to_say"]).optional(),
});

export const SubscriptionUpdateSchema = z.object({
    tier: z.enum(["free", "evergreen"]),
});

export const PrivacyUpdateSchema = z.object({
    isPublic: z.boolean().optional(),
    showWeight: z.boolean().optional(),
    showHeight: z.boolean().optional(),
    showBirthYear: z.boolean().optional(),
    showDetailedTraining: z.boolean().optional(),
    sharing: z.object({
        training: z.enum(["PUBLIC", "FRIENDS", "PRIVATE"]),
        nutrition: z.enum(["PUBLIC", "FRIENDS", "PRIVATE"]),
        health: z.enum(["PUBLIC", "FRIENDS", "PRIVATE"]),
        social: z.enum(["PUBLIC", "FRIENDS", "PRIVATE"]),
        body: z.enum(["PUBLIC", "FRIENDS", "PRIVATE"]),
    }).optional(),
});

export const ActivitySchema = z.object({
    id: z.string(),
    userId: z.string().optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    performance: z.object({
        activityType: z.string(),
        durationMinutes: z.number().min(0),
        calories: z.number().min(0).optional(),
        distanceKm: z.number().min(0).optional(),
        intensity: z.enum(["low", "moderate", "high", "ultra"]).optional(),
        notes: z.string().max(2000).optional(),
        excludeFromStats: z.boolean().optional(),
        subType: z.string().optional(),
        heartRateAvg: z.number().optional(),
    }).optional(),
    plan: z.object({
        title: z.string().min(1).max(200),
        activityType: z.string(),
        durationMinutes: z.number().optional(),
        distanceKm: z.number().optional(),
        description: z.string().max(1000).optional(),
    }).optional(),
});

export const MealItemSchema = z.object({
    type: z.enum(["recipe", "foodItem", "estimate"]),
    referenceId: z.string(),
    servings: z.number().min(0),
    weightGrams: z.number().min(0).optional(),
    variantId: z.string().optional(),
    estimateDetails: z.object({
        name: z.string().max(100),
        caloriesMin: z.number().min(0),
        caloriesMax: z.number().min(0),
        caloriesAvg: z.number().min(0),
        protein: z.number().optional(),
        carbs: z.number().optional(),
        fat: z.number().optional(),
        uncertaintyEmoji: z.string().optional(),
    }).optional(),
});

export const MealEntrySchema = z.object({
    id: z.string(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    mealType: z.enum(["breakfast", "lunch", "dinner", "snack", "beverage", "estimate"]),
    items: z.array(MealItemSchema),
    title: z.string().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
});

export const WeightEntrySchema = z.object({
    id: z.string().optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    weight: z.number().min(20).max(500),
    fatPercentage: z.number().min(1).max(100).optional(),
    muscleMass: z.number().optional(),
    waterPercentage: z.number().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
});
