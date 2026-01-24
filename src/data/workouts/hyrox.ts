import { WorkoutDefinition } from "../../models/workout.ts";

export const HYROX_DB_WORKOUTS: WorkoutDefinition[] = [
  // SIMULATIONS
  {
    id: "sim_half",
    title: "The Half Hyrox",
    category: "HYROX",
    durationMin: 50,
    difficulty: "Intermediate",
    description:
      "En klassisk simulering av halva loppet. Perfekt 2-3 veckor innan tävling för att testa race pace.",
    tags: ["Simulation", "Race Pace", "High Intensity"],
    source: "HYROX_DB",
    staticStructure: [
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
    category: "HYROX",
    durationMin: 45,
    difficulty: "Elite",
    description:
      "Högintensiv intervallbaserad simulering för att bygga mjölksyratålighet.",
    tags: ["Intervals", "Lactate Threshold", "Mental Toughness"],
    source: "HYROX_DB",
    staticStructure: [
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
    category: "RUNNING",
    durationMin: 50,
    difficulty: "Elite",
    description:
      "Vänj benen vid att springa med syra. Fokus på lunges/squats + löpning.",
    tags: ["Compromised Running", "Leg Strength", "Endurance"],
    source: "HYROX_DB",
    staticStructure: [
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
    title: "Ski/Run Lung Buster",
    category: "HYBRID",
    durationMin: 60,
    difficulty: "Intermediate",
    description:
      "Bygg specifik VO2max för skidmomentet kombinerat med löpning.",
    tags: ["Engine", "VO2max", "Ski Erg"],
    source: "HYROX_DB",
    staticStructure: [
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
    durationMin: 45,
    difficulty: "Beginner",
    description: "Teknik och styrka för släden. Tungt men kontrollerat.",
    tags: ["Strength", "Technique", "Sleds"],
    source: "HYROX_DB",
    staticStructure: [
      "EMOM 20 min:",
      "Odd: 15m Sled Push (Tungt! +20kg mot tävling)",
      "Even: 15m Sled Pull (Tungt! +20kg mot tävling)",
      "Efteråt: 100 Wall Balls for time.",
    ],
    tips:
      "Fokus på raka armar i pushen och att luta sig bakåt i pullen. Använd kroppsvikten.",
  },
];
