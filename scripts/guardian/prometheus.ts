import { stats } from "./logger.ts";
import { manager } from "./services.ts";
import {
    getTrafficStats,
    getTopEndpoints,
    getServiceStats,
    getTopIps
} from "./analytics.ts";
import { getWafEvents } from "./waf.ts";

/**
 * Prometheus Metrics Exporter
 * Exposes Guardian metrics in Prometheus text format
 */

// Histogram buckets for latency (in ms)
export const LATENCY_BUCKETS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

// In-memory latency histogram (reset on restart)
const latencyHistogram: Map<string, number[]> = new Map();

// Memory history (samples every 10s, keep 60 samples = 10 minutes)
const memoryHistory: { timestamp: number; rss: number; heapUsed: number }[] = [];
const MAX_MEMORY_SAMPLES = 60;

// Track precise rolling latency for dashboard (last 100 samples per service)
const rollingLatencies: Map<string, number[]> = new Map();
const MAX_ROLLING_SAMPLES = 100;

export function recordLatency(service: string, latencyMs: number) {
    if (!latencyHistogram.has(service)) {
        latencyHistogram.set(service, new Array(LATENCY_BUCKETS.length + 1).fill(0));
    }
    const buckets = latencyHistogram.get(service)!;

    // Find which bucket this latency falls into
    for (let i = 0; i < LATENCY_BUCKETS.length; i++) {
        if (latencyMs <= LATENCY_BUCKETS[i]) {
            buckets[i]++;
            break;
        }
    }
    // Always increment +Inf bucket
    buckets[LATENCY_BUCKETS.length]++;

    // Precise rolling average for dashboard
    if (!rollingLatencies.has(service)) {
        rollingLatencies.set(service, []);
    }
    const samples = rollingLatencies.get(service)!;
    samples.push(latencyMs);
    if (samples.length > MAX_ROLLING_SAMPLES) {
        samples.shift();
    }
}

// Get latency stats for dashboard
export function getLatencyStats() {
    const result: Record<string, { buckets: number[]; labels: string[]; total: number; avgMs: number }> = {};

    for (const [service, buckets] of latencyHistogram.entries()) {
        const total = buckets[LATENCY_BUCKETS.length]; // +Inf has total count

        // Estimate average (rough approximation using bucket midpoints)
        let weightedSum = 0;
        let prevBound = 0;
        let inBucketsCount = 0;
        for (let i = 0; i < LATENCY_BUCKETS.length; i++) {
            const countInBucket = buckets[i];
            const midpoint = (prevBound + LATENCY_BUCKETS[i]) / 2;
            weightedSum += countInBucket * midpoint;
            prevBound = LATENCY_BUCKETS[i];
            inBucketsCount += countInBucket;
        }

        // Include +Inf bucket in average estimate (assume 15s avg for overflow)
        const infCount = total - inBucketsCount;
        if (infCount > 0) {
            weightedSum += infCount * 15000;
        }

        // Use precise rolling average if samples are available
        const samples = rollingLatencies.get(service);
        const preciseAvg = samples && samples.length > 0
            ? Math.round(samples.reduce((a, b) => a + b, 0) / samples.length)
            : (total > 0 ? Math.round(weightedSum / total) : 0); // Fallback to bucket estimate

        result[service] = {
            buckets: buckets.slice(0, LATENCY_BUCKETS.length),
            labels: LATENCY_BUCKETS.map(b => `${b}ms`),
            total,
            avgMs: preciseAvg
        };
    }

    return result;
}

/**
 * Get aggregate average latency across all services
 */
export function getAggregateLatency(): number {
    let totalMs = 0;
    let totalSamples = 0;

    for (const samples of rollingLatencies.values()) {
        if (samples.length > 0) {
            totalMs += samples.reduce((a, b) => a + b, 0);
            totalSamples += samples.length;
        }
    }

    if (totalSamples > 0) return Math.round(totalMs / totalSamples);

    // Fallback to service stats if no discrete samples (unlikely)
    const stats = getLatencyStats();
    let totalLat = 0;
    let count = 0;
    for (const service in stats) {
        if (stats[service].total > 0) {
            totalLat += stats[service].avgMs * stats[service].total;
            count += stats[service].total;
        }
    }
    return count > 0 ? Math.round(totalLat / count) : 0;
}

