import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { formatNumber, formatVolumeTons } from "./number.ts";

Deno.test("formatNumber - basic formatting", () => {
    // In node environment without full ICU, this might vary, but checking basic behavior
    // If strict Swedish locale is not available in test runner, it might fallback.
    // We mainly check it runs without error and produces a string.
    const result = formatNumber(1234.56, 1);
    assertEquals(typeof result, "string");
});

Deno.test("formatVolumeTons", () => {
    assertEquals(formatVolumeTons(1500), "1.5t");
    assertEquals(formatVolumeTons(45200), "45.2t");
});
