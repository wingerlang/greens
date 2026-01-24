// src/api/handlers/muscles.ts
import { getMuscleHierarchy } from "../repositories/muscleRepository.ts";

export async function handleMuscleRoutes(
  req: Request,
  url: URL,
  headers: Headers,
): Promise<Response> {
  if (req.method === "GET") {
    try {
      const hierarchy = await getMuscleHierarchy();
      return new Response(JSON.stringify(hierarchy), { status: 200, headers });
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
