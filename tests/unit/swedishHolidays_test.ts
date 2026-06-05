import { assertEquals } from "jsr:@std/assert";
import { getSwedishHolidays } from "../../src/utils/swedishHolidays.ts";

Deno.test("getSwedishHolidays - calculates fixed holidays for 2026", () => {
    const holidays = getSwedishHolidays(2026);
    
    // Fixed holidays
    assertEquals(holidays["2026-01-01"]?.name, "Nyårsdagen");
    assertEquals(holidays["2026-01-01"]?.isRedDay, true);
    
    assertEquals(holidays["2026-01-05"]?.name, "Trettondagsafton");
    assertEquals(holidays["2026-01-05"]?.isRedDay, false);
    
    assertEquals(holidays["2026-01-06"]?.name, "Trettondedag jul");
    assertEquals(holidays["2026-01-06"]?.isRedDay, true);
    
    assertEquals(holidays["2026-04-30"]?.name, "Valborgsmässoafton");
    assertEquals(holidays["2026-04-30"]?.isRedDay, false);
    
    assertEquals(holidays["2026-05-01"]?.name, "Första maj");
    assertEquals(holidays["2026-05-01"]?.isRedDay, true);
    
    assertEquals(holidays["2026-06-06"]?.name, "Sveriges nationaldag");
    assertEquals(holidays["2026-06-06"]?.isRedDay, true);
    
    assertEquals(holidays["2026-12-24"]?.name, "Julafton");
    assertEquals(holidays["2026-12-24"]?.isRedDay, true);
    
    assertEquals(holidays["2026-12-25"]?.name, "Juldagen");
    assertEquals(holidays["2026-12-25"]?.isRedDay, true);
    
    assertEquals(holidays["2026-12-26"]?.name, "Annandag jul");
    assertEquals(holidays["2026-12-26"]?.isRedDay, true);
    
    assertEquals(holidays["2026-12-31"]?.name, "Nyårsafton");
    assertEquals(holidays["2026-12-31"]?.isRedDay, true);
});

Deno.test("getSwedishHolidays - calculates Easter-based moving holidays for 2026", () => {
    const holidays = getSwedishHolidays(2026);
    
    // Easter in 2026 is April 5th
    assertEquals(holidays["2026-04-02"]?.name, "Skärtorsdagen");
    assertEquals(holidays["2026-04-02"]?.isRedDay, false);
    
    assertEquals(holidays["2026-04-03"]?.name, "Långfredagen");
    assertEquals(holidays["2026-04-03"]?.isRedDay, true);
    
    assertEquals(holidays["2026-04-04"]?.name, "Påskafton");
    assertEquals(holidays["2026-04-04"]?.isRedDay, false);
    
    assertEquals(holidays["2026-04-05"]?.name, "Påskdagen");
    assertEquals(holidays["2026-04-05"]?.isRedDay, true);
    
    assertEquals(holidays["2026-04-06"]?.name, "Annandag påsk");
    assertEquals(holidays["2026-04-06"]?.isRedDay, true);
    
    // Ascension: Easter + 39 days -> May 14th
    assertEquals(holidays["2026-05-14"]?.name, "Kristi himmelsfärdsdag");
    assertEquals(holidays["2026-05-14"]?.isRedDay, true);
    
    // Pentecost: Easter + 49 days -> May 24th
    assertEquals(holidays["2026-05-24"]?.name, "Pingstdagen");
    assertEquals(holidays["2026-05-24"]?.isRedDay, true);
});

Deno.test("getSwedishHolidays - calculates Midsummer and All Saints for 2026", () => {
    const holidays = getSwedishHolidays(2026);
    
    // Midsummer Eve 2026 is June 19th
    assertEquals(holidays["2026-06-19"]?.name, "Midsommarafton");
    assertEquals(holidays["2026-06-19"]?.isRedDay, true);
    
    assertEquals(holidays["2026-06-20"]?.name, "Midsommardagen");
    assertEquals(holidays["2026-06-20"]?.isRedDay, true);
    
    // All Saints Day 2026 is Oct 31st
    assertEquals(holidays["2026-10-30"]?.name, "Allhelgonaafton");
    assertEquals(holidays["2026-10-30"]?.isRedDay, false);
    
    assertEquals(holidays["2026-10-31"]?.name, "Alla helgons dag");
    assertEquals(holidays["2026-10-31"]?.isRedDay, true);
});
