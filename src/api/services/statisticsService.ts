
import { strengthRepo } from '../repositories/strengthRepository.ts';
import { activityRepo } from '../repositories/activityRepository.ts';
import { kv } from '../kv.ts';
import { getAllUsers } from '../db/user.ts';
import { StrengthWorkout, StrengthExercise, calculate1RM } from '../../models/strengthTypes.ts';
import { UniversalActivity } from '../../models/types.ts';

// Cache key
const CACHE_KEY = ['community_stats_cache'];
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface CommunityStats {
    updatedAt: string;
    global: {
        totalUsers: number;
        totalDistanceKm: number;
        totalTonnage: number;
        totalWorkouts: number; // Combined strength + cardio
        totalDurationMinutes: number;
        totalGoalsAchieved: number;
    };
    averages: {
        distancePerUser: number;
        tonnagePerUser: number;
        workoutsPerUser: number;
        sessionDurationMinutes: number;
    };
    strength: {
        // Map of exerciseId -> stats
        exercises: Record<string, {
            name: string;
            count: number; // How many logs
            avg1RM: number;
            max1RM: number;
            avgTonnage: number; // per session
        }>;
        topExercises: string[]; // List of most popular exercise names
    };
    cardio: {
        // Stats for standard distances
        distances: Record<string, {
            count: number;
            avgTimeSeconds: number;
            fastestTimeSeconds: number;
            distribution: { range: string; count: number }[]; // For histograms
        }>;
    };
}

/**
 * Fetch all Strength Workouts from all users
 */
export async function fetchAllStrengthWorkouts(): Promise<StrengthWorkout[]> {
    console.time("fetchStrength");
    const users = await getAllUsers();
    console.log(`[Stats] Fetching strength workouts for ${users.length} users...`);

    // Optimization: Parallel fetch
    const workoutPromises = users.map(user => strengthRepo.getAllWorkouts(user.id));
    const results = await Promise.all(workoutPromises);

    const allWorkouts = results.flat();
    console.timeEnd("fetchStrength");
    console.log(`[Stats] Fetched ${allWorkouts.length} workouts total.`);
    return allWorkouts;
}

/**
 * Fetch all Activities from all users
 */
export async function fetchAllActivities(): Promise<UniversalActivity[]> {
    console.time("fetchActivities");
    const users = await getAllUsers();
    console.log(`[Stats] Fetching activities for ${users.length} users...`);

    const activityPromises = users.map(user => activityRepo.getActivitiesByDateRange(user.id, '2000-01-01', '2099-12-31'));
    const results = await Promise.all(activityPromises);

    const allActivities = results.flat();
    console.timeEnd("fetchActivities");
    console.log(`[Stats] Fetched ${allActivities.length} activities total.`);
    return allActivities;
}

/**
 * Fetch all Goals (PerformanceGoal) from all users
 */
export async function fetchAllGoals(): Promise<any[]> {
    console.time("fetchGoals");
    const users = await getAllUsers();
    let allGoals: any[] = [];

    for (const user of users) {
        const iter = kv.list({ prefix: ['goals', user.id] });
        for await (const entry of iter) {
            allGoals.push(entry.value);
        }
    }
    console.timeEnd("fetchGoals");
    return allGoals;
}

/**
 * Main Calculation Logic
 */
