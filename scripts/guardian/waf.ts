/// <reference lib="deno.unstable" />

/// <reference lib="deno.ns" />
import { getKv } from "./logger.ts";

export interface WafRule {
    id: string;
    description: string;
    pattern: RegExp;
    type: "sqli" | "xss" | "lfi" | "rce" | "scanner" | "traversal";
    locations: ("path" | "query" | "body")[];
    risk: "high" | "medium" | "low";
}

// Common attack vectors
export const WAF_RULES: WafRule[] = [
    // SQL Injection
    {
        id: "sqli-001",
        description: "SQL Injection: UNION SELECT",
        pattern: /union\s+(all\s+)?select/i,
        type: "sqli",
        locations: ["query", "body"],
        risk: "high"
    },
    {
        id: "sqli-002",
        description: "SQL Injection: Comment styles",
        pattern: /(\/\*|--|#)/,
        type: "sqli",
        locations: ["query"],
        risk: "medium"
    },
    {
        id: "sqli-003",
        description: "SQL Injection: OR 1=1",
        pattern: /or\s+['"]?1['"]?\s*=\s*['"]?1/i,
        type: "sqli",
        locations: ["query", "body"],
        risk: "high"
    },
    {
        id: "sqli-004",
        description: "SQL Injection: DROP/DELETE/UPDATE",
        pattern: /;\s*(drop|delete|update|insert)\s+table/i,
        type: "sqli",
        locations: ["query", "body"],
        risk: "high"
    },

    // XSS
    {
        id: "xss-001",
        description: "XSS: Script tag",
        pattern: /<script\b[^>]*>(.*?)<\/script>/i,
        type: "xss",
        locations: ["query", "body"],
        risk: "high"
    },
    {
        id: "xss-002",
        description: "XSS: Javascript URI",
        pattern: /javascript:/i,
        type: "xss",
        locations: ["query", "body"],
        risk: "high"
    },
    {
        id: "xss-003",
        description: "XSS: Event Handlers",
        pattern: /\bon(load|error|click|mouseover)\s*=/i,
        type: "xss",
        locations: ["query", "body"],
        risk: "medium"
    },

    // Path Traversal / LFI
    {
        id: "lfi-001",
        description: "Path Traversal: Parent directory",
        pattern: /\.\.[\/\\]/,
        type: "traversal",
        locations: ["path", "query"],
        risk: "high"
    },
    {
        id: "lfi-002",
        description: "LFI: Sensitive files",
        pattern: /(\/etc\/passwd|\/windows\/win.ini|\.env|\.git\/)/i,
        type: "lfi",
        locations: ["path", "query"],
        risk: "high"
    },

    // RCE
    {
        id: "rce-001",
        description: "RCE: Command Injection",
        pattern: /(;|\||`|\$)\s*(cat|nc|wget|curl|ping|whoami)/i,
        type: "rce",
        locations: ["query", "body"],
        risk: "high"
    },

    // Scanner / Bot Defense
    {
        id: "scan-001",
        description: "Scanner: Admin panels",
        pattern: /(wp-admin|phpmyadmin|admin\.php|config\.php)/i,
        type: "scanner",
        locations: ["path"],
        risk: "medium"
    }
];

export interface WafResult {
    blocked: boolean;
    ruleId?: string;
    reason?: string;
    risk?: string;
}

/**
 * Check request against WAF rules.
 * NOTE: Body inspection is limited for performance and streaming reasons.
 * We only check body if it's small and text-based (implemented in proxy caller).
 */
export async function checkWaf(
    url: URL,
    method: string,
    headers: Headers,
    bodyText?: string
): Promise<WafResult> {
    const path = decodeURIComponent(url.pathname);
    const query = decodeURIComponent(url.search);

    for (const rule of WAF_RULES) {
        // Check Path
        if (rule.locations.includes("path")) {
            if (rule.pattern.test(path)) {
                return createMatch(rule, "Path contains suspicious pattern");
            }
        }

        // Check Query
        if (rule.locations.includes("query")) {
            if (rule.pattern.test(query)) {
                return createMatch(rule, "Query parameters contain suspicious pattern");
            }
        }

        // Check Body (if provided)
        if (rule.locations.includes("body") && bodyText) {
            if (rule.pattern.test(bodyText)) {
                return createMatch(rule, "Request body contains suspicious pattern");
            }
        }
    }

    return { blocked: false };
}

function createMatch(rule: WafRule, context: string): WafResult {
    return {
        blocked: true,
        ruleId: rule.id,
        reason: `${rule.description} (${context})`,
        risk: rule.risk
    };
}

export async function logWafEvent(result: WafResult, ip: string, path: string) {
    const kv = getKv();
    if (!kv || !result.blocked) return;

    const date = new Date().toISOString().split('T')[0];
    const timestamp = Date.now();

    const event = {
        timestamp,
        ip,
        path,
        ruleId: result.ruleId,
        reason: result.reason,
        risk: result.risk
    };

    // Store latest events
    await kv.set(
        ["guardian", "waf", "events", timestamp, crypto.randomUUID()],
        event,
        { expireIn: 30 * 24 * 60 * 60 * 1000 }
    );

    // Update stats
    const atomic = kv.atomic();
    atomic.mutate({
        type: "sum",
        key: ["guardian", "waf", "stats", date, "total_blocked"],
        value: new Deno.KvU64(1n)
    });

    if (result.ruleId) {
        atomic.mutate({
            type: "sum",
            key: ["guardian", "waf", "stats", date, "rule", result.ruleId],
            value: new Deno.KvU64(1n)
        });
    }

    await atomic.commit();
    console.log(`[GUARDIAN] WAF BLOCKED: ${ip} -> ${path} [${result.ruleId}]`);
}

export async function getWafEvents(limit: number = 50): Promise<any[]> {
    const kv = getKv();
    if (!kv) return [];

    const events: any[] = [];
    try {
        const iter = kv.list({ prefix: ["guardian", "waf", "events"] }, {
            limit,
            reverse: true
        });
        for await (const res of iter) {
            events.push(res.value);
        }
    } catch (e) { /* ignore */ }
    return events;
}
