import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
    UniversalActivity,
    ActivityPerformanceSection,
    ActivitySource
} from '../models/types.ts';

// Environment variables (set these in your deployment)
const STRAVA_CLIENT_ID = Deno.env.get('STRAVA_CLIENT_ID') || '';
const STRAVA_CLIENT_SECRET = Deno.env.get('STRAVA_CLIENT_SECRET') || '';
const STRAVA_REDIRECT_URI = Deno.env.get('STRAVA_REDIRECT_URI') || 'http://localhost:3000/api/strava/callback';

const STRAVA_AUTH_URL = 'https://www.strava.com/oauth/authorize';
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';
const STRAVA_API_BASE = 'https://www.strava.com/api/v3';

// ==========================================
// Types
// ==========================================

export interface StravaTokens {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    athleteId: number;
    athleteName: string;
}

export interface StravaActivity {
    id: number;
    name: string;
    type: string;
    sport_type: string;
    start_date: string;
    start_date_local: string;
    elapsed_time: number;      // seconds
    moving_time: number;       // seconds
    distance: number;          // meters
    total_elevation_gain: number; // meters
    average_heartrate?: number;
    max_heartrate?: number;
    calories?: number;
    average_speed: number;     // m/s
    max_speed: number;         // m/s
    has_heartrate: boolean;
    pr_count: number;
    kudos_count: number;
    achievement_count: number;
}

export interface StravaAthlete {
    id: number;
    firstname: string;
    lastname: string;
    profile: string;           // avatar URL
    city: string;
    country: string;
    premium: boolean;
    summit: boolean;
    created_at: string;
    updated_at: string;
}

export interface StravaAthleteStats {
    biggest_ride_distance: number;
    biggest_climb_elevation_gain: number;
    recent_ride_totals: { count: number; distance: number; moving_time: number; elevation_gain: number };
    recent_run_totals: { count: number; distance: number; moving_time: number; elevation_gain: number };
    recent_swim_totals: { count: number; distance: number; moving_time: number };
    ytd_ride_totals: { count: number; distance: number; moving_time: number; elevation_gain: number };
    ytd_run_totals: { count: number; distance: number; moving_time: number; elevation_gain: number };
    ytd_swim_totals: { count: number; distance: number; moving_time: number };
    all_ride_totals: { count: number; distance: number; moving_time: number; elevation_gain: number };
    all_run_totals: { count: number; distance: number; moving_time: number; elevation_gain: number };
    all_swim_totals: { count: number; distance: number; moving_time: number };
}

// ==========================================
// OAuth Flow
// ==========================================

/**
 * Generate the Strava OAuth authorization URL
 */
export function getStravaAuthUrl(state?: string): string {
    const params = new URLSearchParams({
        client_id: STRAVA_CLIENT_ID,
        redirect_uri: STRAVA_REDIRECT_URI,
        response_type: 'code',
        scope: 'read,activity:read_all,profile:read_all',
        state: state || crypto.randomUUID(),
    });
    return `${STRAVA_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeStravaCode(code: string): Promise<StravaTokens | null> {
    try {
        const response = await fetch(STRAVA_TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: STRAVA_CLIENT_ID,
                client_secret: STRAVA_CLIENT_SECRET,
                code,
                grant_type: 'authorization_code',
            }),
        });

        if (!response.ok) {
            console.error('Strava token exchange failed:', await response.text());
            return null;
        }

        const data = await response.json();
        return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresAt: data.expires_at * 1000, // Convert to ms
            athleteId: data.athlete.id,
            athleteName: `${data.athlete.firstname} ${data.athlete.lastname}`,
        };
    } catch (error) {
        console.error('Strava token exchange error:', error);
        return null;
    }
}

/**
 * Refresh an expired access token
 */
export async function refreshStravaToken(refreshToken: string): Promise<StravaTokens | null> {
    try {
        const response = await fetch(STRAVA_TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: STRAVA_CLIENT_ID,
                client_secret: STRAVA_CLIENT_SECRET,
                refresh_token: refreshToken,
                grant_type: 'refresh_token',
            }),
        });

        if (!response.ok) {
            console.error('Strava token refresh failed:', await response.text());
            return null;
        }

        const data = await response.json();
        return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresAt: data.expires_at * 1000,
            athleteId: 0, // Not returned on refresh
            athleteName: '',
        };
    } catch (error) {
        console.error('Strava token refresh error:', error);
        return null;
    }
}

// ==========================================
// API Calls
// ==========================================

async function stravaFetch<T>(endpoint: string, accessToken: string): Promise<T | null> {
    try {
        const response = await fetch(`${STRAVA_API_BASE}${endpoint}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        if (!response.ok) {
            console.error(`Strava API error (${endpoint}):`, await response.text());
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error(`Strava API fetch error (${endpoint}):`, error);
        return null;
    }
}

/**
 * Get authenticated athlete profile
 */
export async function getStravaAthlete(accessToken: string): Promise<StravaAthlete | null> {
    return stravaFetch<StravaAthlete>('/athlete', accessToken);
}

/**
 * Get athlete statistics
 */
