/**
 * StrengthLog CSV Parser
 * Parses StrengthLog export format into StrengthWorkout objects.
 */

import {
    StrengthWorkout,
    StrengthWorkoutExercise,
    StrengthSet,
    StrengthExercise,
    ExerciseCategory,
    generateStrengthId,
    isWeightedDistanceExercise,
    isDistanceBasedExercise,
    normalizeExerciseName,
    parseTimeToSeconds,
    calculateEstimated1RM,
    PersonalBest
} from '../models/strengthTypes.ts';

interface ParsedCSV {
    userInfo: {
        name: string;
        email: string;
        birthDate?: string;
    };
    workouts: StrengthWorkout[];
    exercises: Map<string, StrengthExercise>;
    personalBests: PersonalBest[];
}

interface ParserContext {
    userId: string;
    currentWorkout: StrengthWorkout | null;
    currentExercise: StrengthWorkoutExercise | null;
    exercises: Map<string, StrengthExercise>;
    workouts: StrengthWorkout[];
    personalBests: Map<string, PersonalBest>; // key: exerciseId-type
    errors: string[];
}

/**
 * Parse a StrengthLog CSV file content
 */
export function parseStrengthLogCSV(csvContent: string, userId: string): ParsedCSV {
    const lines = csvContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    // Detect format
    // Legacy format has a specific header or "Workouts" keyword typically
    // New (flat) format starts with "workout,start,end,exercise..."
    const firstLine = lines[0].toLowerCase();
    const isNewFormat = firstLine.startsWith('workout,start,end');
    const isHevyFormat = (firstLine.includes('"title"') && firstLine.includes('"start_time"')) || (firstLine.includes('title,') && firstLine.includes('start_time,'));

    if (isNewFormat) {
        return parseNewStrengthLogFormat(lines, userId);
    }

    if (isHevyFormat) {
        return parseHevyLogFormat(lines, userId);
    }

    return parseLegacyStrengthLogCSV(lines, userId);
}

function parseLegacyStrengthLogCSV(lines: string[], userId: string): ParsedCSV {
    const context: ParserContext = {
        userId,
        currentWorkout: null,
        currentExercise: null,
        exercises: new Map(),
        workouts: [],
        personalBests: new Map(),
        errors: []
    };

    // Parse user info (first line)
    const userInfo = parseUserInfo(lines[0], lines[1]);

    // Find "Workouts" marker
    const workoutsIndex = lines.findIndex(l => l === 'Workouts');
    if (workoutsIndex === -1) {
        throw new Error('Could not find "Workouts" section in CSV');
    }

    // Skip header line after "Workouts"
    // "Name,Date,Body weight,Shape,Sleep,Calories,Stress"
    const dataStartIndex = workoutsIndex + 2;

    for (let i = dataStartIndex; i < lines.length; i++) {
        const line = lines[i];

        // Skip malformed lines
        if (line.startsWith("Instance of 'Loc'")) continue;

        try {
            parseLine(line, context);
        } catch (e) {
            context.errors.push(`Line ${i + 1}: ${e instanceof Error ? e.message : String(e)}`);
        }
    }

    // Finalize last workout
    if (context.currentWorkout) {
        finalizeWorkout(context);
    }

    return {
        userInfo,
        workouts: context.workouts, // Legacy parser populates this array
        exercises: context.exercises,
        personalBests: Array.from(context.personalBests.values())
    };
}

// ----------------------------------------------------------------------
// New Flat Format Parser
// ----------------------------------------------------------------------

