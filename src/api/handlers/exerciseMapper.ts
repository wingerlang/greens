import {
  getExerciseMappings,
  saveExerciseMapping,
} from "../db/exercise-mapper.ts";
import { strengthRepo } from "../repositories/strengthRepository.ts";
import { normalizeExerciseName } from "../../models/strengthTypes.ts";
import { MuscleGroup } from "../../models/strengthTypes.ts";

export async function handleExerciseMapperRoutes(
  req: Request,
  url: URL,
  headers: Headers,
): Promise<Response> {
  const urlParts = url.pathname.split("/");
  // /api/exercises/map

  const userId = req.headers.get("X-User-Id") || "user_default"; // Fallback for dev

  if (req.method === "GET") {
    try {
      // 1. Get all known mappings
      const mappings = await getExerciseMappings(userId);

      // 2. Scan user's history for unique exercise names
      // This is heavy, but necessary to find "Unmapped" ones.
      // In a production app, we might cache the set of unique exercise names in KV.
      const allSessions = await strengthRepo.getAllWorkouts(userId);
      const uniqueNames = new Set<string>();
      const unmapped: string[] = [];

      for (const session of allSessions) {
        // Check both structured exercises and imported source names
        for (const ex of session.exercises) {
          const name = ex.exerciseName;
          const normalized = normalizeExerciseName(name);
          uniqueNames.add(name); // Keep original display name for UI

          if (!mappings[normalized]) {
            // Check if we already added this normalized version to unmapped list?
            // Better: store unmapped as a set of { display: string, normalized: string }
            // For now, just string check
          }
        }
      }

      // Filter unique names that are NOT in mappings
      const unmappedList: string[] = [];
      const seenNormalized = new Set<string>();

      for (const name of uniqueNames) {
        const normalized = normalizeExerciseName(name);
        if (!mappings[normalized] && !seenNormalized.has(normalized)) {
          unmappedList.push(name);
          seenNormalized.add(normalized);
        }
      }

      return new Response(
        JSON.stringify({
          mappings,
          unmapped: unmappedList.sort(),
        }),
        { headers },
      );
    } catch (error) {
      console.error("Error fetching exercise mappings:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch mappings" }),
        { status: 500, headers },
      );
    }
  }

  if (req.method === "POST") {
    try {
      const body = await req.json();
      const { exerciseName, muscleGroup } = body;

      if (!exerciseName || !muscleGroup) {
        return new Response(
          JSON.stringify({ error: "Missing exerciseName or muscleGroup" }),
          { status: 400, headers },
        );
      }

      await saveExerciseMapping(
        userId,
        exerciseName,
        muscleGroup as MuscleGroup,
      );

      return new Response(JSON.stringify({ success: true }), { headers });
    } catch (error) {
      console.error("Error saving exercise mapping:", error);
      return new Response(JSON.stringify({ error: "Failed to save mapping" }), {
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
