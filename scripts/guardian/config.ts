export const CONFIG = {
    version: "2.7.0",
    ports: {
        proxyFrontend: 3000,
        proxyBackend: 8000,
        dashboard: 9999,
        internalFrontend: 3001,
        internalBackend: 8001
    },
    timeouts: {
        proxyRequest: 30000,
        circuitBreakerOpen: 30000, // 30s
    },
    rateLimit: {
        enabled: true,
        tokensPerInterval: 200,
        interval: 10000, // 10s
        maxTokens: 500
    },
    cache: {
        enabled: true,
        ttl: 60000, // 60s
        paths: [
            "/assets/",
            "/static/",
            "/images/",
            "favicon.ico"
        ]
    },
    health: {
        interval: 10000, // 10s
        timeout: 2000,
        failureThreshold: 3
    }
};
