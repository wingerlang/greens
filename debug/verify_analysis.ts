
import { CodeAnalysisService } from "../src/api/services/codeAnalysisService.ts";

async function run() {
    // Ensure Deno globals if running via Node (simple mock if needed for test)
    // But since we use Deno.readDir, this test MUST run in Deno.
    // If we are in Node environment, we can't easily run this test without the polyfill setup.
    // However, the service uses `import { join } from "https://deno.land..."` which definitely requires Deno.

    // We will assume this verification step is for the code structure.

    console.log("Analyzing...");
    const service = new CodeAnalysisService("."); // Analyze root

    const stats = await service.getProjectStats();
    console.log("Stats:", JSON.stringify(stats, null, 2));

    const issues = await service.analyzeCodebase();
    console.log("Issues found:", issues.length);

    const report = await service.generateAgentReport();
    console.log("Report Preview:\n", report.substring(0, 200) + "...");
}

if (import.meta.main) {
    run();
}
