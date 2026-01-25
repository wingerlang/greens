/// <reference lib="deno.ns" />
import { join } from "https://deno.land/std@0.224.0/path/mod.ts";

const TRACE_DIR = "traces";
const MAX_BODY_SIZE = 100 * 1024; // 100KB
const MAX_TRACES = 100;

let isRecording = false;
let lastCleanup = 0;

export interface TraceEntry {
    id: string;
    timestamp: number;
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: string; // Text only for now
}

export async function initRecorder() {
    try {
        await Deno.mkdir(TRACE_DIR, { recursive: true });
    } catch (e) {
        // ignore
    }
}

export function setRecording(enabled: boolean) {
    isRecording = enabled;
    console.log(`[GUARDIAN] Recording Mode: ${enabled ? 'ON' : 'OFF'}`);
}

export function getRecordingStatus() {
    return isRecording;
}

export async function saveTrace(req: Request, bodyText?: string) {
    if (!isRecording) return;

    const headers: Record<string, string> = {};
    req.headers.forEach((val, key) => headers[key] = val);

    if (bodyText && bodyText.length > MAX_BODY_SIZE) {
        bodyText = bodyText.slice(0, MAX_BODY_SIZE) + "... [TRUNCATED]";
    }

    const trace: TraceEntry = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        method: req.method,
        url: req.url,
        headers,
        body: bodyText
    };

    const fileName = `trace_${trace.timestamp}_${trace.id.slice(0, 8)}.json`;
    try {
        await Deno.writeTextFile(join(TRACE_DIR, fileName), JSON.stringify(trace, null, 2));
    } catch (e) {
        console.error("Failed to write trace", e);
    }

    // Probabilistic cleanup (1 in 10 requests) or time-based
    if (Date.now() - lastCleanup > 60000) {
        cleanOldTraces();
        lastCleanup = Date.now();
    }
}

async function cleanOldTraces() {
    try {
        const files: { name: string, time: number }[] = [];
        for await (const dirEntry of Deno.readDir(TRACE_DIR)) {
            if (dirEntry.isFile && dirEntry.name.endsWith(".json")) {
                const parts = dirEntry.name.split('_');
                const time = parseInt(parts[1]) || 0;
                files.push({ name: dirEntry.name, time });
            }
        }

        if (files.length > MAX_TRACES) {
            // Sort oldest first
            files.sort((a, b) => a.time - b.time);
            const toDelete = files.slice(0, files.length - MAX_TRACES);
            for (const f of toDelete) {
                await Deno.remove(join(TRACE_DIR, f.name));
            }
        }
    } catch (e) {
        // ignore
    }
}

export async function listTraces(): Promise<string[]> {
    const files: string[] = [];
    try {
        for await (const dirEntry of Deno.readDir(TRACE_DIR)) {
            if (dirEntry.isFile && dirEntry.name.endsWith(".json")) {
                files.push(dirEntry.name);
            }
        }
    } catch (e) {
        return [];
    }
    return files.sort().reverse().slice(0, 50); // Last 50 traces
}

export async function replayTrace(fileName: string): Promise<any> {
    try {
        const content = await Deno.readTextFile(join(TRACE_DIR, fileName));
        const trace: TraceEntry = JSON.parse(content);

        console.log(`[GUARDIAN] Replaying trace ${fileName} -> ${trace.url}`);

        const res = await fetch(trace.url, {
            method: trace.method,
            headers: trace.headers,
            body: trace.body
        });

        return {
            status: res.status,
            statusText: res.statusText
        };
    } catch (e) {
        console.error("Replay failed:", e);
        throw e;
    }
}
