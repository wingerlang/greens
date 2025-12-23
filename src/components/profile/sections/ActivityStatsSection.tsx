// Activity Statistics Section
import React from 'react';
import { useActivityStats } from '../hooks/useActivityStats.ts';
import { formatDuration } from '../../../utils/dateUtils.ts';

const ACTIVITY_ICONS: Record<string, string> = {
    'Run': '🏃',
    'Ride': '🚴',
    'Swim': '🏊',
    'Walk': '🚶',
    'default': '💪'
};

export function ActivityStatsSection() {
    const { stats, loading } = useActivityStats();

    if (loading) return <div className="text-slate-500 text-center py-4">Laddar statistik...</div>;
    if (!stats) return <div className="text-slate-500 text-center py-4">Ingen data tillgänglig.</div>;

    const periods = [
        { key: 'thisWeek', label: 'Denna Vecka', data: stats.thisWeek },
        { key: 'lastWeek', label: 'Förra Veckan', data: stats.lastWeek },
        { key: 'thisMonth', label: 'Denna Månad', data: stats.thisMonth },
        { key: 'thisYear', label: 'I år', data: stats.thisYear },
        { key: 'allTime', label: 'Totalt', data: stats.allTime }
    ];

    return (
        <div className="space-y-6">
            {/* Period cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {periods.map(p => (
                    <div key={p.key} className="bg-slate-800/50 rounded-xl p-3">
                        <div className="text-slate-500 text-[10px] uppercase font-bold mb-2">{p.label}</div>
                        <div className="text-white text-xl font-black">{p.data.activities}</div>
                        <div className="text-slate-400 text-xs">aktiviteter</div>
                        <div className="text-emerald-400 text-sm font-bold mt-1">
                            {(p.data.totalDistance / 1000).toFixed(1)} km
                        </div>
                        <div className="text-slate-500 text-xs">{formatDuration(p.data.totalDuration)}</div>
                    </div>
                ))}
            </div>

            {/* By activity type */}
            {Object.keys(stats.byType || {}).length > 0 && (
                <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Per Aktivitetstyp</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {Object.entries(stats.byType).map(([type, data]) => (
                            <div key={type} className="bg-slate-800/30 rounded-lg p-3 flex items-center gap-3">
                                <span className="text-2xl">{ACTIVITY_ICONS[type] || ACTIVITY_ICONS.default}</span>
                                <div>
                                    <div className="text-white text-sm font-bold">{type}</div>
                                    <div className="text-slate-400 text-xs">{data.count} st • {(data.distance / 1000).toFixed(0)} km</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Week comparison */}
            {(stats.thisWeek.activities > 0 || stats.lastWeek.activities > 0) && (
                <div className="bg-slate-800/50 rounded-xl p-4">
                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Vecka vs Förra Veckan</h4>
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <div className="text-slate-500 text-xs">Aktiviteter</div>
                            <div className="text-white font-bold">{stats.thisWeek.activities} vs {stats.lastWeek.activities}</div>
                            {stats.thisWeek.activities > stats.lastWeek.activities &&
                                <span className="text-emerald-400 text-xs">📈 +{stats.thisWeek.activities - stats.lastWeek.activities}</span>
                            }
                        </div>
                        <div>
                            <div className="text-slate-500 text-xs">Distans</div>
                            <div className="text-white font-bold">
                                {(stats.thisWeek.totalDistance / 1000).toFixed(1)} vs {(stats.lastWeek.totalDistance / 1000).toFixed(1)} km
                            </div>
                        </div>
                        <div>
                            <div className="text-slate-500 text-xs">Kalorier</div>
                            <div className="text-white font-bold">{stats.thisWeek.totalCalories} vs {stats.lastWeek.totalCalories}</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Recent activities */}
            {stats.recentActivities?.length > 0 && (
                <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Senaste Aktiviteter</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {stats.recentActivities.slice(0, 5).map((act, i) => (
                            <div key={i} className="flex items-center justify-between bg-slate-800/30 rounded-lg p-2 px-3">
                                <div className="flex items-center gap-2">
                                    <span>{ACTIVITY_ICONS[act.type] || ACTIVITY_ICONS.default}</span>
                                    <div>
                                        <div className="text-white text-sm">{act.name || act.type}</div>
                                        <div className="text-slate-500 text-xs">{act.date?.split('T')[0]}</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-emerald-400 font-bold">{((act.distance || 0) / 1000).toFixed(1)} km</div>
                                    <div className="text-slate-500 text-xs">{formatDuration(act.duration || 0)}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
