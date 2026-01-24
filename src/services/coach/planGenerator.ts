import {
  CoachConfig,
  getISODate,
  PlannedActivity,
  StravaActivity,
} from "../../models/types.ts";
import {
  assessGoalFeasibility,
  calculateHrZone,
  calculateVDOT,
  formatPace,
  getPaceZones,
  predictWeightAdjustedVDOT,
} from "../../utils/runningCalculator.ts";

/**
 * Plan Generator Service
 * Creates deterministic training schedules based on VDOT and periodization.
 */

interface WorkoutTemplate {
  category: "INTERVALS" | "TEMPO" | "REPETITION";
  title: string;
  description: string;
  createStructure: (vol: number, paces: any) => PlannedActivity["structure"];
}

const QUALITY_SESSION_TEMPLATES: WorkoutTemplate[] = [
  {
    category: "INTERVALS",
    title: "Klassiska Tusingar",
    description: "Tuffa 1km-intervaller för att höja syreupptagningen.",
    createStructure: (vol, paces) => ({
      warmupKm: vol > 8 ? 3 : 2,
      mainSet: [{
        reps: Math.max(1, Math.floor(vol)),
        distKm: 1,
        pace: formatPace(paces.interval),
        restMin: 2,
      }],
      cooldownKm: vol > 8 ? 3 : 2,
    }),
  },
  {
    category: "INTERVALS",
    title: "Tröskelintervaller (2km)",
    description:
      "Längre intervaller i tröskeltempo för att flytta mjölksyra-tröskeln.",
    createStructure: (vol, paces) => ({
      warmupKm: vol > 10 ? 3 : 2,
      mainSet: [{
        reps: Math.max(2, Math.floor(vol / 2)),
        distKm: 2,
        pace: formatPace(paces.threshold),
        restMin: 1.5,
      }],
      cooldownKm: vol > 10 ? 3 : 2,
    }),
  },
  {
    category: "REPETITION",
    title: "Teknikökningar (Strides)",
    description: "Korta, snabba repetitioner med fokus på perfekt löpteknik.",
    createStructure: (vol, paces) => ({
      warmupKm: 3,
      mainSet: [{
        reps: 8,
        distKm: 0.1,
        pace: formatPace(paces.repetition),
        restMin: 1,
      }],
      cooldownKm: 1,
    }),
  },
  {
    category: "TEMPO",
    title: "Progressionspass",
    description: "Starta lugnt och öka farten successivt till tröskeltempo.",
    createStructure: (vol, paces) => ({
      warmupKm: 3,
      mainSet: [
        {
          reps: 1,
          distKm: vol / 2,
          pace: formatPace(paces.marathon || paces.easy * 0.9),
          restMin: 0,
        },
        {
          reps: 1,
          distKm: vol / 2,
          pace: formatPace(paces.threshold),
          restMin: 0,
        },
      ],
      cooldownKm: 2,
    }),
  },
];

const SCIENTIFIC_BENEFITS: Record<string, string> = {
  "LONG_RUN":
    "Ökar mitokondriell densitet och kapillärisering för extrem uthållighet.",
  "INTERVALS": "Höjer VO2 Max och din förmåga att arbeta under hög syreskuld.",
  "TEMPO":
    "Flyttar din mjölksyratröskel så att du kan hålla högre fart längre.",
  "EASY":
    "Främjar återhämtning och bygger den aeroba basen utan onödigt slitage.",
  "RECOVERY":
    "Aktiv återhämtning som ökar blodgenomströmningen till trötta muskler.",
  "REPETITION": "Förbättrar löpekonomi och rekrytering av snabba muskelfibrer.",
};

