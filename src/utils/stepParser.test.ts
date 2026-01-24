/// <reference lib="deno.ns" />

import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { extractTimer } from "./stepParser.ts";

// Helper to check label
function checkLabel(text: string, expectedLabel: string) {
  const result = extractTimer(text);
  if (!result) {
    throw new Error(`No timer found in text: "${text}"`);
  }
  assertEquals(result.label.toLowerCase(), expectedLabel.toLowerCase());
}

Deno.test("Timer Label Analysis", async (t) => {
  // 1. "Koka riset enligt förpackningen" -> "Koka riset"
  await t.step("Verb + Object manual", () => {
    checkLabel("Koka riset enligt förpackningen.", "Koka riset");
  });

  // 2. "Stek tofun i lite olja tills gyllene (ca 5 min)" -> "Stek tofun"
  await t.step("Complex sentence with parenthesis", () => {
    checkLabel(
      "Stek tofun i lite olja tills gyllene (ca 5 min).",
      "Stek tofun",
    );
  });

  // 3. "Tillsätt vitlök och kikärtor. Stek i 2 min." -> "Stek"
  await t.step("Separate sentence verb", () => {
    checkLabel("Tillsätt vitlök och kikärtor. Stek i 2 min.", "Stek");
  });

  // 4. "Låt puttra i 5 minuter." -> "Låt puttra" or "Puttra"
  await t.step("Double verb", () => {
    checkLabel("Låt puttra i 5 minuter.", "Puttra"); // Or "Låt puttra"
  });

  // 5. "Grädda mitt i ugnen i 20 min" -> "Grädda"
  await t.step("Verb with placement", () => {
    checkLabel("Grädda mitt i ugnen i 20 min.", "Grädda");
  });

  // 6. "Vila i 10 min" -> "Vila"
  await t.step("Simple verb", () => {
    checkLabel("Låt degen vila i 10 min.", "Vila");
  });

  // 7. "Koka upp vatten. Koka pastan i 8 min." -> "Koka pastan"
  await t.step("Multiple sentences, specific timer", () => {
    checkLabel("Koka upp vatten. Koka pastan i 8 min.", "Koka pastan");
  });

  // 8. "Rosta nötterna i torr panna, ca 3 min" -> "Rosta nötterna"
  await t.step("Verb object comma duration", () => {
    checkLabel("Rosta nötterna i torr panna, ca 3 min.", "Rosta nötterna");
  });

  // 9. "Mixa slätt (ca 1 min)" -> "Mixa slätt" or "Mixa"
  await t.step("Verb + Adjective/Adverb", () => {
    checkLabel("Mixa slätt (ca 1 min).", "Mixa");
  });

  // 10. "Enligt förpackning" (fallback if no verb?)
  // If text is JUST "Se förpackning" -> "Se förpackning"
  await t.step("Just manual instruction", () => {
    checkLabel("Se förpackning", "Se förpackning");
  });

  // 11. "stek i 5 min" -> "Stek"
  await t.step("LowerCase verb", () => {
    checkLabel("och stek i 5 min", "Stek");
  });

  // 12. "fräs löken mjuk i 3 min" -> "Fräs löken"
  await t.step("Verb object result duration", () => {
    checkLabel("fräs löken mjuk i 3 min", "Fräs löken");
  });

  // 13. "bjud in grannarna på middag om 10 min" (Tricky! "bjud" is verb, but maybe not cooking?)
  // Let's stick to cooking verbs.

  // 14. "låt sjuda under lock 15 min"
  await t.step("Sjuda under lock", () => {
    checkLabel("låt sjuda under lock 15 min", "Sjuda");
  });

  // 15. "vispa grädden hård (2 min)"
  await t.step("Vispa grädden", () => {
    checkLabel("vispa grädden hård (2 min)", "Vispa grädden");
  });

  // 16. "micra på hög effekt 1 min"
  await t.step("Micra", () => {
    checkLabel("micra på hög effekt 1 min", "Micra"); // or Mikra?
  });

  // 17. "blötlägg över natten (8 timmar)" - 8h > 3h limit? extractTimer has 180min limit.
  // Check limit logic separately.

  // 18. "ugnsrosta 25 min"
  await t.step("Ugnsrosta", () => {
    checkLabel("ugnsrosta 25 min", "Ugnsrosta");
  });

  // 19. "eftergrädda ca 10 min"
  await t.step("Eftergrädda", () => {
    checkLabel("eftergrädda ca 10 min", "Eftergrädda");
  });

  // 20. "Tärna tofun fint. Hacka löken." - SHOULD FAIL (No timer)
  await t.step("No timer false positive", () => {
    const result = extractTimer("Hacka lök och vitlök.");
    assertEquals(result, null);
  });

  await t.step("False positive check: 'Tärna tofun fint'", () => {
    const result = extractTimer("Tärna tofun fint. Hacka löken.");
    assertEquals(result, null);
  });

  await t.step("Specific Verb: Låt degen vila", () => {
    const text = "Låt degen vila i 10 min.";
    const result = extractTimer(text);
    if (result === null) { // Changed from assertNotEquals to if for consistency with checkLabel
      throw new Error(`Expected a timer, but got null for text: "${text}"`);
    }
    checkLabel(text, "Vila");
  });
});