function parseNewStrengthLogFormat(lines: string[], userId: string): ParsedCSV {
    // Header: workout,start,end,exercise,weight,bodyweight,extraWeight,assistingWeight,distanceKM,distanceM,reps,rpm,time-per-500,calories,time,warmup,max,fail,checked,setComment,workoutComment,form,sleep,calories,stress
    // We'll map header names to indices
    const header = parseCSVLine(lines[0]).map(h => h.trim());
    const getIdx = (col: string) => header.indexOf(col);

    const idx = {
        workout: getIdx('workout'),
        start: getIdx('start'),
        end: getIdx('end'),
        exercise: getIdx('exercise'),
        weight: getIdx('weight'),
        bodyweight: getIdx('bodyweight'),
        extraWeight: getIdx('extraWeight'),
        distanceKM: getIdx('distanceKM'),
        distanceM: getIdx('distanceM'),
        reps: getIdx('reps'),
        time: getIdx('time'),
        warmup: getIdx('warmup'),
        workoutComment: getIdx('workoutComment'),
        sleep: getIdx('sleep'),
        stress: getIdx('stress'),
        calories: 23 // Warning: 'calories' appears twice in header (idx 13 and 23 in example). 23 is usually the workout metric? Or row metric?
        // Let's use simple lookup for now.
    };

    const ctx: ParserContext = {
        userId,
        currentWorkout: null, // Not used strictly, we use map
        currentExercise: null,
        exercises: new Map(),
        workouts: [],
        personalBests: new Map(),
        errors: []
    };

    const workoutMap = new Map<string, StrengthWorkout>();

    // Skip header
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;

        try {
            const vals = parseCSVLine(line);

            // 1. Identify Workout Group (by start timestamp + name)
            const workoutName = vals[idx.workout] || 'Unknown Workout';
            const startTimeStr = vals[idx.start];
            const startDate = new Date(parseInt(startTimeStr));
            const dateStr = startDate.toISOString().split('T')[0];
            const workoutIdKey = `${startTimeStr}-${workoutName}`;

            let workout = workoutMap.get(workoutIdKey);
            if (!workout) {
                workout = {
                    id: generateStrengthId(),
                    userId,
                    date: dateStr,
                    name: workoutName,
                    source: 'strengthlog',
                    exercises: [],
                    totalVolume: 0,
                    totalSets: 0,
                    totalReps: 0,
                    uniqueExercises: 0,
                    createdAt: new Date().toISOString(), // or use startTime
                    updatedAt: new Date().toISOString(),
                    notes: vals[idx.workoutComment],
                    // Optional metadata
                    // bodyWeight: ?? Not clearly in row for whole workout, maybe in set data?
                    sleep: parseFloat(vals[idx.sleep]) || undefined,
                    stress: parseFloat(vals[idx.stress]) || undefined
                };
                workoutMap.set(workoutIdKey, workout);
            }

            // 2. Process Exercise
            const exerciseName = vals[idx.exercise];
            if (!exerciseName) continue;

            const normalizedName = normalizeExerciseName(exerciseName);
            if (!ctx.exercises.has(normalizedName)) {
                ctx.exercises.set(normalizedName, {
                    id: `ex-${normalizedName.replace(/\s/g, '-')}`,
                    name: exerciseName,
                    normalizedName,
                    category: guessExerciseCategory(exerciseName),
                    primaryMuscle: 'full_body',
                    isCompound: guessIsCompound(exerciseName)
                });
            }
            const exerciseDef = ctx.exercises.get(normalizedName)!;

            // Find or create Exercise Group in Workout
            // Note: In flat CSV, sets for same exercise might be scattered if user did circuit?
            // Usually simpler to just append or find existing by ID.
            let workoutExercise = workout.exercises.find(we => we.exerciseId === exerciseDef.id);
            if (!workoutExercise) {
                workoutExercise = {
                    exerciseId: exerciseDef.id,
                    exerciseName: exerciseName,
                    sets: []
                };
                workout.exercises.push(workoutExercise);
            }

            // 3. Process Set
            // weight, bodyweight, extraWeight
            // Logic: if bodyweight is set, use it?
            const weightVal = parseFloat(vals[idx.weight]) || 0;
            const bodyweightVal = parseFloat(vals[idx.bodyweight]);
            const extraWeightVal = parseFloat(vals[idx.extraWeight]);
            const repsVal = parseInt(vals[idx.reps]) || 0;
            const distKM = parseFloat(vals[idx.distanceKM]) || 0;
            const distM = parseFloat(vals[idx.distanceM]) || 0;
            const timeVal = vals[idx.time]; // "00:04:44" or similar
            const isWarmup = (vals[idx.warmup] || '').toLowerCase() === 'true';

            const set: StrengthSet = {
                setNumber: workoutExercise.sets.length + 1,
                reps: repsVal,
                weight: weightVal,
                isWarmup
            };

            // Handle Bodyweight logic
            if (!isNaN(bodyweightVal) && bodyweightVal > 0) {
                set.isBodyweight = true;
                set.bodyweight = bodyweightVal;
                // If weight column is empty/zero but BW is present, user might mean BW exercise
                // Commonly: weight = bodyweight + extraWeight
                if (!set.weight) set.weight = bodyweightVal + (extraWeightVal || 0);
            }
            if (!isNaN(extraWeightVal)) {
                set.extraWeight = extraWeightVal;
            }

            // Handle Distance/Time
            const totalDistM = (distKM * 1000) + distM;
            if (totalDistM > 0) {
                set.distance = totalDistM;
                set.distanceUnit = 'm';
            }
            if (timeVal) {
                set.time = timeVal;
                set.timeSeconds = parseTimeToSeconds(timeVal);
            }

            workoutExercise.sets.push(set);

            // 4. Update Stats & PBs
            // We'll do a final pass for stats, but PBs can be tracked incrementally or after.
            // Let's use the helper to track PBs, but we need to mock context slightly or refactor trackPersonalBest
            // trackPersonalBest expects context.currentWorkout to be set.
            ctx.currentWorkout = workout;
            trackPersonalBest(ctx, exerciseDef, set);

        } catch (e) {
            ctx.errors.push(`Row ${i}: ${e}`);
        }
    }

    // Finalize all workouts (calc totals)
    for (const workout of workoutMap.values()) {
        ctx.currentWorkout = workout;
        finalizeWorkout(ctx); // This pushes to ctx.workouts and clears ctx.currentWorkout
    }

    return {
        userInfo: { name: 'User', email: '' }, // New format lacks this
        workouts: ctx.workouts,
        exercises: ctx.exercises,
        personalBests: Array.from(ctx.personalBests.values())
    };
}

