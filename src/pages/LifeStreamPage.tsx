import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Activity,
    Filter,
    Settings,
    RefreshCw,
    TrendingUp,
    Users,
    ChevronRight,
    Search
} from 'lucide-react';
import { useData } from '../context/DataContext.tsx';
import { FeedEventCard } from '../components/feed/FeedEventCard.tsx';
import { aggregateFeedEvents } from '../api/services/feedAggregator.ts';
import type { FeedEvent, FeedEventCategory } from '../models/feedTypes.ts';

const CATEGORIES: { id: FeedEventCategory; label: string; icon: string }[] = [
    { id: 'TRAINING', label: 'Träning', icon: '🏋️' },
    { id: 'NUTRITION', label: 'Kost', icon: '🥗' },
    { id: 'HEALTH', label: 'Hälsa', icon: '😴' },
    { id: 'SOCIAL', label: 'Socialt', icon: '👥' },
];

export function LifeStreamPage() {
    const navigate = useNavigate();
    const { currentUser } = useData();
    const [events, setEvents] = useState<FeedEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeCategories, setActiveCategories] = useState<FeedEventCategory[]>(['TRAINING', 'NUTRITION', 'HEALTH', 'SOCIAL']);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState<{ followingCount: number; trainingForm: number }>({
        followingCount: 0,
        trainingForm: 0
    });

    const fetchFeed = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('auth_token');
            const catParam = activeCategories.join(',');
            const res = await fetch(`http://localhost:8000/api/feed?limit=50&categories=${catParam}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                // Apply smart aggregation
                const aggregated = aggregateFeedEvents(data.events);
                setEvents(aggregated);
            }
        } catch (err) {
            console.error('Failed to fetch feed:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const fetchStats = async () => {
        try {
            const token = localStorage.getItem('auth_token');
            const res = await fetch(`http://localhost:8000/api/feed/stats`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
        } catch (err) {
            console.error('Failed to fetch feed stats:', err);
        }
    };

    useEffect(() => {
        fetchFeed();
        fetchStats();

        // Implement 30s polling for live updates
        const interval = setInterval(() => {
            fetchFeed();
            fetchStats();
        }, 30000);

        return () => clearInterval(interval);
    }, [activeCategories]);

    const handleFeedUpdate = () => {
        fetchFeed();
    };

    const toggleCategory = (cat: FeedEventCategory) => {
        setActiveCategories(prev =>
            prev.includes(cat)
                ? prev.filter(c => c !== cat)
                : [...prev, cat]
        );
    };

    const handleRefresh = () => {
        setRefreshing(true);
        fetchFeed();
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white pb-24">
            {/* Header */}
            <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-xl border-b border-white/5 px-4 py-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                            <Activity className="text-white" size={24} />
                        </div>
                        <div>
                            <h1 className="text-xl font-black tracking-tight">LIFE STREAM</h1>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Universal Activity Feed</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleRefresh}
                            className={`p-2 rounded-xl bg-slate-900 border border-white/5 text-slate-400 hover:text-white transition-all ${refreshing ? 'animate-spin' : ''}`}
                        >
                            <RefreshCw size={20} />
                        </button>
                        <button
                            onClick={() => navigate('/profile')}
                            className="p-2 rounded-xl bg-slate-900 border border-white/5 text-slate-400 hover:text-white transition-all"
                        >
                            <Settings size={20} />
                        </button>
                    </div>
                </div>

                {/* Categories Filter */}
                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar mask-fade-right">
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => toggleCategory(cat.id)}
                            className={`
                                flex items-center gap-2 px-4 py-2 rounded-full border whitespace-nowrap transition-all text-xs font-bold
                                ${activeCategories.includes(cat.id)
                                    ? 'bg-white text-black border-white'
                                    : 'bg-slate-900 text-slate-400 border-white/5 hover:border-white/20'}
                            `}
                        >
                            <span>{cat.icon}</span>
                            <span>{cat.label}</span>
                        </button>
                    ))}
                </div>
            </header>

            <main className="px-4 py-6 max-w-2xl mx-auto">
                {/* Stats / Highlight Bar (Optional) */}
                <div className="grid grid-cols-2 gap-3 mb-8">
                    <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-2xl border border-white/5 p-4 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                            <TrendingUp size={24} />
                        </div>
                        <div>
                            <div className="text-[10px] text-slate-500 font-black uppercase">Veckans Form</div>
                            <div className="text-lg font-black text-white">
                                {stats.trainingForm > 0 ? `+${stats.trainingForm}%` : `${stats.trainingForm}%`}
                            </div>
                        </div>
                    </div>
                    <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-2xl border border-white/5 p-4 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                            <Users size={24} />
                        </div>
                        <div>
                            <div className="text-[10px] text-slate-500 font-black uppercase">Följer</div>
                            <div className="text-lg font-black text-white">{stats.followingCount}</div>
                        </div>
                    </div>
                </div>

                {/* Feed Content */}
                <div className="space-y-4">
                    {loading && !refreshing ? (
                        <div className="flex flex-col items-center justify-center py-20 opacity-50">
                            <RefreshCw className="animate-spin text-emerald-500 mb-4" size={40} />
                            <p className="text-sm font-bold text-slate-500">Hämtar flöde...</p>
                        </div>
                    ) : events.length > 0 ? (
                        events.map((event, index) => (
                            <FeedEventCard
                                key={event.id}
                                event={event}
                                userName={event.userId === currentUser?.id ? 'Du' : `Användare ${event.userId.slice(0, 4)}`}
                                onUpdate={handleFeedUpdate}
                            />
                        ))
                    ) : (
                        <div className="text-center py-20 bg-slate-900/50 rounded-3xl border border-dashed border-white/10">
                            <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-500">
                                <Search size={32} />
                            </div>
                            <h3 className="text-lg font-bold text-white mb-1">Inget att visa ännu</h3>
                            <p className="text-sm text-slate-500 px-10">
                                Börja följa vänner eller logga dina egna aktiviteter för att fylla flödet.
                            </p>
                            <button
                                onClick={() => navigate('/community')}
                                className="mt-6 px-6 py-2 bg-emerald-500 text-black font-bold rounded-full hover:bg-emerald-400 transition-colors"
                            >
                                Hitta vänner
                            </button>
                        </div>
                    )}

                    {/* End of feed sentinel */}
                    {!loading && events.length > 0 && (
                        <div className="text-center py-10 opacity-30">
                            <div className="text-[10px] font-black uppercase tracking-[0.2em]">Du är helt uppdaterad</div>
                            <div className="mt-2 w-1 h-1 bg-white rounded-full mx-auto"></div>
                        </div>
                    )}
                </div>
            </main>

            {/* Floating Action? Maybe for quick log */}
        </div>
    );
}

export default LifeStreamPage;
