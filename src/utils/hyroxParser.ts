import { HyroxStation, ExerciseEntry, StrengthWorkout, ExerciseDefinition, StrengthSet, HyroxStationEvent, HyroxSessionSummary } from '../models/types.ts';
import { findExerciseMatch } from './exerciseMapper.ts';

export const HYROX_STATIONS_ORDER: HyroxStation[] = [
    'ski_erg',
    'sled_push',
    'sled_pull',
    'burpee_broad_jumps',
    'rowing',
    'farmers_carry',
    'sandbag_lunges',
    'wall_balls'
];

interface ParsedHyroxData {
    runSplits: number[];
    stations: Partial<Record<HyroxStation, number>>;
    stationDistances?: Partial<Record<HyroxStation, number>>; // In meters
}

// Convert "05:31" or "5:31" to seconds
const parseTime = (timeStr: string): number | null => {
    if (!timeStr) return null;
    const parts = timeStr.split(':');
    if (parts.length === 2) {
        return (parseInt(parts[0]) * 60) + parseInt(parts[1]);
    }
    const num = parseInt(timeStr);
    return isNaN(num) ? null : num;
};

// Moving these to be accessible in all functions
const STATION_MAPPING: Record<HyroxStation, string[]> = {
    'ski_erg': ['ski_erg', 'skierg', 'skiing', 'ski', 'stakmaskin', 'skidmaskin', 'concept2ski'],
    'sled_push': ['sled_push', 'sled', 'släde push', 'prowler'],
    'sled_pull': ['sled_pull', 'sled rope pull', 'släde pull'],
    'burpee_broad_jumps': ['burpee_broad_jump', 'burpee_broad_jumps', 'bbj'],
    'rowing': ['rowing_machine', 'rowing', 'roder', 'rodd'],
    'farmers_carry': ['farmers_walk', 'farmers_carry', 'farmer walk'],
    'sandbag_lunges': ['sandbag_lunge', 'sandbag_lunges', 'walking lunges', 'utfallsgång'],
    'wall_balls': ['wall_ball', 'wall_balls', 'wallballs'],
    'run_1km': ['running', 'treadmill']
};


export const parseHyroxText = (text: string): ParsedHyroxData => {
    const lines = text.split('\n');
    const runSplits: number[] = new Array(8).fill(0);
    const stations: Partial<Record<HyroxStation, number>> = {};

    // Regex Patterns
    const runRegex = /R(\d+).*?(\d{1,2}:\d{2})/i; // Matches R1: 05:31
    const runWordRegex = /Run\s*(\d+).*?(\d{1,2}:\d{2})/i;

    // Station Regexes - map varying names to keys
    const stationMap: Record<string, HyroxStation> = {
        'ski': 'ski_erg', 'skierg': 'ski_erg',
        'push': 'sled_push', 'sled push': 'sled_push',
        'pull': 'sled_pull', 'sled pull': 'sled_pull',
        'burpee': 'burpee_broad_jumps', 'bbj': 'burpee_broad_jumps', 'broad': 'burpee_broad_jumps',
        'row': 'rowing', 'rower': 'rowing', 'rowing': 'rowing',
        'farmer': 'farmers_carry', 'farmers': 'farmers_carry', 'carry': 'farmers_carry',
        'lunge': 'sandbag_lunges', 'lunges': 'sandbag_lunges', 'sandbag': 'sandbag_lunges',
        'wall': 'wall_balls', 'balls': 'wall_balls', 'wallballs': 'wall_balls'
    };

    // Generic S-regex: S1 (SkiErg): 03:58
    const sRegex = /S(\d+).*?(\d{1,2}:\d{2})/i;

    const stationsDistances: Partial<Record<HyroxStation, number>> = {};

    lines.forEach(line => {
        const cleanLine = line.trim();
        if (!cleanLine) return;

        // 1. Try match Runs
        let match = cleanLine.match(runRegex) || cleanLine.match(runWordRegex);
        if (match) {
            const index = parseInt(match[1]) - 1;
            const time = parseTime(match[2]);
            if (index >= 0 && index < 8 && time !== null) {
                runSplits[index] = time;
                return;
            }
        }

        // 2. Try match indexed Stations (S1, S2...)
        match = cleanLine.match(sRegex);
        if (match) {
            const index = parseInt(match[1]) - 1;
            const time = parseTime(match[2]);
            if (index >= 0 && index < 8 && time !== null) {
                stations[HYROX_STATIONS_ORDER[index]] = time;
                return;
            }
        }

        // 3. Try match named stations (Wall Balls: 07:11)
        // SUPPORT FLEXIBLE DISTANCES: e.g. "Sled 25m: 01:10"
        const distMatch = cleanLine.match(/(\d+)\s*(m|km)/i);
        const timeMatch = cleanLine.match(/(\d{1,2}:\d{2})/);

        if (timeMatch) {
            const lower = cleanLine.toLowerCase();
            for (const [key, stationId] of Object.entries(stationMap)) {
                if (lower.includes(key)) {
                    const time = parseTime(timeMatch[1]);
                    if (time !== null) {
                        stations[stationId] = time;

                        // Extract distance if present
                        if (distMatch) {
                            const val = parseInt(distMatch[1]);
                            const unit = distMatch[2].toLowerCase();
                            const distMeters = unit === 'km' ? val * 1000 : val;
                            stationsDistances[stationId] = distMeters;
                        }
                    }
                    break;
                }
            }
        }
    });

    return { runSplits, stations, stationDistances: stationsDistances };
};


