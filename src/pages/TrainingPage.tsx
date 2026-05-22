import { TrainingTabs } from '../components/training/TrainingTabs.tsx';
import React, { useState, useEffect, useMemo } from 'react';
import { ExerciseEntry, UniversalActivity } from '../models/types.ts';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useData } from '../context/DataContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useSettings } from '../context/SettingsContext.tsx';
import { ActivityDetailModal } from '../components/activities/ActivityDetailModal.tsx';
import {
    WEEKDAY_LABELS
} from '../models/types.ts';
import { useSmartPlanner } from '../hooks/useSmartPlanner.ts';
import { useHealth } from '../hooks/useHealth.ts';
import { getISODate } from '../models/types.ts';
import { RunningStatsView } from './Health/RunningStatsView.tsx';
import { RaceList } from '../components/training/RaceList.tsx';
import { DataAnalysisView } from './training/DataAnalysisView.tsx';
import { KonditionView } from './Health/KonditionView.tsx';
import { TrainingOverview } from '../components/training/TrainingOverview.tsx';
import { CurrentFitnessView } from '../components/training/CurrentFitnessView.tsx';
import { CardioVolumeDashboard } from '../components/training/CardioVolumeDashboard.tsx';
import { EXERCISE_TYPES, INTENSITIES } from '../components/training/ExerciseModal.tsx';
import { formatActivityDuration } from '../utils/durationFormatter.ts';
import './TrainingPage.css';

