
-----
Modul 1: Privacy 2.0 (Socialt & Integritet)
Problemet: Användare vill ha gemenskapen men känner sig övervakade och nakna (data-mässigt) på plattformar som Strava.

Funktionella Krav
Granulär Integritetskontroll (The "Onion Layer" Model):

Användaren ska kunna ställa in synlighet på datapunkt-nivå, inte bara pass-nivå.

Exempel: Vänner ser: Att jag sprang 10km och tiden. Publiken ser: Att jag tränade (men inte kartan/startposition). Ingen ser: Min puls, min vikt eller mina anteckningar.

Social Feed: Möjlighet att följa vänner, ge "kudos/pepp" och kommentera.

Cirklar: Möjlighet att skapa grupper ("Inner Circle" vs "Bekanta") med olika behörigheter.

Tekniskt Specifikation (För AI/Dev)
Databasmodell: Varje WorkoutLog har ett associerat PrivacyConfig-objekt.

show_map: boolean

show_heartrate: boolean

show_power: boolean

show_notes: boolean

Logik: I API-responsen, om requester_id != owner_id och show_heartrate == false, returnera null för pulsdata.

Modul 2: The Hybrid Coach (AI-Planering)
Problemet: Det är svårt att kombinera löpning och styrka utan att bränna ut sig. Användaren vill ha en plan för nästa vecka.

Funktionella Krav
Dynamisk Veckoplanerare: Generera ett schema för kommande vecka som kombinerar löpning (distans/intervaller) och styrka (Push/Pull/Legs eller Helkropp).

Fatigue Management: Om användaren körde ett tungt benpass på tisdagen, ska AI:n inte föreslå hårda löpintervaller på onsdagen (risk för skada).

Adaptivitet: Om användaren missar tisdagens pass, räknar systemet om resten av veckan automatiskt.

Tekniskt Specifikation
Input: Nuvarande nivå (från historik), Mål (t.ex. "Öka 1RM i marklyft" + "Springa milen under 50"), Tillgängliga dagar (Mån, Ons, Fre).

Algoritm:

Hämta Load (Träningsbelastning) från senaste 7 dagarna.

Fördela Intensity poäng över veckan.

Regel: Leg_Hypertrophy_Session måste ha >48h vila innan High_Intensity_Interval_Run.

Modul 3: Integrated Fuel (Kost & Kropp)
Problemet: Kostappar och träningsappar pratar sällan med varandra. Användaren vill ha en plan som ändras baserat på kroppsmått och träning.

Funktionella Krav
Aktivitetsbaserat Kalorimål:

Vilodag = Lägre kalorimål (t.ex. 2200 kcal).

Tungt pass = Högre mål (t.ex. 2800 kcal).

Makro-cykling: Automatiska förslag på mer kolhydrater kring tunga pass, mer fett/protein på vilodagar.

Smart Vägning: Logga vikt och midjemått. Appen räknar ut rullande medelvärde (för att filtrera bort dagliga vätskevariationer) och justerar kostplanen om viktnedgången stannar av.

Tekniskt Specifikation
Integration: Koppla Weekly_Average_Weight mot Target_Weight_Trend.

Logik:

IF (Weight_Trend == Stagnant) AND (Goal == Weight_Loss) THEN (Daily_Calories -= 100).

Visa notis: "Vi har justerat ner ditt intag med 100 kcal baserat på din viktkurva."

Modul 4: Progressive Overload Assistant (Notiser)
Problemet: Man glömmer vad man lyfte sist och lyfter samma vikt år ut och år in (ingen utveckling).

Funktionella Krav
Pre-Set Nudge: Precis innan användaren ska starta ett set i appen (eller via klockan), ge ett förslag.

"Förra veckan gjorde du 100kg x 5. Idag bör du prova 102.5kg x 5 eller 100kg x 6."

Platå-varning: Om användaren inte ökat vikten på 3 pass, föreslå en "Deload" eller att byta övning.

Tekniskt Specifikation
Query: GET Last_Session WHERE Exercise = "Bench Press".

