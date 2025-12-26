import React, { useState, useMemo } from 'react';
import { useData } from '../../context/DataContext.tsx';
import { HyroxClass } from '../../utils/hyroxPredictor.ts';

// ------------------------------------------------------------------
// TYPES
// ------------------------------------------------------------------
interface PartnerStats {
    name: string;
    gender: 'MALE' | 'FEMALE';
    runLevel: number; // 0-100 (50 = 25min 5k, 100 = 15min 5k)
    strengthLevel: number; // 0-100 (Sleds/Wallballs)
    engineLevel: number; // 0-100 (Ski/Row/Burpees)
}

const PRESETS: PartnerStats[] = [
    { name: "Lisa Lunges", gender: 'FEMALE', runLevel: 75, strengthLevel: 85, engineLevel: 80 },
    { name: "Kalle Cardio", gender: 'MALE', runLevel: 90, strengthLevel: 55, engineLevel: 75 },
    { name: "The Titan", gender: 'MALE', runLevel: 95, strengthLevel: 98, engineLevel: 95 }, // "The Good One"
    { name: "The Rookie", gender: 'MALE', runLevel: 30, strengthLevel: 35, engineLevel: 40 }, // "The Bad One"
    { name: "Average Joe", gender: 'MALE', runLevel: 50, strengthLevel: 50, engineLevel: 50 },
    { name: "Hyrox Pro", gender: 'MALE', runLevel: 90, strengthLevel: 90, engineLevel: 95 },
];

// ------------------------------------------------------------------
// WEIGHT RULES
// ------------------------------------------------------------------
const DOUBLES_WEIGHTS = {
    MENS: { sledPush: 152, sledPull: 103, lunge: 20, wallBall: 6, farmers: 24, label: "MEN OPEN WEIGHTS" },
    WOMENS: { sledPush: 102, sledPull: 78, lunge: 10, wallBall: 4, farmers: 16, label: "WOMEN OPEN WEIGHTS" },
    MIXED: { sledPush: 152, sledPull: 103, lunge: 20, wallBall: 6, farmers: 24, label: "MIXED (MEN WEIGHTS)" }, // Standard rule: Mixed uses Men's weights mostly
};

function getWeightClass(g1: 'MALE' | 'FEMALE', g2: 'MALE' | 'FEMALE') {
    if (g1 === 'MALE' && g2 === 'MALE') return DOUBLES_WEIGHTS.MENS;
    if (g1 === 'FEMALE' && g2 === 'FEMALE') return DOUBLES_WEIGHTS.WOMENS;
    return DOUBLES_WEIGHTS.MIXED;
}

// ------------------------------------------------------------------
// LOGIC
// ------------------------------------------------------------------
function calculateSynergy(p1: PartnerStats, p2: PartnerStats) {
    // Synergy comes from complementary skills. 
    // If P1 is weak run, P2 should be strong run.
    const runDiff = Math.abs(p1.runLevel - p2.runLevel);
    const strDiff = Math.abs(p1.strengthLevel - p2.strengthLevel);

    // Base synergy + bonus for covering weaknesses
    let score = 50;
    if (runDiff > 20) score += 15; // Good complement
    if (strDiff > 20) score += 15;

    // Penalty if both are weak at same thing
    if (p1.runLevel < 40 && p2.runLevel < 40) score -= 20;
    if (p1.strengthLevel < 40 && p2.strengthLevel < 40) score -= 20;

    return Math.min(100, Math.max(0, score));
}

// ------------------------------------------------------------------
// COACH AI LOGIC
// ------------------------------------------------------------------
function generateCoachAdvice(user: PartnerStats, partner: PartnerStats, synergy: number) {
    const tips = [];

    // Core synergy
    if (synergy > 80) tips.push("🔥 NI ÄR DREAM TEAM! Era styrkor kompletterar varandra perfekt.");
    else if (synergy < 40) tips.push("⚠️ VARNING: Ni har samma svagheter. Planera noga för att inte krascha.");

    // Specifics
    if (user.runLevel > partner.runLevel + 15) tips.push(`🏃 Du är löparen. Låt ${partner.name} vila i Roxzone medan du drar upp tempot.`);
    if (partner.strengthLevel > user.strengthLevel + 15) tips.push(`💪 ${partner.name} är maskinen! Ge hen alla tunga slädar så du kan fokusera på Burpees.`);
    if (user.engineLevel < 40 && partner.engineLevel < 40) tips.push("💀 Båda har svagt flås? Wall Balls kommer göra ont. Dela upp i små set (10-10) direkt.");

    return tips;
}

