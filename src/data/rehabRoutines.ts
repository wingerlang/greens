import { RehabRoutine } from "../models/types.ts";

export const REHAB_ROUTINES: RehabRoutine[] = [
  {
    id: "routine-knee-1",
    title: "Knäkontroll & Stabilitet",
    description:
      "Ett grundläggande pass för att stärka muskulaturen runt knäet och förbättra stabiliteten. Bra vid diffus smärta eller efter löpning.",
    tags: ["knees", "quads"],
    condition: "pain",
    estimatedDurationMin: 15,
    exercises: [
      {
        id: "ex-gubbvila",
        name: "Isometrisk Knästräck (Gubbvila)",
        description:
          "Sitt på en stol. Sträck ut benet och spänn låret maximalt. Håll 10 sekunder.",
        reps: "3 x 10 st (håll 5s)",
        difficulty: "easy",
      },
      {
        id: "ex-stepup",
        name: "Långsamma Step-Ups",
        description:
          "Stå framför en låda/trappsteg. Kliv upp kontrollerat (3 sek upp, 3 sek ner). Fokusera på att knäet inte faller inåt.",
        reps: "3 x 8 / ben",
        difficulty: "medium",
      },
      {
        id: "ex-glute-bridge",
        name: "Enbens Glute Bridge",
        description:
          "Ligg på rygg. Ett ben i golvet, andra i luften. Lyft höften genom att pressa ner hälen. Knäkontroll är nyckeln.",
        reps: "3 x 12 / ben",
        difficulty: "medium",
      },
    ],
  },
  {
    id: "routine-shoulders-1",
    title: "Axelhälsa & Hållning",
    description:
      'Förebyggande rutin för axlar och bröstrygg. Perfekt för kontorsarbetare eller vid "impingement"-känning.',
    tags: ["shoulders", "upper_back", "neck"],
    condition: "tightness",
    estimatedDurationMin: 12,
    exercises: [
      {
        id: "ex-band-pull",
        name: "Band Pull-Aparts",
        description:
          "Håll ett gummiband framför dig med raka armar. Dra isär bandet mot bröstet. Kläm ihop skulderbladen.",
        reps: "3 x 15",
        difficulty: "easy",
      },
      {
        id: "ex-wall-slide",
        name: "Wall Slides",
        description:
          'Stå med ryggen mot en vägg. Håll armarna i "W"-position mot väggen. Pressa upp till "Y" utan att släppa kontakten med väggen.',
        reps: "3 x 10",
        difficulty: "medium",
      },
      {
        id: "ex-ext-rot",
        name: "Utåtrotation med gummiband",
        description:
          "Fäst gummiband i dörrhandtag. Håll armbågen mot sidan (90 grader). Rotera underarmen utåt.",
        reps: "3 x 12 / sida",
        difficulty: "easy",
      },
    ],
  },
  {
    id: "routine-mobility-hips",
    title: "Höftöppnare för Löpare",
    description:
      "Öka rörligheten i höftböjare och säte. Motverkar stela höfter från stillasittande och löpning.",
    tags: ["hips", "glutes", "lower_back"],
    condition: "tightness",
    estimatedDurationMin: 20,
    exercises: [
      {
        id: "ex-couch-stretch",
        name: "Couch Stretch",
        description:
          "Knäet mot väggen (eller soffan), andra foten i golvet framför. Pressa fram höften. Känn stretchen i framsida lår/höft.",
        reps: "2 min / sida",
        difficulty: "hard",
      },
      {
        id: "ex-pigeon",
        name: "Pigeon Pose",
        description:
          "Klassisk yogaposition. Lägg ena benet vinklat framför dig, sträck det andra bakåt. Fäll fram överkroppen.",
        reps: "2 min / sida",
        difficulty: "medium",
      },
      {
        id: "ex-90-90",
        name: "90/90 Switch",
        description:
          "Sitt på golvet med benen i 90 graders vinkel (ett framåt, ett bakåt). Rotera långsamt över till andra sidan utan att använda händerna.",
        reps: "20 repetitioner",
        difficulty: "medium",
      },
    ],
  },
  {
    id: "routine-lower-back",
    title: "Ländryggsakuten",
    description:
      "Snäll rörelseträning när ryggen har låst sig eller känns trött. Ökar cirkualtionen utan tung belastning.",
    tags: ["lower_back", "core", "glutes"],
    condition: "pain",
    estimatedDurationMin: 10,
    exercises: [
      {
        id: "ex-cat-cow",
        name: "Katt & Ko",
        description:
          "Stå på alla fyra. Skjut rygg (katt) och svanka (ko) växelvis. Andas synkat med rörelsen.",
        reps: "20 st",
        difficulty: "easy",
      },
      {
        id: "ex-mcgill",
        name: "McGill Curl-up",
        description:
          "Ligg på rygg, ena benet böjt, andra rakt. Händerna under ländryggen. Lyft bara huvudet/axlarna lätt. Håll spänningen.",
        reps: "3 x 10 s",
        difficulty: "medium",
      },
      {
        id: "ex-child-pose",
        name: "Barnets Position",
        description:
          "Sitt på hälarna, fäll fram överkroppen med armarna sträckta framåt. Slappna av i ryggen.",
        reps: "2 min",
        difficulty: "easy",
      },
    ],
  },
];
