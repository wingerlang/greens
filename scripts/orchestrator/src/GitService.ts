
export class GitService {
    constructor(private cwd: string = Deno.cwd()) {}

    private async exec(args: string[]): Promise<string> {
        const command = new Deno.Command("git", {
            args,
            cwd: this.cwd,
        });
        const output = await command.output();
        const decoder = new TextDecoder();

        if (!output.success) {
            throw new Error(`Git error: ${decoder.decode(output.stderr)}`);
        }
        return decoder.decode(output.stdout).trim();
    }

    async getCurrentCommit(): Promise<string> {
        return this.exec(["rev-parse", "HEAD"]);
    }

    async getStatus(): Promise<string> {
        return this.exec(["status", "--porcelain"]);
    }

    async pull(): Promise<string> {
        return this.exec(["pull"]);
    }

    async checkout(branchOrCommit: string): Promise<string> {
        return this.exec(["checkout", branchOrCommit]);
    }

    async getCommitHistory(limit: number = 10): Promise<{hash: string, msg: string, date: string}[]> {
        const out = await this.exec(["log", `-${limit}`, "--pretty=format:%h|%s|%ad"]);
        return out.split("\n").map(line => {
            const [hash, msg, date] = line.split("|");
            return { hash, msg, date };
        });
    }
}
