
import { OrchestratorState } from "./types.ts";

export class CaddyService {
    private templatePath = "scripts/orchestrator/templates/Caddyfile.template";
    private outputPath = "scripts/orchestrator/Caddyfile";

    async generate(state: OrchestratorState) {
        let content = await Deno.readTextFile(this.templatePath);

        content = content.replace("{{BETA_PORT}}", String(state.beta.activePortBase || 5000));
        content = content.replace("{{PREVIEW_PORT}}", String(state.preview.activePortBase || 4000));
        content = content.replace("{{PROD_PORT}}", String(state.prod.activePortBase || 3000));

        await Deno.writeTextFile(this.outputPath, content);
    }

    async update(state: OrchestratorState) {
        await this.generate(state);
        await this.reload();
    }

    async reload() {
        console.log("[Caddy] Reloading config...");
        // Check if caddy is running first?
        // Just try reload.
        try {
            const command = new Deno.Command("caddy", {
                args: ["reload", "--config", this.outputPath],
            });
            const output = await command.output();
            if (!output.success) {
                console.error("[Caddy] Reload failed:", new TextDecoder().decode(output.stderr));
            } else {
                console.log("[Caddy] Reload success.");
            }
        } catch (e) {
            console.warn("[Caddy] Caddy not found or error:", e);
        }
    }
}