export async function getStravaAthleteStats(athleteId: number, accessToken: string): Promise<StravaAthleteStats | null> {
    return stravaFetch<StravaAthleteStats>(`/athletes/${athleteId}/stats`, accessToken);
}

/**
 * Get athlete activities (paginated)
 */
export async function getStravaActivities(
    accessToken: string,
    options: {
        before?: number;  // Unix timestamp
        after?: number;   // Unix timestamp
        page?: number;
        perPage?: number;
    } = {}
): Promise<StravaActivity[]> {
    const params = new URLSearchParams();
    if (options.before) params.append('before', options.before.toString());
    if (options.after) params.append('after', options.after.toString());
    params.append('page', (options.page || 1).toString());
    params.append('per_page', (options.perPage || 30).toString());

    const activities = await stravaFetch<StravaActivity[]>(`/athlete/activities?${params.toString()}`, accessToken);
    return activities || [];
}

/**
 * Get detailed activity with laps, zones, etc.
 */
export async function getStravaActivityDetail(activityId: number, accessToken: string): Promise<StravaActivity | null> {
    return stravaFetch<StravaActivity>(`/activities/${activityId}?include_all_efforts=true`, accessToken);
}

// ==========================================
// Data Mapping
// ==========================================

type ExerciseType = 'running' | 'cycling' | 'swimming' | 'strength' | 'yoga' | 'walking' | 'other';
type ExerciseIntensity = 'low' | 'moderate' | 'high';

/**
 * Map Strava activity type to app exercise type
 */
export function mapStravaType(stravaType: string): ExerciseType {
    const mapping: Record<string, ExerciseType> = {
        'Run': 'running',
        'TrailRun': 'running',
        'VirtualRun': 'running',
        'Ride': 'cycling',
        'VirtualRide': 'cycling',
        'GravelRide': 'cycling',
        'MountainBikeRide': 'cycling',
        'EBikeRide': 'cycling',
        'Swim': 'swimming',
        'Walk': 'walking',
        'Hike': 'walking',
        'WeightTraining': 'strength',
        'Workout': 'strength',
        'CrossFit': 'strength',
        'Yoga': 'yoga',
        'Pilates': 'yoga',
    };
    return mapping[stravaType] || 'other';
}

/**
 * Estimate intensity from heart rate or pace
 */
export function estimateIntensity(activity: StravaActivity): ExerciseIntensity {
    // If we have heart rate data
    if (activity.average_heartrate) {
        if (activity.average_heartrate > 160) return 'high';
        if (activity.average_heartrate > 130) return 'moderate';
        return 'low';
    }

    // For running, estimate from pace (m/s to min/km)
    if (activity.type === 'Run' && activity.average_speed > 0) {
        const paceMinPerKm = 1000 / activity.average_speed / 60;
        if (paceMinPerKm < 5) return 'high';
        if (paceMinPerKm < 6.5) return 'moderate';
        return 'low';
    }

    return 'moderate';
}

/**
 * Convert Strava activity to app exercise entry format
 */
export function mapStravaActivityToExercise(activity: StravaActivity) {
    return {
        externalId: `strava_${activity.id}`,
        platform: 'strava' as const,
        date: activity.start_date_local.split('T')[0],
        type: mapStravaType(activity.type),
        durationMinutes: Math.round(activity.moving_time / 60),
        intensity: estimateIntensity(activity),
        caloriesBurned: activity.calories || Math.round(activity.moving_time / 60 * 8), // Estimate if missing
        distance: activity.distance ? Math.round(activity.distance / 10) / 100 : undefined, // Convert to km
        notes: activity.name,
        heartRateAvg: activity.average_heartrate,
        heartRateMax: activity.max_heartrate,
        elevationGain: activity.total_elevation_gain,
        prCount: activity.pr_count,
        kudosCount: activity.kudos_count,
    };
}

// ==========================================
// Check if credentials are configured
// ==========================================

export function isStravaConfigured(): boolean {
    return Boolean(STRAVA_CLIENT_ID && STRAVA_CLIENT_SECRET);
}

// ==========================================
// Universal Activity Mapping (Database Overhaul)
// ==========================================

/**
 * Convert Strava activity to Universal Activity Performance Section
 */
export function mapStravaToPerformance(activity: StravaActivity): ActivityPerformanceSection {
    return {
        source: {
            source: 'strava',
            externalId: activity.id.toString(),
            importedAt: new Date().toISOString()
        },
        distanceKm: activity.distance ? Math.round(activity.distance / 10) / 100 : 0,
        durationMinutes: Math.round(activity.moving_time / 60),
        calories: activity.calories || Math.round((activity.moving_time / 60) * 8), // Rough estimate fallback

        avgHeartRate: activity.average_heartrate,
        maxHeartRate: activity.max_heartrate,
        elevationGain: activity.total_elevation_gain,

        activityType: mapStravaType(activity.type),
        notes: activity.name
    };
}

/**
 * Create a new Universal Activity from a Strava Activity (Unplanned)
 */
export function createUniversalFromStrava(activity: StravaActivity, userId: string): UniversalActivity {
    const performance = mapStravaToPerformance(activity);

    return {
        id: crypto.randomUUID(),
        userId,
        date: activity.start_date_local.split('T')[0],
        status: 'COMPLETED',
        performance,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
}
