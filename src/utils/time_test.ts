import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { parseTimeToSeconds, formatDurationSeconds, formatDurationMinutes } from "./time.ts";

Deno.test("parseTimeToSeconds - handles colon format", () => {
  assertEquals(parseTimeToSeconds("1:30"), 90);
  assertEquals(parseTimeToSeconds("1:00:00"), 3600);
});

Deno.test("parseTimeToSeconds - handles unit format", () => {
  assertEquals(parseTimeToSeconds("1h 30m"), 5400);
  assertEquals(parseTimeToSeconds("45min"), 2700);
  assertEquals(parseTimeToSeconds("45 min"), 2700);
});

Deno.test("parseTimeToSeconds - handles raw numbers", () => {
  assertEquals(parseTimeToSeconds("45"), 2700); // < 300 -> minutes
  assertEquals(parseTimeToSeconds("300"), 300); // >= 300 -> seconds
});

Deno.test("formatDurationSeconds", () => {
  assertEquals(formatDurationSeconds(5400), "1h 30m");
  assertEquals(formatDurationSeconds(2700), "45m");
});

Deno.test("formatDurationMinutes", () => {
  assertEquals(formatDurationMinutes(90), "1h 30min");
  assertEquals(formatDurationMinutes(45), "45min");
});
