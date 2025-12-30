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