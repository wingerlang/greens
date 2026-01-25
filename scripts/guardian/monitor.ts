import { Service, manager } from "./services.ts";

async function updateWindowsStats(pids: Map<number, Service>) {
    if (pids.size === 0) return;
    const pidList = Array.from(pids.keys());
    const whereClause = pidList.map(p => `IDProcess=${p}`).join(" OR ");

    try {
        const cmd = new Deno.Command("wmic", {
            args: [
                "path", "Win32_PerfFormattedData_PerfProc_Process",
                "where", whereClause,
                "get", "IDProcess,PercentProcessorTime,WorkingSet",
                "/format:csv"
            ],
            stdout: "piped"
        });
        const output = await cmd.output();
        const text = new TextDecoder().decode(output.stdout);
        const lines = text.trim().split('\n');

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("Node,")) continue;

            const parts = trimmed.split(",");
            if (parts.length >= 4) {
                 // wmic CSV usually: Node,IDProcess,PercentProcessorTime,WorkingSet (alphabetical per locale? No, consistent)
                 // But wait, in original I assumed alphabetical.
                 // Let's assume index 1=ID, 2=CPU, 3=Mem based on alphabetical sort of requested columns.
                 // IDProcess (I), PercentProcessorTime (P), WorkingSet (W).
                 const pid = parseInt(parts[1]);
                 const cpu = parseFloat(parts[2]);
                 const mem = parseInt(parts[3]);

                 const service = pids.get(pid);
                 if (service) {
                     service.stats.cpu = cpu;
                     service.stats.memory = mem;
                 }
            }
        }
    } catch (e) {
        // Fallback or ignore
    }
}

export async function updateSystemStats() {
    // 1. Collect PIDs and track uptime
    const pids = new Map<number, Service>();
    for (const service of manager.getAll()) {
        if (service.stats.pid) {
            pids.set(service.stats.pid, service);
            if (service.stats.startTime) {
                service.stats.uptime = Math.floor((Date.now() - service.stats.startTime) / 1000);
            }
        }
    }

    // Also track Guardian
    const guardianService = manager.getOrAdd("guardian");
    guardianService.stats.pid = Deno.pid;
    guardianService.stats.uptime = Math.floor(performance.now() / 1000);
    pids.set(Deno.pid, guardianService);

    if (pids.size === 0) return;

    // 2. Fetch Stats (OS specific)
    if (Deno.build.os === "windows") {
        await updateWindowsStats(pids);
    } else {
        try {
            const cmd = new Deno.Command("ps", {
                args: ["-p", Array.from(pids.keys()).join(','), "-o", "pid,pcpu,rss"],
                stdout: "piped"
            });
            const output = await cmd.output();
            const text = new TextDecoder().decode(output.stdout);
            const lines = text.trim().split('\n');

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                const parts = line.split(/\s+/);
                if (parts.length >= 3) {
                    const pid = parseInt(parts[0]);
                    const cpu = parseFloat(parts[1]);
                    const rss = parseInt(parts[2]) * 1024;

                    const service = pids.get(pid);
                    if (service) {
                        service.stats.cpu = cpu;
                        service.stats.memory = rss;
                    }
                }
            }
        } catch (e) { /* ignore */ }
    }

    // 3. Persist Metrics
    for (const service of manager.getAll()) {
        await service.persistMetrics();
    }
    // Also persist guardian
    await guardianService.persistMetrics();
}
