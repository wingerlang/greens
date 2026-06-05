export interface SwedishHoliday {
    date: string; // YYYY-MM-DD
    name: string; // Swedish name of the holiday
    isRedDay: boolean; // True if it is an official red day, or Julafton, Midsommarafton, Nyårsafton
}

// Meeus/Jones/Butcher Computus Algorithm to calculate Easter Sunday
function getEasterSunday(year: number): Date {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = March, 4 = April
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    
    // Create Date at noon in local timezone to avoid zone-crossing shifts
    return new Date(year, month - 1, day, 12, 0, 0);
}

function formatDateString(year: number, monthZeroIndexed: number, day: number): string {
    const m = String(monthZeroIndexed + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${year}-${m}-${d}`;
}

export function getSwedishHolidays(year: number): Record<string, SwedishHoliday> {
    const holidays: Record<string, SwedishHoliday> = {};

    const addHoliday = (dateStr: string, name: string, isRedDay: boolean) => {
        if (holidays[dateStr]) {
            holidays[dateStr] = {
                date: dateStr,
                name: `${holidays[dateStr].name} / ${name}`,
                isRedDay: holidays[dateStr].isRedDay || isRedDay
            };
        } else {
            holidays[dateStr] = { date: dateStr, name, isRedDay };
        }
    };

    // --- Fixed Holidays ---
    addHoliday(formatDateString(year, 0, 1), 'Nyårsdagen', true);
    addHoliday(formatDateString(year, 0, 5), 'Trettondagsafton', false);
    addHoliday(formatDateString(year, 0, 6), 'Trettondedag jul', true);
    addHoliday(formatDateString(year, 3, 30), 'Valborgsmässoafton', false);
    addHoliday(formatDateString(year, 4, 1), 'Första maj', true);
    addHoliday(formatDateString(year, 5, 6), 'Sveriges nationaldag', true);
    addHoliday(formatDateString(year, 11, 24), 'Julafton', true); // Treated as red in practice
    addHoliday(formatDateString(year, 11, 25), 'Juldagen', true);
    addHoliday(formatDateString(year, 11, 26), 'Annandag jul', true);
    addHoliday(formatDateString(year, 11, 31), 'Nyårsafton', true); // Treated as red in practice

    // --- Easter-based moving holidays ---
    const easter = getEasterSunday(year);
    
    // Maundy Thursday (Skärtorsdagen) - Easter Sunday - 3 days
    const skartorsdag = new Date(easter);
    skartorsdag.setDate(easter.getDate() - 3);
    addHoliday(formatDateString(year, skartorsdag.getMonth(), skartorsdag.getDate()), 'Skärtorsdagen', false);

    // Good Friday (Långfredagen) - Easter Sunday - 2 days
    const langfredag = new Date(easter);
    langfredag.setDate(easter.getDate() - 2);
    addHoliday(formatDateString(year, langfredag.getMonth(), langfredag.getDate()), 'Långfredagen', true);

    // Easter Eve (Påskafton) - Easter Sunday - 1 day
    const paskafton = new Date(easter);
    paskafton.setDate(easter.getDate() - 1);
    addHoliday(formatDateString(year, paskafton.getMonth(), paskafton.getDate()), 'Påskafton', false);

    // Easter Sunday (Påskdagen)
    addHoliday(formatDateString(year, easter.getMonth(), easter.getDate()), 'Påskdagen', true);

    // Easter Monday (Annandag påsk) - Easter Sunday + 1 day
    const annandagPask = new Date(easter);
    annandagPask.setDate(easter.getDate() + 1);
    addHoliday(formatDateString(year, annandagPask.getMonth(), annandagPask.getDate()), 'Annandag påsk', true);

    // Ascension Day (Kristi himmelsfärdsdag) - Easter Sunday + 39 days (always a Thursday)
    const kristiHimmelsfard = new Date(easter);
    kristiHimmelsfard.setDate(easter.getDate() + 39);
    addHoliday(formatDateString(year, kristiHimmelsfard.getMonth(), kristiHimmelsfard.getDate()), 'Kristi himmelsfärdsdag', true);

    // Pentecost Sunday (Pingstdagen) - Easter Sunday + 49 days
    const pingstdagen = new Date(easter);
    pingstdagen.setDate(easter.getDate() + 49);
    addHoliday(formatDateString(year, pingstdagen.getMonth(), pingstdagen.getDate()), 'Pingstdagen', true);

    // --- Midsummer ---
    // Midsommarafton: Friday between June 19 and June 25
    const midsommarafton = new Date(year, 5, 19, 12, 0, 0);
    while (midsommarafton.getDay() !== 5) { // 5 is Friday
        midsommarafton.setDate(midsommarafton.getDate() + 1);
    }
    addHoliday(formatDateString(year, 5, midsommarafton.getDate()), 'Midsommarafton', true); // Treated as red in practice

    // Midsommardagen: Saturday after Midsommarafton
    const midsommardagen = new Date(midsommarafton);
    midsommardagen.setDate(midsommarafton.getDate() + 1);
    addHoliday(formatDateString(year, 5, midsommardagen.getDate()), 'Midsommardagen', true);

    // --- All Saints ---
    // Alla helgons dag: Saturday between October 31 and November 6
    const allaHelgonsDag = new Date(year, 9, 31, 12, 0, 0); // October is 9
    while (allaHelgonsDag.getDay() !== 6) { // 6 is Saturday
        allaHelgonsDag.setDate(allaHelgonsDag.getDate() + 1);
    }
    addHoliday(formatDateString(year, allaHelgonsDag.getMonth(), allaHelgonsDag.getDate()), 'Alla helgons dag', true);

    // Allhelgonaafton: Friday before Alla helgons dag
    const allhelgonaafton = new Date(allaHelgonsDag);
    allhelgonaafton.setDate(allaHelgonsDag.getDate() - 1);
    addHoliday(formatDateString(year, allhelgonaafton.getMonth(), allhelgonaafton.getDate()), 'Allhelgonaafton', false);

    return holidays;
}
