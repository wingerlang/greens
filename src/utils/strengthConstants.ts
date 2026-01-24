/**
 * Shared Strength Constants
 * Used for consistent detection of main lifts and categories across the app.
 */

export const MATCH_PATTERNS = {
  squat: ["squat", "knäböj", "böj"],
  bench: ["bench", "bänk", "chestpress", "chest press"],
  deadlift: ["deadlift", "marklyft"],
  ohp: [
    "overhead",
    "militär",
    "axelpress",
    "military",
    "ohp",
    "hantelpress axlar",
  ],
  swings: ["swing", "swings", "kettlebell swing"],
  biceps: [
    "biceps curl",
    "bicep curl",
    "bicepscurl",
    "hammer curl",
    "barbell curl",
    "stångcurl",
    "dumbbell curl",
    "hantelcurl",
  ],
  pullups: ["pullup", "pull up", "chin", "chins", "pull-up"],
  row: [
    "row",
    "rodd",
    "barbell row",
    "stångrodd",
    "pendlay",
    "seated row",
    "sittande rodd",
  ],
};

export const EXCLUDE_PATTERNS = {
  squat: [
    "split",
    "goblet",
    "hack",
    "one",
    "utfall",
    "bulgarian",
    "front",
    "smith",
    "air",
    "luft",
    "hopp",
    "jump",
    "bodyweight",
    "kroppsvikt",
    "pistol",
    "sissy",
    "zercher",
  ],
  bench: [
    "hantel",
    "dumbbell",
    "incline",
    "sned",
    "smith",
    "dip",
    "fly",
    "flyes",
    "cable",
    "kabel",
    "pushup",
    "push up",
    "armhävning",
  ],
  deadlift: [
    "stiff",
    "rumänsk",
    "rdl",
    "raka",
    "rak",
    "deficit",
    "block",
    "trap bar",
    "hex",
  ],
  ohp: ["lateral", "lyft", "raise", "arnold", "push press", "behind"],
  swings: [],
  biceps: [],
  pullups: [
    "lat pulldown",
    "latsdrag",
    "assisted",
    "hjälpt",
    "band",
    "machine",
    "maskin",
  ],
  row: ["upright", "facepull"],
};

// Minimum weight thresholds to filter out bodyweight or accidental light data
export const MIN_WEIGHT_THRESHOLD = {
  squat: 40,
  bench: 30,
  deadlift: 40,
  ohp: 15,
  swings: 8,
  biceps: 5,
  pullups: 0,
  row: 15,
};

/** Helper to normalize text for matching */
export const normalizeStrengthName = (str: string) =>
  str.toLowerCase().replace(/[^a-zåäö0-9]/g, " ").replace(/\s+/g, " ").trim();
