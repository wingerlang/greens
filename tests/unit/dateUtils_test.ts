import { assertEquals } from "jsr:@std/assert";
import { formatSwedishDate, getRelativeTime, formatDuration, parseTimeToSeconds } from "../../src/utils/dateUtils.ts";

Deno.test("formatSwedishDate - formats correctly", () => {
    assertEquals(formatSwedishDate("2024-12-15"), "15 dec. 2024");
});

Deno.test("getRelativeTime - returns Idag", () => {
    const now = new Date();
    assertEquals(getRelativeTime(now.toISOString()), "Idag");
});

Deno.test("getRelativeTime - returns Igår", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    assertEquals(getRelativeTime(yesterday.toISOString()), "Igår");
});

Deno.test("formatDuration - formats hours and minutes", () => {
    assertEquals(formatDuration(3600 + 15 * 60), "1h 15m");
});

Deno.test("formatDuration - formats minutes only", () => {
    assertEquals(formatDuration(15 * 60), "15m");
});

Deno.test("parseTimeToSeconds - parses HH:MM:SS", () => {
    assertEquals(parseTimeToSeconds("01:15:30"), 4530);
});

Deno.test("parseTimeToSeconds - parses MM:SS", () => {
    assertEquals(parseTimeToSeconds("15:30"), 930);
});