export function calculateGlobalStats(
    workouts: StrengthWorkout[],
    activities: UniversalActivity[],
    goals: any[]
): CommunityStats {
    console.time("calcStats");
    const stats: CommunityStats = {
        updatedAt: new Date().toISOString(),
        global: {
            totalUsers: 0,
            totalDistanceKm: 0,
            totalTonnage: 0,
            totalWorkouts: 0,
            totalDurationMinutes: 0,
            totalGoalsAchieved: 0
        },
        averages: {
            distancePerUser: 0,
            tonnagePerUser: 0,
            workoutsPerUser: 0,
            sessionDurationMinutes: 0
        },
        strength: {
            exercises: {},
            topExercises: []
        },
        cardio: {
            distances: {}
        }
    };

    // 1. Unique Users
    const uniqueUserIds = new Set<string>();
    workouts.forEach(w => uniqueUserIds.add(w.userId));
    activities.forEach(a => uniqueUserIds.add(a.userId));
    goals.forEach(g => uniqueUserIds.add(g.userId || 'unknown'));

    stats.global.totalUsers = uniqueUserIds.size || 1;

    // 2. Global Totals & Averages - Activities
    let totalDist = 0;
    let totalDur = 0;

    activities.forEach(a => {
        if (a.status === 'COMPLETED') {
            const perf = a.performance;
            if (perf) {
                totalDist += (perf.distanceKm || 0);
                totalDur += (perf.durationMinutes || 0);
            }
        }
    });

    // 3. Global Totals - Strength
    let totalTonnage = 0;
    let totalStrengthDur = 0;

    workouts.forEach(w => {
        totalTonnage += (w.totalVolume || 0);
        totalStrengthDur += (w.duration || 0);
    });

    stats.global.totalDistanceKm = Math.round(totalDist);
    stats.global.totalTonnage = Math.round(totalTonnage);
    stats.global.totalWorkouts = workouts.length + activities.length;
    stats.global.totalDurationMinutes = Math.round(totalDur + totalStrengthDur);

    // Goals
    const completedGoals = goals.filter(g => g.status === 'completed' || g.isCompleted === true);
    stats.global.totalGoalsAchieved = completedGoals.length;

    // Averages
    stats.averages.distancePerUser = Math.round(stats.global.totalDistanceKm / stats.global.totalUsers);
    stats.averages.tonnagePerUser = Math.round(stats.global.totalTonnage / stats.global.totalUsers);
    stats.averages.workoutsPerUser = parseFloat((stats.global.totalWorkouts / stats.global.totalUsers).toFixed(1));
    stats.averages.sessionDurationMinutes = Math.round(stats.global.totalDurationMinutes / (stats.global.totalWorkouts || 1));

    // 4. Strength Benchmarks
    const exerciseStats: Record<string, {
        name: string;
        sets: number;
        total1RM: number;
        max1RM: number;
        totalTonnage: number;
        count: number;
    }> = {};

    workouts.forEach(w => {
        w.exercises.forEach(we => {
            const name = we.exerciseName;
            const key = name.toLowerCase().trim();

            if (!exerciseStats[key]) {
                exerciseStats[key] = { name: name, sets: 0, total1RM: 0, max1RM: 0, totalTonnage: 0, count: 0 };
            }

            const sessionTonnage = we.sets.reduce((acc, s) => acc + (s.weight * s.reps), 0);
            exerciseStats[key].totalTonnage += sessionTonnage;
            exerciseStats[key].count += 1;

            let sessionMax1RM = 0;
            we.sets.forEach(s => {
                if (s.weight > 0 && s.reps > 0) {
                    const e1rm = calculate1RM(s.weight, s.reps);
                    if (e1rm > sessionMax1RM) sessionMax1RM = e1rm;
                }
            });

            if (sessionMax1RM > 0) {
                exerciseStats[key].total1RM += sessionMax1RM;
                if (sessionMax1RM > exerciseStats[key].max1RM) {
                    exerciseStats[key].max1RM = sessionMax1RM;
                }
            }
        });
    });

    Object.entries(exerciseStats).forEach(([key, val]) => {
        if (val.count > 0) {
            stats.strength.exercises[key] = {
                name: val.name,
                count: val.count,
                avg1RM: Math.round(val.total1RM / val.count),
                max1RM: val.max1RM,
                avgTonnage: Math.round(val.totalTonnage / val.count)
            };
        }
    });

    stats.strength.topExercises = Object.entries(stats.strength.exercises)
        .sort(([, a], [, b]) => b.count - a.count)
        .slice(0, 10)
        .map(([, val]) => val.name);

    // 5. Cardio Benchmarks
    const STANDARD_DISTANCES = [
        { key: '3k', km: 3, tol: 0.1 },
        { key: '5k', km: 5, tol: 0.2 },
        { key: '10k', km: 10, tol: 0.5 },
        { key: '21k', km: 21.1, tol: 1.0 },
        { key: '42k', km: 42.2, tol: 2.0 }
    ];

    const cardioData: Record<string, number[]> = {};
    STANDARD_DISTANCES.forEach(d => cardioData[d.key] = []);

    activities.forEach(a => {
        if (a.status === 'COMPLETED' && a.performance?.distanceKm && a.performance.durationMinutes) {
            const dist = a.performance.distanceKm;
            const timeSec = a.performance.durationMinutes * 60;

            for (const std of STANDARD_DISTANCES) {
                if (Math.abs(dist - std.km) <= std.tol) {
                    const pace = timeSec / dist;
                    const normalizedTime = pace * std.km;
                    cardioData[std.key].push(normalizedTime);
                }
            }
        }
    });

    STANDARD_DISTANCES.forEach(std => {
        const times = cardioData[std.key].sort((a, b) => a - b);
        if (times.length > 0) {
            const sum = times.reduce((a, b) => a + b, 0);
            stats.cardio.distances[std.key] = {
                count: times.length,
                avgTimeSeconds: Math.round(sum / times.length),
                fastestTimeSeconds: Math.round(times[0]),
                distribution: []
            };
        }
    });

    console.timeEnd("calcStats");
    return stats;
}

/**
 * Get Community Stats (Cached or Live)
 */
export async function getCommunityStats(forceRefresh = false): Promise<CommunityStats> {
    // 1. Check Cache
    if (!forceRefresh) {
        const cached = await kv.get<CommunityStats>(CACHE_KEY);
        if (cached.value) {
            const age = Date.now() - new Date(cached.value.updatedAt).getTime();
            if (age < CACHE_TTL_MS) {
                console.log("Serving Community Stats from cache");
                return cached.value;
            }
        }
    }

    console.log("Regenerating Community Stats...");
    // 2. Fetch All Data
    const workouts = await fetchAllStrengthWorkouts();
    const activities = await fetchAllActivities();
    const goals = await fetchAllGoals();

    // 3. Compute
    const stats = calculateGlobalStats(workouts, activities, goals);

    // 4. Save to Cache
    await kv.set(CACHE_KEY, stats);

    return stats;
}
