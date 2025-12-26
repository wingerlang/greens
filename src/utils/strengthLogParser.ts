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
    normalizeExerciseName,
    parseTimeToSeconds,
    calculate1RM,
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
        workouts: context.workouts,
        exercises: context.exercises,
        personalBests: Array.from(context.personalBests.values())
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
                // Rowing pace, skip for now
                break;
        }
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
    if (set.reps <= 0) return;

    const isBW = !!set.isBodyweight;
    const calcWeight = isBW ? (set.extraWeight || 0) : set.weight;

    if (calcWeight <= 0 && !isBW) return;

    const estimated1RM = calculate1RM(calcWeight, set.reps);
    const pbKey = `${exercise.id}-1rm`;

    const existing = ctx.personalBests.get(pbKey);
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
