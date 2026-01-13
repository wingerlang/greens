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



---
OPTIMIZE LOAD
1. Problemet med "Nollorna" (Dipparna i orange linje)
Tittar man på din orangea linje så "kraschar" den ner till noll eller väldigt låga nivåer emellanåt.

Varför det stör: Det förstör illusionen av "Max Hold". Om jag inte tränar marklyft på 2 veckor har jag ju inte tappat all min styrka. Att linjen går ner till botten gör grafen svårläst och rörig.

Lösning: Decay istället för Drop. Låt aldrig linjen gå till noll bara för att data saknas. Låt den ligga kvar på senaste nivån (flatline) eller ha en mycket långsam "decay" (t.ex. -1% per vecka av inaktivitet). Då får du en snygg, sammanhängande kontur av användarens styrka över tid, utan de djupa dalarna.

2. Volymstaplarna är svåra att avläsa (Quality vs Junk)
De staplade baren (ljusgrön/mörkgrön) är en bra idé, men visuellt blir det plottrigt när staplarna är så smala och täta.

Förfining:

Gruppering: Istället för att visa varje pass (om man zoomar ut), gruppera per vecka. Då får du bredare, tydligare staplar.

Fokusera på "Effective Load": Överväg att bara visa den mörkgröna (tung volym) som default, eller gör den ljusgröna (lätt volym) semitransparent/spöklik. Just nu slåss de om uppmärksamheten. Det intressanta för progressive overload är oftast den tunga volymen.

3. "Trend"-knappen och Tröskel-slidern
Du har lagt till en knapp för "Trend" och en slider för "Tröskel: 70%" uppe till höger. Det är bra funktioner, men de är lite gömda.

UX-förbättring: Gör tröskeln tydligare direkt i grafen. Kanske en horisontell linje eller en text som förklarar: "Visar volym över 70% av 1RM". Just nu vet användaren inte riktigt vad den mörkgröna färgen representerar utan att gissa.

4. Dubbla Y-axlar (Skalan)
Du har Volym (0k-12k) till vänster och Vikt (0kg-160kg) till höger. Detta är nödvändigt men kan förvirra.

Visuell separation:

Färgkoda axlarna tydligare. Gör texten på vänster axel Grön (matcha volymstaplarna) och texten på höger axel Orange (matcha 1RM-linjen). Då kopplar hjärnan direkt ihop "Vänster = Staplar" och "Höger = Linje".

5. Den saknade pusselbiten: "Rate of Progress"
Grafen visar att du ökar, men inte hur snabbt eller i vilken fas du är.

Avancerat förslag: Lägg till en bakgrundsgradient eller zoner.

Om trendlinjen (orange) pekar uppåt över tid -> Svag grön bakgrundston ("Progressive Phase").

Om den ligger platt länge -> Neutral/Grå ("Maintenance/Plateau").

Detta ger användaren en omedelbar "känsla" för perioden utan att behöva analysera varenda datapunkt.

Sammanfattning – Nästa steg (Mockup-instruktioner)
För att göra den "ren":

Fixa linjen: Ta bort dipparna till noll. Låt den orangea linjen vara en "tak-kontur" som bara kan gå ner om man faktiskt presterar sämre på ett max-test, inte för att man vilar.

Färgkoda axlarna: Gör Y-axlarnas siffror färgade (Grön vs Orange).

Bredda staplarna: Aggregera data veckovis som default om tidsintervallet är långt (t.ex. >3 månader).

Tydligare Legend: Lägg en liten textruta i grafen: "Mörkgrön = Kvalitetsvolym (>70% 1RM)".