export function TrainingPage() {
    const {
        exerciseEntries: legacyExerciseEntries = [],
        addExercise,
        deleteExercise,
        calculateBMR,
        universalActivities = [],
        unifiedActivities = [],
        plannedActivities = []
    } = useData();

    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { tab, subTab, id } = useParams<{ tab?: string; subTab?: string; id?: string }>();

    const selectedActivityId = searchParams.get('activityId');
    const setSelectedActivityId = (id: string | null) => {
        setSearchParams(prev => {
            if (id) {
                prev.set('activityId', id);
            } else {
                prev.delete('activityId');
            }
            return prev;
        }, { replace: true });
    };

    // Robust activity finding logic (used in the modal overlay)
    const foundActivity = useMemo(() => {
        if (!selectedActivityId || unifiedActivities.length === 0) return null;

        // The ID might contain a tab suffix like "123/splits", extract just the ID part
        const cleanId = selectedActivityId.split('/')[0];

        // Try to find activity robustly: check id, externalId, and merged sub-IDs
        return unifiedActivities.find(e => {
            // 1. Direct match (id or externalId)
            if (e.id === cleanId || e.externalId === cleanId) return true;

            // 2. Check source-specific IDs
            if ((e as any).stravaId === cleanId || (e as any).strengthId === cleanId) return true;

            // 3. Check merged data
            if (e._mergeData) {
                const m = e._mergeData;
                const stravaId = m.strava?.id;
                const stravaExtId = m.strava?.externalId;
                const strengthId = m.strength?.id;
                const strengthExtId = m.strength?.externalId;
                const universalId = m.universalActivity?.id;
                const universalExtId = m.universalActivity?.performance?.source?.externalId;
                const originalIds = m.universalActivity?.mergeInfo?.originalActivityIds || [];

                return stravaId === cleanId ||
                    stravaExtId === cleanId ||
                    strengthId === cleanId ||
                    strengthExtId === cleanId ||
                    universalId === cleanId ||
                    universalExtId === cleanId ||
                    originalIds.includes(cleanId) ||
                    originalIds.some((id: string) => id.includes(cleanId)); // Support partial matches for prefixed IDs
            }
            return false;
        });
    }, [selectedActivityId, unifiedActivities]);

    // URL State Management
    const currentTab = useMemo(() => {
        if (!tab) return 'kalender';
        if (tab === 'kalender') return 'kalender';
        if (/^\d{4}$/.test(tab)) return 'kalender';
        return (['kalender', 'styrka', 'kondition', 'form', 'races', 'lopstatistik', 'dataanalys', 'cardio'].includes(tab) ? tab : 'kalender') as any;
    }, [tab]);

    const initialCalendarMonth = useMemo(() => {
        if (tab === 'kalender' && subTab) {
            const months = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];
            const idx = months.indexOf(subTab.toLowerCase());
            return idx >= 0 ? idx : undefined;
        }
        if (!tab || !/^\d{4}$/.test(tab) || !subTab) return undefined;
        const months = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];
        const idx = months.indexOf(subTab.toLowerCase());
        return idx >= 0 ? idx : undefined;
    }, [tab, subTab]);

    const initialCalendarDay = useMemo(() => {
        if (tab === 'kalender' && subTab && id) {
            const day = parseInt(id, 10);
            return isNaN(day) ? undefined : day;
        }
        if (!tab || !/^\d{4}$/.test(tab) || !subTab || !id) return undefined;
        const day = parseInt(id, 10);
        return isNaN(day) ? undefined : day;
    }, [tab, subTab, id]);

    // Handle Tab Switching
    const handleTabChange = (newTab: string) => {
        if (newTab === 'styrka' && currentTab !== 'styrka') {
            navigate('/styrka');
        } else if (newTab === 'kalender') {
            navigate('/träning/kalender');
        } else {
            navigate(`/training/${newTab}`);
        }
    };




    // Period Filter State
    const [activePreset, setActivePreset] = useState<'all' | 'ytd' | 'prev' | '3m' | '6m' | '9m' | 'ttm' | '3y' | '4w' | '8w' | '12w'>('all');
    const [filterStartDate, setFilterStartDate] = useState<string | null>(null);
    const [filterEndDate, setFilterEndDate] = useState<string | null>(null);

    const applyPeriodPreset = (preset: typeof activePreset) => {
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        setActivePreset(preset);

        switch (preset) {
            case 'all':
                // Find earliest date
                if (legacyExerciseEntries.length > 0) {
                    const sorted = [...legacyExerciseEntries].sort((a, b) => a.date.localeCompare(b.date));
                    setFilterStartDate(sorted[0].date.split('T')[0]);
                } else {
                    setFilterStartDate(null);
                }
                setFilterEndDate(null);
                break;
            case 'ytd':
                setFilterStartDate(`${now.getFullYear()}-01-01`);
                setFilterEndDate(today);
                break;
            case 'prev':
                setFilterStartDate(`${now.getFullYear() - 1}-01-01`);
                setFilterEndDate(`${now.getFullYear() - 1}-12-31`);
                break;
            case '3m': {
                const d = new Date();
                d.setMonth(d.getMonth() - 3);
                setFilterStartDate(d.toISOString().split('T')[0]);
                setFilterEndDate(today);
                break;
            }
            case '6m': {
                const d = new Date();
                d.setMonth(d.getMonth() - 6);
                setFilterStartDate(d.toISOString().split('T')[0]);
                setFilterEndDate(today);
                break;
            }
            case '9m': {
                const d = new Date();
                d.setMonth(d.getMonth() - 9);
                setFilterStartDate(d.toISOString().split('T')[0]);
                setFilterEndDate(today);
                break;
            }
            case 'ttm': {
                const d = new Date();
                d.setFullYear(d.getFullYear() - 1);
                setFilterStartDate(d.toISOString().split('T')[0]);
                setFilterEndDate(today);
                break;
            }
            case '3y': {
                const d = new Date();
                d.setFullYear(d.getFullYear() - 3);
                setFilterStartDate(d.toISOString().split('T')[0]);
                setFilterEndDate(today);
                break;
            }
            case '4w': {
                const d = new Date();
                d.setDate(d.getDate() - 28);
                setFilterStartDate(d.toISOString().split('T')[0]);
                setFilterEndDate(today);
                break;
            }
            case '8w': {
                const d = new Date();
                d.setDate(d.getDate() - 56);
                setFilterStartDate(d.toISOString().split('T')[0]);
                setFilterEndDate(today);
                break;
            }
            case '12w': {
                const d = new Date();
                d.setDate(d.getDate() - 84);
                setFilterStartDate(d.toISOString().split('T')[0]);
                setFilterEndDate(today);
                break;
            }
        }
    };

    // Merge Data - combine server and local entries
    const exerciseEntries = useMemo(() => {
        return unifiedActivities;
    }, [unifiedActivities]);

    // Apply Period Filter to data
    const filteredExerciseEntries = useMemo(() => {
        return exerciseEntries
            .filter(e => {
                if (filterStartDate && e.date < filterStartDate) return false;
                if (filterEndDate && e.date > filterEndDate) return false;
                return true;
            })
            .sort((a, b) => {
                const dateCompare = b.date.localeCompare(a.date); // Descending (Newer first)
                if (dateCompare !== 0) return dateCompare;
                
                const timeA = a.startTime || '00:00';
                const timeB = b.startTime || '00:00';
                return timeA.localeCompare(timeB); // Ascending (Earlier first)
            });
    }, [exerciseEntries, filterStartDate, filterEndDate]);



    const { settings, updateSettings } = useSettings();

    const [selectedDate, setSelectedDate] = useState(getISODate());



    const {
        bmr,
        tdee: dailyTdee,
        dailyCaloriesBurned: dailyBurned,
        activeCycle,
        goalAdjustment,
        dailyExercises
    } = useHealth(selectedDate);

    const tdee = dailyTdee + goalAdjustment;

    const handleEditExercise = (ex: any) => {
        setSelectedActivityId(ex.id);
    };
    return (
        <div className="training-page">
            {/* Tab Navigation */}
            <TrainingTabs currentTab={currentTab} />


            {/* Period Selector */}
            <div className="-mx-4 px-4 py-1 bg-slate-950/80 backdrop-blur-xl border-b border-white/5 shadow-2xl">
                <div className="flex flex-nowrap items-center gap-2 max-w-7xl mx-auto overflow-x-auto no-scrollbar">
                    <div className="flex items-center gap-2 px-3 border-r border-white/5 mr-1">
                        <span className="text-xl">📅</span>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest hidden sm:block">Visa Period</span>
                    </div>
                    {[
                        { id: 'all', label: 'ALLT' },
                        { id: '3y', label: '3 ÅR' },
                        { id: 'ytd', label: 'I ÅR' },
                        { id: 'prev', label: 'FÖREG. ÅR' },
                        { id: 'ttm', label: 'TTM (12M)' },
                        { id: '3m', label: '3 MÅN' },
                        { id: '12w', label: '12 V' },
                        { id: '8w', label: '8 V' },
                        { id: '4w', label: '4 V' }
                    ].map(p => (
                        <button
                            key={p.id}
                            onClick={() => applyPeriodPreset(p.id as any)}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex-shrink-0 ${activePreset === p.id
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                                : 'text-slate-500 hover:text-white hover:bg-white/5 border border-transparent'
                                }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Conditionally render based on tab */}
            {
                currentTab === 'kalender' && (
                    <>

                        {/* Dashboard Overview */}
                        <TrainingOverview
                            exercises={filteredExerciseEntries}
                            plannedActivities={plannedActivities}
                            year={tab && /^\d{4}$/.test(tab) ? parseInt(tab, 10) : (filterStartDate ? new Date(filterStartDate).getFullYear() : new Date().getFullYear())}
                            isFiltered={true}
                            onExerciseClick={handleEditExercise}
                            periodLabel={
                                activePreset === 'all' ? 'Total Volym' :
                                    activePreset === 'ytd' ? `Årsvolym ${new Date().getFullYear()}` :
                                        activePreset === 'prev' ? `Årsvolym ${new Date().getFullYear() - 1}` :
                                            activePreset === 'ttm' ? 'Trailing 12 Months' :
                                                `Periodens Volym (${activePreset.toUpperCase()})`
                            }
                            initialCalendarMonth={initialCalendarMonth}
                            initialCalendarDay={initialCalendarDay}
                            hideStats={true}
                        />

                        {/* Training Log Section */}

                        {/* Full Width Layout for Charts */}
                        {/* Analysis Grid */}

                        {/* Exercise Log */}
                        <div className="content-card">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="section-title">Träningsdagbok</h3>
                                <div className="flex items-center gap-4">
                                    {activePreset !== 'all' && (
                                        <div className="text-[10px] font-black text-blue-400 bg-blue-400/10 px-3 py-1 rounded-full border border-blue-400/20">
                                            FILTER AKTIVT
                                        </div>
                                    )}
                                    <input
                                        type="date"
                                        value={selectedDate}
                                        onChange={(e) => setSelectedDate(e.target.value)}
                                        className="bg-slate-800 border-none rounded-lg text-xs p-2 text-white"
                                    />
                                </div>
                            </div>

                            <div className="exercise-list space-y-2">
                                {dailyExercises.length > 0 ? (
                                    dailyExercises.map(ex => (
                                        <div
                                            key={ex.id}
                                            className="exercise-row p-3 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between group hover:bg-white/10 transition-all cursor-pointer"
                                            onClick={() => handleEditExercise(ex)}
                                        >
                                            <div className="flex items-center gap-4">
                                                <span className="text-2xl">{EXERCISE_TYPES.find(t => t.type === ex.type)?.icon}</span>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-sm">{EXERCISE_TYPES.find(t => t.type === ex.type)?.label}</span>
                                                        <span className={`text-[10px] font-bold uppercase ${INTENSITIES.find(i => i.value === ex.intensity)?.color}`}>
                                                            {INTENSITIES.find(i => i.value === ex.intensity)?.label}
                                                        </span>
                                                    </div>
                                                    <div className="text-xs text-slate-500">{formatActivityDuration(ex.durationMinutes)} • {ex.notes || 'Inga anteckningar'}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className="text-rose-400 font-bold text-sm">-{ex.caloriesBurned} kcal</span>
                                                <button
                                                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-500 transition-all"
                                                    onClick={(e) => { e.stopPropagation(); deleteExercise(ex.id); }}
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-8 text-slate-600 italic text-sm">Ingen träning loggad för {selectedDate}</div>
                                )}
                            </div>
                        </div>


                    </>
                )
            }

            {
                currentTab === 'kondition' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <KonditionView
                            filterStartDate={filterStartDate}
                            filterEndDate={filterEndDate}
                            exerciseEntries={exerciseEntries}
                            universalActivities={universalActivities}
                        />
                    </div>
                )
            }

            {
                currentTab === 'form' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <CurrentFitnessView
                            exerciseEntries={exerciseEntries}
                            universalActivities={universalActivities}
                            filterStartDate={filterStartDate}
                            filterEndDate={filterEndDate}
                            onOpenActivity={setSelectedActivityId}
                        />
                    </div>
                )
            }

            {
                currentTab === 'races' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <RaceList
                            exerciseEntries={exerciseEntries}
                            universalActivities={universalActivities}
                            filterStartDate={filterStartDate}
                            filterEndDate={filterEndDate}
                            subTab={subTab}
                            seriesId={id}
                            onSelectActivity={setSelectedActivityId}
                        />
                    </div>
                )
            }

            {
                currentTab === 'lopstatistik' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <RunningStatsView
                            exerciseEntries={exerciseEntries}
                            universalActivities={universalActivities}
                            filterStartDate={filterStartDate}
                            filterEndDate={filterEndDate}
                        />
                    </div>
                )
            }

            {
                currentTab === 'dataanalys' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <DataAnalysisView
                            exerciseEntries={exerciseEntries}
                            universalActivities={universalActivities}
                            onSelectActivity={setSelectedActivityId}
                        />
                    </div>
                )
            }


            {
                currentTab === 'cardio' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <CardioVolumeDashboard
                            exercises={filteredExerciseEntries}
                            universalActivities={universalActivities}
                            plannedActivities={plannedActivities}
                        />
                    </div>
                )
            }
            {selectedActivityId && (
                <>
                    {foundActivity ? (
                        <ActivityDetailModal
                            activity={foundActivity}
                            onClose={() => setSelectedActivityId(null)}
                            onSelectActivity={setSelectedActivityId}
                        />
                    ) : (
                        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[60] flex items-center justify-center animate-in fade-in duration-300">
                            <div className="bg-slate-900 border border-white/5 p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4 max-w-sm text-center">
                                <div className="w-12 h-12 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                                <div>
                                    <h3 className="text-white font-bold">Söker efter aktivitet...</h3>
                                    <p className="text-xs text-slate-500 mt-1">Vi synkroniserar din träningslogg ({selectedActivityId.substring(0, 8)}...)</p>
                                </div>
                                <button
                                    onClick={() => setSelectedActivityId(null)}
                                    className="mt-2 text-xs font-bold text-slate-400 hover:text-white transition-colors"
                                >
                                    Avbryt
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}


        </div >
    );
}

export default TrainingPage;