export function generateTrainingPlan(
  config: CoachConfig,
  history: StravaActivity[],
  plannedHistory: PlannedActivity[] = [],
): PlannedActivity[] {
  const plans: PlannedActivity[] = [];

  // 1. Baseline Analysis (Start Capacity)
  let currentVdot = 35;
  if (config.userProfile.currentForm) {
    currentVdot = calculateVDOT(
      config.userProfile.currentForm.distanceKm,
      config.userProfile.currentForm.timeSeconds,
    );
  } else if (config.userProfile.recentRaceTime) {
    currentVdot = calculateVDOT(
      config.userProfile.recentRaceTime.distance,
      config.userProfile.recentRaceTime.timeSeconds,
    );
  } else if (history.length > 0) {
    const runs = history.filter((a) => a.type === "Run");
    if (runs.length > 0) {
      const best = runs.sort((a, b) =>
        (b.distance / b.moving_time) - (a.distance / a.moving_time)
      )[0];
      currentVdot = calculateVDOT(best.distance / 1000, best.moving_time);
    }
  }

  // 1.1 Adaptive Adjustment (Feedback Logic)
  const recentHardSessions = plannedHistory.filter((a) =>
    a.status === "COMPLETED" &&
    (a.feedback === "HARD" || a.feedback === "TOO_HARD") &&
    new Date(a.date!) > new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
  );

  if (recentHardSessions.length >= 2) {
    currentVdot -= 1.0; // Reduce intensity if it's feeling too hard
  }
  const veryHardSessions = plannedHistory.filter((a) =>
    a.status === "COMPLETED" &&
    a.feedback === "TOO_HARD" &&
    new Date(a.date!) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  );
  const fatigueFactor = veryHardSessions.length > 0 ? 0.9 : 1.0;

  // 2. Active Goal Analysis
  const activeGoal = config.goals.find((g) => g.isActive) || config.goals[0];
  if (!activeGoal) return [];

  const targetVdot = calculateTargetVDOT(
    activeGoal.type,
    activeGoal.targetTimeSeconds,
  );

  // 3. Weight Adjustment (Pro feature)
  const predictedVdot = config.preferences.weightGoal
    ? predictWeightAdjustedVDOT(currentVdot, 80, config.preferences.weightGoal) // Hardcoded 80 for now
    : currentVdot;

  const paces = getPaceZones(predictedVdot);
  const { maxHr, restingHr } = config.userProfile;

  // 4. Feasibility
  const today = new Date();
  const targetDate = new Date(activeGoal.targetDate);
  const weeksUntilGoal = Math.ceil(
    (targetDate.getTime() - today.getTime()) / (7 * 24 * 60 * 60 * 1000),
  );
  const feasibility = assessGoalFeasibility(
    predictedVdot,
    targetVdot,
    weeksUntilGoal,
  );

  // 5. Volume Analysis
  const recentWeeklyVolume = calculateRecentWeeklyVolume(history);
  let currentVolume = Math.max(
    25,
    Math.min(config.preferences.weeklyVolumeKm, recentWeeklyVolume * 1.2),
  );

  // 6. Activity Generation
  let maxVolumeSeen = recentWeeklyVolume;
  for (let w = 0; w < weeksUntilGoal; w++) {
    const phase = determinePhase(w, weeksUntilGoal);
    const isVolumePR = currentVolume > maxVolumeSeen;
    if (isVolumePR) maxVolumeSeen = currentVolume;

    const weeklyActivities = generateWeek(
      w,
      phase,
      currentVolume,
      config,
      paces,
      maxHr,
      restingHr,
      activeGoal.id,
      fatigueFactor,
      recentHardSessions,
      isVolumePR,
    );
    plans.push(...weeklyActivities);

    if (phase !== "TAPER" && phase !== "RECOVERY") {
      currentVolume = Math.round(
        Math.min(
          currentVolume * 1.05,
          config.preferences.weeklyVolumeKm * 1.5,
        ) * 10,
      ) / 10;
    }
  }

  // Mark longest run in plan
  const longest =
    [...plans].sort((a, b) =>
      (b.estimatedDistance || 0) - (a.estimatedDistance || 0)
    )[0];
  if (longest) longest.isLongestInPlan = true;

  return plans;
}

function calculateTargetVDOT(
  goalType: string,
  targetTimeSecs?: number,
): number {
  if (!targetTimeSecs) return 40;
  // Map time to VDOT based on distance
  const dist = goalType === "MARATHON"
    ? 42.195
    : goalType === "HALF_MARATHON"
    ? 21.097
    : goalType === "10K"
    ? 10
    : 5;
  return calculateVDOT(dist, targetTimeSecs);
}

function calculateRecentWeeklyVolume(history: StravaActivity[]): number {
  if (history.length === 0) return 20;
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
  const relevant = history.filter((a) =>
    new Date(a.start_date) > fourWeeksAgo && a.type === "Run"
  );
  return relevant.reduce((sum, a) => sum + (a.distance / 1000), 0) / 4 || 20;
}

function determinePhase(week: number, totalWeeks: number): string {
  const remaining = totalWeeks - week;
  if (remaining <= 2) return "TAPER";
  if (remaining <= 6) return "PEAK";
  if (remaining <= 12) return "BUILD";
  return "BASE";
}

