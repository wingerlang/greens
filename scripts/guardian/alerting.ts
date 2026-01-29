/**
 * Guardian Alerting Module
 * Sends notifications to webhooks when important events occur
 */

import { CONFIG } from "./config.ts";

interface Alert {
    type: "circuit_open" | "circuit_close" | "waf_block" | "service_crash" | "custom";
    service?: string;
    message: string;
    timestamp: number;
}

// Debounce tracking: type+service -> last sent timestamp
const lastAlertTimes: Map<string, number> = new Map();

/**
 * Send an alert to the configured webhook
 * Respects debounce settings to avoid spam
 */
export async function sendAlert(
    type: Alert["type"],
    message: string,
    service?: string
): Promise<boolean> {
    const alertConfig = (CONFIG as any).alerting;

    // Skip if alerting is disabled or no webhook configured
    if (!alertConfig?.enabled || !alertConfig?.webhookUrl) {
        return false;
    }

    // Debounce check
    const debounceKey = `${type}:${service || "global"}`;
    const lastSent = lastAlertTimes.get(debounceKey) || 0;
    const debounceMs = alertConfig.debounceMs || 60000; // Default 1 minute

    if (Date.now() - lastSent < debounceMs) {
        console.log(`[ALERTING] Debounced alert: ${debounceKey}`);
        return false;
    }

    const alert: Alert = {
        type,
        service,
        message,
        timestamp: Date.now()
    };

    try {
        // Determine webhook format
        const webhookUrl = alertConfig.webhookUrl;
        let payload: any;

        if (webhookUrl.includes("discord.com")) {
            // Discord webhook format
            payload = {
                embeds: [{
                    title: `🛡️ Guardian Alert: ${type.replace("_", " ").toUpperCase()}`,
                    description: message,
                    color: type === "circuit_open" || type === "service_crash" ? 0xff0000 :
                        type === "circuit_close" ? 0x00ff00 : 0xffff00,
                    fields: service ? [{ name: "Service", value: service, inline: true }] : [],
                    timestamp: new Date(alert.timestamp).toISOString()
                }]
            };
        } else if (webhookUrl.includes("slack.com")) {
            // Slack webhook format
            payload = {
                text: `🛡️ *Guardian Alert*`,
                attachments: [{
                    color: type === "circuit_open" || type === "service_crash" ? "danger" :
                        type === "circuit_close" ? "good" : "warning",
                    title: type.replace("_", " ").toUpperCase(),
                    text: message,
                    fields: service ? [{ title: "Service", value: service, short: true }] : [],
                    ts: Math.floor(alert.timestamp / 1000)
                }]
            };
        } else {
            // Generic webhook format
            payload = alert;
        }

        const response = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            lastAlertTimes.set(debounceKey, Date.now());
            console.log(`[ALERTING] Sent alert: ${type} - ${message}`);
            return true;
        } else {
            console.error(`[ALERTING] Webhook failed: ${response.status}`);
            return false;
        }
    } catch (e) {
        console.error(`[ALERTING] Error sending alert:`, e);
        return false;
    }
}

/**
 * Alert when circuit breaker opens
 */
export function alertCircuitOpen(service: string) {
    sendAlert(
        "circuit_open",
        `Circuit breaker OPENED for ${service}. Service is experiencing failures and traffic is being blocked.`,
        service
    );
}

/**
 * Alert when circuit breaker closes (recovery)
 */
export function alertCircuitClose(service: string) {
    sendAlert(
        "circuit_close",
        `Circuit breaker CLOSED for ${service}. Service has recovered and is accepting traffic again.`,
        service
    );
}

/**
 * Alert when a service crashes
 */
export function alertServiceCrash(service: string, exitCode: number) {
    sendAlert(
        "service_crash",
        `Service ${service} crashed with exit code ${exitCode}. Auto-restart in progress.`,
        service
    );
}
