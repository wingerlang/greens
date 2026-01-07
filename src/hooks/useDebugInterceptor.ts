import { useState, useEffect } from 'react';

export interface DebugLog {
    type: 'kv' | 'log';
    operation: string;
    key?: string;
    duration: number;
    timestamp: number;
    details?: any;
    error?: string;
}

export interface DebugProfile {
    id: string;
    url: string;
    method: string;
    status: number;
    startTime: string;
    duration: number;
    memory: {
        rss: number;
        heapTotal: number;
        heapUsed: number;
        external: number;
    };
    logs: DebugLog[];
    error?: string;
}

export interface RequestSummary {
    id: string;
    method: string;
    url: string;
    status: number;
    timestamp: number;
}

export function useDebugInterceptor() {
    const [requests, setRequests] = useState<RequestSummary[]>([]);
    const [latestId, setLatestId] = useState<string | null>(null);

    useEffect(() => {
        if (!import.meta.env.DEV) return;

        const originalFetch = window.fetch;

        window.fetch = async (...args) => {
            const response = await originalFetch(...args);

            const debugId = response.headers.get('X-Debug-Id');
            if (debugId) {
                const url = args[0] instanceof Request ? args[0].url : String(args[0]);
                // Strip host if possible
                const path = url.replace(/^https?:\/\/[^\/]+/, '');
                const method = args[0] instanceof Request ? args[0].method : (args[1]?.method || 'GET');

                const summary: RequestSummary = {
                    id: debugId,
                    method,
                    url: path,
                    status: response.status,
                    timestamp: Date.now()
                };

                setRequests(prev => [summary, ...prev].slice(0, 50));
                setLatestId(debugId);
            }

            return response;
        };

        return () => {
            window.fetch = originalFetch;
        };
    }, []);

    return { requests, latestId };
}
