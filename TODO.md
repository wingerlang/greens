# 🚀 Greens Roadmap & TODO

## ⚡ Modul: Progressive Overload & Analys (PRIO 1)
*Problemet: Svårt att veta exakt vad som krävs för nästa steg och se långsiktig utveckling.*

- [ ] **Pre-Set Nudge (Overload Engine):** 
    - [ ] Implementera en "Target"-ruta vid set-inmatning.
    - [ ] Logik: Hämta förra passets (vikt x reps) och föreslå +2.5% vikt eller +1 rep.
- [ ] **Platå-varning:** Notis om vikten stått stilla i 3 pass. Förslå deload eller övningsbyte.
- [ ] **Analys XL (Gratis Premium):**
    - [ ] **Muskelvolym:** Visualisera Total Volume per muskelgrupp över tid.
    - [ ] **Pulszoner:** Visualisera tidszoner för löparpass.
    - [ ] **ACWR (Skaderisk):** Varna om volymen ökar >15% per vecka (Acute:Chronic Workload Ratio).
    - [ ] **Fitness & Freshness:** Graf baserad på TRIMP som visar formtoppning vs utmattning.
- [ ] **Similar Workouts:** I träningspassvyn, visa historiska pass som matchar nuvarande typ/övningar för direkt jämförelse.

## 🛠️ Tekniska fixar & smågodis (PRIO 2)
*Problemet: Små hinder i användarupplevelsen och datakvalitet.*

- [ ] **Sökning på Matdatabas (Unicode Fix):**
    - [ ] Åtgärda bugg där "öl" ger 0 träffar men "Öl s" fungerar (problem med 2-teckens sökningar + svenska tecken).
- [ ] **Import Refinements (strengthLogParser.ts):**
    - [ ] **Burpee broad jump:** Parsa `distanceKm` och konvertera korrekt till meter.
    - [ ] **Sled push:** Defaulta `reps` till 1 om avstånd finns men reps är 0.
    - [ ] **Static hold:** Säkerställ att `time` fångas för viktade statiska övningar.
- [ ] **Data Management:**
    - [ ] Implementera "Radera träningspass" i backend.
    - [ ] "Reset Exercise": Möjlighet att rensa all historik och PBs för en specifik övning.
- [ ] **UI Polish:**
    - [ ] Förbättra laddningstillstånd (skeletons) på StrengthPage.

## 🛡️ Modul: Privacy 2.0 (Socialt & Integritet)
*Problemet: Balansen mellan gemenskap och personlig integritet.*

- [ ] **Granulär Integritet (Onion Layer Model):**
    - [ ] Möjlighet att dölja puls, karta eller startposition på specifika pass.
    - [ ] Publika vs Vänner vs Privata datapunkter i samma pass.
- [ ] **Social Feed:** Följa vänner, kudos och kommentarer.
- [ ] **Individual Overrides:** Whitelist/Blacklist för specifika vänner (t.ex. dela vikt endast med Coach).

## 🧠 Modul: Hybrid Coach (AI-Planering)
*Problemet: Krockar mellan tung styrka och intensiv cardio.*

- [ ] **Dynamisk Veckoplanerare:** Generera schema baserat på mål (t.ex. "Öka marklyft" + "Milen under 50").
- [ ] **Fatigue Management:** AI-logik som undviker intervaller direkt efter tunga benpass.
- [ ] **Auto-Recalculation:** Anpassa resten av veckan om ett pass missas.

## 🍱 Modul: Integrated Fuel (Kost & Kropp)
*Problemet: Kost och träning lever i separata silon.*

- [ ] **Aktivitetsbaserat Kalorimål:** Dynamiskt mål (Vilodag vs Tungt pass).
- [ ] **Makro-cykling:** Förslag på mer kolhydrater kring träning, mer protein på vilodagar.
- [ ] **Smart Vägning:** Rullande medelvärde för vikt för att se trend genom vätskevariationer.

## 📺 Koncept: The Life Stream (Universal Activity Feed)
- [ ] **Event-baserad modell:** Behandla allt (vatten, pass, sömn) som standardiserade events.
- [ ] **The Matrix Follow:** Prenumerera endast på specifika kategorier från vänner (t.ex. se någons pass men dölja deras matlogg).
- [ ] **Smart Aggregation:** Gruppera småhändelser (6 glas vatten -> 1 post) i feeden.
- [ ] **Nocco 'o Clock:** (Implementerad prototyp) – Vidareutveckla till generella "Timers" för kosttillskott.

--
När aktvititetsloggen laddas - visa en snygg, tränings/hälso/styrkerelaterad spinner.

--
User Story: Smart Näringsinnehåll-parser (Smart Nutrition Parser)
Titel: Implementera en "Smart Paste"-funktion för automatisk ifyllnad av näringsvärden vid skapande av råvara.

Som en användare som lägger till nya produkter/råvaror i systemet Vill jag kunna klistra in en ostrukturerad text innehållandes en näringstabell (från en hemsida, PDF, etc.) i ett nytt textfält Så att systemet automatiskt kan analysera texten, extrahera nyckelvärden (kalorier, protein, kolhydrater, fett) och fylla i motsvarande fält i formuläret, vilket sparar mig tid och minskar risken för manuella inmatningsfel.

1. Affärsregler & Beteende (Business Rules)
Best-Effort Parsing: Systemet ska göra sitt bästa för att hitta värden i rörig data. Det är acceptabelt att den missar ibland, men den får aldrig krascha applikationen p.g.a. dålig input.

Manuell Överskridning: De fält som parsern fyller i (Protein, Kolhydrater, Fett, Kalorier, Fiber) måste fortfarande vara fullt redigerbara av användaren efteråt för korrigering.

Prioritering av Enheter:

För energi: Om både kJ och kcal hittas på samma rad (t.ex. "612 kJ / 147 kcal"), ska kcal prioriteras.

Decimalhantering: Parsern måste klara av både punkt . och komma , som decimalavskiljare (t.ex. "8.60 g" och "8,6 g").

Målfält: Parsern ska primärt försöka fylla i de fyra huvudfälten som syns i image_4.png:

Protein (g)

Kolhydrater (g)

Fett (g)

Kalorier (kcal)

Bonus: Om "Fiber" hittas, fyll i det i "Avancerade inställningar".

2. Teknisk Implementation (Guide för AI-Agenten)
Här är instruktioner för hur denna feature ska integreras i den befintliga komponenten som visas i image_4.png.

A. UI-Uppdateringar (Frontend Component)
I den befintliga modal-komponenten för "Lägg till Råvara":

Nytt Input-fält: Lägg till en textarea (eller ett input-fält som tillåter flera rader) precis ovanför sektionen som heter "Näringsvärden (per 100g)".

Placeholder/Label: Ge fältet en tydlig label eller placeholder, t.ex.: "Klistra in näringstabell här för smart tolkning...".

Event Listener: Lägg till en onChange eller onPaste listener på detta nya fält som triggar parsning-funktionen.

B. Logik: The Parsing Service/Hook
Skapa en ny utility-funktion (t.ex. parseNutritionText.ts) eller en custom hook (t.ex. useNutritionParser.ts) som hanterar logiken. Denna ska inte vara hårt knuten till UI-komponenten utan ta in text och returnera ett dataobjekt.

Pseudokod för parser-logiken:

TypeScript

// Exempel på önskad output-struktur
interface ParsedNutrition {
  kcal?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
}

export const parseNutritionText = (inputText: string): ParsedNutrition => {
  const result: ParsedNutrition = {};
  
  // 1. Normalisera texten
  // Konvertera till lowercase, ersätt ',' med '.' för enklare number parsing.
  // Ta bort onödiga tecken men behåll radbrytningar och mellanslag som avgränsare.
  let normalizedText = inputText.toLowerCase().replace(/,/g, '.');

  // 2. Definiera Regex-mönster för nyckelord
  // Använd "look-arounds" eller fångstgrupper för att hitta siffran nära nyckelordet.
  // Mönstret bör tillåta decimaltal (\d+(\.\d+)?) och eventuella mellanslag (\s*).
  
  const patterns = {
    // Hitta kcal. Hantera "kJ / kcal" genom att specifikt leta efter kcal-delen.
    kcal: /(?:energi|kalorier).*?(\d+(\.\d+)?)\s*kcal/i,
    // Alternativt mönster om bara siffran står och enheten är i rubriken (svårare, börja med det enkla)
    
    protein: /protein.*?\s(\d+(\.\d+)?)\s*g/i,
    carbs: /(kolhydrat|kolhydrater).*?\s(\d+(\.\d+)?)\s*g/i,
    fat: /fett.*?\s(\d+(\.\d+)?)\s*g/i,
    // Undvik "mättat fett" när vi letar efter totalt "fett" genom negative lookbehind om möjligt, 
    // eller enklare: parsa rad för rad och kolla om raden INTE innehåller "mättat".
    fiber: /(fiber|fibrer).*?\s(\d+(\.\d+)?)\s*g/i,
  };
  
  // 3. Exekvera sökningar (Enklast är att splitta texten på radbrytningar och loopa)
  const lines = normalizedText.split('\n');

  lines.forEach(line => {
    // Försök hitta matches på radnivå för att minska risken för felaktiga kopplingar
    
    // Kalorier (Specialhantering för kJ/kcal problemet)
    if (line.includes('kcal') && !result.kcal) {
       const match = line.match(/(\d+(\.\d+)?)\s*kcal/);
       if (match) result.kcal = parseFloat(match[1]);
    }

    // Protein
    if (line.includes('protein') && !result.protein) {
       const match = line.match(/(\d+(\.\d+)?)\s*g?/); // g är optional om kontexten är tydlig
       if (match) result.protein = parseFloat(match[1]);
    }
    
    // ... upprepa för fett, kolhydrater etc.
    // För 'fett', se till att inte matcha 'mättat fett'.
    if (line.includes('fett') && !line.includes('mättat') && !result.fat) {
       const match = line.match(/(\d+(\.\d+)?)/);
       if (match) result.fat = parseFloat(match[1]);
    }
  });
  
  return result;
};
C. Integration (State Updates)
I din huvudkomponent (modalen):

När text klistras in i den nya textarean, anropa parseNutritionText(text).

Ta resultatet och använd dina befintliga state setters för formuläret.

Exempel (om du använder React State):

JavaScript

const handleSmartPaste = (text) => {
  const parsedData = parseNutritionText(text);
  if (parsedData.kcal) setCalories(parsedData.kcal);
  if (parsedData.protein) setProtein(parsedData.protein);
  if (parsedData.fat) setFat(parsedData.fat);
  if (parsedData.carbs) setCarbs(parsedData.carbs);
  // etc.
};
3. Testfall (Edge Cases för AI:n)
Se till att parsern klarar dessa varianter från din beskrivning:

Input A (Strukturerad med dubbla enheter): Energi 612 kJ / 147 kcal -> Ska ge kcal: 147.

Input B (Rörig sträng med bindestreck): -energi118 kilokalori- -> Ska ge kcal: 118. -fett5.9 gram- -> Ska ge fat: 5.9.

Input C (Komma som decimal): Protein 14,2 gram -> Ska ge protein: 14.2.

Input D (Redundans): Om texten innehåller både "Näringsvärde per 100g..." och en senare sektion "per portion...", bör parsern prioritera värdena som verkar vara "per 100g" om möjligt (oftast de första som dyker upp).