function parseUserInfo(headerLine: string, dataLine: string): ParsedCSV['userInfo'] {
    // Header: Name,Language,Sex,Age,Email
    // Data: Johannes Winger-Lang,en,Male,1991-09-04,wingerlang.johannes@gmail.com
    const values = parseCSVLine(dataLine);
    return {
        name: values[0] || '',
        birthDate: values[3],
        email: values[4] || ''
    };
}

function parseLine(line: string, ctx: ParserContext) {
    const values = parseCSVLine(line);

    // Check if this is a workout header line
    // Format: Name,Date,Body weight,Shape,Sleep,Calories,Stress
    // Example: Wednesday Morning: Squat & Push-Up,2025-12-24,79.2,-1,-1,-1,-1
    if (values.length >= 7 && isDateString(values[1])) {
        // Finalize previous workout
        if (ctx.currentWorkout) {
            finalizeWorkout(ctx);
        }

        // Start new workout
        ctx.currentWorkout = {
            id: generateStrengthId(),
            userId: ctx.userId,
            date: values[1],
            name: values[0],
            bodyWeight: parseFloat(values[2]) || undefined,
            shape: parseFloat(values[3]) !== -1 ? parseFloat(values[3]) : undefined,
            sleep: parseFloat(values[4]) !== -1 ? parseFloat(values[4]) : undefined,
            stress: parseFloat(values[6]) !== -1 ? parseFloat(values[6]) : undefined,
            exercises: [],
            totalVolume: 0,
            totalSets: 0,
            totalReps: 0,
            uniqueExercises: 0,
            source: 'strengthlog',
            sourceWorkoutName: values[0],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        ctx.currentExercise = null;
        return;
    }

    // Check if this is an exercise set line
    // Format: "Exercise, <name>",Set,<n>,reps,<count>,weight,<kg>,...
    if (values[0]?.startsWith('Exercise,') || values[0]?.startsWith('"Exercise,')) {
        parseExerciseSet(values, ctx);
        return;
    }
}

function parseExerciseSet(values: string[], ctx: ParserContext) {
    if (!ctx.currentWorkout) return;

    // Extract exercise name from "Exercise, Squat" or similar
    let exercisePart = values[0];
    if (exercisePart.startsWith('"')) exercisePart = exercisePart.slice(1);
    if (exercisePart.endsWith('"')) exercisePart = exercisePart.slice(0, -1);

    const exerciseName = exercisePart.replace(/^Exercise,\s*/, '').trim();
    const normalizedName = normalizeExerciseName(exerciseName);

    // Get or create exercise definition
    if (!ctx.exercises.has(normalizedName)) {
        ctx.exercises.set(normalizedName, {
            id: `ex-${normalizedName.replace(/\s/g, '-')}`,
            name: exerciseName,
            normalizedName,
            category: guessExerciseCategory(exerciseName),
            primaryMuscle: 'full_body', // Will need manual curation
            isCompound: guessIsCompound(exerciseName)
        });
    }
    const exercise = ctx.exercises.get(normalizedName)!;

    // Check if we need to start a new exercise group in workout
    const existingExercise = ctx.currentWorkout.exercises.find(ex => ex.exerciseId === exercise.id);

    if (existingExercise) {
        ctx.currentExercise = existingExercise;
    } else {
        ctx.currentExercise = {
            exerciseId: exercise.id,
            exerciseName: exerciseName,
            sets: []
        };
        ctx.currentWorkout.exercises.push(ctx.currentExercise);
    }

    // Parse the set data
    // Format varies: Set,1,reps,25,weight,30 OR Set,1,reps,25,bodyweight,79.2,extraWeight,0
    const set = parseSetData(values, ctx.currentWorkout.bodyWeight);

    // Ensure set numbers are sequential if we are merging
    set.setNumber = ctx.currentExercise.sets.length + 1;

    ctx.currentExercise.sets.push(set);

    // Track personal bests
    trackPersonalBest(ctx, exercise, set);
}

function parseSetData(values: string[], bodyWeight?: number): StrengthSet {
    const set: StrengthSet = {
        setNumber: parseInt(values[2]) || 1,
        reps: 0,
        weight: 0
    };

    // Parse key-value pairs after "Set,N,"
    for (let i = 3; i < values.length - 1; i += 2) {
        const key = values[i];
        const value = values[i + 1];

        switch (key) {
            case 'reps':
                set.reps = parseInt(value) || 0;
                break;
            case 'weight':
                set.weight = parseFloat(value) || 0;
                break;
            case 'bodyweight':
                set.isBodyweight = true;
                set.bodyweight = parseFloat(value) || bodyWeight;
                set.weight = set.bodyweight || 0;
                break;
            case 'extraWeight':
                set.extraWeight = parseFloat(value) || 0;
                if (set.extraWeight > 0) {
                    set.weight = (set.bodyweight || 0) + set.extraWeight;
                }
                break;
            case 'time':
                set.time = value;
                set.timeSeconds = parseTimeToSeconds(value);
                break;
            case 'distanceKm':
                set.distance = parseFloat(value) * 1000; // Convert to meters
                set.distanceUnit = 'm';
                break;
            case 'distanceMeter':
                set.distance = parseFloat(value);
                set.distanceUnit = 'm';
                break;
            case 'calories':
                set.calories = parseInt(value) || 0;
                break;
            case 'rpm':
                set.rpm = parseInt(value) || 0;
                break;
            case 'warmup':
                set.isWarmup = value === '1' || value.toLowerCase() === 'true';
                break;
            case 'rpe':
                set.rpe = parseFloat(value) || undefined;
                break;
            case 'time-per-500':
                set.tempo = value;
                break;
        }
    }

    // Fix edge cases:
    // 1. Distance-based sets with 0 reps should be 1 rep (e.g. Sled Push)
    if (set.reps === 0 && (set.distance || 0) > 0) {
        set.reps = 1;
    }

    return set;
}

function finalizeWorkout(ctx: ParserContext) {
    if (!ctx.currentWorkout) return;

    const workout = ctx.currentWorkout;

    // Calculate totals
    let totalVolume = 0;
    let totalSets = 0;
    let totalReps = 0;

    for (const exercise of workout.exercises) {
        let exerciseVolume = 0;
        let topWeight = 0;
        let topReps = 0;

        for (const set of exercise.sets) {
            totalSets++;
            totalReps += set.reps;
            const setVolume = set.reps * set.weight;
            exerciseVolume += setVolume;

            if (set.weight > topWeight || (set.weight === topWeight && set.reps > topReps)) {
                topWeight = set.weight;
                topReps = set.reps;
            }
        }

        exercise.totalVolume = exerciseVolume;
        exercise.topSet = { weight: topWeight, reps: topReps };
        totalVolume += exerciseVolume;
    }

    workout.totalVolume = totalVolume;
    workout.totalSets = totalSets;
    workout.totalReps = totalReps;
    workout.uniqueExercises = workout.exercises.length;

    ctx.workouts.push(workout);
    ctx.currentWorkout = null;
    ctx.currentExercise = null;
}

function trackPersonalBest(ctx: ParserContext, exercise: StrengthExercise, set: StrengthSet) {

    // 0. Handle Weighted Distance PBs (Sled Push, Farmers Walk, etc.)
    if (isWeightedDistanceExercise(exercise.name)) {
        const pbKey = `${exercise.id}-1rm`; // Still use 1rm key for consistency
        const existing = ctx.personalBests.get(pbKey);

        // Logic: 
        // 1. Higher weight wins
        // 2. If same weight, longer distance wins

        let isNewPB = false;

        if (!existing) {
            isNewPB = true;
        } else if (set.weight > existing.value) {
            isNewPB = true;
        } else if (set.weight === existing.value && (set.distance || 0) > (existing.distance || 0)) {
            isNewPB = true;
        }

        if (isNewPB) {
            ctx.personalBests.set(pbKey, {
                id: generateStrengthId(),
                exerciseId: exercise.id,
                exerciseName: exercise.name,
                userId: ctx.userId,
                type: '1rm',
                value: set.weight, // Value is the weight
                weight: set.weight,
                distance: set.distance, // Store distance context
                distanceUnit: set.distanceUnit,
                reps: set.reps,
                isBodyweight: false,
                extraWeight: 0,
                date: ctx.currentWorkout!.date,
                workoutId: ctx.currentWorkout!.id,
                workoutName: ctx.currentWorkout!.name,
                estimated1RM: set.weight,
                createdAt: new Date().toISOString(),
                previousBest: existing?.value
            });
        }
        return;
    }

    // 0.5. Track Distance-based PBs (Running, Rowing, Ski Erg)
    // Note: Weighted Distance is handled above. This is for pure cardio/distance.
    if (isDistanceBasedExercise(exercise.name) && set.distance && set.distance > 0) {
        const pbKey = `${exercise.id}-distance`;
        const existing = ctx.personalBests.get(pbKey);

        if (!existing || set.distance > existing.value) {
            ctx.personalBests.set(pbKey, {
                id: generateStrengthId(),
                exerciseId: exercise.id,
                exerciseName: exercise.name,
                userId: ctx.userId,
                type: 'distance',
                value: set.distance,
                weight: 0,
                reps: 0,
                distance: set.distance,
                distanceUnit: set.distanceUnit,
                time: set.timeSeconds,
                tempo: set.tempo,
                date: ctx.currentWorkout!.date,
                workoutId: ctx.currentWorkout!.id,
                workoutName: ctx.currentWorkout!.name,
                estimated1RM: 0,
                createdAt: new Date().toISOString(),
                previousBest: existing?.value
            });
        }
    }

    // 1. Track time-based PBs (for plank, dead hang, etc.)
    if (set.timeSeconds && set.timeSeconds > 0) {
        const timePbKey = `${exercise.id}-time`;
        const existingTimePB = ctx.personalBests.get(timePbKey);

        if (!existingTimePB || set.timeSeconds > existingTimePB.value) {
            ctx.personalBests.set(timePbKey, {
                id: generateStrengthId(),
                exerciseId: exercise.id,
                exerciseName: exercise.name,
                userId: ctx.userId,
                type: 'time',
                value: set.timeSeconds,
                weight: set.weight,
                reps: set.reps,
                isBodyweight: !!set.isBodyweight,
                extraWeight: set.extraWeight,
                date: ctx.currentWorkout!.date,
                workoutId: ctx.currentWorkout!.id,
                workoutName: ctx.currentWorkout!.name,
                estimated1RM: 0, // Not applicable for time-based
                createdAt: new Date().toISOString(),
                previousBest: existingTimePB?.value
            });
        }
    }

    // 2. Track weight-based 1RM PBs
    if (set.reps <= 0) return;

    const isBW = !!set.isBodyweight;
    const calcWeight = isBW ? (set.extraWeight || 0) : set.weight;

    if (calcWeight <= 0 && !isBW) return;

    const estimated1RM = calculateEstimated1RM(calcWeight, set.reps);
    const pbKey = `${exercise.id}-1rm`;

    const existing = ctx.personalBests.get(pbKey);
    // Added fix: For bodyweight, we check extraWeight specifically if values are close, but e1RM should cover it
    // Updated Logic: Always overwrite if greater.
    if (!existing || estimated1RM > existing.value) {
        ctx.personalBests.set(pbKey, {
            id: generateStrengthId(),
            exerciseId: exercise.id,
            exerciseName: exercise.name,
            userId: ctx.userId,
            type: '1rm',
            value: estimated1RM,
            weight: set.weight,
            reps: set.reps,
            isBodyweight: isBW,
            extraWeight: set.extraWeight,
            date: ctx.currentWorkout!.date,
            workoutId: ctx.currentWorkout!.id,
            workoutName: ctx.currentWorkout!.name,
            estimated1RM,
            createdAt: new Date().toISOString(),
            previousBest: existing?.value
        });
    }
}


// ----------------------------------------------------------------------
// Hevy / Generic Format Parser
// ----------------------------------------------------------------------

function parseHevyLogFormat(lines: string[], userId: string): ParsedCSV {
    // Header: "title","start_time","end_time","description","exercise_title","superset_id","exercise_notes","set_index","set_type","weight_kg","reps","distance_km","duration_seconds","rpe"

    // Helper to strip quotes
    const stripQuotes = (s: string) => {
        if (s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1);
        return s;
    };

    const header = parseCSVLine(lines[0]).map(h => stripQuotes(h).trim());
    const getIdx = (col: string) => header.indexOf(col);

    const idx = {
        title: getIdx('title'),
        start_time: getIdx('start_time'),
        end_time: getIdx('end_time'),
        exercise_title: getIdx('exercise_title'),
        weight_kg: getIdx('weight_kg'),
        reps: getIdx('reps'),
        distance_km: getIdx('distance_km'),
        duration_seconds: getIdx('duration_seconds'),
        rpe: getIdx('rpe'),
        exercise_notes: getIdx('exercise_notes'),
        set_type: getIdx('set_type')
    };

    const ctx: ParserContext = {
        userId,
        currentWorkout: null,
        currentExercise: null,
        exercises: new Map(),
        workouts: [],
        personalBests: new Map(),
        errors: []
    };

    const workoutMap = new Map<string, StrengthWorkout>();

    // Skip header
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;

        try {
            const vals = parseCSVLine(line);
            const val = (index: number) => {
                const v = vals[index];
                return v ? stripQuotes(v) : '';
            };

            // 1. Identify Workout Group
            const workoutName = val(idx.title) || 'Unknown Workout';
            const startTimeStr = val(idx.start_time); // "7 Jan 2026, 19:21"

            // Parse Date: "7 Jan 2026, 19:21"
            // JS Date constructor handles "7 Jan 2026 19:21" well usually, but removing comma helps
            const dateParams = startTimeStr.replace(',', '');
            const startDate = new Date(dateParams);

            if (isNaN(startDate.getTime())) {
                // If standard parse failed, fallback or skip
                // Try simple manual parse if needed, but standard should work for "7 Jan 2026 19:21"
                console.warn(`Invalid date: ${startTimeStr}`);
                continue;
            }

            const dateStr = startDate.toISOString().split('T')[0];
            const workoutIdKey = `${startTimeStr}-${workoutName}`;

            let workout = workoutMap.get(workoutIdKey);
            if (!workout) {
                workout = {
                    id: generateStrengthId(),
                    userId,
                    date: dateStr,
                    name: workoutName,
                    source: 'hevy',
                    exercises: [],
                    totalVolume: 0,
                    totalSets: 0,
                    totalReps: 0,
                    uniqueExercises: 0,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                };
                workoutMap.set(workoutIdKey, workout);
            }

            // Ensure workout is defined for TS
            if (!workout) continue;

            // 2. Process Exercise
            const exerciseName = val(idx.exercise_title);
            if (!exerciseName) continue;

            const normalizedName = normalizeExerciseName(exerciseName);
            if (!ctx.exercises.has(normalizedName)) {
                ctx.exercises.set(normalizedName, {
                    id: `ex-${normalizedName.replace(/\s/g, '-')}`,
                    name: exerciseName,
                    normalizedName,
                    category: guessExerciseCategory(exerciseName),
                    primaryMuscle: 'full_body',
                    isCompound: guessIsCompound(exerciseName)
                });
            }
            const exerciseDef = ctx.exercises.get(normalizedName)!;

            // Find or create Exercise Group
            // In Hevy export, sets are usually sequential rows.
            // We check the last exercise added. If it matches, we append.
            // If not, we check if it exists (for supersets mixed rows?) -- Hevy export usually groups sets?
            // Actually Hevy export is flat row per set.
            // If the row order is strictly chronological per set, we can just look at the last exercise in the array.

            let workoutExercise = workout.exercises.length > 0 ? workout.exercises[workout.exercises.length - 1] : undefined;

            // If the last exercise isn't this one, we create a new group.
            // Note: This logic splits split-sets (A1, B1, A2, B2). 
            // If we want to group all Squats together even if interleaved, we should search by ID using find().
            // BUT, strictly preserving order of execution (A1, B1...) is often preferred for logs.
            // However, our data model `StrengthWorkout` usually groups by exercise.
            // Let's group by exercise ID to keep the model clean.

            workoutExercise = workout.exercises.find(we => we.exerciseId === exerciseDef.id);
            if (!workoutExercise) {
                workoutExercise = {
                    exerciseId: exerciseDef.id,
                    exerciseName: exerciseName,
                    sets: []
                };
                workout.exercises.push(workoutExercise);
            }

            // 3. Process Set
            const weightVal = parseFloat(val(idx.weight_kg)) || 0;
            const repsVal = parseInt(val(idx.reps)) || 0;
            const distKmVal = parseFloat(val(idx.distance_km)) || 0;
            const durationSecVal = parseInt(val(idx.duration_seconds)) || 0;
            const rpeVal = parseFloat(val(idx.rpe));

            const set: StrengthSet = {
                setNumber: workoutExercise.sets.length + 1,
                reps: repsVal,
                weight: weightVal,
                rpe: !isNaN(rpeVal) ? rpeVal : undefined
            };

            // Hevy specific: 'set_type' (normal, warmup, failure, drop)
            const setType = val(idx.set_type).toLowerCase();
            if (setType === 'warmup') set.isWarmup = true;
            // if (setType === 'failure') ...
            // if (setType === 'drop') ...

            if (distKmVal > 0) {
                set.distance = distKmVal * 1000;
                set.distanceUnit = 'm';
            }
            if (durationSecVal > 0) {
                set.timeSeconds = durationSecVal;
                // Format time string if needed, or leave optional
            }

            workoutExercise.sets.push(set);

            // 4. Update PBs
            ctx.currentWorkout = workout;
            trackPersonalBest(ctx, exerciseDef, set);

        } catch (e) {
            ctx.errors.push(`Row ${i}: ${e}`);
        }
    }

    // Finalize
    for (const workout of workoutMap.values()) {
        ctx.currentWorkout = workout;
        finalizeWorkout(ctx);
    }

    return {
        userInfo: { name: 'User', email: '' },
        workouts: ctx.workouts,
        exercises: ctx.exercises,
        personalBests: Array.from(ctx.personalBests.values())
    };
}

