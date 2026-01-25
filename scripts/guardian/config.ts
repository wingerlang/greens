export const CONFIG = {
    ports: {
        frontend: 3000,
        backend: 8000,
        dashboard: 9999,
        internalFrontend: 3001,
        internalBackend: 8001
    },
    features: {
        waf: true,
        botDefense: true,
        rateLimit: true,
        smartCache: true,
        circuitBreaker: true,
        recorder: true,
    },
    rateLimit: {
        windowMs: 10000, // 10s
        maxRequests: 200, // Old fixed window default
        tokenBucket: {
            capacity: 50,
            fillRate: 10, // tokens per second
        }
    },
    smartCache: {
        maxSize: 50 * 1024 * 1024, // 50MB
        ttl: 600 * 1000, // 10 minutes
        paths: ["/assets/", ".png", ".jpg", ".jpeg", ".svg", ".css", ".js", ".woff2"]
    },
    timeouts: {
        proxyConnect: 3000,
        proxyRead: 30000,
    }
};