Calculation:

Next_Load = Last_Load * 1.025 (2.5% ökning).

Next_Reps = Last_Reps + 1.

UI: En tydlig "Target"-ruta bredvid inmatningsfältet.

Modul 5: Demokratiserad Data (Gratis "Premium"-stats)
Problemet: Bra data (utmattning, volym, intensitetszoner) ligger ofta bakom betalväggar.

Funktionella Krav
Träningsdagbok XL:

Visualisera Total Volume per muskelgrupp över tid.

Visualisera Tidszoner för puls (Löpning).

Formkoll (Fitness/Fatigue): En graf liknande Stravas "Fitness & Freshness" (baserad på TRIMP eller liknande impuls-beräkningar) som visar om du är nedtränad eller i toppform.

Skaderisk-analys: Varna om volymen ökar med mer än 10-15% per vecka (Acute:Chronic Workload Ratio).

Sammanfattning för AI-prompt (Copy-Paste)
Om du ska be en AI bygga en prototyp av detta, använd följande prompt:

"Agera Senior Product Manager och Systemarkitekt. Jag vill designa en träningsapp som kombinerar styrka och löpning.

Kärnfunktioner:

Privacy-First Social Feed: En datamodell där varje attribut (puls, karta, vikt) har en separat 'is_public' flagga.

AI Planner: En algoritm som genererar nästa veckas schema. Den måste hantera 'interference effect' mellan löpning och styrka (t.ex. inga tunga benpass dagen innan intervaller).

Smart Nutrition: Dynamiskt kaloriintag baserat på dagens TDEE + Träningspassets energiåtgång. Justera automatiskt baserat på loggad vikttrend (rullande snitt).

Overload Engine: En logikmotor som inför varje set hämtar historisk data och kalkylerar ett specifikt mål (vikt/reps) för att garantera progression.

Skapa en databasstruktur (SQL), en API-specifikation för integritetsinställningarna, och pseudokod för 'Overload Engine'-logiken."

--
När klockan är 08:00 - skriv ut "Nocco 'o-clock
--
Koncept: "The Life Stream" (Universal Activity Feed)1. Grundfilosofi: "Allt är en händelse"Feeden är inte bara träningspass. Det är en kronologisk tidslinje över användarens livsstil. För att detta ska fungera tekniskt måste systemet behandla allt (ett glas vatten, ett nytt PB, 8 timmars sömn) som standardiserade "Events".Datamodell (Event Types):WORKOUT_STRENGTH (Set, reps, övningar)WORKOUT_CARDIO (Distans, tid, karta)NUTRITION_MEAL (Kalorier, makros, bild på mat)HYDRATION (Mängd vatten)HEALTH_SLEEP (Timmar, kvalitet)BODY_METRIC (Invägning, midjemått - ofta privat, men en del av feeden)2. "The Matrix Follow" – Det modulära följ-systemetDetta är kärnan i din feature. Istället för en "Följ"-knapp, har vi en "Prenumerations-dashboard" för varje vän.User Story:"Jag vill följa Kalles Styrketräning för inspiration, men jag vill inte se hans Mat eller Sömn i min feed."UI – Prenumerationskortet:När du går in på en profil och klickar "Följ/Inställningar", ser du en matris:KategoriStatusDetaljnivå (Valfritt)🏋️ Träning✅ Följer[Alla pass] / [Endast PB & Tävling]🥗 Kost❌ Följer ej-💧 Vätska❌ Följer ej-😴 Hälsa (Sömn/Vikt)✅ Följer-📝 Dagbok✅ Följer[Visa anteckningar]3. Smart Aggregering (Anti-Spam Logic)Om en person loggar varje glas vatten (8 ggr/dag), kommer feeden bli oanvändbar. Feeden måste vara smart grupperad.Funktion: "Bundling"Om 5 händelser av typen HYDRATION sker inom 4 timmar, slås de ihop till ett kort i feeden: "Drack 1.2 liter vatten under eftermiddagen."Samma gäller set i styrketräning. Vi visar inte varje set som en post, utan "Pass slutfört: Bröst & Triceps (24 set totalt)".4. Feedens Placering & StrukturFeeden är en Komponent som återanvänds på två ställen:A. Huvud-feeden (Dashboard):Här blandas alla vänner du följer, filtrerat genom dina prenumerationsval (Matrisen ovan).Sortering: Kronologisk (Senaste överst).Design: "Cards". Varje händelse är ett kort.B. Profil-feeden (Personlig tidslinje):När du besöker någons profil ser du deras Life Stream.Här ser du allt som den personen valt att göra publikt (eller synligt för vänner), oavsett vad du "prenumererar" på i din huvud-feed. Det fungerar som deras dagbok.5. Specifikation för AI/UtvecklareHär är instruktionerna för att bygga backend och logiken för detta system.Databas-schema (Konceptuellt)SQL-- Huvudtabell för alla händelser
CREATE TABLE ActivityFeed (
    activity_id UUID PRIMARY KEY,
    user_id UUID,
    activity_type ENUM('STRENGTH', 'CARDIO', 'NUTRITION', 'SLEEP', 'HYDRATION'),
    timestamp DATETIME,
    visibility_level ENUM('PUBLIC', 'FRIENDS', 'PRIVATE'), -- Sändarens val
    data_payload JSONB -- Innehåller all specifik data (övningar, mat, etc)
);

