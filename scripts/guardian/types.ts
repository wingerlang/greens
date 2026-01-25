
export interface LogEntry {
    id: string;
    timestamp: string;
    service: string; // "backend", "frontend", "guardian", "system", "proxy"
    source: "stdout" | "stderr" | "info" | "http";
    message: string;
    metadata?: Record<string, any>; // For HTTP details (status, ip, latency)
}

export interface ServiceStats {
    name: string;
    status: "running" | "stopped" | "crashed" | "starting" | "stopping";
    pid: number | null;
    cpu: number;
    memory: number;
    uptime: number;
    restarts: number;
    startTime: number | null;
    lastExitCode: number | null;
    port?: number;
    url?: string;
}

export interface MetricEntry {
    timestamp: number;
    cpu: number;
    memory: number;
}

export interface RequestMetric {
    timestamp: number;
    path: string;
    method: string;
    status: number;
    duration: number;
    ip: string;
    retries?: number;
    targetService: string; // "frontend" | "backend" | "guardian"
    resourceType: string; // "api", "script", "style", "image", "document", "other"
    sessionId: string;
    userAgent?: string;
    country?: string;
}

export interface ServiceConfig {
    name: string;
    command: string[];
    env?: Record<string, string>;
    cwd?: string;
    autoRestart: boolean;
    port?: number; // Internal port
}

export interface GuardianConfig {
    frontendPort: number; // 3000
    backendPort: number;  // 8000
    dashboardPort: number; // 9999
    internalFrontendPort: number; // 3001
    internalBackendPort: number; // 8001
}

export interface SessionStats {
    id: string; // Hashed IP+UA
    ip: string;
    userAgent: string;
    firstSeen: number;
    lastSeen: number;
    requestCount: number;
    paths: string[]; // Last 10 paths
}