// ------------------------------------------------------------------
// COMPONENT
// ------------------------------------------------------------------
export function HyroxDuoLab() {
    const { exerciseEntries } = useData();

    // ------------------------------------------------------------------
    // REAL STATS (Last 60 Days)
    // ------------------------------------------------------------------
    const stats60d = useMemo(() => {
        const now = new Date();
        const cutoff = new Date();
        cutoff.setDate(now.getDate() - 60);

        // Ensure date parsing is safe (handle YYYY-MM-DD)
        const recent = exerciseEntries.filter(e => {
            if (!e.date) return false;
            const d = new Date(e.date);
            return d >= cutoff;
        });

        const sessions = new Set(recent.map(e => e.date)).size;

        let tonnage = 0;
        let runDist = 0;
        let hyroxCount = 0;

        recent.forEach(e => {
            // Tonnage
            if (e.tonnage) tonnage += e.tonnage;

            // Running Distance (Include Runs and Hyrox runs if parsed)
            if (e.distance && (e.type === 'running' || (e.type as any) === 'hyrox' || (e.notes && e.notes.toLowerCase().includes('run')))) {
                runDist += e.distance;
            }

            // Hyrox Sessions
            const isHyrox =
                (e.type as any) === 'hyrox' ||
                (e.notes || '').toLowerCase().includes('hyrox') ||
                (e.subType as any) === 'hyrox' ||
                ((e as any).title || '').toLowerCase().includes('hyrox'); // Check title too

            if (isHyrox) hyroxCount++;
        });

        return {
            sessions,
            tonnage: tonnage > 1000 ? (Math.round(tonnage / 1000) + 't') : (tonnage + 'kg'),
            runDist: Math.round(runDist) + 'km',
            hyroxSessions: hyroxCount
        };
    }, [exerciseEntries]);

    // User Stats (Mocked for now, in real app load from profile)
    const [userStats, setUserStats] = useState<PartnerStats>({ name: "JAG", gender: 'MALE', runLevel: 65, strengthLevel: 60, engineLevel: 70 });
    const [partnerStats, setPartnerStats] = useState<PartnerStats>(PRESETS[0]);
    const [presetName, setPresetName] = useState("Average Joe");

    // Dynamic Rules
    const activeWeights = useMemo(() => getWeightClass(userStats.gender, partnerStats.gender), [userStats.gender, partnerStats.gender]);
    const synergy = useMemo(() => calculateSynergy(userStats, partnerStats), [userStats, partnerStats]);
    const advice = useMemo(() => generateCoachAdvice(userStats, partnerStats, synergy), [userStats, partnerStats, synergy]);

    // SPLITS CALCULATION
    const stations = [
        { id: 'ski', name: 'Ski Erg', type: 'engine' },
        { id: 'sled_push', name: 'Sled Push', type: 'strength', weight: activeWeights.sledPush + 'kg' },
        { id: 'sled_pull', name: 'Sled Pull', type: 'strength', weight: activeWeights.sledPull + 'kg' },
        { id: 'bbj', name: 'Burpee Broad', type: 'engine' },
        { id: 'row', name: 'Rowing', type: 'engine' },
        { id: 'farmers', name: 'Farmers', type: 'strength', weight: activeWeights.farmers + 'kg' },
        { id: 'lunges', name: 'Lunges', type: 'strength', weight: activeWeights.lunge + 'kg' },
        { id: 'wb', name: 'Wall Balls', type: 'strength', weight: activeWeights.wallBall + 'kg' },
    ];

    // ------------------------------------------------------------------
    // FATIGUE-AWARE SPLIT ALGORITHM
    // ------------------------------------------------------------------
    const predictedSplit = useMemo(() => {
        let swaps = 0;
        let lastPerson = '';

        // Fatigue State
        let fatigueUser = 0;
        let fatiguePartner = 0;
        const FATIGUE_COST = 15; // Score penalty per station done
        const FATIGUE_RECOVERY = 5; // Recovery when resting

        return stations.map(s => {
            // Raw Ability
            let uScore = s.type === 'strength' ? userStats.strengthLevel : userStats.engineLevel;
            let pScore = s.type === 'strength' ? partnerStats.strengthLevel : partnerStats.engineLevel;

            // Gender normalization
            if (userStats.gender === 'MALE') uScore += 5;
            if (partnerStats.gender === 'MALE') pScore += 5;

            // Apply Fatigue
            const uEffective = uScore - fatigueUser;
            const pEffective = pScore - fatiguePartner;

            // Decision (Assign to highest EFFECTIVE score)
            const assignedTo = uEffective >= pEffective ? 'ME' : 'PARTNER';

            // Update Fatigue
            if (assignedTo === 'ME') {
                fatigueUser += FATIGUE_COST;
                fatiguePartner = Math.max(0, fatiguePartner - FATIGUE_RECOVERY);
            } else {
                fatiguePartner += FATIGUE_COST;
                fatigueUser = Math.max(0, fatigueUser - FATIGUE_RECOVERY);
            }

            // Track swaps
            if (lastPerson && lastPerson !== assignedTo) swaps++;
            lastPerson = assignedTo;

            return {
                ...s,
                assignedTo,
                advantage: Math.round(Math.abs(uEffective - pEffective)), // Show margin
                fatiguePenalty: assignedTo === 'ME' ? fatigueUser : fatiguePartner // Debug info
            };
        });
    }, [userStats, partnerStats, activeWeights]);

    const transitionPenalty = useMemo(() => {
        let swaps = 0;
        let last = predictedSplit[0].assignedTo;
        predictedSplit.forEach(s => {
            if (s.assignedTo !== last) { swaps++; last = s.assignedTo; }
        });
        return swaps * 10;
    }, [predictedSplit]);

    // MOCK TIMINGS & WIN PROB
    const predictedTimeSec = 3600 + (transitionPenalty) + (100 - synergy) * 10; // Just a dummy heuristic
    const winProb = Math.min(99, Math.max(1, synergy - (transitionPenalty / 10)));

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8">

            {/* HERO */}
            <div className="text-center relative py-6">
                <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
                    <span className="text-9xl">⚔️</span>
                </div>
                <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter mb-2 relative z-10">
                    Duo <span className="text-cyan-500">Compete</span> Lab
                </h2>
                <div className="flex justify-center gap-2">
                    <span className="bg-slate-800 text-slate-400 px-3 py-1 rounded text-[10px] font-bold uppercase tracking-widest border border-white/5">
                        Class: {userStats.gender === partnerStats.gender ? (userStats.gender + ' DOUBLES') : 'MIXED DOUBLES'}
                    </span>
                    <span className="bg-amber-500/10 text-amber-500 px-3 py-1 rounded text-[10px] font-bold uppercase tracking-widest border border-amber-500/20">
                        Weights: {activeWeights.label}
                    </span>
                </div>
            </div>

            {/* REAL STATS (Last 60d) */}
            <div className="grid grid-cols-4 gap-2 bg-slate-900 border border-white/5 rounded-2xl p-4 max-w-2xl mx-auto">
                <div className="text-center border-r border-white/5 last:border-0">
                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Pass (60d)</div>
                    <div className="text-xl font-black text-white">{stats60d.sessions}</div>
                </div>
                <div className="text-center border-r border-white/5 last:border-0">
                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Volym</div>
                    <div className="text-xl font-black text-cyan-400">{stats60d.tonnage}</div>
                </div>
                <div className="text-center border-r border-white/5 last:border-0">
                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Löpning</div>
                    <div className="text-xl font-black text-emerald-400">{stats60d.runDist}</div>
                </div>
                <div className="text-center">
                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Hyrox-pass</div>
                    <div className="text-xl font-black text-amber-400">{stats60d.hyroxSessions}</div>
                </div>
            </div>

            {/* PLAYERS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
                {/* VS BADGE */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 hidden md:flex w-16 h-16 bg-black border-4 border-cyan-500 rounded-full items-center justify-center shadow-2xl shadow-cyan-500/50">
                    <span className="text-xl font-black text-white italic">VS</span>
                </div>

                <PlayerCard title="JAG (YOU)" stats={userStats} onChange={setUserStats} color="cyan" />

                <div>
                    <div className="flex justify-end mb-4">
                        <select
                            value={presetName}
                            onChange={(e) => {
                                setPresetName(e.target.value);
                                const p = PRESETS.find(x => x.name === e.target.value);
                                if (p) setPartnerStats({ ...p });
                            }}
                            className="bg-slate-800 text-xs font-bold text-white px-3 py-1 rounded uppercase tracking-widest outline-none border border-white/10 focus:border-cyan-500"
                        >
                            {PRESETS.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                            <option value="Custom">Custom</option>
                        </select>
                    </div>
                    <PlayerCard title={partnerStats.name} stats={partnerStats} onChange={setPartnerStats} color="rose" />
                </div>
            </div>

            {/* TACTICAL BOARD */}
            <div className="bg-slate-900 border border-white/5 rounded-3xl p-8 relative overflow-hidden">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* ANALYSIS COLUMN */}
                    <div className="bg-slate-950/50 rounded-2xl p-6 border border-white/5 flex flex-col gap-6">

                        {/* SYNERGY */}
                        <div className="text-center">
                            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Team Synergy</h4>
                            <div className="text-4xl font-black text-white mb-1">{synergy}%</div>
                            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                <div className={`h-full ${synergy > 80 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${synergy}%` }}></div>
                            </div>
                        </div>

                        {/* WIN PROB */}
                        <div className="text-center">
                            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Win Probability</h4>
                            <div className="text-4xl font-black text-cyan-400 mb-1">{Math.round(winProb)}%</div>
                            <p className="text-[9px] text-slate-400">vs Average Duo</p>
                        </div>

                        {/* TRANSITION PENALTY */}
                        <div className="text-center bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">
                            <h4 className="text-[9px] font-black text-rose-400 uppercase tracking-widest mb-1">Transition Loss</h4>
                            <div className="text-xl font-black text-white">+{transitionPenalty}s</div>
                            <p className="text-[9px] text-slate-400">Time lost switching</p>
                        </div>
                    </div>

                    {/* STRATEGY COLUMN */}
                    <div className="lg:col-span-2 flex flex-col justify-between">
                        <div className="mb-6">
                            <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">🤖 Coach AI Analysis</h4>
                            <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-xl space-y-2">
                                {advice.map((tip, i) => (
                                    <div key={i} className="flex gap-3 items-start">
                                        <span className="text-indigo-400 mt-0.5">💡</span>
                                        <p className="text-sm text-slate-200 leading-snug">{tip}</p>
                                    </div>
                                ))}
                                {advice.length === 0 && <p className="text-sm text-slate-400">Inga specifika råd. Ni ser stabila ut.</p>}
                            </div>
                        </div>

                        <div>
                            <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Optimal Tactical Split</h4>
                            <div className="grid grid-cols-4 sm:grid-cols-4 gap-3">
                                {predictedSplit.map(s => (
                                    <div key={s.id} className={`p-3 rounded-xl border flex flex-col items-center text-center transition-all relative overflow-hidden ${s.assignedTo === 'ME' ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-rose-500/10 border-rose-500/30'
                                        }`}>
                                        <span className="text-[9px] font-bold text-slate-400 uppercase mb-1">{s.name}</span>
                                        {s.weight && <span className="text-[8px] text-slate-500 absolute top-1 right-1">{s.weight}</span>}

                                        <span className={`text-lg font-black ${s.assignedTo === 'ME' ? 'text-cyan-400' : 'text-rose-400'}`}>
                                            {s.assignedTo === 'ME' ? 'YOU' : 'PARTNER'}
                                        </span>

                                        {/* STRENGTH WARNING */}
                                        {s.type === 'strength' && (
                                            (s.assignedTo === 'ME' && userStats.strengthLevel < 40) ||
                                            (s.assignedTo === 'PARTNER' && partnerStats.strengthLevel < 40)
                                        ) && (
                                                <div className="absolute bottom-0 inset-x-0 bg-red-500 text-white text-[8px] font-bold py-0.5">WEAK!</div>
                                            )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ATTRIBUTE COMPARISON */}
            <div className="bg-slate-900 border border-white/5 rounded-3xl p-8">
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-6 text-center">Attribute Head-to-Head</h4>
                <div className="space-y-6 max-w-2xl mx-auto">
                    <ComparisonBar label="Running (5k Capacity)" val1={userStats.runLevel} val2={partnerStats.runLevel} c1="cyan" c2="rose" />
                    <ComparisonBar label="Strength (Sleds/Lunges)" val1={userStats.strengthLevel} val2={partnerStats.strengthLevel} c1="cyan" c2="rose" />
                    <ComparisonBar label="Engine (Burpees/Row)" val1={userStats.engineLevel} val2={partnerStats.engineLevel} c1="cyan" c2="rose" />
                </div>
            </div>
        </div>
    );
}

// SUBCOMPONENTS

const PlayerCard = ({ title, stats, onChange, color }: any) => {
    const update = (key: keyof PartnerStats, val: any) => onChange({ ...stats, [key]: val });

    return (
        <div className={`bg-slate-900 border border-${color}-500/30 rounded-3xl p-6 shadow-xl shadow-${color}-900/10`}>
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/5">
                <h3 className={`text-xl font-black text-${color}-400 italic`}>{title}</h3>
                <div className="flex gap-2">
                    <button onClick={() => update('gender', 'MALE')} className={`text-[10px] px-2 py-1 rounded font-bold ${stats.gender === 'MALE' ? `bg-${color}-500 text-black` : 'bg-slate-800 text-slate-500'}`}>MALE</button>
                    <button onClick={() => update('gender', 'FEMALE')} className={`text-[10px] px-2 py-1 rounded font-bold ${stats.gender === 'FEMALE' ? `bg-${color}-500 text-black` : 'bg-slate-800 text-slate-500'}`}>FEMALE</button>
                </div>
            </div>

            <div className="space-y-5">
                <StatSlider label="Running Lvl" value={stats.runLevel} onChange={(v: number) => update('runLevel', v)} color={color} />
                <StatSlider label="Strength Lvl" value={stats.strengthLevel} onChange={(v: number) => update('strengthLevel', v)} color={color} />
                <StatSlider label="Engine Lvl" value={stats.engineLevel} onChange={(v: number) => update('engineLevel', v)} color={color} />
            </div>
        </div>
    )
}

const StatSlider = ({ label, value, onChange, color }: any) => (
    <div>
        <div className="flex justify-between text-[10px] uppercase font-bold text-slate-400 mb-1.5">
            <span>{label}</span>
            <span className={`text-${color}-400 ml-2`}>{value}/100</span>
        </div>
        <input
            type="range" min="0" max="100"
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className={`w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-${color}-500`}
        />
    </div>
)

const ComparisonBar = ({ label, val1, val2, c1, c2 }: any) => (
    <div className="relative pt-6">
        <div className="absolute top-0 left-0 right-0 flex justify-between text-[10px] font-bold text-slate-500 uppercase">
            <span>{label}</span>
        </div>

        {/* CENTER LINE */}
        <div className="absolute top-6 bottom-0 left-1/2 w-px bg-white/10 z-0"></div>

        <div className="flex items-center h-8 relative z-10">
            {/* LEFT BAR (USER) */}
            <div className="flex-1 flex justify-end pr-2">
                <div className={`h-full rounded-l bg-${c1}-500 transition-all duration-500 flex items-center justify-end px-2 text-[10px] font-bold text-black`} style={{ width: `${val1}%` }}>
                    {val1}
                </div>
            </div>

            {/* RIGHT BAR (PARTNER) */}
            <div className="flex-1 flex justify-start pl-2">
                <div className={`h-full rounded-r bg-${c2}-500 transition-all duration-500 flex items-center justify-start px-2 text-[10px] font-bold text-black`} style={{ width: `${val2}%` }}>
                    {val2}
                </div>
            </div>
        </div>
    </div>
)
