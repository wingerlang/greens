
import React, { useEffect, useState } from 'react';
import { statisticsService, CommunityStats } from '../services/statisticsService.ts';
import { ComparisonBar } from '../components/charts/ComparisonBar.tsx';
import { RadarProfile } from '../components/charts/RadarProfile.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { Link } from 'react-router-dom';

export function CommunityStatsPage() {
    const { user } = useAuth();
    const [stats, setStats] = useState<CommunityStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'strength' | 'cardio'>('overview');
    const [exerciseSearch, setExerciseSearch] = useState('');
    const [selectedExercise, setSelectedExercise] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        const data = await statisticsService.getCommunityStats();
        setStats(data);
        setLoading(false);

        // Select first exercise by default
        if (data && data.strength.topExercises.length > 0) {
            setSelectedExercise(data.strength.topExercises[0].toLowerCase());
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
            </div>
        );
    }

    if (!stats) return <div className="p-8 text-center text-red-500">Kunde inte ladda statistik.</div>;

    // Derived Data for Radar Chart (Mock Logic for now)
    const radarData = [
        { subject: 'Volym', A: 85, B: 50, fullMark: 100 },
        { subject: 'Styrka', A: 65, B: 50, fullMark: 100 },
        { subject: 'Kondition', A: 90, B: 50, fullMark: 100 },
        { subject: 'Frekvens', A: 70, B: 50, fullMark: 100 },
        { subject: 'Mångsidighet', A: 40, B: 50, fullMark: 100 },
    ];

    const formatDuration = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return `${h}h ${m}m ${s}s`;
        return `${m}m ${s}s`;
    };

    const selectedExerciseData = selectedExercise ? stats.strength.exercises[selectedExercise] : null;

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
            {/* Header */}
            <div className="space-y-6 border-b border-slate-800 pb-8">
                <div className="flex flex-col md:flex-row justify-between items-end gap-6">
                    <div>
                        <h1 className="text-4xl font-black text-white mb-2 tracking-tight">Statistik</h1>
                        <p className="text-gray-400">
                            Jämför dig mot {stats.global.totalUsers} andra atleter i communityt.
                        </p>
                    </div>

                    {/* Main Nav Tabs */}
                    <div className="flex gap-2 bg-slate-900/50 p-1 rounded-xl border border-slate-800">
                        <Link
                            to="/community"
                            className="px-6 py-2 rounded-lg text-sm font-bold transition-all text-gray-400 hover:text-white hover:bg-slate-800"
                        >
                            Medlemmar
                        </Link>
                        <Link
                            to="/community/stats"
                            className="px-6 py-2 rounded-lg text-sm font-bold transition-all bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
                        >
                            Statistik
                        </Link>
                    </div>
                </div>

                {/* Page Sub-Tabs */}
                <div className="flex gap-2">
                    {(['overview', 'strength', 'cardio'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                                activeTab === tab
                                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                                    : 'text-gray-400 hover:text-white hover:bg-slate-800'
                            }`}
                        >
                            {tab === 'overview' ? 'Översikt' : tab === 'strength' ? 'Styrka' : 'Kondition'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && (
                <div className="space-y-8">
                    {/* Big Numbers */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatCard
                            label="Total Distans"
                            value={stats.global.totalDistanceKm.toLocaleString()}
                            unit="km"
                            icon="🌍"
                            color="text-sky-400"
                        />
                        <StatCard
                            label="Total Vikt"
                            value={(stats.global.totalTonnage / 1000).toFixed(0)}
                            unit="ton"
                            icon="🏋️‍♂️"
                            color="text-rose-400"
                        />
                        <StatCard
                            label="Antal Pass"
                            value={stats.global.totalWorkouts.toLocaleString()}
                            unit="st"
                            icon="🔥"
                            color="text-amber-400"
                        />
                         <StatCard
                            label="Mål Uppnådda"
                            value={stats.global.totalGoalsAchieved.toLocaleString()}
                            unit="st"
                            icon="🏆"
                            color="text-emerald-400"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {/* Radar Chart */}
                        <div className="md:col-span-1 h-96">
                            <RadarProfile data={radarData} />
                        </div>

                        {/* General Comparisons */}
                        <div className="md:col-span-2 grid grid-cols-1 gap-6">
                            <ComparisonBar
                                title="Pass per månad"
                                unit="st"
                                userValue={12} // Mock: fetch from user stats
                                avgValue={stats.averages.workoutsPerUser}
                                maxValue={stats.averages.workoutsPerUser * 2.5}
                                color="#f472b6"
                            />
                            <ComparisonBar
                                title="Snittlängd pass"
                                unit="min"
                                userValue={55} // Mock
                                avgValue={stats.averages.sessionDurationMinutes}
                                maxValue={90}
                                color="#60a5fa"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Strength Tab */}
            {activeTab === 'strength' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Exercise List */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 h-[600px] flex flex-col">
                        <h3 className="font-bold text-white mb-4">Övningar</h3>
                        <input
                            type="text"
                            placeholder="Sök övning..."
                            value={exerciseSearch}
                            onChange={(e) => setExerciseSearch(e.target.value)}
                            className="bg-slate-800 border-none rounded-lg px-4 py-2 text-white mb-4 w-full focus:ring-2 focus:ring-emerald-500"
                        />
                        <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                            {Object.values(stats.strength.exercises)
                                .filter(e => e.name.toLowerCase().includes(exerciseSearch.toLowerCase()))
                                .sort((a, b) => b.count - a.count)
                                .map(ex => (
                                    <button
                                        key={ex.name}
                                        onClick={() => setSelectedExercise(ex.name.toLowerCase())}
                                        className={`w-full text-left p-3 rounded-lg flex justify-between items-center transition-all ${
                                            selectedExercise === ex.name.toLowerCase()
                                                ? 'bg-emerald-600 text-white'
                                                : 'bg-slate-800/50 text-gray-300 hover:bg-slate-800'
                                        }`}
                                    >
                                        <span className="font-bold">{ex.name}</span>
                                        <span className="text-xs opacity-70">{ex.count} loggar</span>
                                    </button>
                                ))}
                        </div>
                    </div>

                    {/* Detail View */}
                    <div className="lg:col-span-2 space-y-6">
                        {selectedExerciseData ? (
                            <>
                                <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-2xl p-8">
                                    <div className="flex justify-between items-start mb-8">
                                        <div>
                                            <h2 className="text-3xl font-black text-white">{selectedExerciseData.name}</h2>
                                            <p className="text-emerald-400 font-medium">Community Favorit #{stats.strength.topExercises.indexOf(selectedExerciseData.name) + 1}</p>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-3xl font-black text-white">{selectedExerciseData.max1RM} kg</div>
                                            <div className="text-gray-400 text-sm uppercase font-bold tracking-wider">Högsta 1RM</div>
                                        </div>
                                    </div>

                                    <div className="space-y-8">
                                        <ComparisonBar
                                            title="Ditt 1RM vs Community"
                                            unit="kg"
                                            userValue={100} // Mock: Should be fetched from user PBs
                                            avgValue={selectedExerciseData.avg1RM}
                                            maxValue={selectedExerciseData.max1RM}
                                            color="#10b981"
                                        />

                                        <ComparisonBar
                                            title="Volym per pass"
                                            unit="kg"
                                            userValue={3500} // Mock
                                            avgValue={selectedExerciseData.avgTonnage}
                                            maxValue={selectedExerciseData.avgTonnage * 2}
                                            color="#a855f7"
                                        />
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-500">
                                Välj en övning för att se statistik
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Cardio Tab */}
            {activeTab === 'cardio' && (
                <div className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {['5k', '10k', '21k'].map(dist => {
                            const dStats = stats.cardio.distances[dist];
                            if (!dStats) return null;

                            return (
                                <div key={dist} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 relative overflow-hidden group hover:border-slate-600 transition-all">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 font-black text-6xl group-hover:scale-110 transition-transform">{dist}</div>
                                    <h3 className="text-2xl font-black text-white mb-6 uppercase italic">{dist}</h3>

                                    <div className="space-y-4 relative z-10">
                                        <div className="flex justify-between items-end border-b border-slate-800 pb-2">
                                            <span className="text-gray-400 text-sm">Snittid</span>
                                            <span className="text-xl font-bold text-white">{formatDuration(dStats.avgTimeSeconds)}</span>
                                        </div>
                                        <div className="flex justify-between items-end border-b border-slate-800 pb-2">
                                            <span className="text-gray-400 text-sm">Snabbast</span>
                                            <span className="text-xl font-bold text-amber-400">{formatDuration(dStats.fastestTimeSeconds)}</span>
                                        </div>
                                        <div className="pt-4">
                                            <div className="text-xs text-gray-500 uppercase font-bold mb-1">Din bästa tid</div>
                                            <div className="text-lg font-bold text-emerald-400">24m 30s</div>
                                            <div className="text-xs text-emerald-500/70 mt-1">Snabbare än 65% av communityt</div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Detailed Cardio Comparison */}
                     <div className="bg-slate-900/50 p-8 rounded-2xl border border-slate-800">
                        <h3 className="text-xl font-bold text-white mb-6">Distansfördelning</h3>
                        <p className="text-gray-400">Här skulle vi visa en graf över hur många som springer olika distanser (kommer snart).</p>
                     </div>
                </div>
            )}
        </div>
    );
}

function StatCard({ label, value, unit, icon, color }: { label: string, value: string, unit: string, icon: string, color: string }) {
    return (
        <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl flex flex-col items-center text-center hover:bg-slate-800/50 transition-colors">
            <div className="text-3xl mb-2">{icon}</div>
            <div className={`text-3xl lg:text-4xl font-black ${color} mb-1 tracking-tight`}>
                {value}<span className="text-lg text-gray-500 ml-1 font-bold">{unit}</span>
            </div>
            <div className="text-gray-400 text-xs font-bold uppercase tracking-wider">{label}</div>
        </div>
    );
}
