
export async function clearPort(port: number) {
    if (Deno.build.os === "windows") {
        try {
            const cmd = new Deno.Command("netstat", { args: ["-ano"] });
            const { stdout } = await cmd.output();
            const output = new TextDecoder().decode(stdout);
            const lines = output.split("\n");
            const pattern = new RegExp(`:${port}\\s+.*LISTENING\\s+(\\d+)`);

            for (const line of lines) {
                const match = line.match(pattern);
                if (match) {
                    const pid = match[1];
                    if (parseInt(pid) === Deno.pid) continue;
                    const killCmd = new Deno.Command("taskkill", { args: ["/F", "/PID", pid] });
                    await killCmd.output();
                }
            }
        } catch (e) { /* ignore */ }
    } else {
        // Linux/Mac
        try {
            const cmd = new Deno.Command("lsof", { args: ["-t", "-i", `:${port}`] });
            const output = await cmd.output();
            const pids = new TextDecoder().decode(output.stdout).trim().split('\n');
            for (const pid of pids) {
                if (pid && parseInt(pid) !== Deno.pid) {
                     const kill = new Deno.Command("kill", { args: ["-9", pid] });
                     await kill.output();
                }
            }
        } catch (e) { /* ignore */ }
    }
}
