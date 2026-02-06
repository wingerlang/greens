
import { ensureDir } from "jsr:@std/fs";
import { join } from "jsr:@std/path";

const DATA_DIR = "data";
const REPORT_FILE = join(DATA_DIR, "ci_report.json");
const COVERAGE_DIR = "coverage";

interface CiReport {
    timestamp: string;
    status: "passed" | "failed";
    totalTests: number;
    passedTests: number;
    failedTests: number;
    coverage: {
        totalFiles: number;
        totalLines: number;
        coveredLines: number;
        percent: number;
    };
    output: string;
}

export async function runCiPipeline(): Promise<CiReport> {
    console.log("[CI] Starting pipeline...");
    const startTime = Date.now();

    // 1. Clean coverage dir
    try {
        await Deno.remove(COVERAGE_DIR, { recursive: true });
    } catch {
        // ignore
    }

    // 2. Run Tests
    console.log("[CI] Running tests...");
    const testCmd = new Deno.Command("deno", {
        args: [
            "test",
            "-A",
            "--unstable-kv",
            "--coverage=" + COVERAGE_DIR,
            "tests/unit/",
            "src/utils/",
            "scripts/guardian/middleware/"
        ],
        stdout: "piped",
        stderr: "piped"
    });

    const testOutput = await testCmd.output();
    const testStdout = new TextDecoder().decode(testOutput.stdout);
    const testStderr = new TextDecoder().decode(testOutput.stderr);
    const success = testOutput.success;

    console.log("[CI] Test finished. Success:", success);

    // Parse test output for counts
    // Example: "ok | 13 passed | 0 failed"
    let passed = 0;
    let failed = 0;
    const match = (testStdout + testStderr).match(/\|\s+(\d+)\s+passed\s+\|\s+(\d+)\s+failed/);
    if (match) {
        passed = parseInt(match[1]);
        failed = parseInt(match[2]);
    }

    // 3. Generate Coverage
    let coveragePercent = 0;
    let totalLines = 0;
    let coveredLines = 0;
    let totalFiles = 0;

    if (success) {
        console.log("[CI] Generating coverage report...");
        const covCmd = new Deno.Command("deno", {
            args: ["coverage", COVERAGE_DIR, "--json"],
            stdout: "piped",
            stderr: "piped"
        });
        const covOutput = await covCmd.output();
        if (covOutput.success) {
            const jsonStr = new TextDecoder().decode(covOutput.stdout);
            // The output is a stream of JSON objects (one per file) or a wrapper?
            // "deno coverage --json" outputs a JSON object structure?
            // Actually it seems to output one JSON object per file, separated by newline?
            // Or a single JSON object if lcov?
            // Let's assume it's one JSON object per file? No, documentation says "Output coverage in JSON format".
            // It might be a single root object { "url": "...", "ranges": [...] } repeated?

            // Let's handle the output. Usually it is a list of coverage reports.
            // Wait, "deno coverage --json" produces a custom JSON format which is a stream of ProcessCoverage objects if I recall, or maybe just one big object.
            // Let's try to parse it as a single JSON or lines.

            // Actually, simpler approach: use regex on the text output of `deno coverage` (without --json) to get the summary line if it exists.
            // But `deno coverage` without args prints detailed per-file.

            // Let's try parsing the JSON.
            try {
               const lines = jsonStr.split('\n').filter(l => l.trim().length > 0);
               // It seems Deno coverage json output is just the raw coverage data.
               // We need to aggregate it ourselves.

               // Coverage entry structure: { url: string, functions: [...], ranges: [...] } or similar?
               // Actually, `deno coverage` outputs text by default. `deno coverage --lcov` outputs lcov.
               // Let's use `deno coverage` text output and parse the summary if possible, or calculate from line data.

               // Alternative: parse `deno coverage` text output.
               // Cover file:///.../file.ts ... 85.7% (6/7)

               // Let's stick to parsing text output of `deno coverage` (no --json).
            } catch (e) {
                console.error("Failed to parse coverage JSON", e);
            }
        }
    }

    // Retry coverage with text output to parse percentage easily
    if (success) {
         const covCmdText = new Deno.Command("deno", {
            args: ["coverage", COVERAGE_DIR],
            stdout: "piped",
            stderr: "piped"
        });
        const covOut = await covCmdText.output();
        const covText = new TextDecoder().decode(covOut.stdout);

        // Parse lines like: "Cover file:///.../script.ts ... 100.0% (5/5)"
        // And find a total average? Deno doesn't output a total summary line by default.
        // We have to sum it up.

        const lines = covText.split('\n');
        let fileCount = 0;
        let lineSum = 0;
        let coveredSum = 0;

        for (const line of lines) {
            const match = line.match(/\s+([0-9.]+)%\s+\((\d+)\/(\d+)\)/);
            if (match) {
                fileCount++;
                const covered = parseInt(match[2]);
                const total = parseInt(match[3]);
                coveredSum += covered;
                lineSum += total;
            }
        }

        totalFiles = fileCount;
        totalLines = lineSum;
        coveredLines = coveredSum;
        if (totalLines > 0) {
            coveragePercent = (coveredLines / totalLines) * 100;
        }
    }

    const report: CiReport = {
        timestamp: new Date().toISOString(),
        status: success ? "passed" : "failed",
        totalTests: passed + failed,
        passedTests: passed,
        failedTests: failed,
        coverage: {
            totalFiles,
            totalLines,
            coveredLines,
            percent: parseFloat(coveragePercent.toFixed(2))
        },
        output: testStdout + "\n" + testStderr
    };

    // Save report
    await ensureDir(DATA_DIR);
    await Deno.writeTextFile(REPORT_FILE, JSON.stringify(report, null, 2));

    console.log(`[CI] Pipeline finished. Status: ${report.status}, Coverage: ${report.coverage.percent}%`);
    return report;
}

if (import.meta.main) {
    runCiPipeline();
}
