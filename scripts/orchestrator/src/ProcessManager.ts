
import { ensureDir } from "jsr:@std/fs";
import { dirname } from "jsr:@std/path";

export class ProcessManager {
    private processes: Map<string, Deno.ChildProcess> = new Map();
    private logsDir: string;

    constructor(logsDir: string = "./logs/orchestrator") {
        this.logsDir = logsDir;
    }

    async start(id: string, cmd: string[], env: Record<string, string> = {}): Promise<number> {
        // Stop existing if any
        if (this.processes.has(id)) {
            await this.stop(id);
        }

        await ensureDir(this.logsDir);
        const logFile = await Deno.open(`${this.logsDir}/${id}.log`, {
            create: true,
            append: true,
        });

        console.log(`[ProcessManager] Starting ${id}: ${cmd.join(" ")}`);

        const command = new Deno.Command(cmd[0], {
            args: cmd.slice(1),
            env: { ...Deno.env.toObject(), ...env },
            stdout: "piped",
            stderr: "piped",
        });

        const process = command.spawn();
        this.processes.set(id, process);

        // Pipe output to log file
        this.pipeToLog(process.stdout, logFile);
        this.pipeToLog(process.stderr, logFile);

        return process.pid;
    }

    private async pipeToLog(stream: ReadableStream<Uint8Array>, file: Deno.FsFile) {
        const reader = stream.getReader();
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                await file.write(value);
            }
        } catch (_) {
            // Ignore errors on close
        }
    }

    async stop(id: string) {
        const process = this.processes.get(id);
        if (process) {
            console.log(`[ProcessManager] Stopping ${id} (PID: ${process.pid})`);
            try {
                process.kill("SIGTERM");
                await process.status; // Wait for exit
            } catch (e) {
                console.warn(`[ProcessManager] Error stopping ${id}:`, e);
            }
            this.processes.delete(id);
        }
    }

    isRunning(id: string): boolean {
        return this.processes.has(id);
    }

    getPid(id: string): number | undefined {
        return this.processes.get(id)?.pid;
    }
}
