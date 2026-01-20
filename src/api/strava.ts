import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
    UniversalActivity,
    ActivityPerformanceSection,
    ActivitySource,
    UserSettings
} from '../models/types.ts';

// Environment variables (set these in your deployment)
// @ts-ignore: Deno is polyfilled
const STRAVA_CLIENT_ID = globalThis.Deno ? Deno.env.get('STRAVA_CLIENT_ID') || '' : process.env.STRAVA_CLIENT_ID || '';
// @ts-ignore: Deno is polyfilled
const STRAVA_CLIENT_SECRET = globalThis.Deno ? Deno.env.get('STRAVA_CLIENT_SECRET') || '' : process.env.STRAVA_CLIENT_SECRET || '';
// @ts-ignore: Deno is polyfilled
const STRAVA_REDIRECT_URI = globalThis.Deno ? Deno.env.get('STRAVA_REDIRECT_URI') || 'http://localhost:3000/api/strava/callback' : process.env.STRAVA_REDIRECT_URI || 'http://localhost:3000/api/strava/callback';

const STRAVA_AUTH_URL = 'https://www.strava.com/oauth/authorize';
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';
const STRAVA_API_BASE = 'https://www.strava.com/api/v3';

export function isStravaConfigured(): boolean {
    return !!STRAVA_CLIENT_ID && !!STRAVA_CLIENT_SECRET;
}

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
    workout_type?: number;    // 0=default, 1=race, 2=long run, 3=intervals (Run)
    average_heartrate?: number;
    max_heartrate?: number;
    calories?: number;
    average_speed: number;     // m/s
    max_speed: number;         // m/s
    average_watts?: number;
    max_watts?: number;
    kilojoules?: number;
    has_heartrate: boolean;
    pr_count: number;
    kudos_count: number;
    achievement_count: number;
    splits_metric?: Array<{
        distance: number;
        elapsed_time: number;
        elevation_difference: number;
        moving_time: number;
        split: number;
        average_speed: number;
        average_heartrate?: number;
        pace_zone?: number;
    }>;
    excludeFromStats?: boolean;
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
 * recursively fetches ALL activities (handling pagination)
 */
