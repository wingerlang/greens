import { Middleware, GuardianContext, Next } from "./types.ts";
import { CONFIG } from "../config.ts";
import { getKv } from "../logger.ts";

interface GeoData {
    country: string;
    countryCode: string;
    city: string;
    isp: string;
}

export class GeoIpMiddleware implements Middleware {
    name = "GeoIP";

    async handle(ctx: GuardianContext, next: Next): Promise<void> {
        if (!CONFIG.features.geoIp) {
            await next();
            return;
        }

        const ip = ctx.ip;
        // Skip local IPs
        if (ip === "127.0.0.1" || ip === "::1" || ip.startsWith("192.168.") || ip.startsWith("10.")) {
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
