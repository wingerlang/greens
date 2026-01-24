export interface ErgStandard {
  level: string;
  distances: {
    "500m"?: string; // Time string "MM:SS"
    "1000m": string;
    "2000m": string;
    "5000m": string;
  };
}

export const ROWING_STANDARDS: { male: ErgStandard[]; female: ErgStandard[] } =
  {
    male: [
      {
        level: "Elite",
        distances: {
          "500m": "1:24",
          "1000m": "2:55",
          "2000m": "6:15",
          "5000m": "16:40",
        },
      },
      {
        level: "Advanced",
        distances: {
          "500m": "1:30",
          "1000m": "3:15",
          "2000m": "6:40",
          "5000m": "17:40",
        },
      },
      {
        level: "Intermediate",
        distances: {
          "500m": "1:40",
          "1000m": "3:35",
          "2000m": "7:20",
          "5000m": "19:00",
        },
      },
      {
        level: "Beginner",
        distances: {
          "500m": "1:55",
          "1000m": "4:00",
          "2000m": "8:10",
          "5000m": "21:30",
        },
      },
    ],
    female: [
      {
        level: "Elite",
        distances: {
          "500m": "1:38",
          "1000m": "3:30",
          "2000m": "7:10",
          "5000m": "19:10",
        },
      },
      {
        level: "Advanced",
        distances: {
          "500m": "1:45",
          "1000m": "3:45",
          "2000m": "7:40",
          "5000m": "20:30",
        },
      },
      {
        level: "Intermediate",
        distances: {
          "500m": "1:58",
          "1000m": "4:10",
          "2000m": "8:30",
          "5000m": "22:30",
        },
      },
      {
        level: "Beginner",
        distances: {
          "500m": "2:15",
          "1000m": "4:50",
          "2000m": "9:40",
          "5000m": "25:00",
        },
      },
    ],
  };

export const SKIERG_STANDARDS: { male: ErgStandard[]; female: ErgStandard[] } =
  {
    male: [
      {
        level: "Elite",
        distances: { "1000m": "3:15", "2000m": "6:45", "5000m": "17:30" },
      },
      {
        level: "Advanced",
        distances: { "1000m": "3:30", "2000m": "7:15", "5000m": "18:45" },
      },
      {
        level: "Intermediate",
        distances: { "1000m": "3:55", "2000m": "8:00", "5000m": "20:30" },
      },
      {
        level: "Beginner",
        distances: { "1000m": "4:30", "2000m": "9:00", "5000m": "23:00" },
      },
    ],
    female: [
      {
        level: "Elite",
        distances: { "1000m": "3:50", "2000m": "7:50", "5000m": "20:30" },
      },
      {
        level: "Advanced",
        distances: { "1000m": "4:10", "2000m": "8:30", "5000m": "22:00" },
      },
      {
        level: "Intermediate",
        distances: { "1000m": "4:40", "2000m": "9:30", "5000m": "24:30" },
      },
      {
        level: "Beginner",
        distances: { "1000m": "5:20", "2000m": "10:45", "5000m": "28:00" },
      },
    ],
  };
