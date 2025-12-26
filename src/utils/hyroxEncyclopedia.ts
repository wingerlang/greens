import { HyroxStation } from "../models/types.ts";

export interface StationDetail {
    id: HyroxStation;
    title: string;
    icon: string;
    description: string;
    standards: {
        men: string;
        women: string;
        pro_men: string;
        pro_women: string;
    };
    mechanics: string[];
    commonMistakes: string[];
    proTips: string[];
    doublesStrategy: string;
    pacing: string;
}

export const HYROX_ENCYCLOPEDIA: Partial<Record<HyroxStation, StationDetail>> = {
    ski_erg: {
        id: 'ski_erg',
        title: "Ski Erg",
        icon: "🎿",
        description: "1000m på Concept2 SkiErg. Startskottet för loppet. Kräver en blandning av teknik och explosivitet, men framförallt disciplin för att inte gå ut för hårt.",
        standards: {
            men: "1000m (Damper setting valfri)",
            women: "1000m (Damper setting valfri)",
            pro_men: "1000m",
            pro_women: "1000m"
        },
        mechanics: [
            "Håll armarna raka (eller lätt böjda) i starten av draget.",
            "Använd kroppsvikten genom att 'falla' ner.",
            "Avsluta rörelsen med en lätt knäböjning.",
            "Återgå till full sträckning i varje drag."
        ],
        commonMistakes: [
            "T-Rex armar (böjda armbågar i starten) = Biceps dör.",
            "För djupa knäböj (Squat-Skiing) = Benen dör.",
            "Gå ut för hårt (Fly-and-Die) = Hela loppet förstörs."
        ],
        proTips: [
            "Håll en frekvens på 40-45 s/m.",
            "Fokusera på 'butterfly'-rörelse med händerna för att slappna av i axlarna på vägen upp.",
            "Andas rytmiskt: Andas ut på vägen ner, in på vägen upp."
        ],
        doublesStrategy: "Dela upp på 250m eller 500m. Korta byten sparar energi men kostar tid i övergången. 500m var är standard för eliten.",
        pacing: "Håll dig 5-10 sekunder långsammare per 500m än ditt 2k-pers. Det ska kännas 'för lätt' första 500m."
    },
    sled_push: {
        id: 'sled_push',
        title: "Sled Push",
        icon: "🛒",
        description: "50m släde (4x12.5m). En av de mest brutala styrkestationerna som kan sänka pulsen men döda benen.",
        standards: {
            men: "152 kg (3 plattor + släde)",
            women: "102 kg (2 plattor + släde)",
            pro_men: "202 kg (4 plattor)",
            pro_women: "152 kg (3 plattor)"
        },
        mechanics: [
            "Låga höfter, ryggen neutral.",
            "Armarna raka eller böjda nära kroppen (beroende på teknik).",
            "Tryck ifrån hela foten.",
            "Håll en konstant rörelse - friktionen vid start är tyngst."
        ],
        commonMistakes: [
            "Stanna halvvägs. Att starta om kostar extremt mycket energi.",
            "För höga höfter = tappa kraftöverföring.",
            "Titta upp/framåt för mycket = nackspänning."
        ],
        proTips: [
            "Håll armarna helt raka och lås ut dem mot ramen (skelettet tar vikten, inte triceps).",
            "Ta korta, snabba steg.",
            "Vänd snabbt vid linjen - använd vändningen som 'vila'."
        ],
        doublesStrategy: "Ofta gör den starkare partnern mer eller allt. I Mixed gör mannen ofta hela. Annars 25m/25m.",
        pacing: "Gå inte snabbare än att du kan springa direkt efter. Mjölksyra här sitter i länge."
    },
    sled_pull: {
        id: 'sled_pull',
        title: "Sled Pull",
        icon: "🪢",
        description: "50m släde (4x12.5m). Kräver stark rygg, grepp och baksida lår. Måste dra tills hela släden passerat linjen.",
        standards: {
            men: "103 kg",
            women: "78 kg",
            pro_men: "153 kg",
            pro_women: "103 kg"
        },
        mechanics: [
            "Stå i 'boxen' (får ej lämna den).",
            "Luta dig bakåt och använd kroppsvikten.",
            "Håll armarna raka så länge som möjligt.",
            "Gå baklänges snabbt snarare än att dra med armarna."
        ],
        commonMistakes: [
            "Biceps-curla repet = armarna dör.",
            "Vira repet runt handen (ej tillåtet).",
            "Stå för brett och tappa balansen."
        ],
        proTips: [
            "Gå längst bak i boxen och 'gå' släden framåt med raka armar. När du når slutet av boxen, ta snabba steg fram.",
            "Använd höften för att skapa momentum."
        ],
        doublesStrategy: "Den starka drar. Eller dela 25m var. Greppet tar slut fort, så byten kan vara bra.",
        pacing: "Håll ett jämnt tempo. Att rycka släden är ineffektivt."
    },
    burpee_broad_jumps: {
        id: 'burpee_broad_jumps',
        title: "Burpee Broad Jumps",
        icon: "🐸",
        description: "80m. Kombination av flås och benstyrka. En riktig lår-dödare efter slädarna.",
        standards: {
            men: "80m",
            women: "80m",
            pro_men: "80m",
            pro_women: "80m"
        },
        mechanics: [
            "Bröstet i marken (händerna behöver ej släppa).",
            "Hoppa framåt jämfota.",
            "Du måste landa kontrollerat.",
            "Stega fram fötterna i uppresningen för att spara energi."
        ],
        commonMistakes: [
            "Hoppa för långt och tappa balansen.",
            "Hoppa för högt (slöseri med energi).",
            "Göra en 'pushup' i botten (onödigt)."
        ],
        proTips: [
            "Mät upp 80m som ca 40-50 reps. Räkna reps istället för meter för mentalt fokus.",
            "Använd 'step-in' teknik istället för att hoppa in med fötterna, det sparar ländryggen."
        ],
        doublesStrategy: "Vartannat hopp eller 10-10. Att göra hela själv är sällan värt det.",
        pacing: "Hitta en rytm du kan hålla utan att stanna. Vila i plankposition om du måste."
    },
    rowing: {
        id: 'rowing',
        title: "Rowing",
        icon: "🚣",
        description: "1000m på Concept2 RowErg. Återhämtning för vissa, döden för andra. Sitter halvvägs i loppet.",
        standards: {
            men: "1000m (Damper valfri)",
            women: "1000m (Damper valfri)",
            pro_men: "1000m",
            pro_women: "1000m"
        },
        mechanics: [
            "Ben - Rygg - Armar.",
            "Armar - Rygg - Ben (på vägen tillbaka).",
            "Håll kedjan rak.",
            "Kraften kommer 60% från benen."
        ],
        commonMistakes: [
            "Dra med armarna för tidigt.",
            "Lyfta hälarna för mycket i catch-läget.",
            "För hög frekvens (s/m) utan kraft."
        ],
        proTips: [
            "Sikta på 26-30 s/m. Lägre än SkiErg.",
            "Använd tiden till att återhämta andningen och få ner pulsen något inför Farmers carry.",
            "Släpp inte handtaget i vändningarna."
        ],
        doublesStrategy: "500m var är standard. Går att göra 250m byten för att hålla extremt högt tempo.",
        pacing: "Håll din maraton-rodd-pace minus 5 sekunder."
    },
    farmers_carry: {
        id: 'farmers_carry',
        title: "Farmers Carry",
        icon: "👜",
        description: "200m med kettlebells. Greppstyrka och bålstabilitet prövas här.",
        standards: {
            men: "2 x 24 kg",
            women: "2 x 16 kg",
            pro_men: "2 x 32 kg",
            pro_women: "2 x 24 kg"
        },
        mechanics: [
            "Rak rygg, bröstet upp.",
            "Korta, snabba steg.",
            "Lås skulderbladen bakåt/nedåt."
        ],
        commonMistakes: [
            "Börja springa och tappa kontrollen.",
            "Låta vikterna gunga in i benen.",
            "Släppa ner vikterna för ofta (kostar mycket kraft att plocka upp)."
        ],
        proTips: [
            "Kroka fast tummarna under pekfingret (hook grip) om möjligt.",
            "Andas med magen (bukhjärtat) för att stabilisera bålen.",
            "Om du måste vila: ställ ner dem kontrollerat och skaka loss armarna i 5 sekunder, lyft sen direkt."
        ],
        doublesStrategy: "En partner kan göra allt om greppet är starkt. Annars dela 100/100m.",
        pacing: "Gå så fort du kan utan att tappa. Det är bara 200m."
    },
    sandbag_lunges: {
        id: 'sandbag_lunges',
        title: "Sandbag Lunges",
        icon: "🎒",
        description: "100m utfall med sandsäck. Många kallar detta 'The Graveyard'. Det är här loppet avgörs.",
        standards: {
            men: "20 kg",
            women: "10 kg",
            pro_men: "30 kg",
            pro_women: "20 kg"
        },
        mechanics: [
            "Bakre knät MÅSTE nudda marken (lätt touch).",
            "Full utsträckning i höften i varje steg.",
            "Säcken får inte nudda marken."
        ],
        commonMistakes: [
            "För korta steg.",
            "Vila händerna på knäna (ej tillåtet).",
            "Släppa ner säcken (kostar enormt att plocka upp)."
        ],
        proTips: [
            "Vila med säcken på axlarna/ryggen om du måste stanna. Släpp den ALDRIG.",
            "Hitta en rytm: Andas in på väg ner, ut på pressen upp.",
            "Byt axel vid 50m vendingen."
        ],
        doublesStrategy: "Dela 50/50. Att göra 100m själv är en risk för kramp.",
        pacing: "Gå inte ut för hårt. Jämn takt vinner."
    },
    wall_balls: {
        id: 'wall_balls',
        title: "Wall Balls",
        icon: "🥎",
        description: "75-100 kast. Den sista spiken i kistan. Mentalt och fysiskt utmattande.",
        standards: {
            men: "6 kg (100 reps)",
            women: "4 kg (75 reps)",
            pro_men: "9 kg (100 reps)",
            pro_women: "6 kg (75 reps)"
        },
        mechanics: [
            "Squat under parallell (höftveck nedanför knä).",
            "Kasta till målet (träffa eller över).",
            "Fånga bollen i en rörelse ner i nästa squat."
        ],
        commonMistakes: [
            "Inte gå djupt nog (No rep).",
            "Missa målet.",
            "Stå för långt ifrån väggen."
        ],
        proTips: [
            "Håll armarna uppe nära hakan.",
            "Vila med armarna nere när bollen är i luften (micro-vila).",
            "Dela upp mentalt: 10 set av 10 reps (eller 7-8). Det är 'bara' 10 reps."
        ],
        doublesStrategy: "Byt ofta. 10-15 reps var. Håll tempot uppe.",
        pacing: "Bli inte stående med bollen. Kasta eller lägg ner den."
    },
    run_1km: {
        id: 'run_1km',
        title: "Running (8 x 1km)",
        icon: "🏃",
        description: "Kärnan i Hyrox. 50% av tiden spenderas här. Löpningen är din 'vila' men också där du kan tappa mest tid.",
        standards: { men: "-", women: "-", pro_men: "-", pro_women: "-" },
        mechanics: ["Avslappnade axlar.", "Hög höft.", "Använd armpendling."],
        commonMistakes: ["Starta första varvet för fort (Adrenalin).", "Gå i Roxzone.", "Tappa tekniken när tröttheten kommer."],
        proTips: ["Spring 'innanför' din kapacitet. Du ska kunna prata.", "Använd Roxzone för att dricka (men stanna inte).", "Efter stationerna: ta 100m att hitta benen igen, öka sen."],
        doublesStrategy: "I Doubles byter man inte under varvet. Man springer ihop (men bara en gör stationen).",
        pacing: "Jämna varv. Det sista varvet ska vara lika snabbt som det första."
    }
};
