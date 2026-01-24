// src/api/handlers/exercises.ts
import {
  deleteExercise,
  getExerciseDatabase,
  searchExercises,
  upsertExercise,
} from "../repositories/exerciseRepository.ts";
import { ExerciseDefinition } from "../../models/exercise.ts";
import { kv } from "../kv.ts";
import { normalizeExerciseName } from "../../models/strengthTypes.ts";

export async function handleExerciseRoutes(
  req: Request,
  url: URL,
  headers: Headers,
): Promise<Response> {
  // GET /api/exercises/unmapped
  if (req.method === "GET" && url.searchParams.has("unmapped")) {
    try {
      // 1. Fetch all definitions
      const db = await getExerciseDatabase();
      const knownNames = new Set<string>();

      db.exercises.forEach((ex) => {
        knownNames.add(normalizeExerciseName(ex.name_en));
        knownNames.add(normalizeExerciseName(ex.name_sv));
        ex.aliases?.forEach((a) => knownNames.add(normalizeExerciseName(a)));
      });

      // 2. Scan global strength sessions for unique names
      // Note: This iterates ALL strength sessions. For scale, use map-reduce or background job.
      // Current scale allows this.
      const uniqueNames = new Set<string>();
      const iter = kv.list({ prefix: ["strength_sessions"] });

      for await (const entry of iter) {
        const session = entry.value as any; // Typed as StrengthWorkout
        if (session && session.exercises) {
          session.exercises.forEach((ex: any) => {
            if (ex.exerciseName) {
              uniqueNames.add(ex.exerciseName);
            }
          });
        }
      }

      // 3. Filter
      const unmapped: string[] = [];
      for (const name of uniqueNames) {
        const normalized = normalizeExerciseName(name);
        if (!knownNames.has(normalized)) {
          unmapped.push(name);
        }
      }

      return new Response(JSON.stringify({ unmapped: unmapped.sort() }), {
        status: 200,
        headers,
      });
    } catch (error) {
      console.error("Failed to fetch unmapped:", error);
      return new Response(JSON.stringify({ error: (error as Error).message }), {
        status: 500,
        headers,
      });
    }
  }

  // GET /api/exercises?q=search
  if (req.method === "GET") {
    try {
      const query = url.searchParams.get("q");
      if (query) {
        const results = await searchExercises(query);
        return new Response(JSON.stringify(results), { status: 200, headers });
      } else {
        const db = await getExerciseDatabase();
        return new Response(JSON.stringify(db.exercises), {
          status: 200,
          headers,
        });
      }
    } catch (error) {
      return new Response(JSON.stringify({ error: (error as Error).message }), {
        status: 500,
        headers,
      });
    }
  }

  // POST /api/exercises - Create or Update
  if (req.method === "POST") {
    try {
      const body = await req.json();
      // Basic validation
      if (!body.id || !body.name_en || !body.name_sv) {
        return new Response(
          JSON.stringify({ error: "Missing required fields" }),
          { status: 400, headers },
        );
      }

      await upsertExercise(body as ExerciseDefinition);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers,
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: (error as Error).message }), {
        status: 500,
        headers,
      });
    }
  }

  // DELETE /api/exercises?id=xyz
  if (req.method === "DELETE") {
    try {
      const id = url.searchParams.get("id");
      if (!id) {
        return new Response(JSON.stringify({ error: "Missing id" }), {
          status: 400,
          headers,
        });
      }

      await deleteExercise(id);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers,
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: (error as Error).message }), {
        status: 500,
        headers,
      });
    }
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers,
  });
}
