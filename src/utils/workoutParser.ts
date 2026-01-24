import {
  PaceTarget,
  ParsedWorkout,
  RecoveryDefinition,
  SegmentType,
  WorkoutSegment,
} from "../models/analysisTypes.ts";

/**
 * Parses time string like "4:15" or "10:00" to seconds.
 * Returns null if invalid.
 */
function parsePaceToSeconds(paceStr: string): number | null {
  if (!paceStr) return null;
  const parts = paceStr.split(":");
  if (parts.length === 2) {
    const min = parseInt(parts[0], 10);
    const sec = parseInt(parts[1], 10);
    if (!isNaN(min) && !isNaN(sec)) return min * 60 + sec;
  }
  return null;
}

/**
 * Standardizes units and text.
 */
function normalizeText(text: string): string {
  let t = text.toLowerCase();

  // Remove emojis
  t = t.replace(
    /([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g,
    "",
  );

  // Standardize delimiters
  t = t.replace(/[—–]/g, "-");
  t = t.replace(/x/g, "x"); // ensure lowercase x
  t = t.replace(/\*/g, "x");

  // Units
  t = t.replace(/\s*kilometers?/g, "km");
  t = t.replace(/\s*kiloms?/g, "km");
  t = t.replace(/\s*meters?/g, "m");
  t = t.replace(/\s*mins?/g, "min");
  t = t.replace(/\s*sek/g, "s");
  t = t.replace(/\s*seconds?/g, "s");

  // Cleanup spacing
  t = t.replace(/\s+/g, " ").trim();

  return t;
}

function classifyLine(line: string): SegmentType {
  if (
    line.match(/(uppv|warm|upp|start|jogg(?!ing)|öppna)/) &&
    !line.includes("vila")
  ) return "WARMUP";
  // Exclusion: 'ner till' (progressive pace) should not be cooldown
  if (line.match(/(ner|cool|slut|avjogg)/) && !line.includes("ner till")) {
    return "COOLDOWN";
  }
  if (line.match(/(vila|stå|gå|jogg mellan)/)) return "REST";
  return "INTERVAL";
}

function parsePace(text: string): PaceTarget | undefined {
  // Check for progressive range: "4:00 -> 3:45" or "4:00 till 3:45" or "ner till 3:59"
  // Support dot separator in time: 4.15
  const normalizedTime = (t: string) => t.replace(".", ":");

  const progMatch = text.match(
    /(\d{1,2}[.:]\d{2})\s*(?:->|till|to|-|ner till)\s*(\d{1,2}[.:]\d{2})/,
  );
  if (progMatch) {
    const start = normalizedTime(progMatch[1]);
    const end = normalizedTime(progMatch[2]);
    return {
      type: "progressive",
      display: `${start}-${end}`,
      maxSeconds: parsePaceToSeconds(start) || 0, // usually start is slower (higher sec)
      minSeconds: parsePaceToSeconds(end) || 0,
    };
  }

  // Steady pace: "4:00", "@ 4:00", "fart 3.30"
  const steadyMatch = text.match(/(?:@|fart)?\s*(\d{1,2}[.:]\d{2})/);
  if (steadyMatch) {
    // Enforce context if no @ or 'fart' present?
    // If strict match like "3:30" appears, it's likely pace.
    const val = normalizedTime(steadyMatch[1]);
    const sec = parsePaceToSeconds(val);
    // Sanity check: Pace between 2:00 and 15:00 min/km usually
    if (sec && sec > 120 && sec < 900) {
      return {
        type: "steady",
        display: val,
        value: sec,
      };
    }
  }

  return undefined;
}

function parseDistance(text: string): number | undefined {
  // 2k -> 2000
  // 2km -> 2000
  const kmMatch = text.match(/(\d+(?:[.,]\d+)?)\s*k(?:m)?(?!\w)/); // k or km
  if (kmMatch) {
    return parseFloat(kmMatch[1].replace(",", ".")) * 1000;
  }

  const mMatch = text.match(/(\d+)\s*m(?!\w)/); // match 'm' but not 'min'
  if (mMatch) {
    return parseInt(mMatch[1], 10);
  }

  return undefined;
}

function parseDuration(text: string): number | undefined {
  // 10 min, 10min
  const minMatch = text.match(/(\d+(?:[.,]\d+)?)\s*min/);
  if (minMatch) {
    return parseFloat(minMatch[1].replace(",", ".")) * 60;
  }

  // special heuristic: "jogg 15m" -> if context implies duration?
  // The previous test failed because "15m" matched distance.
  // If "m" is present, parseDistance claims it.
  // We can prioritize: if line says "jogg", and val < 30, and unit is "m", treat as min?
  const heuristicMatch = text.match(/jogg\s+(\d+)\s*m(?!\w)/);
  if (heuristicMatch) {
    const val = parseInt(heuristicMatch[1]);
    if (val < 30) return val * 60;
  }

  const secMatch = text.match(/(\d+)\s*s/);
  if (secMatch) {
    return parseInt(secMatch[1], 10);
  }

  return undefined;
}

function parseRecovery(
  line: string,
  prevSegmentReps: number = 1,
): RecoveryDefinition | undefined {
  // Variable list check: "vila: 500, 400, 300..."
  // Looking for a sequence of numbers separated by comma
  const listMatch = line.match(
    /(?:vila|rest|jogg)?\s*:?\s*((?:\d+\s*,?\s*){2,})/,
  );
  if (listMatch) {
    const nums = listMatch[1].split(/[,\s]+/).map((n) => parseInt(n.trim()))
      .filter((n) => !isNaN(n));
    if (nums.length > 1) {
      // Check context for unit (default m if big, s if small?)
      // Or look for unit in string
      const hasM = line.includes("m");
      const hasS = line.includes("s") || line.includes("sek");
      const unit = hasS ? "s" : "m"; // Default to meter for lists usually (pyramid dists)

      return {
        type: "variable_list",
        unit,
        variableValues: nums,
      };
    }
  }

  // Simple recovery
  let dist = parseDistance(line);
  let time = parseDuration(line);

  // If explicit "vila X min" found
  const explicitRestVila = line.match(/vila\s*(\d+)\s*(m|min|s)/);
  if (explicitRestVila) {
    const val = parseInt(explicitRestVila[1]);
    const unit = explicitRestVila[2];
    if (unit === "s") time = val;
    if (unit === "min" || unit === "m") {
      // ambiguity 'm' for vila could be min.
      // In 'vila 1 min' -> min.
      // In 'vila 200m' -> meter?
      // Context heuristic: < 10 usually min, > 50 usually m/s.
      if (val < 10) time = val * 60;
      else if (line.includes("jogg")) dist = val; // "vila 200m jogg"
    }
  }

  if (dist) return { type: "distance", value: dist, unit: "m" };
  if (time) return { type: "time", value: time, unit: "s" };

  return undefined;
}

export function parseWorkout(
  title: string,
  description: string,
): ParsedWorkout {
  const raw = `${title}\n${description}`;
  const cleanLines = raw.split("\n").map(normalizeText).filter((l) =>
    l.length > 0
  );

  const segments: WorkoutSegment[] = [];

  // State machine basic
  let currentReps = 1;

  for (let i = 0; i < cleanLines.length; i++) {
    const line = cleanLines[i];

    // --- Pre-check: Comma-separated list of durations/distances? ---
    // "1min, 2min, 3min"
    if (line.includes(",") && !line.includes("vila")) {
      // If it looks like a list of simple segments
      const parts = line.split(",").map((s) => s.trim());
      const listSegments: WorkoutSegment[] = [];
      let validList = true;

      for (const p of parts) {
        const pTime = parseDuration(p);
        const pDist = parseDistance(p);
        // If neither, fail list parsing
        if (!pTime && !pDist) {
          validList = false;
          break;
        }
        listSegments.push({
          type: "INTERVAL", // default
          reps: 1,
          work: { dist: pDist, time: pTime },
          originalString: p,
        });
      }

      if (validList && listSegments.length > 1) {
        segments.push(...listSegments);
        continue;
      }
    }

    let type = classifyLine(line);

    // --- 1. Reps extraction ---
    // "5x1000m" or "5 x 1000m" or "5*1000m"
    const repsMatch = line.match(/(\d+)\s*x/);
    currentReps = repsMatch ? parseInt(repsMatch[1], 10) : 1;

    // --- 2. Work Metric ---
    const dist = parseDistance(line);
    const time = parseDuration(line);
    const pace = parsePace(line);

    // --- 3. Explicit Rest in same line? ---
    // "8x400m vila 60s"
    let recovery = parseRecovery(line, currentReps);

    // If no work metric found, and line classified as INTERVAL, verify it's not just a wrapper line?
    // E.g. "Serie:" -> continue
    if (type === "INTERVAL" && !dist && !time) {
      // Check for loose numeric list? "1min, 2min..."
      if (line.match(/\d+min, \d+min/)) {
        // Scenario E: Pyramid list - handled by Pre-check above usually,
        // but if spaces/newlines matched oddly, we might be here.
      }
    }

    // --- 4. Look ahead for Rest Line ---
    // If this line is work, and next line is purely rest
    if ((dist || time) && !recovery && i + 1 < cleanLines.length) {
      const nextLine = cleanLines[i + 1];
      if (classifyLine(nextLine) === "REST") {
        const nextRec = parseRecovery(nextLine, currentReps);
        if (nextRec) {
          recovery = nextRec;
          // Check if variable list length matches reps
          if (
            nextRec.type === "variable_list" &&
            nextRec.variableValues?.length === currentReps
          ) {
            // Perfect match
          }
        }
      }
    }

    // Construct Segment
    if (dist || time || type === "WARMUP" || type === "COOLDOWN") {
      // If type is REST, we generally merge it into previous segment if possible.
      // If standalone rest line (not consumed above), we might drop it or store as 'REST' segment?
      if (type === "REST") {
        // Try to attach to previous segment
        if (segments.length > 0) {
          const last = segments[segments.length - 1];
          if (!last.recovery) {
            last.recovery = recovery || parseRecovery(line);
            continue;
          }
        }
      }

      segments.push({
        type,
        reps: currentReps,
        work: {
          dist,
          time,
          pace,
        },
        recovery,
        originalString: line,
      });
    }
  }

  // Post-processing: Handle "Variable List" recovery by expanding segments?
  const expandedSegments: WorkoutSegment[] = [];
  segments.forEach((seg) => {
    if (
      seg.reps > 1 && seg.recovery?.type === "variable_list" &&
      seg.recovery.variableValues?.length === seg.reps
    ) {
      // Expand!
      seg.recovery.variableValues.forEach((val, idx) => {
        expandedSegments.push({
          ...seg,
          reps: 1,
          recovery: {
            type: seg.recovery!.unit === "s" ? "time" : "distance",
            unit: seg.recovery!.unit,
            value: val,
          },
          originalString: `${seg.originalString} (Rep ${idx + 1})`,
        });
      });
    } else {
      expandedSegments.push(seg);
    }
  });

  // Determine Category
  let suggestedSubType: "interval" | "long-run" | "default" | "tempo" =
    "default";
  if (expandedSegments.some((s) => s.type === "INTERVAL")) {
    suggestedSubType = "interval";
  }

  // Keyword overrides
  const lowerRaw = raw.toLowerCase();
  if (
    lowerRaw.includes("långpass") || lowerRaw.includes("long run") ||
    lowerRaw.includes("longrun")
  ) {
    suggestedSubType = "long-run";
  } else if (lowerRaw.includes("tröskel") && suggestedSubType === "default") {
    suggestedSubType = "interval"; // classification as Interval for Threshold
  } else if (
    lowerRaw.includes("tävling") || lowerRaw.includes("race") ||
    lowerRaw.includes("lopp")
  ) {
    // We don't have 'race' in the simple union above, but could map to 'race' if added to type,
    // effectively mapped to 'default' or 'competition' in app.
    // For now let's keep it safe.
  }

  return {
    segments: expandedSegments,
    totalDistance: expandedSegments.reduce(
      (sum, s) => sum + (s.work.dist || 0) * s.reps,
      0,
    ),
    classification: expandedSegments.some((s) => s.type === "INTERVAL")
      ? "INTERVALS"
      : "DISTANCE",
    suggestedSubType,
  };
}
