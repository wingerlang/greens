import { getSession } from "../db/session.ts";

export async function handleParserRoutes(
  req: Request,
  url: URL,
  headers: Headers,
): Promise<Response> {
  const method = req.method;
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");

  // We want this to be secure, but also easy to use
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

  if (url.pathname === "/api/parse-url" && method === "POST") {
    try {
      const { url: targetUrl } = await req.json();
      if (!targetUrl) throw new Error("No URL provided");

      console.log(`🌐 Fetching external URL for parsing: ${targetUrl}`);

      const response = await fetch(targetUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept":
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "sv-SE,sv;q=0.9,en-US;q=0.8,en;q=0.7",
        },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch URL: ${response.status} ${response.statusText}`,
        );
      }

      const html = await response.text();

      // Very raw scraping to avoid heavy dependencies on backend
      // We want to extract:
      // 1. Title (Name)
      // 2. Metadata (OG Title)
      // 3. JSON-LD (Schema.org)
      // 4. Body text (Nutrition facts)

      const titleMatch = html.match(/<title>(.*?)<\/title>/i);
      const ogTitleMatch = html.match(
        /<meta property="og:title" content="(.*?)"/i,
      );
      const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);

      // Extract JSON-LD
      const jsonLdMatches = html.matchAll(
        /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi,
      );
      const jsonLds: any[] = [];
      for (const match of jsonLdMatches) {
        try {
          const data = JSON.parse(match[1].trim());
          jsonLds.push(data);
        } catch (e) {
          // Skip malformed JSON
        }
      }

      // Simple body text extraction (strip tags)
      const bodyText = html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      return new Response(
        JSON.stringify({
          title: ogTitleMatch?.[1] || titleMatch?.[1] || "",
          h1: h1Match?.[1]?.replace(/<[^>]+>/g, " ").trim() || "",
          jsonLds: jsonLds,
          text: bodyText.substring(0, 10000), // Limit to first 10k chars to avoid bloat
        }),
        { headers },
      );
    } catch (e) {
      console.error("URL Parsing error:", e);
      return new Response(
        JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
        { status: 500, headers },
      );
    }
  }

  return new Response(JSON.stringify({ error: "Not found" }), {
    status: 404,
    headers,
  });
}