export interface HyroxStationStats {
    times: number[];
    totalSets: number;
    totalReps: number;
    totalTonnage: number;
    totalDistance: number;
    bestWeightedDistance?: number; // weight × distance for sled exercises
    lastDate?: string;
    sessions: Set<string>; // Dates of sessions
    history: HyroxStationEvent[];
}

export const parseHyroxStats = (exercises: ExerciseEntry[], strength: StrengthWorkout[], exerciseDB: ExerciseDefinition[]): Record<HyroxStation, HyroxStationStats> => {
    const stats: Record<HyroxStation, HyroxStationStats> = {
        ski_erg: { times: [], totalSets: 0, totalReps: 0, totalTonnage: 0, totalDistance: 0, sessions: new Set(), history: [] },
        sled_push: { times: [], totalSets: 0, totalReps: 0, totalTonnage: 0, totalDistance: 0, sessions: new Set(), history: [] },
        sled_pull: { times: [], totalSets: 0, totalReps: 0, totalTonnage: 0, totalDistance: 0, sessions: new Set(), history: [] },
        burpee_broad_jumps: { times: [], totalSets: 0, totalReps: 0, totalTonnage: 0, totalDistance: 0, sessions: new Set(), history: [] },
        rowing: { times: [], totalSets: 0, totalReps: 0, totalTonnage: 0, totalDistance: 0, sessions: new Set(), history: [] },
        farmers_carry: { times: [], totalSets: 0, totalReps: 0, totalTonnage: 0, totalDistance: 0, sessions: new Set(), history: [] },
        sandbag_lunges: { times: [], totalSets: 0, totalReps: 0, totalTonnage: 0, totalDistance: 0, sessions: new Set(), history: [] },
        wall_balls: { times: [], totalSets: 0, totalReps: 0, totalTonnage: 0, totalDistance: 0, sessions: new Set(), history: [] },
        run_1km: { times: [], totalSets: 0, totalReps: 0, totalTonnage: 0, totalDistance: 0, sessions: new Set(), history: [] }
    };

    // 1. Add data from dedicated Hyrox activities (simulations)
    exercises.forEach(entry => {
        if (entry.hyroxStats && entry.hyroxStats.stations) {
            Object.entries(entry.hyroxStats.stations).forEach(([key, value]) => {
                const k = key as HyroxStation;
                if (typeof value === 'number' && stats[k]) {
                    stats[k].times.push(value);
                    stats[k].sessions.add(entry.date.split('T')[0]);
                    stats[k].totalSets += 1;
                    stats[k].history.push({
                        date: entry.date,
                        type: 'simulation',
                        timeSeconds: value
                    });
                }
            });
        }
    });

    strength.forEach(session => {
        (session.exercises || []).forEach(exercise => {
            // Use the unified mapper to find what exercise this is in our database
            const match = findExerciseMatch(exercise.exerciseName, exerciseDB);
            let matchedId = match?.exercise?.id || '';

            // FALLBACK: If no database match, check raw name against station mapping directly
            if (!match) {
                const normalizedName = exercise.exerciseName.toLowerCase().replace(/[^a-zåäö0-9]/g, '');
                for (const [stationId, ids] of Object.entries(STATION_MAPPING)) {
                    if (ids.some(id => normalizedName.includes(id) || id.includes(normalizedName))) {
                        matchedId = stationId; // Use the station ID itself as the matched ID
                        break;
                    }
                }
            }

            if (!matchedId) return;

            // Check if this matched exercise belongs to any Hyrox station
            for (const [stationId, ids] of Object.entries(STATION_MAPPING)) {
                if (ids.includes(matchedId) || ids.some(id => matchedId.includes(id)) || stationId === matchedId) {
                    const st = stats[stationId as HyroxStation];
                    const dateKey = session.date.split('T')[0];
                    st.sessions.add(dateKey);

                    st.totalSets += (exercise.sets || []).length;

                    const event: HyroxStationEvent = {
                        date: session.date,
                        type: 'strength',
                        sets: exercise.sets,
                        notes: exercise.notes,
                        reps: 0,
                        weight: 0,
                        distance: 0
                    };

                    (exercise.sets || []).forEach(set => {
                        event.reps = (event.reps || 0) + (set.reps || 0);
                        event.weight = Math.max(event.weight || 0, set.weight || 0);
                        st.totalReps += set.reps || 0;
                        st.totalTonnage += (set.reps || 0) * (set.weight || 0);

                        // Capture distance (especially for Sled Push/Pull)
                        if (set.distance) {
                            st.totalDistance += set.distance;
                            event.distance = (event.distance || 0) + set.distance;
                        } else if (set.reps && ids.some(id => id.includes('sled') || id.includes('lunge') || id.includes('carry'))) {
                            // HEURISTIC: Sometimes meters are logged as reps in external apps (e.g. 20 reps for 20m)
                            if (set.reps >= 10 && set.reps <= 100) {
                                st.totalDistance += set.reps;
                                event.distance = (event.distance || 0) + set.reps;
                            }
                        }

                        // Extract time from notes or set data if possible
                        if (set.timeSeconds) {
                            st.times.push(set.timeSeconds);
                            if (!event.timeSeconds || set.timeSeconds < event.timeSeconds) {
                                event.timeSeconds = set.timeSeconds;
                            }
                        }
                    });

                    // Calculate weighted distance for sled-type exercises (weight × distance PB)
                    if (stationId === 'sled_push' || stationId === 'sled_pull' || stationId === 'farmers_carry' || stationId === 'sandbag_lunges') {
                        const weightedDistance = (event.weight || 0) * (event.distance || 0);
                        if (weightedDistance > 0) {
                            st.bestWeightedDistance = Math.max(st.bestWeightedDistance || 0, weightedDistance);
                        }
                    }

                    st.history.push(event);

                    // Update last date
                    if (!st.lastDate || dateKey > st.lastDate) {
                        st.lastDate = dateKey;
                    }

                    // Fallback: Extract time from notes if possible, e.g. "Tid: 02:45" or "2:45"
                    const timeMatch = (exercise.notes || "").match(/(\d{1,2}:\d{2})/);
                    if (timeMatch) {
                        const time = parseTime(timeMatch[1]);
                        if (time !== null) {
                            st.times.push(time);
                        }
                    }
                    break;
                }
            }
        });
    });

    // 3. Sort history and update last date and final tonnage
    Object.values(stats).forEach(st => {
        st.history.sort((a, b) => b.date.localeCompare(a.date));
        if (st.history.length > 0) {
            st.lastDate = st.history[0].date.split('T')[0];
        }
    });

    return stats;
};

