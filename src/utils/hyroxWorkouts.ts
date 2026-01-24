export interface HyroxWorkout {
  id: string;
  title: string;
  category: "SIMULATION" | "ENGINE" | "STRENGTH" | "COMPROMISED" | "TECHNIQUE";
  duration: string;
  difficulty: "Beginner" | "Intermediate" | "Elite";
  description: string;
  structure: string[];
  tips: string;
}

export const HYROX_WORKOUTS: HyroxWorkout[] = [
  // SIMULATIONS
  {
    id: "sim_half",
    title: "The Half Hyrox",
    category: "SIMULATION",
    duration: "40-60 min",
    difficulty: "Intermediate",
    description:
      "En klassisk simulering av halva loppet. Perfekt 2-3 veckor innan tävling.",
    structure: [
      "1000m Run",
      "1000m Ski Erg",
      "1000m Run",
      "2x25m Sled Push (Tävlingsvikt)",
      "1000m Run",
      "2x25m Sled Pull (Tävlingsvikt)",
      "1000m Run",
      "80m Burpee Broad Jump",
    ],
    tips: "Håll tävlingspace på löpningen. Ingen vila i bytena (Roxzone).",
  },
  {
    id: "sim_f45",
    title: "F45 Hyrox Special",
    category: "SIMULATION",
    duration: "45 min",
    difficulty: "Elite",
    description:
      "Högintensiv intervallbaserad simulering för att bygga mjölksyratålighet.",
    structure: [
      "4 Rounds:",
      "4 min AMRAP:",
      "  250m Run",
      "  25 Wall Balls",
      "  15m Sled Push",
      "2 min Rest",
    ],
    tips:
      "Gå ALL OUT varje rond. Målet är att hålla samma varvtid i rond 4 som i rond 1.",
  },
  // COMPROMISED RUNNING
  {
    id: "comp_leg_killer",
    title: "Leg Compromise 3000",
    category: "COMPROMISED",
    duration: "50 min",
    difficulty: "Elite",
    description:
      "Vänj benen vid att springa med syra. Fokus på lunges/squats + löpning.",
    structure: [
      "3 Rounds:",
      "1000m Run (Tröskelpace)",
      "60m Sandbag Lunges (Tävlingsvikt)",
      "500m Run (Överfart)",
      "3 min Vila",
    ],
    tips:
      "De första 200m efter utfallen kommer kännas hemska. Det är meningen. Hitta tekniken snabbt.",
  },
  // ENGINE
  {
    id: "eng_ski_run",
    title: "Ski/Run Intervals",
    category: "ENGINE",
    duration: "60 min",
    difficulty: "Intermediate",
    description: "Bygg specifik VO2max för skidmomentet.",
    structure: [
      "10 min warmup",
      "6 x (1000m Ski Erg + 400m Run)",
      "Vila: 90 sekunder mellan set",
      "Ski Erg ska vara 5 sek långsammare än PB-pace.",
    ],
    tips: "Använd löpningen som aktiv vila, men gå inte.",
  },
  // STRENGTH
  {
    id: "str_push_pull",
    title: "Sled Power Hour",
    category: "STRENGTH",
    duration: "45 min",
    difficulty: "Beginner",
    description: "Teknik och styrka för släden. Tungt men kontrollerat.",
    structure: [
      "EMOM 20 min:",
      "Odd: 15m Sled Push (Tungt! +20kg mot tävling)",
      "Even: 15m Sled Pull (Tungt! +20kg mot tävling)",
      "Efteråt: 100 Wall Balls for time.",
    ],
    tips:
      "Fokus på raka armar i pushen och att luta sig bakåt i pullen. Använd kroppsvikten.",
  },
];

export const DEEP_TIPS = {
  nutrition: {
    title: "Race Nutrition Guide 🍌",
    points: [
      "Dagen innan: Öka kolhydrater (ris, pasta) med 30%. Undvik fiberrik mat.",
      "3h innan: Stor frukost (Havregryn, banan, ljust bröd). Ca 800kcal.",
      "60m innan: Koffein (200mg) + Nitrater (Rödbetsjuice).",
      "Under loppet: Gel vid Station 5 (Rodd) eller Station 6 (Farmers). Inte för sent!",
      "Vätska: Drick små klunkar elektrolyter vid varvning. Stanna inte.",
    ],
  },
  pacing: {
    title: "Mastering the Pacing ⏱️",
    points: [
      "The Trap: Alla öppnar för hårt på Ski Erg. Du vinner inget där, men kan förlora allt.",
      "The Wall: Väggen kommer vid Burpees eller Utfall. Spara benen i början.",
      "Running: Löpningen är 50% av tiden. Spring 5 sek/km långsammare än ditt 10k-tempo.",
      "Roxzone: GÅ INTE. Joggvila är 30 sek snabbare per varv än att gå.",
    ],
  },
};
