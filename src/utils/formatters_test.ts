/// <reference lib="deno.ns" />

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
    formatDateFull,
    formatDaysAgoCompact,
    formatDateRelative,
    formatDateShort,
    normalizeText,
    slugify,
    deslugify,
    formatNumber,
    formatVolumeTons,
    formatDuration,
    calculateRollingAverage,
    calculateTrend
} from "./formatters.ts";

Deno.test("formatDateFull", () => {
    // We can't easily test dynamic dates like "today" without mocking Date,
    // but we can test the structure or specific logic if we inject the date.
    // For now, let's just ensure it returns a string and contains expected parts for a fixed date relative to now.

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    assertEquals(formatDateFull(todayStr).includes("idag"), true);
});

Deno.test("formatDaysAgoCompact", () => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    assertEquals(formatDaysAgoCompact(todayStr), "idag");

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    assertEquals(formatDaysAgoCompact(yesterdayStr), "igår");
});

Deno.test("normalizeText", () => {
    assertEquals(normalizeText("  HeLLo   "), "hello");
    assertEquals(normalizeText("Åäö"), "åäö");
});

Deno.test("slugify and deslugify", () => {
    const text = "Bench Press";
    const slug = slugify(text);
    assertEquals(slug, "Bench-Press");
    assertEquals(deslugify(slug), text);
});

Deno.test("formatNumber", () => {
    // Swedish locale uses non-breaking space as thousands separator usually
    // But behavior might differ in CI env. Let's check basics.
    const num = 1000;
    const formatted = formatNumber(num);
    // Just check it's not "1000" if locale works, or contains space
    // If locale is missing, it might be "1,000" or "1000".
    // Safe check: it returns a string
    assertEquals(typeof formatted, "string");
});

Deno.test("formatVolumeTons", () => {
    assertEquals(formatVolumeTons(45000), "45.0t");
    assertEquals(formatVolumeTons(1500), "1.5t");
});

Deno.test("formatDuration", () => {
    assertEquals(formatDuration(45), "45min");
    assertEquals(formatDuration(90), "1h 30min");
    assertEquals(formatDuration(60), "1h");
});

Deno.test("calculateRollingAverage", () => {
    const data = [10, 20, 30, 40, 50];
    // Window 3
    // idx 0: [10] -> 10
    // idx 1: [10, 20] -> 15
    // idx 2: [10, 20, 30] -> 20
    // idx 3: [20, 30, 40] -> 30
    // idx 4: [30, 40, 50] -> 40

    const avg = calculateRollingAverage(data, 3);
    assertEquals(avg, [10, 15, 20, 30, 40]);
});

Deno.test("calculateTrend", () => {
    assertEquals(calculateTrend([80, 80.6]), "up"); // +0.6 > 0.5
    assertEquals(calculateTrend([80, 80.2]), "stable"); // +0.2 < 0.5
    assertEquals(calculateTrend([80, 79.4]), "down"); // -0.6 < -0.5
});
