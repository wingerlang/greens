
import { CodeAnalysisService } from "../src/api/services/codeAnalysisService.ts";

async function main() {
    console.error("🔍 Analyzing codebase...");

    try {
        const service = new CodeAnalysisService();
        const report = await service.generateAgentReport();

        // Output purely the report to stdout so it can be piped
        console.log(report);

        console.error("✅ Analysis complete.");
    } catch (e) {
        console.error("❌ Error during analysis:", e);
        Deno.exit(1);
    }
}

if (import.meta.main) {
    main();
}