function generateWeek(
  weekNum: number,
  phase: string,
  weeklyVolume: number,
  config: CoachConfig,
  paces: any,
  maxHr: number,
  restingHr: number,
  goalId: string,
  fatigueFactor: number = 1.0,
  recentHardSessions: PlannedActivity[] = [],
  isVolumePR: boolean = false,
): PlannedActivity[] {
  const activities: PlannedActivity[] = [];
  const trainingDays = config.preferences.trainingDays;

  const dayMap: Record<string, number> = {
    "Monday": 1,
    "Tuesday": 2,
    "Wednesday": 3,
    "Thursday": 4,
    "Friday": 5,
    "Saturday": 6,
    "Sunday": 0,
  };
  const longRunDay = dayMap[config.preferences.longRunDay] ?? 0;
  const intervalDay = dayMap[config.preferences.intervalDay] ?? 2;

  // 1. Calculate Long Run Distance (Ensure it's the anchor of the week)
  // Minimigräns 12km eller 40% av volymen
  let longDist = Math.max(12, weeklyVolume * 0.4);

  // 2. Calculate Quality Session Volume
  let qualitySessionVol = 0;
  const intervalIsTrainingDay = trainingDays.includes(intervalDay);
  if (phase !== "BASE" && intervalIsTrainingDay) {
    qualitySessionVol = Math.max(4, weeklyVolume * 0.2);
  }

  // 3. Distribute remaining volume to Easy days
  const otherDays = trainingDays.filter((d) =>
    d !== longRunDay &&
    d !== (phase !== "BASE" && intervalIsTrainingDay ? intervalDay : -1)
  );
  let remainingVol = Math.max(0, weeklyVolume - longDist - qualitySessionVol);

  const easyPerDay = otherDays.length > 0
    ? Math.max(4, remainingVol / otherDays.length)
    : 0;

  // Final check: Long Run MUST be significantly longer than Easy Run (min 1.5x)
  if (longDist < easyPerDay * 1.5) {
    longDist = Math.round(easyPerDay * 1.5 * 10) / 10;
  }

  trainingDays.forEach((day) => {
    const activityDate = new Date();
    activityDate.setDate(
      activityDate.getDate() + (weekNum * 7) +
        ((day - activityDate.getDay() + 7) % 7),
    );
    const dateStr = getISODate(activityDate);

    if (day === longRunDay) {
      activities.push(
        createActivity(
          dateStr,
          "LONG_RUN",
          longDist * fatigueFactor,
          paces.easy,
          2,
          maxHr,
          restingHr,
          goalId,
          isVolumePR,
        ),
      );
    } else if (day === intervalDay && phase !== "BASE") {
      activities.push(
        createQualitySession(
          dateStr,
          phase,
          qualitySessionVol * fatigueFactor,
          paces,
          maxHr,
          restingHr,
          goalId,
        ),
      );
    } else {
      const isRecovery = fatigueFactor < 1.0 ||
        (recentHardSessions.length >= 3 && activities.length % 2 === 0);
      activities.push(
        createActivity(
          dateStr,
          isRecovery ? "RECOVERY" : "EASY",
          easyPerDay * (isRecovery ? 0.7 : 1.0) * fatigueFactor,
          paces.easy,
          1,
          maxHr,
          restingHr,
          goalId,
        ),
      );
    }
  });

  return activities;
}

function createActivity(
  date: string,
  category: PlannedActivity["category"],
  dist: number,
  pace: number,
  hrZone: number,
  maxHr: number,
  restingHr: number,
  goalId: string,
  isVolumePR: boolean = false,
): PlannedActivity {
  const paceStr = formatPace(pace);
  return {
    id: crypto.randomUUID(),
    date,
    type: "RUN",
    category,
    title: `${Math.round(dist)}km ${
      category === "LONG_RUN" ? "Långpass" : "Distans"
    }`,
    description:
      `Spring i bekvämt tempo (${paceStr} min/km). Håll pulsen i zon ${hrZone}.`,
    scientificBenefit: SCIENTIFIC_BENEFITS[category],
    isVolumePR: isVolumePR,
    structure: {
      warmupKm: 0,
      mainSet: [{
        reps: 1,
        distKm: Math.max(0.1, Math.round(dist * 10) / 10),
        pace: paceStr,
        restMin: 0,
      }],
      cooldownKm: 0,
    },
    targetPace: paceStr,
    targetHrZone: hrZone,
    estimatedDistance: Math.round(dist * 10) / 10,
    status: "PLANNED",
    goalId,
  };
}

function createQualitySession(
  date: string,
  phase: string,
  vol: number,
  paces: any,
  maxHr: number,
  restingHr: number,
  goalId: string,
): PlannedActivity {
  // Pick a template based on phase or just random for variety
  const templates = QUALITY_SESSION_TEMPLATES.filter((t) =>
    phase === "PEAK" ? t.category === "INTERVALS" : true
  );
  const template = templates[Math.floor(Math.random() * templates.length)];
  const sessionVol = Math.max(4, vol); // Quality sessions at least 4km of work

  return {
    id: crypto.randomUUID(),
    date,
    type: "RUN",
    category: template.category,
    title: template.title,
    description: template.description,
    scientificBenefit: SCIENTIFIC_BENEFITS[template.category],
    structure: template.createStructure(sessionVol, paces),
    targetPace: formatPace(
      template.category === "TEMPO" ? paces.threshold : paces.interval,
    ),
    targetHrZone: 4,
    estimatedDistance: Math.round((sessionVol + 4) * 10) / 10,
    status: "PLANNED",
    goalId,
  };
}
