import { kv } from "../kv.ts";

export async function handleDebugRoutes(
  req: Request,
  url: URL,
  headers: Headers,
): Promise<Response> {
  // Only allow if debug mode is on
  if (Deno.env.get("DEBUG_MODE") !== "true") {
    return new Response(JSON.stringify({ error: "Debug mode disabled" }), {
      status: 403,
      headers,
    });
  }

  const pathParts = url.pathname.split("/");
  // /api/debug/host-info
  if (pathParts[3] === "host-info") {
    return await handleGetHostInfo(req);
  }

  // /api/debug/:id
  const id = pathParts[3];

  if (!id) {
    return new Response(JSON.stringify({ error: "Missing ID" }), {
      status: 400,
      headers,
    });
  }

  const result = await kv.get(["system", "debug", id]);

  if (!result.value) {
    return new Response(
      JSON.stringify({ error: "Debug session not found or expired" }),
      { status: 404, headers },
    );
  }

  return new Response(JSON.stringify(result.value), { status: 200, headers });
}

export async function handleGetHostInfo(req: Request): Promise<Response> {
  const interfaces = Deno.networkInterfaces();
  const headers = { "Content-Type": "application/json" };

  const candidates: { name: string; ip: string }[] = [];
  for (const iface of interfaces) {
    if (iface.family === "IPv4" && !iface.address.startsWith("127.")) {
      candidates.push({ name: iface.name, ip: iface.address });
    }
  }

  // Prioritize 192.168
  const bestMatch = candidates.find((c) => c.ip.startsWith("192.168."));
  // Then non-172
  const secondBest = candidates.find((c) =>
    !/^172\.(1[6-9]|2\d|3[0-1])\./.test(c.ip)
  );

  // Sort to put best first
  const sortedIPs = candidates.map((c) => c.ip).sort((a, b) => {
    if (a === bestMatch?.ip) return -1;
    if (b === bestMatch?.ip) return 1;
    if (a === secondBest?.ip && !bestMatch) return -1;
    return 0;
  });

  return new Response(JSON.stringify({ ips: sortedIPs }), { headers });
}
