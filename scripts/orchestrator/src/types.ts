
export type Environment = 'beta' | 'preview' | 'prod';

export interface ServiceConfig {
    env: Environment;
    basePort: number;
    dbMode: 'real' | 'copy';
    buildMode: 'vite-dev' | 'vite-prod';
    distDir?: string; // For prod/preview
}

export interface DeploymentState {
    env: Environment;
    status: 'stopped' | 'starting' | 'running' | 'error';
    pid?: number;
    currentCommit?: string;
    lastUpdated: Date;
    activePortBase: number;
}

export interface OrchestratorState {
    beta: DeploymentState;
    preview: DeploymentState;
    prod: DeploymentState;
}

export interface TestResult {
    id: string;
    timestamp: Date;
    commitHash: string;
    passRate: number;
    coverage: number;
    details: any; // JSON
}
