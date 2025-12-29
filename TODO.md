Nu ska vi säkerställa seed, inlogg, säkerhet, sessioner och personer.

1) När appen startar upp för första gången måste datan seedas (livsmedelverkets csv-fil som vi har)
2) Tre användare ska skapas
    a) Admin 
    b) Johannes
    c) Jonathan
Lösenord är "admin" för samtliga 3. 

Admin ska ha rollen "admin" och Jonathan & Johannes är vanliga users. 

All data som genereras ska givetvis vara kopplat till det kontot som är inloggat. Börja där, ställ 100 frågor till om det behövs. Inlogg, användarhantering osv är helt centralt att det funkar klockrent, skalbart mm. Bygg en MASSIV plan för hur denna featuren ska implementeras på bästa möjliga tänkbara sätt.

Det ska t.ex. kunna listas aktiva sessioner, inloggningar ska loggas (per användare).