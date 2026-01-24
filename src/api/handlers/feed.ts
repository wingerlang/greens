import { FeedRepository } from "../repositories/feedRepository.ts";
import { getSession } from "../db/session.ts";
import { kv } from "../kv.ts";
import type {
  FeedEventCategory,
  FeedEventType,
} from "../../models/feedTypes.ts";

/**
 * Feed API Handler
 *
 * Endpoints:
 * GET  /api/feed                           - Get main feed (filtered by subscriptions)
 * GET  /api/feed/user/:userId              - Get a user's profile feed
 * GET  /api/feed/preferences/:targetUserId - Get my subscription settings for a user
 * PUT  /api/feed/preferences/:targetUserId - Update my subscription settings
 * POST /api/feed/events                    - Create a new feed event
 * DELETE /api/feed/events/:eventId         - Delete an event
 */
export async function handleFeedRoutes(
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

  try {
    // ============================================
    // GET /api/feed - Main feed (from followed users)
    // ============================================
    if (url.pathname === "/api/feed" && method === "GET") {
      const limit = parseInt(url.searchParams.get("limit") || "50");
      const categories = url.searchParams.get("categories")?.split(",") as
        | FeedEventCategory[]
        | undefined;

      const events = await FeedRepository.getMainFeed(userId, {
        limit,
        categories,
      });

      return new Response(
        JSON.stringify({
          events,
          hasMore: events.length === limit,
        }),
        { headers },
      );
    }

    // ============================================
    // GET /api/feed/me - My own feed (private view)
    // ============================================
    if (url.pathname === "/api/feed/me" && method === "GET") {
      const limit = parseInt(url.searchParams.get("limit") || "50");
      const categories = url.searchParams.get("categories")?.split(",") as
        | FeedEventCategory[]
        | undefined;

      const events = await FeedRepository.getUserEvents(userId, {
        limit,
        categories,
        includePrivate: true,
      });

      return new Response(JSON.stringify({ events }), { headers });
    }

    // ============================================
    // GET /api/feed/user/:userId - User's profile feed
    // ============================================
    if (url.pathname.match(/^\/api\/feed\/user\/[^/]+$/) && method === "GET") {
      const targetUserId = url.pathname.split("/").pop()!;
      const limit = parseInt(url.searchParams.get("limit") || "50");

      const events = await FeedRepository.getUserEvents(targetUserId, {
        limit,
      });

      // Filter out private events for non-owners
      const visibleEvents = targetUserId === userId
        ? events
        : events.filter((e) => e.visibility !== "PRIVATE");

      return new Response(JSON.stringify({ events: visibleEvents }), {
        headers,
      });
    }

    // ============================================
    // GET /api/feed/preferences/:targetUserId - Get subscription settings
    // ============================================
    if (
      url.pathname.match(/^\/api\/feed\/preferences\/[^/]+$/) &&
      method === "GET"
    ) {
      const targetUserId = url.pathname.split("/").pop()!;

      const preference = await FeedRepository.getFollowPreference(
        userId,
        targetUserId,
      );

      if (!preference) {
        // Return defaults if no preference set
        return new Response(
          JSON.stringify({
            preference: null,
            defaults: {
              subscribedCategories: ["TRAINING"],
              detailLevel: "full",
              notificationsEnabled: false,
            },
          }),
          { headers },
        );
      }

      return new Response(JSON.stringify({ preference }), { headers });
    }

    // ============================================
    // PUT /api/feed/preferences/:targetUserId - Update subscription settings
    // ============================================
    if (
      url.pathname.match(/^\/api\/feed\/preferences\/[^/]+$/) &&
      method === "PUT"
    ) {
      const targetUserId = url.pathname.split("/").pop()!;
      const body = await req.json();

      const { subscribedCategories, detailLevel, notificationsEnabled } = body;

      if (!subscribedCategories || !Array.isArray(subscribedCategories)) {
        return new Response(
          JSON.stringify({
            error: "subscribedCategories is required and must be an array",
          }),
          { status: 400, headers },
        );
      }

      const preference = await FeedRepository.setFollowPreference({
        followerId: userId,
        targetUserId,
        subscribedCategories,
        detailLevel: detailLevel || "full",
        notificationsEnabled: notificationsEnabled || false,
      });

      return new Response(JSON.stringify({ preference }), { headers });
    }

    // ============================================
    // POST /api/feed/events - Create a new event
    // ============================================
    if (url.pathname === "/api/feed/events" && method === "POST") {
      const body = await req.json();

      const { type, title, summary, payload, visibility, timestamp, metrics } =
        body;

      if (!type || !title || !payload) {
        return new Response(
          JSON.stringify({
            error: "type, title, and payload are required",
          }),
          { status: 400, headers },
        );
      }

      const event = await FeedRepository.createEvent({
        userId,
        type: type as FeedEventType,
        title,
        summary,
        payload,
        visibility: visibility || "FRIENDS",
        timestamp: timestamp || new Date().toISOString(),
        metrics,
      });

      return new Response(JSON.stringify({ event }), { status: 201, headers });
    }

    // ============================================
    // DELETE /api/feed/events/:eventId - Delete an event
    // ============================================
    if (
      url.pathname.match(/^\/api\/feed\/events\/[^/]+$/) && method === "DELETE"
    ) {
      const eventId = url.pathname.split("/").pop()!;

      // Verify ownership
      const event = await FeedRepository.getEventById(eventId);
      if (!event) {
        return new Response(JSON.stringify({ error: "Event not found" }), {
          status: 404,
          headers,
        });
      }
      if (event.userId !== userId) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers,
        });
      }

      await FeedRepository.deleteEvent(eventId);

      return new Response(JSON.stringify({ success: true }), { headers });
    }

    // ============================================
    // GET /api/feed/all-preferences - Get all my subscription settings
    // ============================================
    // ============================================
    // GET /api/feed/stats - Get following count and training form
    // ============================================
    if (url.pathname === "/api/feed/stats" && method === "GET") {
      const form = await FeedRepository.getTrainingForm(userId);

      // Get following count from database
      const followingIter = kv.list({ prefix: ["following", userId] });
      let followingCount = 0;
      for await (const _ of followingIter) {
        followingCount++;
      }

      return new Response(
        JSON.stringify({
          followingCount,
          trainingForm: form,
        }),
        { headers },
      );
    }

    // ============================================
    // PATCH /api/feed/events/:eventId/visibility - Update event visibility
    // ============================================
    if (
      url.pathname.startsWith("/api/feed/events/") &&
      url.pathname.endsWith("/visibility") && method === "PATCH"
    ) {
      const eventId = url.pathname.split("/")[4];
      const body = await req.json();
      const { visibility } = body;

      if (!visibility) {
        return new Response(
          JSON.stringify({ error: "Visibility is required" }),
          { status: 400, headers },
        );
      }

      const success = await FeedRepository.updateEventVisibility(
        userId,
        eventId,
        visibility,
      );
      if (!success) {
        return new Response(
          JSON.stringify({ error: "Event not found or unauthorized" }),
          { status: 404, headers },
        );
      }

      return new Response(JSON.stringify({ success: true }), { headers });
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers,
    });
  } catch (e) {
    console.error("Feed API Error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : String(e),
      }),
      { status: 500, headers },
    );
  }
}
