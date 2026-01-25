/// <reference lib="deno.ns" />
import { banIp } from "./security.ts";

const BAD_BOT_AGENTS = [
    /sqlmap/i,
    /nikto/i,
    /nmap/i,
    /masscan/i,
    /gobuster/i,
    /dirbuster/i,
    /hydra/i,
    /medusa/i,
    /wpscan/i,
    /nessus/i,
    /burpcollaborator/i,
    /python-requests/i, // controversial, but often bots if not API
    /curl/i, // also controversial, maybe skip
    /wget/i
];

// If a user accesses these, they are 100% looking for trouble. Instant ban.
const HONEYPOT_PATHS = [
    "/.env",
    "/.git/config",
    "/wp-login.php",
    "/phpmyadmin",
    "/admin.php",
    "/composer.lock",
    "/id_rsa",
    "/.ssh/"
];

export async function checkBot(userAgent: string): Promise<{ blocked: boolean; reason?: string }> {
    for (const regex of BAD_BOT_AGENTS) {
        if (regex.test(userAgent)) {
            return { blocked: true, reason: "Known Bad Bot UA" };
        }
    }
    return { blocked: false };
}

export async function checkHoneypot(path: string, ip: string): Promise<boolean> {
    const normalizedPath = path.toLowerCase();

    for (const honeypot of HONEYPOT_PATHS) {
        if (normalizedPath.includes(honeypot)) {
            console.log(`[GUARDIAN] HONEYPOT TRIGGERED: ${ip} requested ${path}`);
            await banIp(ip, `Honeypot triggered: ${path}`);
            return true;
        }
    }
    return false;
}
