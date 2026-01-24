import {
  ExerciseEntry,
  HyroxStation,
  StrengthSession,
} from "../models/types.ts";

// Standard Weights (Men/Women Open) - can be configured later
const HYROX_STANDARDS = {
  sledPush: { weight: 152 }, // kg (Open Men)
  sledPull: { weight: 103 }, // kg
  farmersCarry: { weight: 24 }, // kg x 2
  sandbagLunges: { weight: 20 }, // kg
  wallBalls: { weight: 6 }, // kg
};

export function identifyHyroxActivity(activity: ExerciseEntry): boolean {
  const text = (activity.notes + " " + (activity as any).name).toLowerCase(); // basic check, 'name' might need casting if not on ExerciseEntry yet
  return text.includes("hyrox") || text.includes("sled push") ||
    text.includes("wall ball");
}

// Helper to check both explicit duration (if name matches) and text regex (if name doesn't match or for splits)
function checkActivityForStation(
  activity: ExerciseEntry,
  keywords: string[],
  targetArray: number[],
) {
  // Combine notes, name, and title to be safe
  const text = (activity.notes || "" + " " + (activity as any).name ||
    "" + " " + (activity as any).title || "").toLowerCase();
  const name =
    ((activity as any).name || "" + " " + (activity as any).title || "")
      .toLowerCase();

  // 1. Check if the Activity ITSELF is this station (e.g. Name = "Sled Push")
  // and has a valid duration.
  // Sanity: Station avg is usually 2-8 mins. Allow up to 20 mins.
  // If user logged "Sled Push 50m", duration might be accurate.
  const isDirectMatch = keywords.some((k) => name.includes(k));
  if (
    isDirectMatch && activity.durationMinutes &&
    activity.durationMinutes > 0.5 && activity.durationMinutes < 20
  ) {
    // If it's a specific entry for this station
    targetArray.push(activity.durationMinutes * 60);
    return;
  }

  // 2. Look for regex in text (notes or name)
  // "Sled Push: 3:00"
  for (const keyword of keywords) {
    const regex = new RegExp(
      `${keyword}[^\\d\\r\\n]*(\\d+)(:|m|\\s|\\.)(\\d{2})?`,
      "i",
    );
    const match = text.match(regex);
    if (match) {
      const minutes = parseInt(match[1]);
      const seconds = match[3] ? parseInt(match[3]) : 0;
      const totalSeconds = minutes * 60 + seconds;
      // Sanity check (30s to 15 mins)
      if (totalSeconds > 30 && totalSeconds < 900) {
        targetArray.push(totalSeconds);
        return;
      }
    }
  }
}

export function parseHyroxStats(
  activities: ExerciseEntry[],
  strengthSessions: StrengthSession[] = [],
): Record<HyroxStation, number[]> {
  const stats: Record<HyroxStation, number[]> = {
    ski_erg: [],
    sled_push: [],
    sled_pull: [],
    burpee_broad_jumps: [],
    rowing: [],
    farmers_carry: [],
    sandbag_lunges: [],
    wall_balls: [],
    run_1km: [],
  };

  // Helper to process any activity (Real or Virtual)
  const processActivity = (a: ExerciseEntry) => {
    const text = (a.notes || "" + " " + (a as any).name || "").toLowerCase();

    // 1. Station Parsing
    checkActivityForStation(a, ["ski", "ski erg"], stats.ski_erg);
    checkActivityForStation(a, ["sled push", "push"], stats.sled_push); // "Sled Push" specific
    checkActivityForStation(a, ["sled pull", "pull"], stats.sled_pull);
    checkActivityForStation(a, ["burpee", "bbj"], stats.burpee_broad_jumps);
    checkActivityForStation(a, ["row", "rowing"], stats.rowing);
    checkActivityForStation(a, ["farmers", "carry"], stats.farmers_carry);
    checkActivityForStation(a, ["lunge", "sandbag"], stats.sandbag_lunges);
    checkActivityForStation(a, ["wall", "wall ball", "wb"], stats.wall_balls);

    // 2. Run Parsing
    // A) Dedicated 1km Intervals (strict distance check)
    if (
      a.type === "running" && a.distance && Math.abs(a.distance - 1.0) < 0.1
    ) {
      stats.run_1km.push(a.durationMinutes * 60);
    }
    // B) Splits inside a Hyrox Note (e.g., "Run 1: 4:00", "Run 8: 5:30")
    parseRunSplits(text, stats.run_1km);
  };

  // 1. Process Standard Activities
  activities.forEach(processActivity);

  // 2. Process Strength Sessions (Deep Search)
  if (strengthSessions) {
    strengthSessions.forEach((session) => {
      // Check each exercise inside the session
      session.exercises.forEach((ex) => {
        // effective duration: hard to know per exercise if not logged.
        // Assuming distinct sets? No, usually "3 x 10" etc.
        // If it's a Hyrox station, we assume it's done as a "station work".
        // We fake a Virtual Activity for it. Use 0 duration if unknown, parser might catch text duration?

        // Create a Virtual Entry
        const virtualEntry: any = {
          name: ex.name,
          notes: ex.notes || "",
          // Fallback duration: if session is 60m and 6 exercises -> 10m each?
          // Better to rely on "Name Match" with a safe default if no explicit duration found.
          // But checkActivityForStation checks durationMinutes > 0.5.
          // Let's assume 5 mins if nothing else.
          durationMinutes: session.durationMinutes /
            (session.exercises.length || 1),
          type: "strength",
          id: `virtual-${session.id}-${ex.id}`,
          date: session.date,
        };

        processActivity(virtualEntry);
      });
    });
  }

  return stats;
}

function parseRunSplits(text: string, targetArray: number[]) {
  // Look for "Run X: 4:30"
  const regex = /run\s*\d*[^\\d]*(\d+)(:|m|\s|\.)(\d{2})/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const minutes = parseInt(match[1]);
    const seconds = match[3] ? parseInt(match[3]) : 0;
    const total = minutes * 60 + seconds;
    if (total > 150 && total < 600) { // 2:30 to 10:00 range
      targetArray.push(total);
    }
  }
}
