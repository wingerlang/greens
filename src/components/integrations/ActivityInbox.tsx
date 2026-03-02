import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { UniversalActivity } from '../../models/types.ts';

export function ActivityInbox() {
    const { token, user } = useAuth();
    const [activities, setActivities] = useState<UniversalActivity[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!token && !user) return;
        fetchInbox();
    }, [token, user]);

    const fetchInbox = async () => {
        try {
            // Fetch last 14 days for now
            const end = new Date().toISOString().split('T')[0];
            const start = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

            const headers: HeadersInit = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(`/api/activities?start=${start}&end=${end}`, {
                headers
            });
            const data = await res.json();

            if (data.activities) {
                // Filter for things with performance data (completed)
                // Sort descending by date
                const sorted = (data.activities as UniversalActivity[])
                    .filter(a => a.status === 'COMPLETED' || a.performance)
                    .sort((a, b) => b.date.localeCompare(a.date));
                setActivities(sorted);
            }
        } catch (err) {
            console.error('Failed to load activity inbox', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="p-4 text-center text-slate-500">Laddar aktiviteter...</div>;
    }

    return (
        <section className="mt-8">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">Senaste Aktiviteter 📥</h2>
                <button onClick={fetchInbox} className="text-xs text-slate-400 hover:text-white">Uppdatera</button>
            </div>

            <div className="space-y-3">
                {activities.map(activity => (
                    <div key={activity.id} className="glass-card p-4 rounded-xl flex items-center justify-between group hover:bg-slate-800/50 transition-colors">
                        <div className="flex items-center gap-4">
                            {/* Icon based on source */}
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg shadow-lg ${activity.performance?.source?.source === 'strava'
                                ? 'bg-[#FC4C02] text-white'
                                : 'bg-emerald-500 text-slate-900'
                                }`}>
                                {activity.plan?.activityType === 'cycling' || activity.performance?.notes?.toLowerCase().includes('ride') ? '🚴' : '🏃'}
                            </div>

                            <div>
                                <div className="font-bold text-white text-sm flex items-center gap-2">
                                    {activity.performance?.notes || activity.plan?.title || 'Okänd Aktivitet'}
                                    {activity.performance?.source?.source === 'strava' && (
                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">STRAVA</span>
                                    )}
                                </div>
                                <div className="text-xs text-slate-400 flex gap-3 mt-0.5">
                                    <span>📅 {activity.date}</span>
                                    <span>📏 {activity.performance?.distanceKm?.toFixed(1)} km</span>
                                    <span>⏱️ {activity.performance?.durationMinutes?.toFixed(1)} min</span>
                                </div>
                            </div>
                        </div>

                        {/* Status/Action */}
                        <div className="text-right">
                            {activity.plan ? (
                                <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20">
                                    Matchad ✓
                                </div>
                            ) : (
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-800 px-2 py-1 rounded-full border border-white/5">
                                    Importerad
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {activities.length === 0 && (
                    <div className="text-center py-8 text-slate-500 bg-slate-900/30 rounded-xl border border-dashed border-slate-800">
                        Inga aktiviteter hittades de senaste 14 dagarna.
                    </div>
                )}
            </div>
        </section>
    );
}
