
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
}

export interface ServiceConfig {
    name: string;
    command: string[];
    env?: Record<string, string>;
    cwd?: string;
    autoRestart: boolean;
    port?: number; // Internal port
}
