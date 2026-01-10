// src/api/handlers/exercises.ts
import {
    getExerciseDatabase,
    upsertExercise,
    deleteExercise,
    searchExercises
} from '../repositories/exerciseRepository.ts';
import { ExerciseDefinition } from '../../models/exercise.ts';

export async function handleExerciseRoutes(req: Request, url: URL, headers: Headers): Promise<Response> {
    // GET /api/exercises?q=search
    if (req.method === 'GET') {
        try {
            const query = url.searchParams.get('q');
            if (query) {
                const results = await searchExercises(query);
                return new Response(JSON.stringify(results), { status: 200, headers });
            } else {
                const db = await getExerciseDatabase();
                return new Response(JSON.stringify(db.exercises), { status: 200, headers });
            }
        } catch (error) {
            return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500, headers });
        }
    }

    // POST /api/exercises - Create or Update
    if (req.method === 'POST') {
        try {
            const body = await req.json();
            // Basic validation
            if (!body.id || !body.name_en || !body.name_sv) {
                return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers });
            }

            await upsertExercise(body as ExerciseDefinition);
            return new Response(JSON.stringify({ success: true }), { status: 200, headers });
        } catch (error) {
            return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500, headers });
        }
    }

    // DELETE /api/exercises?id=xyz
    if (req.method === 'DELETE') {
        try {
            const id = url.searchParams.get('id');
            if (!id) {
                return new Response(JSON.stringify({ error: "Missing id" }), { status: 400, headers });
            }

            await deleteExercise(id);
            return new Response(JSON.stringify({ success: true }), { status: 200, headers });
        } catch (error) {
            return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500, headers });
        }
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
}
