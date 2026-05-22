import { assertEquals } from "jsr:@std/assert";
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
} from "../../src/utils/formatters.ts";

Deno.test("formatDateFull - formats correctly", () => {
    // Note: This test is time-sensitive. We might need to mock Date, but for now we'll check fixed output format if possible,
    // or just check that it contains the year.
    const date = new Date("2023-01-01").toISOString();
    const formatted = formatDateFull(date);
    // "1 januari 2023 (X år sedan)"
    assertEquals(formatted.includes("januari 2023"), true);
});

Deno.test("normalizeText - basic", () => {
    assertEquals(normalizeText("  Hello   World  "), "hello   world");
});

Deno.test("normalizeText - swedish chars", () => {
    assertEquals(normalizeText("ÅÄÖ"), "åäö");
});

Deno.test("slugify - basic", () => {
    assertEquals(slugify("Bench Press"), "Bench-Press");
});

Deno.test("deslugify - basic", () => {
    assertEquals(deslugify("Bench-Press"), "Bench Press");
});

Deno.test("formatNumber - formatting", () => {
    // Depends on locale, but sv-SE uses non-breaking space as group separator usually
    // Using loose check or regex
    const formatted = formatNumber(1234567);
    // 1 234 567 (char code 160 is nbsp)
    // Deno might use standard space depending on ICU.
    // Let's check regex \s
    assertEquals(/1\s234\s567/.test(formatted), true);
});

Deno.test("formatVolumeTons", () => {
    assertEquals(formatVolumeTons(4500), "4.5t");
    assertEquals(formatVolumeTons(100), "0.1t");
});

Deno.test("formatDuration", () => {
    assertEquals(formatDuration(90), "1h 30min");
    assertEquals(formatDuration(45), "45min");
    assertEquals(formatDuration(60), "1h");
});

Deno.test("calculateRollingAverage", () => {
    const data = [10, 20, 30, 40];
    const avg = calculateRollingAverage(data, 2);
    // [10, (10+20)/2, (20+30)/2, (30+40)/2]
    // [10, 15, 25, 35]
    assertEquals(avg, [10, 15, 25, 35]);
});

Deno.test("calculateTrend", () => {
    assertEquals(calculateTrend([10, 11]), "up");
    assertEquals(calculateTrend([10, 9]), "down");
    assertEquals(calculateTrend([10, 10.2]), "stable");
});
