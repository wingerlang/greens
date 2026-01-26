import { Middleware, GuardianContext, Next } from "./types.ts";
import { CONFIG } from "../config.ts";
import { getKv } from "../logger.ts";

interface GeoData {
    country: string;
    countryCode: string;
    city: string;
    isp: string;
}

function isPrivateIp(ip: string): boolean {
    return ip === "127.0.0.1" ||
           ip === "::1" ||
           ip.startsWith("192.168.") ||
           ip.startsWith("10.") ||
           // Simplified check for 172.16.0.0/12
           (ip.startsWith("172.") && parseInt(ip.split('.')[1]) >= 16 && parseInt(ip.split('.')[1]) <= 31) ||
           ip.startsWith("fc00:");
}

export class GeoIpMiddleware implements Middleware {
    name = "GeoIP";

    async handle(ctx: GuardianContext, next: Next): Promise<void> {
        if (!CONFIG.features.geoIp) {
            await next();
            return;
        }

        let ip = ctx.ip;

        // If local/private IP, try to find real IP from headers
        // This handles cases where Guardian is behind a Load Balancer or Proxy (e.g., Cloudflare, Nginx)
        if (isPrivateIp(ip)) {
             const cfIp = ctx.req.headers.get("cf-connecting-ip");
             const realIp = ctx.req.headers.get("x-real-ip");
             const forwarded = ctx.req.headers.get("x-forwarded-for");

             if (cfIp) {
                 ip = cfIp;
             } else if (realIp) {
                 ip = realIp;
             } else if (forwarded) {
                 // X-Forwarded-For can be a comma-separated list, first one is the client
                 const ips = forwarded.split(',').map(s => s.trim());
                 if (ips.length > 0) {
                     ip = ips[0];
                 }
             }
        }

        // If STILL private, mark as local and skip lookup
        if (isPrivateIp(ip)) {
            ctx.state.set("geo", { country: "Local", countryCode: "XX", city: "Local", isp: "Local" });
            await next();
            return;
        }

        const kv = getKv();
        let geo: GeoData | null = null;

        if (kv) {
            try {
                const res = await kv.get<GeoData>(["guardian", "geoip", ip]);
                if (res.value) {
                    geo = res.value;
                }
            } catch (e) {
                // Ignore
            }
        }

        if (!geo) {
            // Fetch
            try {
                // Use a short timeout
                const controller = new AbortController();
                const id = setTimeout(() => controller.abort(), 1500);

                const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,city,isp`, {
                    signal: controller.signal
                });
                clearTimeout(id);

                if (res.ok) {
                    const data = await res.json();
                    if (data.status === "success") {
                        geo = {
                            country: data.country,
                            countryCode: data.countryCode,
                            city: data.city,
                            isp: data.isp
                        };

                        // Cache for 30 days
                        if (kv) {
                            await kv.set(["guardian", "geoip", ip], geo, { expireIn: 30 * 24 * 60 * 60 * 1000 });
                        }
                    }
                }
            } catch (e) {
                // Failed to fetch, ignore
            }
        }

        if (geo) {
            ctx.state.set("geo", geo);
        }

        await next();
    }
}
