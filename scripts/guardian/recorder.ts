/// <reference lib="deno.ns" />
import { join } from "https://deno.land/std@0.224.0/path/mod.ts";

const TRACE_DIR = "traces";
let isRecording = false;

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

    const trace: TraceEntry = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        method: req.method,
        url: req.url,
        headers,
        body: bodyText
    };

    const fileName = `trace_${trace.timestamp}_${trace.id.slice(0, 8)}.json`;
    await Deno.writeTextFile(join(TRACE_DIR, fileName), JSON.stringify(trace, null, 2));
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

        // We can't easily "inject" this into the proxy flow from here,
        // but we can fire it at the backend port directly if we know it.
        // Or fire it at the Guardian proxy itself (loopback).
        // Let's fire at the Guardian Proxy to test the whole stack again.

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
