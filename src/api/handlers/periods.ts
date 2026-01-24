import { getSession } from "../db/session.ts";
import { periodRepo } from "../repositories/periodRepository.ts";
import { TrainingPeriod } from "../../models/types.ts";

export async function handlePeriodRoutes(
  req: Request,
  url: URL,
  headers: Headers,
): Promise<Response> {
  const method = req.method;
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) {
    return new Response(JSON.stringify({ error: "No token" }), {
      status: 401,
      headers,
    });
  }
  const session = await getSession(token);
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers,
    });
  }

  const userId = session.userId;

  // GET /api/periods
  if (method === "GET") {
    const periods = await periodRepo.getPeriods(userId);
    return new Response(JSON.stringify(periods), { headers });
  }

  // POST /api/periods (Create/Update)
  if (method === "POST") {
    try {
      const period = await req.json() as TrainingPeriod;
      if (!period.id) {
        return new Response(JSON.stringify({ error: "Missing ID" }), {
          status: 400,
          headers,
        });
      }
      await periodRepo.savePeriod(userId, period);
      return new Response(JSON.stringify({ success: true }), { headers });
    } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid data" }), {
        status: 400,
        headers,
      });
    }
  }

  // DELETE /api/periods?id=...
  if (method === "DELETE") {
    const id = url.searchParams.get("id");
    if (!id) {
      return new Response(JSON.stringify({ error: "Missing ID" }), {
        status: 400,
        headers,
      });
    }
    await periodRepo.deletePeriod(userId, id);
    return new Response(JSON.stringify({ success: true }), { headers });
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers,
  });
}
