
import { TestResult } from "./types.ts";

export class Database {
    private kv: Deno.Kv | null = null;
    private dbPath = "scripts/orchestrator/db/orchestrator.db";

    async init() {
        if (!this.kv) {
            this.kv = await Deno.openKv(this.dbPath);
        }
    }

    async addTestResult(result: TestResult) {
        if (!this.kv) await this.init();
        await this.kv!.set(["tests", result.timestamp.toISOString(), result.id], result);
    }

    async getTestResults(limit: number = 20): Promise<TestResult[]> {
        if (!this.kv) await this.init();
        const iter = this.kv!.list<TestResult>({ prefix: ["tests"] }, { limit, reverse: true });
        const results: TestResult[] = [];
        for await (const res of iter) {
            results.push(res.value);
        }
        return results;
    }
}
