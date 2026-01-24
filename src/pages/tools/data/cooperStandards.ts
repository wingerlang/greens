export type CooperLevel = "Excellent" | "Good" | "Average" | "Bad" | "Very Bad";

export interface CooperStandard {
  ageMin: number;
  ageMax: number;
  gender: "male" | "female";
  levels: {
    excellent: number; // > X
    good: number; // > X
    average: number; // > X
    bad: number; // > X
    // very bad is implied < bad
  };
}

export const COOPER_LEVEL_COLORS: Record<CooperLevel, string> = {
  "Excellent": "from-emerald-400 to-teal-500",
  "Good": "from-teal-400 to-cyan-500",
  "Average": "from-yellow-400 to-orange-500",
  "Bad": "from-orange-400 to-red-500",
  "Very Bad": "from-red-500 to-rose-600",
};

export const COOPER_LEVEL_TEXT_COLORS: Record<CooperLevel, string> = {
  "Excellent": "text-emerald-400",
  "Good": "text-teal-400",
  "Average": "text-yellow-400",
  "Bad": "text-orange-400",
  "Very Bad": "text-rose-400",
};

// Standard data from Kenneth Cooper's original work
// Ranges are often: 13-14, 15-16, 17-19, 20-29, 30-39, 40-49, 50-59, 60+
export const COOPER_STANDARDS: CooperStandard[] = [
  // --- MALE ---
  {
    ageMin: 13,
    ageMax: 14,
    gender: "male",
    levels: { excellent: 2700, good: 2400, average: 2200, bad: 2100 },
  },
  {
    ageMin: 15,
    ageMax: 16,
    gender: "male",
    levels: { excellent: 2800, good: 2500, average: 2300, bad: 2200 },
  },
  {
    ageMin: 17,
    ageMax: 19,
    gender: "male",
    levels: { excellent: 3000, good: 2700, average: 2500, bad: 2300 },
  },
  {
    ageMin: 20,
    ageMax: 29,
    gender: "male",
    levels: { excellent: 2800, good: 2400, average: 2200, bad: 1600 },
  },
  {
    ageMin: 30,
    ageMax: 39,
    gender: "male",
    levels: { excellent: 2700, good: 2300, average: 1900, bad: 1500 },
  },
  {
    ageMin: 40,
    ageMax: 49,
    gender: "male",
    levels: { excellent: 2500, good: 2100, average: 1700, bad: 1400 },
  },
  {
    ageMin: 50,
    ageMax: 59,
    gender: "male",
    levels: { excellent: 2400, good: 2000, average: 1600, bad: 1300 },
  },
  {
    ageMin: 60,
    ageMax: 99,
    gender: "male",
    levels: { excellent: 2300, good: 1900, average: 1400, bad: 1200 },
  },

  // --- FEMALE ---
  {
    ageMin: 13,
    ageMax: 14,
    gender: "female",
    levels: { excellent: 2000, good: 1900, average: 1600, bad: 1500 },
  },
  {
    ageMin: 15,
    ageMax: 16,
    gender: "female",
    levels: { excellent: 2100, good: 2000, average: 1700, bad: 1600 },
  },
  {
    ageMin: 17,
    ageMax: 19,
    gender: "female",
    levels: { excellent: 2300, good: 2100, average: 1800, bad: 1700 },
  },
  {
    ageMin: 20,
    ageMax: 29,
    gender: "female",
    levels: { excellent: 2700, good: 2200, average: 1800, bad: 1500 },
  },
  {
    ageMin: 30,
    ageMax: 39,
    gender: "female",
    levels: { excellent: 2500, good: 2000, average: 1700, bad: 1400 },
  },
  {
    ageMin: 40,
    ageMax: 49,
    gender: "female",
    levels: { excellent: 2300, good: 1900, average: 1500, bad: 1200 },
  },
  {
    ageMin: 50,
    ageMax: 59,
    gender: "female",
    levels: { excellent: 2200, good: 1700, average: 1400, bad: 1100 },
  },
  {
    ageMin: 60,
    ageMax: 99,
    gender: "female",
    levels: { excellent: 2000, good: 1600, average: 1300, bad: 1000 },
  },
];

export function getCooperStandard(
  age: number,
  gender: "male" | "female",
): CooperStandard | undefined {
  return COOPER_STANDARDS.find((s) =>
    s.gender === gender && age >= s.ageMin && age <= s.ageMax
  );
}

export function getDetailedCooperGrade(
  distance: number,
  standard: CooperStandard,
): {
  grade: CooperLevel;
  nextLevel?: CooperLevel;
  distanceToNext?: number;
  percentToNext?: number;
} {
  const { excellent, good, average, bad } = standard.levels;

  if (distance >= excellent) return { grade: "Excellent", percentToNext: 100 };
  if (distance >= good) {
    return {
      grade: "Good",
      nextLevel: "Excellent",
      distanceToNext: excellent - distance,
      percentToNext: (distance - good) / (excellent - good) * 100,
    };
  }
  if (distance >= average) {
    return {
      grade: "Average",
      nextLevel: "Good",
      distanceToNext: good - distance,
      percentToNext: (distance - average) / (good - average) * 100,
    };
  }
  if (distance >= bad) {
    return {
      grade: "Bad",
      nextLevel: "Average",
      distanceToNext: average - distance,
      percentToNext: (distance - bad) / (average - bad) * 100,
    };
  }

  return {
    grade: "Very Bad",
    nextLevel: "Bad",
    distanceToNext: bad - distance,
    percentToNext: Math.max(0, distance / bad * 100), // Rough approx for <Bad
  };
}
