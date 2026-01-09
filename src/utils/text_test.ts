import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { normalizeText, slugify, deslugify } from "./text.ts";

Deno.test("normalizeText - handles whitespace and casing", () => {
    assertEquals(normalizeText("  Hello World  "), "hello world");
});

Deno.test("normalizeText - handles swedish characters", () => {
    assertEquals(normalizeText("Räksmörgås"), "räksmörgås");
});

Deno.test("slugify - basic functionality", () => {
    assertEquals(slugify("Bench Press"), "Bench-Press");
});

Deno.test("deslugify - basic functionality", () => {
    assertEquals(deslugify("Bench-Press"), "Bench Press");
});
