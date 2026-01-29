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
