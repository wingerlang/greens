Göm moduler under feature-flaggor som är personberoende.

Löpning
styrketräning
sömn
kalorier
skafferi
veckoplanering
---
Lägg till alkohol som ett koncept

--
Bygg den ultimama "Jämför-personer"-vyn. Givet två personer som har styrketränat, skapa en sida för att visualisera skillnader och likheter. 

Ålder, kön, vikt.
Total antal pass, träningstid, set, reps.
Jämför PB mot PB. Vikt/kön-justerat. Övning för övning - båda personernas totalt statistik, PBs, trendlinjer - verkligen allt.
Bästa totallyft för 3 övningar?
Var är du starkare och/eller svagare än den andra?
Hur många övningar har du ett bättre (justerat eller inte) PB?
Givet trendlinjer - när är ni lika starka? 

Outline:
1. "Tale of the Tape" – Matchen i korthet (Sticky Header)
Längst upp ligger en statisk panel som alltid syns. Det sätter kontexten direkt. Tänk "Boxningsmatch-poster".

Layout: [Avatar A] vs [Avatar B]

Kärn-data (Personlig):

Namn & Ålder.

Kroppsvikt (Senast registrerad).

Kön (Viktigt för poängberäkning).

Beräknad Nivå: En textetikett baserad på StrengthLog-data (t.ex. "Advanced Powerlifter" vs "Novice Bodybuilder").

2. "The Power Card" – Styrkeöversikten (Hero Section)
Här svarar vi på frågan: "Vem är starkast totalt sett?"

Visualisering: Radar-diagram (Spindelnätsdiagram).

Axlar: Knäböj, Bänkpress, Marklyft, Militärpress, Chins (eller anpassningsbart).

Data: Visar procentuell fyllnad baserat på vem som är starkast. Om Person A lyfter 100kg och Person B 80kg, fyller Person A axeln 100% och B 80%.

Switch: En tydlig toggle-knapp: [Raw Styrka] / [Poäng (Wilks/IPF)].

Raw: Vem lyfter mest kilon?

Poäng: Vem är starkast relativt sin kroppsvikt och kön?

Nyckeltal (KPI-kort under grafen):

Totalen (Big 3): Sammanlagt kg i Böj/Bänk/Mark. (Färgkodad grön för vinnaren).

Relative Strength Score: (T.ex. IPF GL Points eller Wilks). Det mest rättvisa måttet.

Träningsålder: Antal år med loggade pass.

3. "The Grind" – Volym & Dedikation
Vem tränar hårdast? Styrka är inte allt, arbetskapacitet räknas.

Tabell/Bar-chart vy: | Metrik | Person A | Person B | Diff | | :--- | :--- | :--- | :--- | | Pass i år | 142 | 98 | <span style="color:green">A (+44)</span> | | Total tid | 180h | 110h | <span style="color:green">A (+70h)</span> | | Ton lyfta | 450t | 510t | <span style="color:red">B (+60t)</span> | | Snitt-RPE | 8.5 | 7.0 | A tränar tyngre |

4. "Head-to-Head" – Övningsdetaljer (Hjärtat av vyn)
Här kommer den "gedigna" delen med trädstruktur och sökning.

Verktygsfält:

Sök: "Bänk...", "Biceps..."

Filter: [Bara gemensamma övningar] / [Visa alla], [Basövningar], [Maskin].

Sortering: [Störst Diff %], [Muskelgrupp], [Alfabetisk].

List-vy (Expanderbar Trädstruktur): Vi grupperar per muskelgrupp (Bröst, Rygg, Ben) för överskådlighet.

Rad-design (Per övning): När raden är stängd ser man en snabb jämförelse.

Vänster: Övningsnamn (t.ex. Bänkpress).

Mitten: Grafisk Bar som visar förhållandet. (En horisontell stapel delad i två färger. Mitten är 50/50).

Höger: Vinnarens 1RM och "Diff" (t.ex. "+12.5 kg").

Expanderad Rad (Klick på övning): När användaren klickar fälls "Details" ut:

Statistik-grid:

- [x] **Matchup (Strength Comparison View)** 🥊
    - [x] **Tale of the Tape (Sticky Header)**
        - [x] Basic user info comparison (Name, Age, Bodyweight, Gender)
        - [x] Comparison subject selector (dropdown/search)
        - [x] Global "Fair Fight" (Wilks/IPF) toggle
    - [x] **The Power Card (Hero Section)**
        - [x] Radar chart comparing strength in key lifts (Squat, Bench, Deadlift, OHP, Pullups)
        - [x] KPI Cards: Big 3 Total, IPF GL Points, Strength Score
        - [x] Relative strength calculation vs bodyweight
    - [x] **The Grind (Volume & Dedication)**
        - [x] Table/Comparison of sessions per year, total time, tonnage, and average RPE
    - [x] **Head-to-Head (Detailed Exercise Comparison)**
        - [x] Expandable tree-structure for muscle groups
        - [x] Dynamic comparison bars with "dominance" ratios
        - [x] Search filter for specific exercises
    - [x] **The Crystal Ball (Future & Trends)**
        - [x] Line chart projecting future strength gains
        - [x] "Intercept Point" calculation (when B catches up to A)
    - [x] **The Scoreboard (Summary)**
        - [x] Win distribution bar (Who owns more sectors?)
        - [x] Strengths & Weaknesses analysis
        - [x] "Match-Poster" export button (UI only)
    - [x] **MVP Phase 1: Header, Common Exercises (1RM), Big 3 Total, History Plots** [COMPLETED]

Person B dominerar: Dragövningar (Rygg/Biceps).

Unika achievements:

"Person A: Better Grind (Mer volym)"

"Person B: Higher Peaks (Tyngre 1RM)"

UX/UI "Goodies" för att göra det enkelt
Färgkodning: Välj två distinkta färger (t.ex. Blå för A, Orange för B). Använd dessa konsekvent i alla grafer och texter.

Diff-vy: Använd små pilar (▲ ▼) och procent. +10kg är bra, men +15% säger mer om skillnaden mellan en lätt och tung person.

Vikt/Kön-toggle: En global knapp som heter "Fair Fight" (Rättvis kamp). När den är på, räknas alla siffror om till IPF/Wilks-poäng i realtid. Detta är avgörande om en man på 100kg jämför sig med en kvinna på 60kg.

Prioriteringsordning för utveckling (MVP)
Header & Matchup: Få in personernas grunddata.

Gemensamma övningar (1RM): Jämför bara rena PB i lista.

Big 3 Total: Summeringen av de tre stora.

Grafer: Historik-plotten.

Avancerat: "Fair Fight" (Wilks-algoritm) och Trend-prediktioner.

Vill du att jag ska ta fram en JSON-struktur för hur data-objektet till denna vyn skulle se ut, eller vill du ha hjälp med SQL-queryn för att hämta ut jämförelsen?