/**
 * Extracts a flat list of all sessions containing any Hyrox activity
 */
export const parseHyroxHistory = (exercises: ExerciseEntry[], strength: StrengthWorkout[], exerciseDB: ExerciseDefinition[]): HyroxSessionSummary[] => {
    const history: HyroxSessionSummary[] = [];
    const processedIds = new Set<string>();

    // Unified Processing: Process everything in the master list (exercises)
    exercises.forEach(ex => {
        const isExplicitRace = ex.subType === 'race' || ex.subType === 'competition' || ex.subType === 'simulation' || ex.subType === 'simulering';
        const hStats = (ex as any).hyroxStats || { stations: {}, runSplits: [] };
        const stationsFromStats = Object.keys(hStats.stations || {}) as HyroxStation[];
        const hasRuns = hStats.runSplits?.some((r: number) => r > 0);

        // Detect stations and times from strength names if it's a strength activity or merged
        const detectedStations: Set<HyroxStation> = new Set(stationsFromStats);
        const sessionSplits: Partial<Record<HyroxStation, number>> = { ...hStats.stations };
        const sessionRunSplits: number[] = hStats.runSplits?.length > 0 ? [...hStats.runSplits] : [];
        let tonnage = 0;

        // Check for underlying strength data (either mapped or merged)
        const mergeData = (ex as any)._mergeData;
        const sw = mergeData?.strengthWorkout || (ex.source === 'strength' ? strength.find(s => s.id === ex.id) : null);

        if (sw) {
            (sw.exercises || []).forEach((e: any) => {
                const match = findExerciseMatch(e.exerciseName, exerciseDB);
                if (match) {
                    const matchedId = match.exercise.id;
                    for (const [stationId, ids] of Object.entries(STATION_MAPPING)) {
                        if (ids.includes(matchedId) || ids.some(id => matchedId.includes(id))) {
                            const sid = stationId as HyroxStation;
                            detectedStations.add(sid);

                            let exerciseTime = 0;
                            (e.sets || []).forEach((set: any) => {
                                tonnage += (set.reps || 0) * (set.weight || 0);
                                if (set.timeSeconds && !exerciseTime) {
                                    exerciseTime = set.timeSeconds;
                                }
                            });

                            // Fallback: Extract time from exercise notes if still missing
                            if (!exerciseTime && e.notes) {
                                const timeMatch = e.notes.match(/(\d{1,2}:\d{2})/);
                                if (timeMatch) {
                                    const time = parseTime(timeMatch[1]);
                                    if (time !== null) exerciseTime = time;
                                }
                            }

                            if (exerciseTime > 0) {
                                if (sid === 'run_1km') {
                                    // If we are filling from strength, and runSplits is empty or looks like we are building it
                                    if (hStats.runSplits?.length === 0 || sessionRunSplits.length < 8) {
                                        sessionRunSplits.push(exerciseTime);
                                    }
                                } else if (!sessionSplits[sid]) {
                                    sessionSplits[sid] = exerciseTime;
                                }
                            }
                            break;
                        }
                    }
                }
            });
        }

        const stations = Array.from(detectedStations);
        const functionalStations = stations.filter(s => s !== 'run_1km');

        // ONLY include if it's explicitly a Hyrox type OR has functional Hyrox stations
        // Stiffer check: if it's just 'running' it shouldn't be hyroxRelated unless it has non-run stations
        const hasHyroxMetadata = ex.type === 'hyrox' || (ex as any).hyroxStats?.stations || (ex as any).hyroxStats?.runSplits?.length > 0;
        const isHyroxRelated = hasHyroxMetadata || functionalStations.length > 0;

        if (isHyroxRelated && (stations.length > 0 || hasRuns || isExplicitRace)) {
            // A Race has most stations OR is explicitly marked as race/competition
            const isRace = isExplicitRace || functionalStations.length >= 7;

            // LAST RESORT: Try parsing RX/SX patterns from notes if data is missing
            if (ex.notes && (Object.keys(sessionSplits).length < 2 || sessionRunSplits.length < 2)) {
                const noteLines = ex.notes.split('\n');
                const stationSequence: HyroxStation[] = [
                    'ski_erg', 'sled_push', 'sled_pull', 'burpee_broad_jumps',
                    'rowing', 'farmers_carry', 'sandbag_lunges', 'wall_balls'
                ];

                noteLines.forEach(line => {
                    // Match Run patterns: R1: 05:31 or R1: 5:31
                    const runMatch = line.match(/[Rr](\d)[:. ]*(\d{1,2}[:.]\d{2})/);
                    if (runMatch) {
                        const runIdx = parseInt(runMatch[1]) - 1;
                        const time = parseTime(runMatch[2]);
                        if (time !== null && runIdx >= 0 && runIdx < 8) {
                            if (!sessionRunSplits[runIdx]) sessionRunSplits[runIdx] = time;
                            if (!detectedStations.has('run_1km')) detectedStations.add('run_1km');
                        }
                    }

                    // Match Station patterns: S1: 03:58 or S1 (SkiErg): 03:58
                    const stationMatch = line.match(/[Ss](\d).*?[:. ]*(\d{1,2}[:.]\d{2})/);
                    if (stationMatch) {
                        const stationIdx = parseInt(stationMatch[1]) - 1;
                        const time = parseTime(stationMatch[2]);
                        if (time !== null && stationIdx >= 0 && stationIdx < 8) {
                            const sid = stationSequence[stationIdx];
                            if (!sessionSplits[sid]) sessionSplits[sid] = time;
                            if (!detectedStations.has(sid)) detectedStations.add(sid);
                        }
                    }
                });
            }

            history.push({
                id: ex.id,
                date: ex.date,
                name: ex.title || (isRace ? 'Hyrox Race' : 'Hyrox Simulation'),
                type: (ex.type === 'hyrox' || isRace) ? 'simulation' : 'strength',
                stations,
                isRace,
                isWorkout: !isRace,
                totalDuration: ex.durationMinutes,
                totalTonnage: tonnage > 0 ? tonnage : undefined,
                notes: ex.notes,
                splits: sessionSplits,
                runSplits: sessionRunSplits,
                stationDistances: hStats.stationDistances
            });
            processedIds.add(ex.id);
        }
    });

    // 2. Fallback for raw strength sessions not in the master list
    strength.forEach(session => {
        if (processedIds.has(session.id)) return;

        const matchingStations: Set<HyroxStation> = new Set();
        const sessionSplits: Partial<Record<HyroxStation, number>> = {};
        const sessionRunSplits: number[] = [];
        let sessionTonnage = 0;

        (session.exercises || []).forEach(exercise => {
            const match = findExerciseMatch(exercise.exerciseName, exerciseDB);
            if (!match) return;

            const matchedId = match.exercise.id;
            for (const [stationId, ids] of Object.entries(STATION_MAPPING)) {
                if (ids.includes(matchedId) || ids.some(id => matchedId.includes(id))) {
                    const sid = stationId as HyroxStation;
                    matchingStations.add(sid);

                    let exerciseTime = 0;
                    (exercise.sets || []).forEach(set => {
                        sessionTonnage += (set.reps || 0) * (set.weight || 0);
                        if (set.timeSeconds && !exerciseTime) {
                            exerciseTime = set.timeSeconds;
                        }
                    });

                    // Fallback: Extract time from exercise notes
                    if (!exerciseTime && exercise.notes) {
                        const timeMatch = exercise.notes.match(/(\d{1,2}:\d{2})/);
                        if (timeMatch) {
                            const time = parseTime(timeMatch[1]);
                            if (time !== null) exerciseTime = time;
                        }
                    }

                    if (exerciseTime > 0) {
                        if (sid === 'run_1km') {
                            if (sessionRunSplits.length < 8) sessionRunSplits.push(exerciseTime);
                        } else if (!sessionSplits[sid]) {
                            sessionSplits[sid] = exerciseTime;
                        }
                    }
                    break;
                }
            }
        });

        if (matchingStations.size > 0) {
            const functionalStations = Array.from(matchingStations).filter(s => s !== 'run_1km');
            const isRace = functionalStations.length >= 7;

            history.push({
                id: session.id,
                date: session.date,
                name: session.name || (isRace ? 'Hyrox Race' : 'Hyrox Simulation'),
                type: isRace ? 'simulation' : 'strength',
                stations: Array.from(matchingStations),
                isRace,
                isWorkout: !isRace,
                totalDuration: session.duration || 60,
                totalTonnage: sessionTonnage > 0 ? sessionTonnage : undefined,
                notes: session.notes,
                splits: sessionSplits,
                runSplits: sessionRunSplits
            });
        }
    });

    return history.sort((a, b) => b.date.localeCompare(a.date));
};
