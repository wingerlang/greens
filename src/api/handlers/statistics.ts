
import { getCommunityStats } from '../services/statisticsService.ts';

export async function handleGetCommunityStats(req: Request): Promise<Response> {
    try {
        const url = new URL(req.url);
        const force = url.searchParams.get('refresh') === 'true';

        const stats = await getCommunityStats(force);

        return new Response(JSON.stringify(stats), {
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "public, max-age=3600" // Browser cache for 1 hour
            }
        });
    } catch (e) {
        console.error("Stats API Error:", e);
        return new Response(JSON.stringify({ error: "Failed to fetch stats" }), { status: 500 });
    }
}
