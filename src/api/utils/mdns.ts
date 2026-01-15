import createMdns from "npm:multicast-dns@^7.2.5";

export function startMdns() {
    try {
        const mdns = createMdns();
        const hostname = "greens.local";

        // Find local IPv4
        const interfaces = Deno.networkInterfaces();
        const candidates: { name: string, ip: string }[] = [];

        for (const iface of interfaces) {
            if (iface.family === "IPv4" && !iface.address.startsWith("127.")) {
                candidates.push({ name: iface.name, ip: iface.address });
            }
        }

        console.log("mDNS: Detected IPs:", candidates);

        // Prefer 192.168.x.x
        let selectedIp = candidates.find(c => c.ip.startsWith("192.168."))?.ip;

        // Fallback to any non-172 (Docker/WSL often uses 172.16-31, but normal router might too. 
        // 192.168 is safer bet for home LAN).
        if (!selectedIp) {
            // Filter out 172.16-31 range if possible to avoid internal docker IPs
            // Regex for 172.16.x.x - 172.31.x.x
            const nonDocker = candidates.find(c => !/^172\.(1[6-9]|2\d|3[0-1])\./.test(c.ip));
            selectedIp = nonDocker?.ip || candidates[0]?.ip; // fallback to first available
        }

        if (!selectedIp) {
            console.error("mDNS: Could not determine local LAN IP. Found:", candidates);
            return;
        }

        console.log(`mDNS: Broadcasting ${hostname} -> ${selectedIp}`);

        const localIp = selectedIp;

        mdns.on('query', (query) => {
            const name = hostname;

            // Check if they are asking for us
            const questions = query.questions.filter(q => q.name === name || q.name === name + ".");

            if (questions.length > 0) {
                mdns.respond({
                    answers: questions.map(q => ({
                        name: hostname,
                        type: 'A',
                        ttl: 300,
                        data: localIp
                    }))
                });
            }
        });

    } catch (e) {
        console.error("Failed to start mDNS service:", e);
    }
}
