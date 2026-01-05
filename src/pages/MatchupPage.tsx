import React, { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext.tsx';
import {
    Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
    LineChart, Line, CartesianGrid
} from 'recharts';
import { Search, Trophy, TrendingUp, Users, Target, Zap, ArrowRight, ChevronDown, ChevronRight, Scale, Sparkles, LayoutPanelLeft, Calendar, Timer, Dumbbell, User as UserIcon, HelpCircle } from 'lucide-react';
import { calculateWilks, calculateIPFPoints, calculateEstimated1RM } from '../utils/strengthCalculators.ts';
import './MatchupPage.css';

const MAIN_EXERCISES = [
    { id: 'squat', name: 'Knäböj', patterns: ['knäböj', 'squat', 'böj'] },
    { id: 'bench', name: 'Bänkpress', patterns: ['bänkpress', 'bench', 'bänk'] },
    { id: 'deadlift', name: 'Marklyft', patterns: ['marklyft', 'deadlift', 'mark'] },
    { id: 'overhead', name: 'Militärpress', patterns: ['militärpress', 'overhead', 'axlar'] },
    { id: 'pullups', name: 'Chins', patterns: ['chins', 'pullups', 'pull-ups'] },
];

type TimeRange = 'ALL' | '2025' | '6m' | '3m' | '7d';

export function MatchupPage() {
    const { users, currentUser, strengthSessions: mySessions, weightEntries: myWeightEntries } = useData();

    // --- Selection State ---
    const [userAId, setUserAId] = useState<string>(currentUser?.id || '');
    const [userBId, setUserBId] = useState<string>(users.find(u => u.id !== currentUser?.id)?.id || '');

    const [viewMode, setViewMode] = useState<'raw' | 'relative' | 'fair'>('raw');
    const [statsMode, setStatsMode] = useState<'raw' | 'bw' | 'points'>('raw');
    const [timeRange, setTimeRange] = useState<TimeRange>('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [userBSearch, setUserBSearch] = useState('');
    const [isSearchingB, setIsSearchingB] = useState(false);


    // Progression comparison date range
    const [progressionFromDate, setProgressionFromDate] = useState<string>('2025-01-01');
    const [progressionToDate, setProgressionToDate] = useState<string>(new Date().toISOString().split('T')[0]);

    // 1RM vs e1RM toggle
    const [rmMode, setRmMode] = useState<'actual' | 'estimated'>('actual');

    // HEAD-TO-HEAD sort and filter
    type H2HSortMode = 'alpha' | 'diff' | 'a-wins' | 'b-wins' | 'sessions';
    const [h2hSort, setH2HSort] = useState<H2HSortMode>('alpha');
    const [h2hFilter, setH2HFilter] = useState<'all' | 'a-wins' | 'b-wins' | 'tie'>('all');

    // --- Sync default users once loaded ---
    useEffect(() => {
        if (!userAId && currentUser?.id) {
            setUserAId(currentUser.id);
        }
        if (!userBId && users.length > 0) {
            const defaultB = users.find(u => u.id !== currentUser?.id)?.id;
            if (defaultB) setUserBId(defaultB);
        }
    }, [users, currentUser, userAId, userBId]);


    // --- Resolved Users ---
    const userA = useMemo(() => users.find(u => u.id === userAId), [users, userAId]);
    const userB = useMemo(() => users.find(u => u.id === userBId), [users, userBId]);

    // --- Data Fetching ---
    const [sessionsA, setSessionsA] = useState<any[]>([]);
    const [sessionsB, setSessionsB] = useState<any[]>([]);
    const [prsA, setPrsA] = useState<any[]>([]);
    const [prsB, setPrsB] = useState<any[]>([]);
    const [extraA, setExtraA] = useState<any>(null);
    const [extraB, setExtraB] = useState<any>(null);
    const [loading, setLoading] = useState(false);


    // Fetch Helper
    const fetchSessions = async (uid: string) => {
        // Use local cache for me, but only if it's actually loaded
        if (uid === currentUser?.id && mySessions && mySessions.length > 0) return mySessions;

        const token = localStorage.getItem('auth_token');
        try {
            const res = await fetch(`/api/strength/workouts?userId=${uid}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            return data.workouts || [];
        } catch (e) {
            console.error("Failed to fetch workouts for", uid, e);
            return [];
        }
    };


    // Extra Data Fetcher (Sleep, weight history etc)
    const fetchExtra = async (uid: string) => {
        if (uid === currentUser?.id) {
            // Re-fetch to ensure we have sleepSessions which might not be in useData?
            // Actually useData should have it, but for B we MUST fetch.
        }
        const token = localStorage.getItem('auth_token');
        try {
            const res = await fetch(`/api/data?userId=${uid}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return await res.json();
        } catch (e) {
            console.error("Failed to fetch extra data for", uid);
            return {};
        }
    };

    const fetchPrs = async (uid: string) => {
        const token = localStorage.getItem('auth_token');
        try {
            const res = await fetch(`/api/user/prs?userId=${uid}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            return data.prs || [];
        } catch (e) {
            console.error("Failed to fetch PRs for", uid);
            return [];
        }
    };

    // Load Data Effect
    useEffect(() => {
        const load = async () => {
            setLoading(true);
            const token = localStorage.getItem('auth_token');
            const [dataA, dataB, prA, prB, extA, extB] = await Promise.all([
                fetchSessions(userAId),
                fetchSessions(userBId),
                fetchPrs(userAId),
                fetchPrs(userBId),
                fetchExtra(userAId),
                fetchExtra(userBId),
                // Trigger PR detection on the fly
                fetch(`/api/user/prs/detect?userId=${userAId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`/api/user/prs/detect?userId=${userBId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
            ]);
            setSessionsA(dataA);
            setSessionsB(dataB);
            setPrsA(prA);
            setPrsB(prB);
            setExtraA(extA);
            setExtraB(extB);
            setLoading(false);
        };
        if (userAId && userBId) load();
    }, [userAId, userBId, currentUser, mySessions]);


    // --- Time Filter Logic ---
    const filterDate = useMemo(() => {
        const now = new Date();
        if (timeRange === '2025') return new Date('2025-01-01');
        if (timeRange === '7d') { const d = new Date(); d.setDate(now.getDate() - 7); return d; }
        if (timeRange === '3m') { const d = new Date(); d.setMonth(now.getMonth() - 3); return d; }
        if (timeRange === '6m') { const d = new Date(); d.setMonth(now.getMonth() - 6); return d; }
        return new Date('2000-01-01'); // ALL
    }, [timeRange]);

    const filteredSessionsA = useMemo(() => sessionsA.filter(s => new Date(s.date) >= filterDate), [sessionsA, filterDate]);
    const filteredSessionsB = useMemo(() => sessionsB.filter(s => new Date(s.date) >= filterDate), [sessionsB, filterDate]);

    // --- 1RM Helper ---
    // Conservative 1RM estimation - prefers lower rep sets as they're more reliable
    const getExerciseStats = (sessions: any[], patterns: string[]) => {
        let max1RM = 0;
        let totalVolume = 0;
        let totalReps = 0;
        let totalSets = 0;
        let count = 0;
        let bestSet: any = null;
        let bestSetReps = 999; // Track reps of best set - prefer lower reps

        // Custom conservative 1RM estimation - caps at 8 reps for more reliable estimates
        const conservative1RM = (weight: number, reps: number) => {
            if (reps === 0 || weight === 0) return 0;
            if (reps === 1) return weight;
            // Cap at 8 reps - high rep sets are unreliable for 1RM estimation
            const effectiveReps = Math.min(reps, 8);
            return weight * (1 + effectiveReps / 30);
        };

        sessions.forEach(session => {
            let foundInSession = false;
            if (!session.exercises) return;

            session.exercises.forEach((ex: any) => {
                const name = ex.name || ex.exerciseName;
                if (name && patterns.some(p => name.toLowerCase().includes(p))) {
                    foundInSession = true;
                    if (ex.sets && Array.isArray(ex.sets)) {
                        ex.sets.forEach((set: any) => {
                            const weight = Number(set.weight) || 0;
                            const reps = Number(set.reps) || 0;
                            if (weight === 0 || reps === 0) return;

                            const estimated = conservative1RM(weight, reps);

                            // Prefer this set if:
                            // 1. It has a higher 1RM estimate, OR
                            // 2. It has a similar 1RM (within 5%) but fewer reps (more reliable)
                            const shouldReplace = estimated > max1RM ||
                                (estimated >= max1RM * 0.95 && reps < bestSetReps);

                            if (shouldReplace) {
                                max1RM = estimated;
                                bestSetReps = reps;
                                bestSet = { weight, reps, date: session.date, sessionId: session.id, exerciseName: name };
                            }
                            totalVolume += weight * reps;
                            totalReps += reps;
                            totalSets++;
                        });
                    } else {
                        const weight = Number(ex.weight) || 0;
                        const reps = Number(ex.reps) || 0;
                        const sets = Number(ex.sets) || 1;
                        if (weight > 0 && reps > 0) {
                            const estimated = conservative1RM(weight, reps);
                            const shouldReplace = estimated > max1RM ||
                                (estimated >= max1RM * 0.95 && reps < bestSetReps);
                            if (shouldReplace) {
                                max1RM = estimated;
                                bestSetReps = reps;
                                bestSet = { weight, reps, date: session.date, sessionId: session.id, exerciseName: name };
                            }
                            totalVolume += weight * reps * sets;
                            totalReps += reps * sets;
                            totalSets += sets;
                        }
                    }
                }
            });
            if (foundInSession) count++;
        });

        return {
            max1RM: Math.round(max1RM),
            totalVolume: Math.round(totalVolume),
            totalReps,
            totalSets,
            count,
            bestSet
        };
    };

    const get1RM = (sessions: any[], patterns: string[]) => getExerciseStats(sessions, patterns).max1RM;

    // --- EXACT Match Exercise Stats (for Head-to-Head) ---
    const getExactExerciseStats = (sessions: any[], exactName: string) => {
        let heaviestWeight = 0; // Heaviest weight touched (any reps)
        let estimated1RM = 0; // Calculated from weight x reps formula
        let totalVolume = 0;
        let totalReps = 0;
        let totalSets = 0;
        let count = 0;
        let heaviestWeightSet: any = null; // Set with heaviest weight
        let estimatedBestSet: any = null; // Best estimated set
        let estimatedBestSetReps = 999;
        const normalizedTarget = exactName.toLowerCase().trim();

        const conservative1RM = (weight: number, reps: number) => {
            if (reps === 0 || weight === 0) return 0;
            if (reps === 1) return weight;
            const effectiveReps = Math.min(reps, 8);
            return weight * (1 + effectiveReps / 30);
        };

        sessions.forEach(session => {
            let foundInSession = false;
            if (!session.exercises) return;

            session.exercises.forEach((ex: any) => {
                const name = (ex.name || ex.exerciseName || '').toLowerCase().trim();
                // EXACT match only
                if (name === normalizedTarget) {
                    foundInSession = true;
                    if (ex.sets && Array.isArray(ex.sets)) {
                        ex.sets.forEach((set: any) => {
                            const weight = Number(set.weight) || 0;
                            const reps = Number(set.reps) || 0;
                            if (weight === 0 || reps === 0) return;

                            // Track heaviest weight touched (any rep count)
                            if (weight > heaviestWeight) {
                                heaviestWeight = weight;
                                heaviestWeightSet = { weight, reps, date: session.date, sessionId: session.id, exerciseName: ex.name || ex.exerciseName };
                            }

                            // Track estimated 1RM (prefer lower rep sets when close)
                            const estimated = conservative1RM(weight, reps);
                            const shouldReplace = estimated > estimated1RM || (estimated >= estimated1RM * 0.95 && reps < estimatedBestSetReps);
                            if (shouldReplace) {
                                estimated1RM = estimated;
                                estimatedBestSetReps = reps;
                                estimatedBestSet = { weight, reps, date: session.date, sessionId: session.id, exerciseName: ex.name || ex.exerciseName };
                            }

                            totalVolume += weight * reps;
                            totalReps += reps;
                            totalSets++;
                        });
                    }
                }
            });
            if (foundInSession) count++;
        });

        // Use rmMode to determine which to return as "max1RM"
        const useActual = rmMode === 'actual' && heaviestWeight > 0;

        return {
            max1RM: useActual ? Math.round(heaviestWeight) : Math.round(estimated1RM),
            actual1RM: Math.round(heaviestWeight), // Now "heaviest weight touched"
            estimated1RM: Math.round(estimated1RM),
            totalVolume: Math.round(totalVolume),
            totalReps,
            totalSets,
            count,
            bestSet: useActual ? heaviestWeightSet : estimatedBestSet,
            actualBestSet: heaviestWeightSet,
            estimatedBestSet
        };
    };


    // --- Shared Exercises (exercises BOTH users have done) ---
    const sharedExercises = useMemo(() => {
        const getExerciseNames = (sessions: any[]) => {
            const names = new Set<string>();
            sessions.forEach(s => {
                if (!s.exercises) return;
                s.exercises.forEach((ex: any) => {
                    const name = (ex.name || ex.exerciseName || '').trim();
                    if (name) names.add(name);
                });
            });
            return names;
        };

        const namesA = getExerciseNames(sessionsA);
        const namesB = getExerciseNames(sessionsB);

        // Find intersection
        const shared: string[] = [];
        namesA.forEach(name => {
            if (namesB.has(name)) shared.push(name);
        });

        // Sort alphabetically
        return shared.sort((a, b) => a.localeCompare(b, 'sv'));
    }, [sessionsA, sessionsB]);


    // --- Derived Stats (Power & Radar) ---
    const powerStats = useMemo(() => {
        const weightA = userA?.settings?.weight || (userAId === currentUser?.id ? (myWeightEntries[0]?.weight || 80) : 80);
        const weightB = userB?.settings?.weight || 85;

        const totalA = get1RM(sessionsA, ['squat']) + get1RM(sessionsA, ['bench']) + get1RM(sessionsA, ['deadlift']);
        const totalB = get1RM(sessionsB, ['squat']) + get1RM(sessionsB, ['bench']) + get1RM(sessionsB, ['deadlift']);

        const genderA = (userA?.settings?.gender === 'female' ? 'female' : 'male') as 'male' | 'female';
        const genderB = (userB?.settings?.gender === 'female' ? 'female' : 'male') as 'male' | 'female';

        let pointsA = 0;
        let pointsB = 0;

        if (viewMode === 'raw') {
            pointsA = totalA;
            pointsB = totalB;
        } else if (viewMode === 'relative') {
            pointsA = totalA / weightA;
            pointsB = totalB / weightB;
        } else {
            pointsA = calculateIPFPoints(weightA, totalA, genderA);
            pointsB = calculateIPFPoints(weightB, totalB, genderB);
        }

        return {
            totalA, totalB,
            pointsA: isNaN(pointsA) ? 0 : Math.round(pointsA * (viewMode === 'relative' ? 100 : 10)) / (viewMode === 'relative' ? 100 : 10),
            pointsB: isNaN(pointsB) ? 0 : Math.round(pointsB * (viewMode === 'relative' ? 100 : 10)) / (viewMode === 'relative' ? 100 : 10),
            weightA, weightB
        };
    }, [sessionsA, sessionsB, userA, userB, viewMode, currentUser?.id, myWeightEntries]);

    const radarData = useMemo(() => {
        return MAIN_EXERCISES.map(ex => {
            const valA = get1RM(sessionsA, ex.patterns);
            const valB = get1RM(sessionsB, ex.patterns);
            const max = Math.max(valA, valB, 1);
            return {
                subject: ex.name,
                A: Math.round((valA / max) * 100),
                B: Math.round((valB / max) * 100),
                fullMark: 100,
                rawA: valA,
                rawB: valB
            };
        });
    }, [sessionsA, sessionsB]);

    // --- Table Data Calculation ---
    const tableData = useMemo(() => {
        const calc = (sessions: any[]) => {
            const count = sessions.length || 1; // Avoid division by zero
            const totalCount = sessions.length;
            const time = sessions.reduce((sum, s) => sum + (s.durationMinutes || s.duration || 0), 0);
            let vol = 0;
            let reps = 0;
            let sets = 0;
            let exercises = 0;

            sessions.forEach(s => {
                let sessionVol = 0;
                let sessionReps = 0;
                let sessionSets = 0;
                let sessionEx = 0;

                if (s.exercises) {
                    sessionEx = s.exercises.length;
                    exercises += sessionEx;

                    s.exercises.forEach((e: any) => {
                        if (e.sets && Array.isArray(e.sets)) {
                            sessionSets += e.sets.length;
                            e.sets.forEach((set: any) => {
                                const w = Number(set.weight) || 0;
                                const r = Number(set.reps) || 0;
                                sessionVol += w * r;
                                sessionReps += r;
                            });
                        } else {
                            const w = Number(e.weight) || 0;
                            const r = Number(e.reps) || 0;
                            const st = Number(e.sets) || 1;
                            sessionVol += w * r * st;
                            sessionReps += r * st;
                            sessionSets += st;
                        }
                    });
                }
                vol += sessionVol;
                reps += sessionReps;
                sets += sessionSets;
            });

            return {
                count: totalCount,
                time,
                vol: isNaN(vol) ? 0 : vol,
                reps,
                sets,
                exercises,
                avgVol: vol / count,
                avgReps: reps / count,
                avgSets: sets / count,
                avgEx: exercises / count,
                avgTime: time / count
            };
        };


        const getAvgSleep = (extra: any) => {
            if (!extra || !extra.sleepSessions || extra.sleepSessions.length === 0) return 0;
            const sessions = extra.sleepSessions.filter((s: any) => new Date(s.date) >= filterDate);
            if (sessions.length === 0) return 0;
            const totalSec = sessions.reduce((sum: number, s: any) => sum + (s.durationSeconds || 0), 0);
            return (totalSec / sessions.length) / 3600; // in hours
        };

        const weightA = userA?.settings?.weight || (userAId === currentUser?.id ? (myWeightEntries[0]?.weight || 80) : 80);
        const weightB = userB?.settings?.weight || 85;
        const genderA = userA?.settings?.gender || 'male';
        const genderB = userB?.settings?.gender || 'male';

        const scale = (val: number, weight: number, gender: any, isVolume = false) => {
            if (statsMode === 'bw' && isVolume) return val / weight;
            if (statsMode === 'points' && isVolume) return calculateIPFPoints(weight, val, gender);
            return val;
        };

        const sleepA = getAvgSleep(extraA);
        const sleepB = getAvgSleep(extraB);

        const format = (val: number, isVolume = false, decimals = 0) => {
            if (statsMode === 'raw') {
                if (isVolume) return val.toLocaleString();
                return val.toFixed(decimals);
            }
            return val.toFixed(2);
        };


        // Calculate stats for both users
        const statsA = calc(filteredSessionsA);
        const statsB = calc(filteredSessionsB);

        // Count PRs in period (simple approach - counts new maxes)
        const countPRs = (sessions: any[]) => {
            const maxes: Record<string, number> = {};
            let prCount = 0;
            const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
            sorted.forEach(s => {
                if (!s.exercises) return;
                s.exercises.forEach((e: any) => {
                    const name = (e.name || e.exerciseName || '').toLowerCase();
                    if (e.sets && Array.isArray(e.sets)) {
                        e.sets.forEach((set: any) => {
                            const w = Number(set.weight) || 0;
                            const r = Number(set.reps) || 0;
                            if (w === 0 || r === 0) return;
                            const est = w * (1 + Math.min(r, 8) / 30);
                            const key = name;
                            if (!maxes[key] || est > maxes[key]) {
                                if (maxes[key]) prCount++;
                                maxes[key] = est;
                            }
                        });
                    }
                });
            });
            return prCount;
        };

        const prsA = countPRs(filteredSessionsA);
        const prsB = countPRs(filteredSessionsB);

        return [
            { label: 'Antal Pass', a: statsA.count, b: statsB.count, unit: 'st', decimals: 0 },
            { label: 'Nya PB', a: prsA, b: prsB, unit: 'st', decimals: 0 },
            { label: 'Total Vikt', a: format(scale(statsA.vol, weightA, genderA, true), true), b: format(scale(statsB.vol, weightB, genderB, true), true), unit: statsMode === 'raw' ? 'kg' : 'pts', isRaw: true },
            { label: 'Total Tid', a: statsA.time, b: statsB.time, unit: 'min', decimals: 0 },
            { label: 'Sömn / Natt', a: sleepA.toFixed(1), b: sleepB.toFixed(1), unit: 'h', isRaw: true },
            { label: 'Vikt / Pass', a: format(scale(statsA.avgVol, weightA, genderA, true), true), b: format(scale(statsB.avgVol, weightB, genderB, true), true), unit: statsMode === 'raw' ? 'kg' : 'pts', isRaw: true },
            { label: 'Set / Pass', a: statsA.avgSets.toFixed(1), b: statsB.avgSets.toFixed(1), unit: 'st', isRaw: true },
            { label: 'Reps / Pass', a: Math.round(statsA.avgReps), b: Math.round(statsB.avgReps), unit: 'st', decimals: 0 },
            { label: 'Reps / Set', a: statsA.sets > 0 ? (statsA.reps / statsA.sets).toFixed(1) : '-', b: statsB.sets > 0 ? (statsB.reps / statsB.sets).toFixed(1) : '-', unit: 'st', isRaw: true },
            { label: 'Övningar / Pass', a: statsA.avgEx.toFixed(1), b: statsB.avgEx.toFixed(1), unit: 'st', isRaw: true },
            { label: 'Tid / Pass', a: Math.round(statsA.avgTime), b: Math.round(statsB.avgTime), unit: 'min', decimals: 0 },
        ];
    }, [filteredSessionsA, filteredSessionsB, extraA, extraB, userA, userB, statsMode, filterDate, currentUser?.id, myWeightEntries]);


    // --- Progression Data (PB changes over time) - Uses EXACT matching ---
    const progressionData = useMemo(() => {
        const fromDate = new Date(progressionFromDate);
        const toDate = new Date(progressionToDate);

        // Conservative 1RM formula
        const conservative1RM = (weight: number, reps: number) => {
            if (reps === 0 || weight === 0) return 0;
            if (reps === 1) return weight;
            const effectiveReps = Math.min(reps, 8);
            return weight * (1 + effectiveReps / 30);
        };

        // Get best 1RM up to a certain date - EXACT name matching
        const get1RMUpToDate = (sessions: any[], exactName: string, upToDate: Date) => {
            let heaviestWeight = 0; // Heaviest weight touched (any reps)
            let max1RM = 0; // Estimated via formula
            const normalizedTarget = exactName.toLowerCase().trim();

            sessions.filter(s => new Date(s.date) <= upToDate).forEach(session => {
                if (!session.exercises) return;
                session.exercises.forEach((ex: any) => {
                    const name = (ex.name || ex.exerciseName || '').toLowerCase().trim();
                    if (name === normalizedTarget) { // EXACT match
                        if (ex.sets && Array.isArray(ex.sets)) {
                            ex.sets.forEach((set: any) => {
                                const weight = Number(set.weight) || 0;
                                const reps = Number(set.reps) || 0;
                                if (weight === 0 || reps === 0) return;

                                // Track heaviest weight touched (any rep count)
                                if (weight > heaviestWeight) {
                                    heaviestWeight = weight;
                                }

                                // Track estimated 1RM
                                const estimated = conservative1RM(weight, reps);
                                if (estimated > max1RM) {
                                    max1RM = estimated;
                                }
                            });
                        }
                    }
                });
            });

            // Return based on rmMode
            const useActual = rmMode === 'actual' && heaviestWeight > 0;
            return Math.round(useActual ? heaviestWeight : max1RM);
        };

        // Count PRs in a date range - EXACT name matching
        const countPRsInRange = (sessions: any[], exactName: string, start: Date, end: Date) => {
            let prCount = 0;
            let runningMax = 0;
            const normalizedTarget = exactName.toLowerCase().trim();

            const sortedSessions = [...sessions]
                .filter(s => {
                    const d = new Date(s.date);
                    return d >= start && d <= end;
                })
                .sort((a, b) => a.date.localeCompare(b.date));

            sortedSessions.forEach(session => {
                if (!session.exercises) return;
                session.exercises.forEach((ex: any) => {
                    const name = (ex.name || ex.exerciseName || '').toLowerCase().trim();
                    if (name === normalizedTarget) { // EXACT match
                        if (ex.sets && Array.isArray(ex.sets)) {
                            ex.sets.forEach((set: any) => {
                                const weight = Number(set.weight) || 0;
                                const reps = Number(set.reps) || 0;
                                if (weight === 0 || reps === 0) return;
                                const estimated = conservative1RM(weight, reps);
                                if (estimated > runningMax) {
                                    runningMax = estimated;
                                    prCount++;
                                }
                            });
                        }
                    }
                });
            });
            return prCount;
        };

        // Use sharedExercises (exact matches) instead of MAIN_EXERCISES (fuzzy)
        return sharedExercises.map(exName => {
            const currentA = get1RMUpToDate(sessionsA, exName, toDate);
            const currentB = get1RMUpToDate(sessionsB, exName, toDate);
            const startA = get1RMUpToDate(sessionsA, exName, fromDate);
            const startB = get1RMUpToDate(sessionsB, exName, fromDate);
            const prsA = countPRsInRange(sessionsA, exName, fromDate, toDate);
            const prsB = countPRsInRange(sessionsB, exName, fromDate, toDate);

            return {
                name: exName,
                currentA,
                currentB,
                startA,
                startB,
                // Show diff if there's any current value (even if starting from 0)
                diffA: currentA > 0 ? currentA - startA : null,
                diffB: currentB > 0 ? currentB - startB : null,
                // Percentage only makes sense if we had a start value > 0
                diffPctA: startA > 0 ? ((currentA - startA) / startA) * 100 : null,
                diffPctB: startB > 0 ? ((currentB - startB) / startB) * 100 : null,
                // PR count in period
                prsA,
                prsB,
            };
        });
    }, [sessionsA, sessionsB, progressionFromDate, progressionToDate, sharedExercises, rmMode]);



    // Trend Data (Dummy for now, could be calculated)
    const trendData = useMemo(() => {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun'];
        return months.map((m, i) => ({ name: m, A: 350 + (i * 10), B: 300 + (i * 20) }));
    }, []);

    // --- Render Helpers ---
    const formatTime = (seconds: any) => {
        if (!seconds || seconds === '-') return '-';
        const s = Number(seconds);
        if (isNaN(s)) return seconds;
        const mins = Math.floor(s / 60);
        const secs = s % 60;
        const hrs = Math.floor(mins / 60);
        const rmins = mins % 60;
        if (hrs > 0) return `${hrs}:${rmins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        return `${rmins}:${secs.toString().padStart(2, '0')}`;
    };

    const renderDiff = (a: number | string, b: number | string, unit: string = '', showPercent: boolean = true) => {
        const valA = parseFloat(String(a).replace(/,/g, ''));
        const valB = parseFloat(String(b).replace(/,/g, ''));
        if (isNaN(valA) || isNaN(valB)) return <span className="text-slate-500">-</span>;
        const diff = valA - valB;
        if (diff === 0) return <span className="text-slate-500">-</span>;
        const isWin = diff > 0;
        const percentDiff = valB !== 0 ? ((valA - valB) / Math.abs(valB)) * 100 : 0;
        return (
            <span className={`font-bold ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isWin ? '+' : ''}{Number.isInteger(diff) ? diff : diff.toFixed(1)}{unit}
                {showPercent && valB !== 0 && <span className="text-[9px] opacity-70 ml-1">({percentDiff > 0 ? '+' : ''}{percentDiff.toFixed(0)}%)</span>}
            </span>
        );
    };

    return (
        <div className="matchup-page animate-in fade-in duration-500 pb-20">
            {/* 1. HEADER & Contender Selection */}
            <header className="matchup-header glass sticky top-16 z-50 p-4 mb-4 border-b border-white/10 shadow-2xl">
                <div className="flex items-center justify-between max-w-6xl mx-auto gap-4">

                    {/* User A Selector */}
                    <div className="flex items-center gap-3 flex-1 justify-end">
                        <div className="text-right hidden sm:block">
                            <div className="relative group inline-flex items-center gap-1 justify-end">
                                <ChevronDown size={14} className="text-slate-500 group-hover:text-emerald-400 transition-colors" />
                                <select
                                    value={userAId}
                                    onChange={(e) => setUserAId(e.target.value)}
                                    className="bg-transparent text-lg sm:text-2xl font-black text-white outline-none cursor-pointer hover:text-emerald-400 text-right appearance-none py-1 min-w-[120px]"
                                >
                                    {users.map(u => (
                                        <option key={u.id} value={u.id} className="bg-slate-900 text-white">{u.name} {u.id === currentUser?.id ? '(Mig)' : ''}</option>
                                    ))}
                                </select>
                            </div>
                            {userA && (
                                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                                    {userA.handle ? `@${userA.handle}` : `@${userA.username}`}
                                </p>
                            )}
                        </div>
                        <div className="relative">
                            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-xl font-black text-white shadow-lg shadow-emerald-500/20 ring-2 ring-white/10 overflow-hidden">
                                {userA?.avatarUrl ? <img src={userA.avatarUrl} className="w-full h-full object-cover" /> : userA?.name[0]}
                            </div>
                            {userAId === currentUser?.id && (
                                <div className="absolute -top-1 -right-1 bg-emerald-400 text-slate-900 text-[8px] font-black px-1 rounded shadow-sm">ME</div>
                            )}
                        </div>
                    </div>

                    {/* VS Badge */}
                    <div className="flex flex-col items-center">
                        <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-slate-900 border-2 border-slate-700/50 flex items-center justify-center text-xs sm:text-sm font-black text-slate-400 italic shadow-2xl ring-4 ring-white/5">
                            VS
                        </div>
                    </div>

                    {/* User B Selector - SEARCHABLE */}
                    <div className="flex items-center gap-3 flex-1">
                        <div className="relative">
                            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-xl font-black text-white shadow-lg shadow-indigo-500/20 ring-2 ring-white/10 overflow-hidden">
                                {userB?.avatarUrl ? <img src={userB.avatarUrl} className="w-full h-full object-cover" /> : userB?.name[0]}
                            </div>
                            {userBId === currentUser?.id && (
                                <div className="absolute -top-1 -left-1 bg-indigo-400 text-slate-900 text-[8px] font-black px-1 rounded shadow-sm">ME</div>
                            )}
                        </div>
                        <div className="relative group">
                            {isSearchingB ? (
                                <div className="absolute left-0 top-0 z-[60] min-w-[200px] bg-slate-900 border border-white/10 rounded-xl p-2 shadow-2xl animate-in fade-in zoom-in duration-200">
                                    <input
                                        autoFocus
                                        type="text"
                                        value={userBSearch}
                                        onChange={(e) => setUserBSearch(e.target.value)}
                                        placeholder="Namn eller @handle..."
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-indigo-500"
                                        onBlur={() => setTimeout(() => setIsSearchingB(false), 200)}
                                    />
                                    <div className="mt-2 max-h-[200px] overflow-y-auto">
                                        {users.filter(u => {
                                            const s = userBSearch.toLowerCase();
                                            return u.name.toLowerCase().includes(s) || (u.handle || u.username).toLowerCase().includes(s.replace('@', ''));
                                        }).map(u => (
                                            <button
                                                key={u.id}
                                                onMouseDown={() => { setUserBId(u.id); setIsSearchingB(false); setUserBSearch(''); }}
                                                className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 text-xs text-slate-300 flex items-center gap-2 group/u"
                                            >
                                                <div className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center font-bold">{u.name[0]}</div>
                                                <div className="flex flex-col">
                                                    <span className="font-bold group-hover/u:text-white">{u.name}</span>
                                                    <span className="text-[10px] text-slate-500">@{u.handle || u.username}</span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col cursor-pointer" onClick={() => setIsSearchingB(true)}>
                                    <div className="flex items-center gap-1 group">
                                        <span className="text-lg sm:text-2xl font-black text-white hover:text-indigo-400 transition-colors uppercase decoration-dotted underline-offset-4 decoration-indigo-500/30 underline">{userB?.name || 'Välj...'}</span>
                                        <ChevronDown size={16} className="text-slate-500 group-hover:text-indigo-400 transition-colors" />
                                    </div>
                                    {userB && (
                                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                                            {userB.handle ? `@${userB.handle}` : `@${userB.username}`}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                </div>

            </header>

            <div className="max-w-6xl mx-auto space-y-8 px-4 sm:px-0">
                {/* 2. TALE OF THE TAPE */}
                <section className="glass p-4 sm:p-6 rounded-[32px] border border-white/5 relative overflow-hidden group">
                    {/* Gender background icons */}
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 opacity-[0.08] group-hover:opacity-[0.25] transition-opacity duration-300 pointer-events-none">
                        <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke={userA?.settings?.gender === 'female' ? '#ec4899' : '#3b82f6'} strokeWidth="0.8" className="group-hover:drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]">
                            {userA?.settings?.gender === 'female' ? (
                                <><circle cx="12" cy="8" r="5" /><line x1="12" y1="13" x2="12" y2="21" /><line x1="9" y1="18" x2="15" y2="18" /></>
                            ) : (
                                <><circle cx="10" cy="14" r="5" /><line x1="14" y1="10" x2="21" y2="3" /><line x1="15" y1="3" x2="21" y2="3" /><line x1="21" y1="3" x2="21" y2="9" /></>
                            )}
                        </svg>
                    </div>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-[0.08] group-hover:opacity-[0.25] transition-opacity duration-300 pointer-events-none">
                        <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke={userB?.settings?.gender === 'female' ? '#ec4899' : '#3b82f6'} strokeWidth="0.8" className="group-hover:drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]">
                            {userB?.settings?.gender === 'female' ? (
                                <><circle cx="12" cy="8" r="5" /><line x1="12" y1="13" x2="12" y2="21" /><line x1="9" y1="18" x2="15" y2="18" /></>
                            ) : (
                                <><circle cx="10" cy="14" r="5" /><line x1="14" y1="10" x2="21" y2="3" /><line x1="15" y1="3" x2="21" y2="3" /><line x1="21" y1="3" x2="21" y2="9" /></>
                            )}
                        </svg>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                    <div className="grid grid-cols-3 gap-4 text-center items-center relative z-10">
                        {/* A Info */}
                        <div className="space-y-3">
                            <div className="flex flex-col">
                                <span className="text-xl sm:text-3xl font-black text-white">
                                    {userA?.settings?.birthYear ? (new Date().getFullYear() - userA.settings.birthYear) : '?'}
                                </span>
                                <span className="text-[9px] text-slate-500 font-bold">ÅR</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xl sm:text-3xl font-black text-emerald-400">{userA?.settings?.weight || '?'}</span>
                                <span className="text-[9px] text-slate-500 font-bold">KG</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xl sm:text-3xl font-black text-white">{userA?.settings?.height || '?'}</span>
                                <span className="text-[9px] text-slate-500 font-bold">CM</span>
                            </div>
                        </div>

                        {/* Mid Labels (Icons) */}
                        <div className="space-y-4 flex flex-col items-center justify-center py-1 h-full opacity-30">
                            <div className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center"><Calendar size={14} className="text-slate-400" /></div>
                            <div className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center"><Scale size={14} className="text-slate-400" /></div>
                            <div className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center"><Target size={14} className="text-slate-400" /></div>
                        </div>

                        {/* B Info */}
                        <div className="space-y-3">
                            <div className="flex flex-col text-right">
                                <span className="text-xl sm:text-3xl font-black text-white">
                                    {userB?.settings?.birthYear ? (new Date().getFullYear() - userB.settings.birthYear) : '?'}
                                </span>
                                <span className="text-[9px] text-slate-500 font-bold">ÅR</span>
                            </div>
                            <div className="flex flex-col text-right">
                                <span className="text-xl sm:text-3xl font-black text-indigo-400">{userB?.settings?.weight || '?'}</span>
                                <span className="text-[9px] text-slate-500 font-bold">KG</span>
                            </div>
                            <div className="flex flex-col text-right">
                                <span className="text-xl sm:text-3xl font-black text-white">{userB?.settings?.height || '?'}</span>
                                <span className="text-[9px] text-slate-500 font-bold">CM</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 3. POWER CARD (Radar & Totals) */}
                <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                    <div className="glass p-4 rounded-3xl h-[220px] relative">
                        <div className="absolute top-3 left-4 text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <Zap size={12} className="text-amber-400" /> Styrkeprofil
                        </div>
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                                <PolarGrid stroke="#334155" />
                                <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 'bold' }} />
                                <Radar name={userA?.name} dataKey="A" stroke="#10b981" fill="#10b981" fillOpacity={0.4} />
                                <Radar name={userB?.name} dataKey="B" stroke="#6366f1" fill="#6366f1" fillOpacity={0.4} />
                                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc', borderRadius: '8px' }} itemStyle={{ fontSize: '11px' }} />
                            </RadarChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-2">
                                <h3 className="text-2xl font-black text-white">Total Styrka</h3>
                                <div className="group relative">
                                    <HelpCircle size={14} className="text-slate-600 hover:text-slate-400 cursor-help" />
                                    <div className="absolute left-0 top-6 w-72 bg-slate-900 border border-white/10 rounded-xl p-4 text-xs text-slate-300 shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                                        <p className="font-bold text-white mb-2">Visningslägen:</p>
                                        <p className="mb-2"><span className="text-emerald-400 font-bold">Faktisk:</span> Summan av bästa 1RM för bänkpress, knäböj och marklyft i kg.</p>
                                        <p className="mb-2"><span className="text-amber-400 font-bold">Relativ:</span> Total styrka delat med kroppsvikt. Visar hur stark du är i förhållande till din storlek.</p>
                                        <p><span className="text-indigo-400 font-bold">Poäng (IPF):</span> Internationella Styrkelyftförbundets formel som korrigerar för både kön och kroppsvikt – möjliggör rättvis jämförelse.</p>
                                    </div>
                                </div>
                            </div>
                            <div className="flex bg-slate-900 rounded-lg p-1">
                                <button onClick={() => setViewMode('raw')} className={`px-3 py-1 rounded text-[10px] font-bold ${viewMode === 'raw' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-400'}`} title="Summa av 1RM i kg">Faktisk</button>
                                <button onClick={() => setViewMode('relative')} className={`px-3 py-1 rounded text-[10px] font-bold ${viewMode === 'relative' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-400'}`} title="Total / kroppsvikt">Relativ</button>
                                <button onClick={() => setViewMode('fair')} className={`px-3 py-1 rounded text-[10px] font-bold ${viewMode === 'fair' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-400'}`} title="IPF-poäng (korrigerat för kön & vikt)">Poäng</button>
                            </div>
                        </div>

                        {/* Big Numbers */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/50 border border-white/5 relative overflow-hidden">
                                <span className="text-[10px] uppercase text-slate-500 font-bold block mb-1">{userA?.name?.toUpperCase()} TOTAL</span>
                                <div className="text-4xl font-black text-white">{viewMode === 'raw' ? powerStats.totalA : powerStats.pointsA}</div>
                                <div className="text-xs text-emerald-400 mt-1 font-bold">
                                    {powerStats.totalA > powerStats.totalB ? 'LEDANDE' : ''}
                                </div>
                            </div>
                            <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/50 border border-white/5 relative overflow-hidden">
                                <span className="text-[10px] uppercase text-slate-500 font-bold block mb-1">{userB?.name?.toUpperCase()} TOTAL</span>
                                <div className="text-4xl font-black text-slate-300">{viewMode === 'raw' ? powerStats.totalB : powerStats.pointsB}</div>
                                <div className="text-xs text-rose-400 mt-1 font-bold">
                                    {renderDiff(viewMode === 'raw' ? powerStats.totalA : powerStats.pointsA, viewMode === 'raw' ? powerStats.totalB : powerStats.pointsB)}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 4. THE GRIND 2.0 (Stats Table) */}
                <section className="glass p-6 sm:p-8 rounded-3xl">
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                                <Dumbbell size={20} className="text-emerald-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white tracking-tight">Giganternas Kamp – Statistik</h3>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Djupanalys av träningsdata</p>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2 w-full lg:w-auto">
                            {/* Scaling Toggles with explanations */}
                            <div className="flex bg-slate-900 p-1 rounded-xl border border-white/5">
                                <button
                                    onClick={() => setStatsMode('raw')}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tight transition-all ${statsMode === 'raw' ? 'bg-slate-700 text-white shadow-lg' : 'text-slate-500 hover:text-slate-400'}`}
                                    title="Visar faktiska värden i kg, min, st"
                                >
                                    Faktisk
                                </button>
                                <button
                                    onClick={() => setStatsMode('bw')}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tight transition-all ${statsMode === 'bw' ? 'bg-slate-700 text-white shadow-lg' : 'text-slate-500 hover:text-slate-400'}`}
                                    title="Volym delat med kroppsvikt (kg/BW) – för rättvis jämförelse oavsett storlek"
                                >
                                    Relativ (BW)
                                </button>
                                <button
                                    onClick={() => setStatsMode('points')}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tight transition-all ${statsMode === 'points' ? 'bg-slate-700 text-white shadow-lg' : 'text-slate-500 hover:text-slate-400'}`}
                                    title="IPF GL-poäng – standardiserad poäng justerad för kön och kroppsvikt"
                                >
                                    Poäng (IPF)
                                </button>
                            </div>

                            {/* Time Filter */}
                            <div className="flex bg-slate-900 p-1 rounded-xl border border-white/5">
                                {(['ALL', '2025', '6m', '3m', '7d'] as TimeRange[]).map(r => (
                                    <button
                                        key={r}
                                        onClick={() => setTimeRange(r)}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tight transition-all ${timeRange === r ? 'bg-emerald-500 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                                    >
                                        {r}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-white/5">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-white/[0.02] text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                    <th className="px-4 py-3 border-b border-white/5">Kategori</th>
                                    <th className="px-4 py-3 border-b border-white/5 text-right">{userA?.name}</th>
                                    <th className="px-4 py-3 border-b border-white/5 text-right">{userB?.name}</th>
                                    <th className="px-4 py-3 border-b border-white/5 text-right">Diff</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {tableData.filter(row => {
                                    // Hide rows where both users have zero/empty values
                                    const valA = parseFloat(String(row.a).replace(/,/g, ''));
                                    const valB = parseFloat(String(row.b).replace(/,/g, ''));
                                    return !isNaN(valA) && !isNaN(valB) && (valA > 0 || valB > 0);
                                }).map((row, i) => (
                                    <tr key={i} className="hover:bg-white/[0.02] transition-colors group">
                                        <td className="px-4 py-2 font-bold text-slate-300 text-[11px]">{row.label}</td>
                                        <td className="px-4 py-2 text-right font-mono text-white text-xs group-hover:text-emerald-400 transition-colors">
                                            {row.a} <span className="text-[9px] text-slate-600 ml-0.5">{row.unit}</span>
                                        </td>
                                        <td className="px-4 py-2 text-right font-mono text-slate-400 text-xs group-hover:text-indigo-300 transition-colors">
                                            {row.b} <span className="text-[9px] text-slate-600 ml-0.5">{row.unit}</span>
                                        </td>
                                        <td className="px-4 py-2 text-right font-mono text-[10px]">
                                            {renderDiff(row.a, row.b, '')}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* PROGRESSION TABLE - Störst Ökning */}
                <section className="glass p-6 sm:p-8 rounded-3xl">
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                                <TrendingUp size={20} className="text-purple-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white tracking-tight">Störst Ökning</h3>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Progression i 1RM över tid</p>
                            </div>
                        </div>

                        {/* Date Range Controls */}
                        <div className="flex items-center gap-3 bg-slate-900/50 p-3 rounded-xl border border-white/5">
                            <div className="flex flex-col">
                                <label className="text-[9px] text-slate-500 uppercase font-black mb-1">Från</label>
                                <input
                                    type="date"
                                    value={progressionFromDate}
                                    onChange={(e) => setProgressionFromDate(e.target.value)}
                                    className="bg-slate-900 border border-white/5 text-white px-2 py-1 rounded-lg text-[11px] font-mono focus:border-purple-500/50 outline-none"
                                />
                            </div>
                            <span className="text-slate-500 text-lg">→</span>
                            <div className="flex flex-col">
                                <label className="text-[9px] text-slate-500 uppercase font-black mb-1">Till</label>
                                <input
                                    type="date"
                                    value={progressionToDate}
                                    onChange={(e) => setProgressionToDate(e.target.value)}
                                    className="bg-slate-900 border border-white/5 text-white px-2 py-1 rounded-lg text-[11px] font-mono focus:border-purple-500/50 outline-none"
                                />
                            </div>
                            <div className="flex gap-1 ml-2">
                                <button
                                    onClick={() => { setProgressionFromDate('2025-01-01'); setProgressionToDate(new Date().toISOString().split('T')[0]); }}
                                    className="text-[9px] px-2 py-1 bg-slate-800 rounded text-slate-400 hover:text-white transition-colors font-bold"
                                >2025</button>
                                <button
                                    onClick={() => {
                                        const d = new Date();
                                        d.setMonth(d.getMonth() - 3);
                                        setProgressionFromDate(d.toISOString().split('T')[0]);
                                        setProgressionToDate(new Date().toISOString().split('T')[0]);
                                    }}
                                    className="text-[9px] px-2 py-1 bg-slate-800 rounded text-slate-400 hover:text-white transition-colors font-bold"
                                >3m</button>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-white/5">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-white/[0.02] text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                    <th className="px-4 py-3 border-b border-white/5">Övning</th>
                                    <th className="px-4 py-3 border-b border-white/5 text-right">{userA?.name}</th>
                                    <th className="px-4 py-3 border-b border-white/5 text-right">{userB?.name}</th>
                                    <th className="px-4 py-3 border-b border-white/5 text-center">Flest PB</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {progressionData.filter(row => row.currentA > 0 || row.currentB > 0).map((row, i) => (
                                    <tr key={i} className="hover:bg-white/[0.02] transition-colors group">
                                        <td className="px-4 py-3 font-bold text-slate-300 text-[11px]">
                                            <Link to={`/strength/${encodeURIComponent(row.name)}`} className="hover:text-emerald-400 transition-colors">
                                                {row.name}
                                            </Link>
                                            <span className="block text-[9px] text-slate-600 font-normal">Nu: {row.currentA}kg / {row.currentB}kg</span>
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-xs">
                                            {row.diffA !== null ? (
                                                <span className={`font-bold ${row.diffA >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                    {row.diffA >= 0 ? '+' : ''}{row.diffA}kg
                                                    {row.diffPctA !== null ? (
                                                        <span className="text-[9px] opacity-70 ml-1">({row.diffPctA >= 0 ? '+' : ''}{row.diffPctA.toFixed(0)}%)</span>
                                                    ) : row.startA === 0 && row.currentA > 0 ? (
                                                        <span className="text-[9px] text-purple-400 ml-1">ny!</span>
                                                    ) : null}
                                                </span>
                                            ) : <span className="text-slate-600">-</span>}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-xs">
                                            {row.diffB !== null ? (
                                                <span className={`font-bold ${row.diffB >= 0 ? 'text-indigo-400' : 'text-rose-400'}`}>
                                                    {row.diffB >= 0 ? '+' : ''}{row.diffB}kg
                                                    {row.diffPctB !== null ? (
                                                        <span className="text-[9px] opacity-70 ml-1">({row.diffPctB >= 0 ? '+' : ''}{row.diffPctB.toFixed(0)}%)</span>
                                                    ) : row.startB === 0 && row.currentB > 0 ? (
                                                        <span className="text-[9px] text-purple-400 ml-1">ny!</span>
                                                    ) : null}
                                                </span>
                                            ) : <span className="text-slate-600">-</span>}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex justify-center gap-2">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${row.prsA >= row.prsB ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                                                    {row.prsA}
                                                </span>
                                                <span className="text-slate-600 text-[10px]">vs</span>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${row.prsB > row.prsA ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-500'}`}>
                                                    {row.prsB}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* Performance Hall of Fame (Activity PBs) */}
                <section className="glass p-6 sm:p-8 rounded-3xl">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                            <Trophy className="text-amber-400" size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-white">Performance Hall of Fame</h3>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Personbästa och milstolpar</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[
                            { id: '5k', label: '5 KM' },
                            { id: '10k', label: '10 KM' },
                            { id: 'half_marathon', label: 'Halvmara' },
                            { id: 'marathon', label: 'Marathon' }
                        ].map(pb => {
                            const valA = formatTime(prsA.find(p => p.category === pb.id)?.time);
                            const valB = formatTime(prsB.find(p => p.category === pb.id)?.time);

                            return (
                                <Link
                                    key={pb.id}
                                    to={valA !== '-' ? `/activities?activityId=${prsA.find(p => p.category === pb.id)?.activityId}` : '#'}
                                    className="p-5 rounded-3xl bg-white/[0.02] border border-white/5 relative overflow-hidden group hover:border-amber-500/30 transition-all"
                                >
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <Zap size={10} className="text-amber-400" /> {pb.label}
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-end border-b border-white/5 pb-2">
                                            <span className="text-xs font-bold text-emerald-400 uppercase">{userA?.name}</span>
                                            <span className="text-lg font-black text-white">{valA}</span>
                                        </div>
                                        <div className="flex justify-between items-end">
                                            <span className="text-xs font-bold text-indigo-400 uppercase">{userB?.name}</span>
                                            <span className="text-lg font-black text-slate-300">{valB}</span>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </section>


                {/* 5. HEAD-TO-HEAD (Exercises) */}
                <section>
                    <div className="flex flex-col gap-4 mb-6">
                        {/* Top Row: Title and 1RM Toggle */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h3 className="text-xl font-black text-white">Head-to-Head</h3>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                                    Djupdykning i specifika övningar: Maxstyrka, volym, set & reps
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                {/* 1RM Mode Toggle */}
                                <div className="flex items-center gap-1 bg-slate-900/50 p-1 rounded-lg border border-white/5">
                                    <button
                                        onClick={() => setRmMode('actual')}
                                        className={`px-2.5 py-1 text-[9px] font-black uppercase rounded transition-all ${rmMode === 'actual' ? 'bg-emerald-500 text-white' : 'text-slate-500 hover:text-white'}`}
                                    >
                                        1RM
                                    </button>
                                    <button
                                        onClick={() => setRmMode('estimated')}
                                        className={`px-2.5 py-1 text-[9px] font-black uppercase rounded transition-all ${rmMode === 'estimated' ? 'bg-indigo-500 text-white' : 'text-slate-500 hover:text-white'}`}
                                    >
                                        e1RM
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Bottom Row: Search, Sort, Filter */}
                        <div className="flex flex-wrap items-center gap-3">
                            {/* Search */}
                            <div className="relative flex-1 min-w-[150px] max-w-[250px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                                <input
                                    type="text"
                                    placeholder="Sök övning..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-9 pr-4 text-xs text-white outline-none focus:border-emerald-500/50 transition-all"
                                />
                            </div>

                            {/* Sort */}
                            <div className="flex items-center gap-1 bg-slate-900/50 p-1 rounded-lg border border-white/5">
                                <span className="text-[9px] text-slate-500 uppercase font-black px-2">Sortera:</span>
                                {[
                                    { key: 'alpha', label: 'A-Ö' },
                                    { key: 'diff', label: 'Störst diff' },
                                    { key: 'a-wins', label: `${userA?.name?.split(' ')[0] || 'A'} ⬆` },
                                    { key: 'b-wins', label: `${userB?.name?.split(' ')[0] || 'B'} ⬆` },
                                    { key: 'sessions', label: 'Flest pass' },
                                ].map(opt => (
                                    <button
                                        key={opt.key}
                                        onClick={() => setH2HSort(opt.key as H2HSortMode)}
                                        className={`px-2 py-1 text-[9px] font-bold rounded transition-all ${h2hSort === opt.key ? 'bg-purple-500 text-white' : 'text-slate-500 hover:text-white'}`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>

                            {/* Filter */}
                            <div className="flex items-center gap-1 bg-slate-900/50 p-1 rounded-lg border border-white/5">
                                <span className="text-[9px] text-slate-500 uppercase font-black px-2">Visa:</span>
                                {[
                                    { key: 'all', label: 'Alla' },
                                    { key: 'a-wins', label: `${userA?.name?.split(' ')[0] || 'A'} vinner` },
                                    { key: 'b-wins', label: `${userB?.name?.split(' ')[0] || 'B'} vinner` },
                                    { key: 'tie', label: 'Lika' },
                                ].map(opt => (
                                    <button
                                        key={opt.key}
                                        onClick={() => setH2HFilter(opt.key as any)}
                                        className={`px-2 py-1 text-[9px] font-bold rounded transition-all ${h2hFilter === opt.key ? 'bg-amber-500 text-white' : 'text-slate-500 hover:text-white'}`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>



                    {/* Dynamic Shared Exercises Grid */}
                    {sharedExercises.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            <p className="text-lg font-bold mb-2">Inga gemensamma övningar</p>
                            <p className="text-xs">Ni har inte gjort samma övningar ännu.</p>
                        </div>
                    ) : (() => {
                        // Pre-compute stats for all exercises for sorting/filtering
                        const exerciseData = sharedExercises
                            .filter(exName => exName.toLowerCase().includes(searchQuery.toLowerCase()))
                            .map(exName => {
                                const statsA = getExactExerciseStats(sessionsA, exName);
                                const statsB = getExactExerciseStats(sessionsB, exName);
                                return { exName, statsA, statsB };
                            })
                            .filter(d => d.statsA.max1RM > 0 || d.statsB.max1RM > 0);

                        // Apply filter
                        const filteredData = exerciseData.filter(d => {
                            if (h2hFilter === 'all') return true;
                            if (h2hFilter === 'a-wins') return d.statsA.max1RM > d.statsB.max1RM;
                            if (h2hFilter === 'b-wins') return d.statsB.max1RM > d.statsA.max1RM;
                            if (h2hFilter === 'tie') return d.statsA.max1RM === d.statsB.max1RM;
                            return true;
                        });

                        // Apply sort
                        const sortedData = [...filteredData].sort((a, b) => {
                            switch (h2hSort) {
                                case 'alpha':
                                    return a.exName.localeCompare(b.exName, 'sv');
                                case 'diff':
                                    const diffA = Math.abs(a.statsA.max1RM - a.statsB.max1RM);
                                    const diffB = Math.abs(b.statsA.max1RM - b.statsB.max1RM);
                                    return diffB - diffA;
                                case 'a-wins':
                                    const marginA = a.statsA.max1RM - a.statsB.max1RM;
                                    const marginAB = b.statsA.max1RM - b.statsB.max1RM;
                                    return marginAB - marginA; // B wins more = lower
                                case 'b-wins':
                                    const marginBA = a.statsB.max1RM - a.statsA.max1RM;
                                    const marginBB = b.statsB.max1RM - b.statsA.max1RM;
                                    return marginBB - marginBA;
                                case 'sessions':
                                    const sessionsA = a.statsA.count + a.statsB.count;
                                    const sessionsB = b.statsA.count + b.statsB.count;
                                    return sessionsB - sessionsA;
                                default:
                                    return 0;
                            }
                        });

                        return (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {sortedData.length === 0 ? (
                                    <div className="col-span-2 text-center py-8 text-slate-500">
                                        <p className="text-sm">Inga övningar matchar filtret</p>
                                    </div>
                                ) : sortedData.map(({ exName, statsA, statsB }, i) => {
                                    return (
                                        <div key={i} className="glass rounded-2xl p-5 border border-white/5 hover:border-white/10 transition-all group relative overflow-hidden">
                                            <div className="flex justify-between items-center mb-4">
                                                <div className="flex flex-col">
                                                    <h4 className="text-sm font-black text-white group-hover:text-emerald-400 transition-colors">{exName}</h4>
                                                    <span className="text-[9px] text-slate-500 font-bold uppercase">Exakt match</span>
                                                </div>
                                                <div className="px-2 py-0.5 bg-white/5 rounded-full text-[9px] font-black text-slate-400">
                                                    {statsA.count + statsB.count} pass
                                                </div>
                                            </div>

                                            {/* 1RM Comparison */}
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase">
                                                    <Link to={`/strength/${encodeURIComponent(exName)}`} className="hover:text-emerald-400 transition-colors">
                                                        {statsA.max1RM} kg
                                                        {statsA.bestSet && (
                                                            <span className="block text-[8px] font-normal lowercase text-emerald-400/60">
                                                                {statsA.bestSet.weight}kg x {statsA.bestSet.reps}
                                                                <span className="text-slate-600 ml-1">{statsA.bestSet.date}</span>
                                                            </span>
                                                        )}
                                                        {/* Show alternative value */}
                                                        {rmMode === 'actual' && statsA.actual1RM === 0 && statsA.estimated1RM > 0 && (
                                                            <span className="block text-[7px] text-slate-600 italic">inga singelyft - visar e1RM</span>
                                                        )}
                                                        {rmMode === 'actual' && statsA.actual1RM > 0 && statsA.estimated1RM !== statsA.actual1RM && (
                                                            <span className="block text-[7px] text-slate-600">e1RM: {statsA.estimated1RM}kg</span>
                                                        )}
                                                        {rmMode === 'estimated' && statsA.actual1RM > 0 && (
                                                            <span className="block text-[7px] text-slate-600">1RM: {statsA.actual1RM}kg</span>
                                                        )}
                                                    </Link>
                                                    <span className="text-[9px]">{rmMode === 'actual' ? '1RM' : 'e1RM'}</span>
                                                    <Link to={`/strength/${encodeURIComponent(exName)}`} className="hover:text-indigo-400 transition-colors text-right">
                                                        {statsB.max1RM} kg
                                                        {statsB.bestSet && (
                                                            <span className="block text-[8px] font-normal lowercase text-indigo-400/60">
                                                                {statsB.bestSet.weight}kg x {statsB.bestSet.reps}
                                                                <span className="text-slate-600 ml-1">{statsB.bestSet.date}</span>
                                                            </span>
                                                        )}
                                                        {/* Show alternative value */}
                                                        {rmMode === 'actual' && statsB.actual1RM === 0 && statsB.estimated1RM > 0 && (
                                                            <span className="block text-[7px] text-slate-600 italic">inga singelyft - visar e1RM</span>
                                                        )}
                                                        {rmMode === 'actual' && statsB.actual1RM > 0 && statsB.estimated1RM !== statsB.actual1RM && (
                                                            <span className="block text-[7px] text-slate-600">e1RM: {statsB.estimated1RM}kg</span>
                                                        )}
                                                        {rmMode === 'estimated' && statsB.actual1RM > 0 && (
                                                            <span className="block text-[7px] text-slate-600">1RM: {statsB.actual1RM}kg</span>
                                                        )}
                                                    </Link>
                                                </div>
                                                <div className="h-1 bg-slate-900 rounded-full overflow-hidden flex">
                                                    <div style={{ width: `${(statsA.max1RM / (statsA.max1RM + statsB.max1RM || 1)) * 100}%` }} className="h-full bg-emerald-500" />
                                                    <div style={{ width: `${(statsB.max1RM / (statsA.max1RM + statsB.max1RM || 1)) * 100}%` }} className="h-full bg-indigo-500" />
                                                </div>

                                                {/* Compact Stats Row */}
                                                <div className="flex justify-between text-[9px] text-slate-500 pt-1">
                                                    <span>{(statsA.totalVolume / 1000).toFixed(1)}t vol</span>
                                                    <span>{statsA.count} vs {statsB.count} pass</span>
                                                    <span>{(statsB.totalVolume / 1000).toFixed(1)}t vol</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })()}
                </section>

                {/* 6. SCOREBOARD */}
                <section className="glass p-8 rounded-3xl flex flex-col justify-center items-center text-center border border-white/5 bg-gradient-to-b from-white/[0.02] to-transparent">
                    <Trophy size={48} className="text-amber-400 mb-4" />
                    <h3 className="text-2xl font-black text-white mb-2">Match Status</h3>
                    <p className="text-slate-400 max-w-lg mx-auto">
                        Baserat på totalvolym och grensegrar har {powerStats.pointsA > powerStats.pointsB ? userA?.name : userB?.name} initiativet just nu.
                    </p>
                </section>

                {/* 7. CRYSTAL BALL (Trends) - BOTTOM */}
                <section className="glass p-8 rounded-3xl overflow-hidden relative opacity-80 hover:opacity-100 transition-opacity">
                    <div className="flex items-center gap-3 mb-6">
                        <Sparkles size={18} className="text-purple-400" />
                        <h3 className="text-lg font-bold text-white">Framtid & Trender</h3>
                    </div>
                    <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={trendData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                <XAxis dataKey="name" stroke="#64748b" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                                <Line type="monotone" dataKey="A" stroke="#10b981" strokeWidth={3} dot={false} />
                                <Line type="monotone" dataKey="B" stroke="#6366f1" strokeWidth={3} strokeDasharray="4 4" dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </section>
            </div>
        </div>
    );
}
