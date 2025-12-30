/**
 * Strength Training API Handler
 * Endpoints for importing, listing, and managing strength workouts.
 */

import { getSession } from '../db/session.ts';
import { strengthRepo } from '../repositories/strengthRepository.ts';
import { parseStrengthLogCSV } from '../../utils/strengthLogParser.ts';

export async function handleStrengthRoutes(req: Request, url: URL, headers: Headers): Promise<Response> {
    const method = req.method;

    // Auth check
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return new Response(JSON.stringify({ error: 'No token' }), { status: 401, headers });
    const session = await getSession(token);
    if (!session) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });

    const userId = session.userId;

    // ============================================
    // Import CSV
    // ============================================
    if (url.pathname === '/api/strength/import' && method === 'POST') {
        try {
            const body = await req.json();
            const csvContent = body.csv;

            if (!csvContent || typeof csvContent !== 'string') {
                return new Response(JSON.stringify({ error: 'Missing CSV content' }), { status: 400, headers });
            }

            const parsed = parseStrengthLogCSV(csvContent, userId);
            const result = await strengthRepo.importWorkouts(
                userId,
                parsed.workouts,
                parsed.exercises,
                parsed.personalBests
            );

            return new Response(JSON.stringify(result), { headers });
        } catch (e) {
            console.error('[POST /api/strength/import] Error:', e);
            return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers });
        }
    }

    // ============================================
    // List Workouts
    // ============================================
    // ============================================
    // List Workouts
    // ============================================
    if (url.pathname === '/api/strength/workouts' && method === 'GET') {
        try {
            const startDate = url.searchParams.get('start') || '2000-01-01';
            const endDate = url.searchParams.get('end') || '2099-12-31';

            // Allow fetching for another user (for Matchup/VS mode)
            // In a real app, strict privacy checks (isPublic/isFollowing) would go here.
            const targetUserId = url.searchParams.get('userId') || userId;

            const workouts = await strengthRepo.getWorkoutsByDateRange(targetUserId, startDate, endDate);
            return new Response(JSON.stringify({ workouts }), { headers });
        } catch (e) {
            return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers });
        }
    }

    // ============================================
    // Single Workout Detail (GET / DELETE)
    // ============================================
    if (url.pathname.startsWith('/api/strength/workout/')) {
        const workoutId = url.pathname.split('/').pop();
        if (!workoutId) {
            return new Response(JSON.stringify({ error: 'Missing workout ID' }), { status: 400, headers });
        }

        // GET - Fetch workout
        if (method === 'GET') {
            try {
                const workout = await strengthRepo.getWorkout(userId, workoutId);
                if (!workout) {
                    return new Response(JSON.stringify({ error: 'Workout not found' }), { status: 404, headers });
                }
                return new Response(JSON.stringify({ workout }), { headers });
            } catch (e) {
                return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers });
            }
        }

        // DELETE - Remove workout
        if (method === 'DELETE') {
            try {
                // First find the workout to get its date
                const workout = await strengthRepo.getWorkout(userId, workoutId);
                if (!workout) {
                    return new Response(JSON.stringify({ error: 'Workout not found' }), { status: 404, headers });
                }

                await strengthRepo.deleteWorkout(userId, workout.date, workoutId);
                return new Response(JSON.stringify({ success: true, message: 'Workout deleted' }), { headers });
            } catch (e) {
                console.error('[DELETE /api/strength/workout/:id] Error:', e);
                return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers });
            }
        }
    }

    // ============================================
    // Exercises Database
    // ============================================
    if (url.pathname === '/api/strength/exercises' && method === 'GET') {
        try {
            const exercises = await strengthRepo.getAllExercises();
            return new Response(JSON.stringify({ exercises }), { headers });
        } catch (e) {
            return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers });
        }
    }

    // ============================================
    // Personal Bests
    // ============================================
    if (url.pathname === '/api/strength/pbs' && method === 'GET') {
        try {
            const pbs = await strengthRepo.getAllPersonalBests(userId);
            return new Response(JSON.stringify({ personalBests: pbs }), { headers });
        } catch (e) {
            return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers });
        }
    }

    // ============================================
    // Statistics
    // ============================================
    if (url.pathname === '/api/strength/stats' && method === 'GET') {
        try {
            const stats = await strengthRepo.getStrengthStats(userId);
            return new Response(JSON.stringify({ stats }), { headers });
        } catch (e) {
            return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers });
        }
    }

    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers });
}
