/goals - 🎯 Mina Mål
* Boxarna på sidan är extremt fula: för stora, för mycket padding, ocentrerad text. Vänligen snygga till.
* "Aktiva mål behöver hottas till. De ser "lama" ut när det tillhör en period. Istället för bara "0 / 4x/v" så bör vi ha en mycket större text (det  får plats) med mer vänlig utskrift. "Träna fyra dagar i veckan (just nu: 0) eller liknande.
* Aktiva mål bör ha ett kryss så att man kan ta bort dem.
* Tydliggör huruvida "kalorimål" behövs nu när vi har ett viktmål. Viktmål kan vara en "kalorimål" i sig, och vi kan sätta vikten på "stabil" - det är inget "viktnedgångsmål".


Lägg till "koffein" på något lämpligt sätt i matdatabasen. Kaffe och nocco ska ha koffein tillagt.


Strava-aktivieter: Det ska vara "moving" time. Vissa aktiviteter har felaktig moving time (t.ex. om man springer med död gps). Därför ska vi printa ut BÅDE elapsed time och moving time, men ange tiden i moving time. Vi ska också kunna markera typ "not eligible for PB", eller "felaktig" eller

-----
"Time pickers". Vi har en extremt mängd olika timepickers. Jag vill att vi använder samma och återanvänder alla kod

ALL, <nuvarande år>, <aktiv träningsperiod>, 7D, 14D, 30D, 3M, 6M, 12M, <föregående år>, <andra träningsperiod som en lista>, TTM (12M). Koden ska vara extremt smart och flexibel. Den ska fortfarande kunna vara "sticky" och stödja lite olika storlekar (t.ex. dölja vissa av peruodenra. Dashboarden behöver bara några enstaka (7D, 14D, 30D, i år )). Det ska finnas en "kompakt" vy och en "snygg" vy - villkorat.

--
Möjliggör att starta hela projektet med NodeJS. Undersök vad som är Deno-specifikt och se om det går att ersätta med en Node-verison (utan att försämra det). Lokalt kommer jag vilja köra det via Deno, men på vissa miljöer som är NodeJS-only vore det föredraget. Framförallt är det för AI-agenters skulle som har bättre stöd för Deno.

-- 
På /stryka
"Pass denna vecka" ska enbart inkludera styrkepass (men kondition inom parentes).


På year-in-review:
Snygga till url (url year-in-review -> review, år ska ha - eller _, inte %2C)
"Föredelning" - grafens label har svart text, syns knappt.
"Distans per vecka (Löpning)" - när den sträcker sig under multipla år får den skifta till "Distans mer månad" istället, då bredden blir helt galen.


Styrkeövning:
"All-time PB ska vara "Tyngsta lyft". Lägg till en "Bästa lyft" som står t.ex.  7x100kg (1eRM: 130KG)