-- Tabell för vad jag vill se av andra
CREATE TABLE FollowPreferences (
    follower_id UUID,
    target_user_id UUID,
    subscribed_categories ARRAY['STRENGTH', 'NUTRITION', 'SLEEP'] -- Mottagarens val
);
Logik för Feed-generering (Pseudokod)Pythondef generate_main_feed(current_user):
    # 1. Hämta alla jag följer
    followed_users = get_following(current_user)

    feed_items = []

    for friend in followed_users:
        # 2. Hämta mina inställningar för denna vän (Vad vill JAG se?)
        my_subs = get_subscriptions(current_user, friend)
        
        # 3. Hämta vännens aktiviteter (filtrera på vad DE tillåter)
        activities = get_activities(
            user=friend, 
            time_range="last_24h",
            min_visibility="FRIENDS" # Eller PUBLIC
        )

        for activity in activities:
            # 4. "The Handshake" - Matchar aktiviteten mina prenumerationsval?
            if activity.type in my_subs:
                feed_items.append(activity)

    # 5. Smart Aggregering (Slå ihop småposter)
    feed_items = bundle_hydration_events(feed_items)
    feed_items = bundle_meals(feed_items)

    # 6. Sortera och returnera
    return sort_by_time_desc(feed_items)
UX/UI Detaljer "Look & Feel"Ikon-driven design: Varje kort i feeden har en tydlig ikon till vänster (Hantel, Löparsko, Vattenglas, Säng). Detta gör feeden skanningsbar.Expanderbara Kort:Stängt läge: "Kalle sprang 10km (5:30 min/km)."Klick: Expanderar och visar karta, pulszoner och splits.Kontextuella Tags:Om WORKOUT_STRENGTH innehåller ett PB, sätt en guldram runt kortet eller en "New PB 🏆"-badge.Om NUTRITION matchar dagens mål, visa en grön bock: "Dagsmål uppnått".Detta system ger full kontroll. Den som är datanörd kan se allt, den som bara vill ha träningspepp slipper se vad folk åt till frukost.

---

## 🐛 Buggar

- [ ] **Sökning på Matdatabas:** "öl" ger 0 träffar men "Öl s" fungerar. "köl" hittar starköl. Troligtvis Unicode-kodningsproblem med svenska tecken vid 2-teckens sökningar.

---

## 🚀 Kommande funktioner

- [ ] **Per-person Privacy Overrides:** Möjlighet att ge specifika personer tillgång till data som annars är privat. T.ex. "Dela vikt endast med Anna" medan det förblir privat för alla andra. Kräver whitelist/blacklist per kategori per person. UI: Modal/panel per vän där man kan sätta individuella behörigheter som överskrider default-privacy.