// Record memory sample
export function recordMemorySample() {
    const mem = Deno.memoryUsage();
    memoryHistory.push({
        timestamp: Date.now(),
        rss: mem.rss,
        heapUsed: mem.heapUsed
    });

    if (memoryHistory.length > MAX_MEMORY_SAMPLES) {
        memoryHistory.shift();
    }
}

// Get memory history for dashboard
export function getMemoryHistory() {
    return memoryHistory;
}

export async function generatePrometheusMetrics(): Promise<string> {
    const lines: string[] = [];
    const now = Date.now();

    // Helper to add metric
    const addMetric = (name: string, type: string, help: string, value: number | string, labels?: Record<string, string>) => {
        if (!lines.some(l => l.startsWith(`# HELP ${name}`))) {
            lines.push(`# HELP ${name} ${help}`);
            lines.push(`# TYPE ${name} ${type}`);
        }
        const labelStr = labels ? `{${Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(",")}}` : "";
        lines.push(`${name}${labelStr} ${value}`);
    };

    // === Guardian Core Metrics ===

    // Uptime
    const uptimeSeconds = Math.floor((now - stats.startTime) / 1000);
    addMetric("guardian_uptime_seconds", "gauge", "Guardian uptime in seconds", uptimeSeconds);

    // Total requests
    addMetric("guardian_requests_total", "counter", "Total requests processed", stats.totalRequests);

    // Requests per second
    addMetric("guardian_requests_per_second", "gauge", "Current requests per second", stats.rps.toFixed(2));

    // Active connections (approximation - not tracked)
    // addMetric("guardian_active_connections", "gauge", "Approximate active connections", 0);

    // === Traffic Stats (from KV) ===
    try {
        const traffic = await getTrafficStats();
        addMetric("guardian_requests_today_total", "counter", "Total requests today", traffic.total);
    } catch (e) { /* ignore */ }

    // === Service Stats ===
    try {
        const services = await getServiceStats();
        for (const svc of services) {
            addMetric("guardian_service_requests_total", "counter", "Requests per service", svc.count, { service: svc.name });
        }
    } catch (e) { /* ignore */ }

    // === Service Health ===
    for (const service of manager.getAll()) {
        const status = service.stats.status;
        const statusNum = status === "running" ? 1 : status === "starting" ? 0.5 : 0;
        addMetric("guardian_service_up", "gauge", "Service health status (1=up, 0=down)", statusNum, { service: service.config.name });

        addMetric("guardian_service_restarts_total", "counter", "Service restart count", service.stats.restarts, { service: service.config.name });

        if (service.stats.cpu) {
            addMetric("guardian_service_cpu_percent", "gauge", "Service CPU usage", service.stats.cpu.toFixed(2), { service: service.config.name });
        }
        if (service.stats.memory) {
            addMetric("guardian_service_memory_bytes", "gauge", "Service memory usage", service.stats.memory * 1024, { service: service.config.name });
        }
        if (service.stats.startTime) {
            const serviceUptime = Math.floor((now - service.stats.startTime) / 1000);
            addMetric("guardian_service_uptime_seconds", "gauge", "Service uptime", serviceUptime, { service: service.config.name });
        }
    }

    // === Latency Histogram ===
    for (const [service, buckets] of latencyHistogram.entries()) {
        let cumulative = 0;
        for (let i = 0; i < LATENCY_BUCKETS.length; i++) {
            cumulative += buckets[i];
            addMetric("guardian_request_duration_ms_bucket", "histogram", "Request latency histogram", cumulative, {
                service,
                le: String(LATENCY_BUCKETS[i])
            });
        }
        // +Inf bucket
        cumulative += buckets[LATENCY_BUCKETS.length];
        addMetric("guardian_request_duration_ms_bucket", "histogram", "Request latency histogram", cumulative, {
            service,
            le: "+Inf"
        });
    }

    // === WAF Stats ===
    try {
        const wafEvents = await getWafEvents(100);
        addMetric("guardian_waf_blocked_total", "counter", "Total WAF blocked requests", wafEvents.length);
    } catch (e) { /* ignore */ }

    // === Top IPs for anomaly detection ===
    try {
        const topIps = await getTopIps(5);
        for (const ip of topIps) {
            addMetric("guardian_ip_requests_total", "counter", "Requests per IP", ip.count, { ip: ip.ip });
        }
    } catch (e) { /* ignore */ }

    return lines.join("\n") + "\n";
}