// ============================================
// Utility Functions
// ============================================

function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());

    return result;
}

function isDateString(str: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(str);
}

function guessExerciseCategory(name: string): ExerciseCategory {
    const lower = name.toLowerCase();

    if (lower.includes('barbell') || lower.includes('deadlift') || lower.includes('squat') ||
        lower.includes('bench press') || lower.includes('overhead press')) {
        return 'barbell';
    }
    if (lower.includes('dumbbell')) return 'dumbbell';
    if (lower.includes('machine') || lower.includes('leg press') || lower.includes('lat pulldown') ||
        lower.includes('leg extension') || lower.includes('leg curl')) {
        return 'machine';
    }
    if (lower.includes('cable') || lower.includes('pushdown') || lower.includes('fly')) return 'cable';
    if (lower.includes('kettlebell')) return 'kettlebell';
    if (lower.includes('push-up') || lower.includes('pull-up') || lower.includes('dip') ||
        lower.includes('burpee') || lower.includes('lunge')) {
        return 'bodyweight';
    }
    if (lower.includes('rowing') || lower.includes('bike') || lower.includes('run')) return 'cardio';

    return 'other';
}

function guessIsCompound(name: string): boolean {
    const compounds = ['squat', 'deadlift', 'bench press', 'overhead press', 'row', 'pull-up',
        'chin-up', 'dip', 'lunge', 'press', 'clean', 'snatch'];
    const lower = name.toLowerCase();
    return compounds.some(c => lower.includes(c));
}