export async function getAllStravaActivities(
    accessToken: string,
    options: { before?: number; after?: number } = {},
    onProgress?: (count: number) => void
): Promise<StravaActivity[]> {
    let allActivities: StravaActivity[] = [];
    let page = 1;
    const PER_PAGE = 200; // Maximize efficiency

    while (true) {
        const batch = await getStravaActivities(accessToken, {
            ...options,
            page,
            perPage: PER_PAGE
        });

        if (!batch || batch.length === 0) {
            break;
        }

        allActivities = [...allActivities, ...batch];
        if (onProgress) onProgress(allActivities.length);

        if (batch.length < PER_PAGE) {
            break; // Reached end of list
        }

        page++;
        // Polite delay to avoid hammering API too hard if many pages
        await new Promise(r => setTimeout(r, 100));
    }

    return allActivities;
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
 * Map Strava workout type to app sub-type
 */
export function mapStravaSubType(type: string, workoutType?: number): any {
    if (workoutType === undefined) return undefined;

    // Running
    if (type === 'Run') {
        if (workoutType === 1) return 'race';
        if (workoutType === 2) return 'long-run';
        if (workoutType === 3) return 'interval';
    }

    // Cycling
    if (type === 'Ride') {
        if (workoutType === 11) return 'race';
        if (workoutType === 12) return 'interval'; // Generic workout -> interval?
    }

    return undefined;
}

/**
 * More accurate calorie estimation based on HR, weight, age, and gender (Keytel et al. 2005)
 * Returns both the value and a technical breakdown/explanation
 * 
 * Priority order:
 * 1. Strava's own calories (most accurate - uses their algorithms and power data)
 * 2. Keytel formula with HR data (with sanity caps)
 * 3. Conservative fallback schablons
 */
export function calculateStravaCalories(activity: StravaActivity, userSettings?: UserSettings): { calories: number; breakdown: string } {
    const durationMin = (activity.moving_time || activity.elapsed_time) / 60;
    const hr = activity.average_heartrate;
    const type = mapStravaType(activity.type);

    // Sanity limits per activity type (kcal/min) - based on research and Strava comparisons
    const KCAL_LIMITS: Record<string, { min: number; max: number }> = {
        running: { min: 6, max: 12 },      // Elite marathon ~12, easy jog ~6
        cycling: { min: 4, max: 14 },      // Includes power-based riding
        swimming: { min: 5, max: 12 },
        strength: { min: 3, max: 8 },      // Weight training
        walking: { min: 2, max: 5 },
        yoga: { min: 1.5, max: 4 },
        other: { min: 3, max: 10 }
    };

    const limits = KCAL_LIMITS[type] || KCAL_LIMITS.other;

    // 1. ALWAYS prioritize Strava's own calorie calculation if available
    if (activity.calories && activity.calories > 0) {
        return {
            calories: activity.calories,
            breakdown: `Källhänvisning: Strava API\nVärdet beräknat av Strava baserat på deras interna algoritmer (puls, kraft, etc).`
        };
    }

    // 2. If we have HR and user profile data, use the scientific formula WITH sanity check
    if (hr && userSettings && userSettings.weight && userSettings.birthYear) {
        const weight = userSettings.weight;
        const age = new Date().getFullYear() - userSettings.birthYear;
        const gender = userSettings.gender || 'male';

        let kjPerMin = 0;
        let formula = "";
        if (gender === 'male') {
            kjPerMin = -55.0969 + (0.6309 * hr) + (0.1988 * weight) + (0.2017 * age);
            formula = "Keytel et al. (Male): -55.0969 + (0.6309 * HR) + (0.1988 * W) + (0.2017 * A)";
        } else {
            kjPerMin = -20.4022 + (0.4472 * hr) - (0.1263 * weight) + (0.0740 * age);
            formula = "Keytel et al. (Female): -20.4022 + (0.4472 * HR) - (0.1263 * W) + (0.0740 * A)";
        }

        let kcalPerMin = kjPerMin / 4.184;
        const originalKcalPerMin = kcalPerMin;

        // Apply sanity limits
        kcalPerMin = Math.max(limits.min, Math.min(limits.max, kcalPerMin));

        let total = Math.round(kcalPerMin * durationMin);

        let breakdown = `Formel: ${formula}\nIndata:\n- Puls: ${hr.toFixed(0)} bpm\n- Vikt: ${weight} kg\n- Ålder: ${age} år\n- Tid: ${durationMin.toFixed(1)} min\nResultat: ~${kcalPerMin.toFixed(2)} kcal/min`;

        if (Math.abs(originalKcalPerMin - kcalPerMin) > 0.1) {
            breakdown += `\n\nNotering: Begränsat från ${originalKcalPerMin.toFixed(1)} till ${kcalPerMin.toFixed(1)} kcal/min (rimliga gränser för ${type}: ${limits.min}-${limits.max} kcal/min).`;
        }

        return { calories: Math.max(total, 0), breakdown };
    }

    // 3. CONSERVATIVE fallback - lower values aligned with Strava estimates
    let kcalPerMin = 5; // Default - conservative
    let reason = "Konservativ schablon för blandad träning";

    if (type === 'strength') { kcalPerMin = 4; reason = "Schablon för styrketräning (utan pulsdata)"; }
    else if (type === 'walking') { kcalPerMin = 3; reason = "Schablon för rask promenad"; }
    else if (type === 'running') { kcalPerMin = 8; reason = "Konservativ schablon för löpning (utan pulsdata)"; }
    else if (type === 'cycling') { kcalPerMin = 6; reason = "Schablon för cykling (utan pulsdata)"; }
    else if (type === 'swimming') { kcalPerMin = 7; reason = "Schablon för simning"; }
    else if (type === 'yoga') { kcalPerMin = 2.5; reason = "Schablon för yoga"; }

    const total = Math.round(durationMin * kcalPerMin);
    return {
        calories: total,
        breakdown: `Källhänvisning: App Schablon (Konservativ)\nAnledning: Saknar Strava-kalorier och pulsdata.\nBeräkning: ${durationMin.toFixed(1)} min × ${kcalPerMin} kcal/min (${reason}).`
    };
}


/**
 * Convert Strava activity to app exercise entry format
 */
export function mapStravaActivityToExercise(activity: StravaActivity, userSettings?: UserSettings) {
    const calorieData = calculateStravaCalories(activity, userSettings);

    return {
        externalId: `strava_${activity.id}`,
        platform: 'strava' as const,
        date: activity.start_date_local.split('T')[0],
        type: mapStravaType(activity.type),
        durationMinutes: (userSettings?.stravaTimePreference === 'elapsed' ? activity.elapsed_time : (activity.moving_time || activity.elapsed_time)) / 60,
        intensity: estimateIntensity(activity),
        caloriesBurned: calorieData.calories,
        calorieBreakdown: calorieData.breakdown,
        distance: activity.distance ? Math.round(activity.distance / 10) / 100 : undefined, // Convert to km
        notes: activity.name,
        heartRateAvg: activity.average_heartrate,
        heartRateMax: activity.max_heartrate,
        elevationGain: activity.total_elevation_gain,
        prCount: activity.pr_count,
        kudosCount: activity.kudos_count,
        achievementCount: activity.achievement_count,
        maxSpeed: activity.max_speed ? activity.max_speed * 3.6 : undefined,
        kilojoules: activity.kilojoules,
        subType: mapStravaSubType(activity.type, activity.workout_type),
    };
}

// ...
// Assuming StravaActivity interface is defined elsewhere and includes these properties:
// interface StravaActivity {
//     // ... existing properties
//     max_speed: number;         // m/s
//     average_watts?: number;    // watts
//     max_watts?: number;        // watts
//     has_heartrate: boolean;
//     pr_count: number;
//     kudos_count: number;
//     achievement_count: number;
//     // ... other properties
// }

// Assuming ActivityPerformanceSection interface is defined elsewhere and needs these properties:
// interface ActivityPerformanceSection {
//     // ... existing properties
//     averageWatts?: number;
//     maxWatts?: number;
//     averageSpeed?: number; // km/h
//     // ... other properties
// }

export function mapStravaToPerformance(activity: StravaActivity, userSettings?: UserSettings): ActivityPerformanceSection {
    const calorieData = calculateStravaCalories(activity, userSettings);

    return {
        source: {
            source: 'strava',
            externalId: activity.id.toString(),
            importedAt: new Date().toISOString()
        },
        distanceKm: activity.distance ? Math.round(activity.distance / 10) / 100 : 0,
        durationMinutes: (userSettings?.stravaTimePreference === 'elapsed' ? activity.elapsed_time : (activity.moving_time || activity.elapsed_time)) / 60,
        elapsedTimeSeconds: activity.elapsed_time,
        calories: calorieData.calories,
        calorieBreakdown: calorieData.breakdown,

        avgHeartRate: activity.average_heartrate,
        maxHeartRate: activity.max_heartrate,
        elevationGain: activity.total_elevation_gain,

        averageWatts: activity.average_watts,
        maxWatts: activity.max_watts,
        averageSpeed: activity.average_speed ? activity.average_speed * 3.6 : 0, // m/s to km/h
        maxSpeed: activity.max_speed ? activity.max_speed * 3.6 : 0, // m/s to km/h
        kilojoules: activity.kilojoules,
        prCount: activity.pr_count,
        kudosCount: activity.kudos_count,
        achievementCount: activity.achievement_count,

        activityType: mapStravaType(activity.type),
        startTimeLocal: activity.start_date_local, // Full ISO for time-of-day analysis
        notes: activity.name,
        subType: mapStravaSubType(activity.type, activity.workout_type),
        excludeFromStats: activity.excludeFromStats,
        splits: activity.splits_metric?.map(s => ({
            split: s.split,
            distance: s.distance,
            elapsedTime: s.elapsed_time,
            movingTime: s.moving_time,
            elevationDiff: s.elevation_difference,
            averageSpeed: s.average_speed,
            averageHeartrate: s.average_heartrate
        }))
    };
}

/**
 * Create a new Universal Activity from a Strava Activity (Unplanned)
 */
export function createUniversalFromStrava(activity: StravaActivity, userId: string, userSettings?: UserSettings): UniversalActivity {
    const performance = mapStravaToPerformance(activity, userSettings);

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
