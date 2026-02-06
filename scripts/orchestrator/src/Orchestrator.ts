
import { ProcessManager } from "./ProcessManager.ts";
import { GitService } from "./GitService.ts";
import { CaddyService } from "./CaddyService.ts";
import {
    OrchestratorState,
    Environment,
    DeploymentState
} from "./types.ts";
import { ensureDir } from "jsr:@std/fs";
import { join } from "jsr:@std/path";

const STATE_FILE = "orchestrator.state.json";
const REPO_ROOT = Deno.cwd();

export class Orchestrator {
    private pm: ProcessManager;
    private git: GitService;
    private caddy: CaddyService;
    private state: OrchestratorState;

    constructor() {
        this.pm = new ProcessManager();
        this.git = new GitService(REPO_ROOT);
        this.caddy = new CaddyService();
        this.state = this.loadState();
    }

    private loadState(): OrchestratorState {
        try {
            const text = Deno.readTextFileSync(STATE_FILE);
            const data = JSON.parse(text);
            // Revive dates
            ['beta', 'preview', 'prod'].forEach(k => {
                if (data[k]?.lastUpdated) data[k].lastUpdated = new Date(data[k].lastUpdated);
            });
            return data;
        } catch {
            return {
                beta: { env: 'beta', status: 'stopped', lastUpdated: new Date(), activePortBase: 5000 },
                preview: { env: 'preview', status: 'stopped', lastUpdated: new Date(), activePortBase: 4000 },
                prod: { env: 'prod', status: 'stopped', lastUpdated: new Date(), activePortBase: 3000 }
            };
        }
    }

    private async saveState() {
        await Deno.writeTextFile(STATE_FILE, JSON.stringify(this.state, null, 2));
    }

    private async generateGuardianConfig(env: Environment, basePort: number, outputDir: string) {
        // Base config template
        const config = {
            mode: env === 'beta' ? 'dev' : 'prod',
            adminSecret: "admin-secret-TODO", // Should be secure
            ports: {
                frontend: basePort,
                backend: basePort + 5000,
                dashboard: basePort + 6999,
                internalFrontend: basePort + 1,
                internalBackend: basePort + 5001
            },
            features: {
                recorder: true,
                compression: true
            },
            // ... other defaults
        };

        // Adjust ports logic to match user expectation or standard offsets
        const offset = basePort - 3000;
        config.ports.backend = 8000 + offset;
        config.ports.dashboard = 9999 + offset;
        config.ports.internalBackend = 8001 + offset;

        await ensureDir(outputDir);
        await Deno.writeTextFile(join(outputDir, "guardian.config.json"), JSON.stringify(config, null, 4));
        return join(outputDir, "guardian.config.json");
    }

    async deployBeta() {
        console.log("[Orchestrator] Deploying Beta...");
        await this.git.pull();

        const port = 5000;
        const processId = `guardian-${port}`;

        // Stop existing
        if (this.pm.isRunning(processId)) {
            await this.pm.stop(processId);
        }

        const configPath = await this.generateGuardianConfig('beta', port, "./.orchestrator/beta");

        // Start Guardian (Beta runs Vite Dev)
        const pid = await this.pm.start(processId,
            ["deno", "run", "-A", "--unstable-kv", "scripts/guardian/main.ts"],
            { "GUARDIAN_CONFIG_FILE": configPath }
        );

        this.state.beta.status = 'running';
        this.state.beta.pid = pid;
        this.state.beta.activePortBase = port;
        this.state.beta.lastUpdated = new Date();
        await this.saveState();
        await this.caddy.update(this.state);
        console.log("[Orchestrator] Beta Deployed.");
    }

    async promoteToPreview() {
        console.log("[Orchestrator] Promoting to Preview...");
        // 1. Build
        console.log("[Orchestrator] Building project...");
        const buildCmd = new Deno.Command("deno", {
            args: ["task", "build"],
            cwd: REPO_ROOT
        });
        const buildOut = await buildCmd.output();
        if (!buildOut.success) {
            throw new Error("Build failed: " + new TextDecoder().decode(buildOut.stderr));
        }

        // 2. Determine Slot (Blue/Green)
        // If Prod is on 3000, we use 4000. Else 3000.
        // Default Prod is 3000 if undefined.
        const currentProdPort = this.state.prod.activePortBase || 3000;
        const targetPort = currentProdPort === 3000 ? 4000 : 3000;
        const processId = `guardian-${targetPort}`;

        if (this.pm.isRunning(processId)) {
            await this.pm.stop(processId);
        }

        const configPath = await this.generateGuardianConfig('preview', targetPort, `./.orchestrator/${targetPort}`);

        // 3. Start Guardian (Prod Mode)
        const pid = await this.pm.start(processId,
            ["deno", "run", "-A", "--unstable-kv", "scripts/guardian/main.ts"],
            {
                "GUARDIAN_CONFIG_FILE": configPath,
                "GUARDIAN_MODE": "prod"
            }
        );

        this.state.preview.status = 'running';
        this.state.preview.pid = pid;
        this.state.preview.lastUpdated = new Date();
        this.state.preview.activePortBase = targetPort;

        await this.saveState();
        await this.caddy.update(this.state);
        console.log(`[Orchestrator] Preview Deployed on port ${targetPort}.`);
    }

    async swapProd() {
        console.log("[Orchestrator] Swapping Prod...");

        if (this.state.preview.status !== 'running') {
            throw new Error("Cannot swap: Preview is not running");
        }

        const oldProd = { ...this.state.prod };
        const oldPreview = { ...this.state.preview };

        // New Prod is the old Preview
        this.state.prod = {
            ...oldPreview,
            env: 'prod'
        };

        // New Preview is the old Prod (Rollback candidate)
        this.state.preview = {
            ...oldProd,
            env: 'preview'
        };

        await this.saveState();
        await this.caddy.update(this.state);
        console.log(`[Orchestrator] Prod Swapped. Prod is now on ${this.state.prod.activePortBase}.`);
    }

    getState() {
        return this.state;
    }
}
