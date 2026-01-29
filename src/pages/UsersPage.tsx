import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { socialService } from '../services/socialService.ts';
import { User, UserRole } from '../models/types.ts';

export function UsersPage() {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState<'relevance' | 'name' | 'newest' | 'stats'>('relevance');
    const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');

    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [allUsers, myFollowing] = await Promise.all([
                socialService.getCommunityUsers(),
                socialService.getFollowing().catch(() => [])
            ]);
            setUsers(allUsers);
            setFollowingIds(new Set(myFollowing));
        } catch (err) {
            console.error("Failed to load users", err);
        } finally {
            setLoading(false);
        }
    };

    const handleFollowToggle = async (targetId: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!currentUser) return;

        const isFollowing = followingIds.has(targetId);
        try {
            if (isFollowing) {
                await socialService.unfollowUser(targetId);
                const next = new Set(followingIds);
                next.delete(targetId);
                setFollowingIds(next);
            } else {
                await socialService.followUser(targetId);
                setFollowingIds(prev => new Set(prev).add(targetId));
            }
        } catch (err) {
            console.error("Failed to toggle follow", err);
        }
    };

    const filteredUsers = useMemo(() => {
        let result = [...users];

        // Search
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(u =>
                u.name?.toLowerCase().includes(q) ||
                (u.handle || u.username).toLowerCase().includes(q) ||
                (u.role === 'admin' && 'admin'.includes(q))
            );
        }

        // Role Filter
        if (roleFilter !== 'all') {
            result = result.filter(u => u.role === roleFilter);
        }

        // Sort
        return result.sort((a: any, b: any) => {
            const aIsMe = a.id === currentUser?.id;
            const bIsMe = b.id === currentUser?.id;
            if (aIsMe) return -1;
            if (bIsMe) return 1;

            const aIsFollowing = followingIds.has(a.id);
            const bIsFollowing = followingIds.has(b.id);

            if (sort === 'relevance') {
                if (aIsFollowing && !bIsFollowing) return -1;
                if (!aIsFollowing && bIsFollowing) return 1;
                // Then admin
                if (a.role === 'admin' && b.role !== 'admin') return -1;
                if (b.role === 'admin' && a.role !== 'admin') return 1;
            }

            if (sort === 'newest') {
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            }

            if (sort === 'stats') {
                const aVal = (a.stats?.distance || 0) + (a.stats?.sessions || 0);
                const bVal = (b.stats?.distance || 0) + (b.stats?.sessions || 0);
                return bVal - aVal;
            }

            // Name sort (default fallback for relevance tie-break)
            return (a.name || a.handle || a.username).localeCompare(b.name || b.handle || b.username);
        });
    }, [users, search, sort, roleFilter, followingIds, currentUser]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
            </div>
        );
    }

    const getActivityEmoji = (type: string) => {
        switch (type?.toLowerCase()) {
            case 'running': return '🏃';
            case 'strength': return '💪';
            case 'cycling': return '🚴';
            case 'swimming': return '🏊';
            case 'walking': return '🚶';
            case 'yoga': return '🧘';
            case 'hyrox': return '🔥';
            default: return '⚡';
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-12 animate-in fade-in duration-700 px-4 md:px-0">
            {/* Header Redesign */}
            <div className="relative group overflow-hidden rounded-[3rem] p-1 shadow-2xl bg-gradient-to-br from-emerald-500/20 via-slate-900 to-emerald-900/20 border border-white/5">
                <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-3xl rounded-[3rem]"></div>
                <div className="relative p-10 flex flex-col lg:flex-row justify-between items-center gap-10">
                    <div className="text-center lg:text-left">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-black uppercase tracking-widest mb-4 border border-emerald-500/20">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            Live Community
                        </div>
                        <h1 className="text-5xl md:text-6xl font-black text-white mb-4 tracking-tighter">
                            World of <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-emerald-600">Greens</span>
                        </h1>
                        <p className="text-lg text-gray-400 max-w-xl font-medium leading-relaxed">
                            Möt träningseliten. {users.length} personliga profiler redo att peppa och motivera dig mot dina nästa mål.
                        </p>
                    </div>

                    {/* Quick Stats Overlay */}
                    <div className="flex gap-4 md:gap-8">
                        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 text-center min-w-[120px]">
                            <div className="text-3xl font-black text-white mb-1">{users.length}</div>
                            <div className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Atleter</div>
                        </div>
                        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 text-center min-w-[120px]">
                            <div className="text-3xl font-black text-emerald-400 mb-1">{followingIds.size}</div>
                            <div className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Following</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Controls Bar */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-6 sticky top-4 z-30 p-4 bg-slate-950/80 backdrop-blur-2xl border border-white/5 rounded-[2rem] shadow-2xl">
                <div className="relative group w-full md:w-[400px]">
                    <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                        <span className="text-gray-500 group-focus-within:text-emerald-400 transition-colors text-xl">🔍</span>
                    </div>
                    <input
                        type="text"
                        placeholder="Search for athletes, handles..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="bg-white/5 border border-white/10 text-white rounded-2xl py-4 pl-14 pr-6 w-full focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all font-medium placeholder:text-gray-600"
                    />
                </div>

                <div className="flex flex-wrap justify-center gap-4">
                    <div className="flex gap-1 bg-white/5 p-1.5 rounded-2xl border border-white/10">
                        {(['relevance', 'stats', 'newest'] as const).map(s => (
                            <button
                                key={s}
                                onClick={() => setSort(s)}
                                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-tighter transition-all ${sort === s
                                    ? 'bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)]'
                                    : 'text-gray-500 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                {s === 'relevance' ? 'Relevant' : s === 'stats' ? 'Volume' : 'Fresh'}
                            </button>
                        ))}
                    </div>

                    <div className="flex gap-1 bg-white/5 p-1.5 rounded-2xl border border-white/10">
                        <button onClick={() => setViewMode('list')} className={`p-2.5 rounded-xl transition-all ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}>
                            📄
                        </button>
                        <button onClick={() => setViewMode('grid')} className={`p-2.5 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}>
                            🧊
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            {viewMode === 'list' ? (
                <div className="grid grid-cols-1 gap-4">
                    {filteredUsers.map(user => (
                        <AthleteRow key={user.id} user={user} isMe={user.id === currentUser?.id} isFollowing={followingIds.has(user.id)} onFollowToggle={handleFollowToggle} />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                    {filteredUsers.map(user => (
                        <AthleteCard key={user.id} user={user} isMe={user.id === currentUser?.id} isFollowing={followingIds.has(user.id)} onFollowToggle={handleFollowToggle} />
                    ))}
                </div>
            )}

            {filteredUsers.length === 0 && (
                <div className="text-center py-40 animate-pulse">
                    <div className="text-8xl mb-6 grayscale opacity-20">🏃💨</div>
                    <p className="text-xl text-gray-500 font-medium">Inga atleter matchar din sökning...</p>
                </div>
            )}
        </div>
    );
}

const AthleteCard = ({ user, isMe, isFollowing, onFollowToggle }: { user: any, isMe: boolean, isFollowing: boolean, onFollowToggle: any }) => {
    const stats = user.stats || { distance: 0, sessions: 0, tonnage: 0, duration: 0 };
    const latest = user.latestActivity;
    const isEvergreen = user.subscription?.tier === 'evergreen';
    const age = user.settings?.birthYear ? (new Date().getFullYear() - user.settings.birthYear) : null;
    const handle = user.handle || user.username;

    const getActivityEmoji = (type: string) => {
        switch (type?.toLowerCase()) {
            case 'running': return '🏃';
            case 'strength': return '💪';
            case 'cycling': return '🚴';
            case 'hyrox': return '🔥';
            default: return '⚡';
        }
    };

    return (
        <Link
            to={`/u/${handle}`}
            className={`
                group relative flex flex-col p-8 rounded-[2.5rem] transition-all duration-500 hover:-translate-y-2
                ${isMe
                    ? 'bg-gradient-to-br from-emerald-900/40 to-slate-900 border-2 border-emerald-500 shadow-[0_40px_100px_-20px_rgba(16,185,129,0.3)]'
                    : 'bg-white/5 border border-white/10 hover:border-emerald-500/50 hover:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.5)]'
                }
                overflow-hidden
            `}
        >
            {/* Glossy Aura */}
            <div className={`absolute -top-24 -right-24 w-64 h-64 blur-[100px] opacity-20 transition-opacity group-hover:opacity-40 rounded-full ${isEvergreen ? 'bg-emerald-400' : 'bg-blue-400'}`}></div>

            <div className="flex items-start justify-between mb-8">
                <div className="relative">
                    <div className={`w-20 h-20 rounded-3xl overflow-hidden bg-slate-800 ${isMe ? 'ring-2 ring-emerald-500 ring-offset-4 ring-offset-slate-900' : ''} shadow-2xl transition-transform group-hover:scale-105`}>
                        {user.avatarUrl ? (
                            <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-3xl font-black bg-gradient-to-br from-slate-700 to-slate-900">
                                {user.name?.[0] || user.username[0] || '?'}
                            </div>
                        )}
                    </div>
                    {isEvergreen && (
                        <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-[10px] font-black uppercase text-white px-2 py-1 rounded-lg shadow-lg" title="Evergreen Member">
                            EVERGREEN
                        </div>
                    )}
                </div>

                <div className="flex flex-col items-end gap-2">
                    {!isMe && (
                        <button
                            onClick={(e) => onFollowToggle(user.id, e)}
                            className={`
                                px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all
                                ${isFollowing
                                    ? 'bg-white/5 text-gray-500 hover:bg-red-500 hover:text-white'
                                    : 'bg-emerald-500 text-white hover:bg-emerald-400 shadow-[0_10px_30px_-5px_rgba(16,185,129,0.5)]'
                                }
                            `}
                        >
                            {isFollowing ? 'Följer' : 'Följ'}
                        </button>
                    )}
                    {isMe && (
                        <div className="bg-emerald-500/10 text-emerald-400 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-500/20">
                            YOU
                        </div>
                    )}
                    {(user.streak || 0) > 0 && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/10 text-orange-500 rounded-xl border border-orange-500/20 text-[10px] font-black">
                            🔥 {user.streak} DAGAR
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1">
                <h3 className="text-2xl font-black text-white mb-1 group-hover:text-emerald-400 transition-colors flex items-center gap-2">
                    {user.name || user.username}
                    {age && <span className="text-sm font-medium text-gray-500">· {age}</span>}
                </h3>
                <p className="text-emerald-500/80 font-bold text-sm tracking-tight mb-4">@{handle}</p>

                <p className="text-gray-400 text-sm leading-relaxed mb-8 line-clamp-2 h-10 group-hover:text-gray-300 transition-colors">
                    {user.bio || 'Bygger morgondagens bästa jag. En repition i taget.'}
                </p>

                {/* Volume Stats Grid */}
                <div className="grid grid-cols-2 gap-3 mb-8">
                    <div className="bg-white/5 p-4 rounded-3xl border border-white/5 transition-transform group-hover:scale-[1.02]">
                        <div className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Volume 30d</div>
                        <div className="text-lg font-black text-white">{stats.distance} <span className="text-xs text-gray-500 font-bold uppercase">km</span></div>
                    </div>
                    <div className="bg-white/5 p-4 rounded-3xl border border-white/5 transition-transform group-hover:scale-[1.02]">
                        <div className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Strength 30d</div>
                        <div className="text-lg font-black text-white">{stats.tonnage > 1000 ? (stats.tonnage / 1000).toFixed(1) : stats.tonnage} <span className="text-xs text-gray-500 font-bold uppercase">{stats.tonnage > 1000 ? 'tons' : 'kg'}</span></div>
                    </div>
                </div>

                {/* Activity Pulse */}
                {latest ? (
                    <div className="p-5 rounded-3xl bg-emerald-500/5 border border-emerald-500/10 flex items-center gap-4 transition-all group-hover:bg-emerald-500/10">
                        <div className="text-3xl animate-pulse">{getActivityEmoji(latest.type)}</div>
                        <div className="overflow-hidden">
                            <div className="text-[10px] text-emerald-500/60 font-black uppercase tracking-widest mb-0.5">Senaste passet</div>
                            <div className="text-sm font-bold text-white truncate">{latest.title || latest.type}</div>
                            <div className="text-[10px] text-gray-500 font-medium">
                                {new Date(latest.date).toLocaleDateString()} · {latest.distance ? `${latest.distance} km` : `${latest.duration} min`}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="p-5 rounded-3xl bg-slate-800/50 border border-slate-700/50 flex items-center gap-4 text-gray-600 grayscale">
                        <div className="text-3xl">🎽</div>
                        <div>
                            <div className="text-[10px] font-black uppercase tracking-widest mb-0.5">Söker nästa pass</div>
                            <div className="text-xs font-bold">Ingen nyligen aktivitet</div>
                        </div>
                    </div>
                )}
            </div>
        </Link>
    );
};

const AthleteRow = ({ user, isMe, isFollowing, onFollowToggle }: { user: any, isMe: boolean, isFollowing: boolean, onFollowToggle: any }) => {
    const stats = user.stats || { distance: 0, sessions: 0, tonnage: 0, duration: 0 };
    const latest = user.latestActivity;
    const isEvergreen = user.subscription?.tier === 'evergreen';
    const age = user.settings?.birthYear ? (new Date().getFullYear() - user.settings.birthYear) : null;
    const handle = user.handle || user.username;

    const getActivityEmoji = (type: string) => {
        switch (type?.toLowerCase()) {
            case 'running': return '🏃';
            case 'strength': return '💪';
            case 'cycling': return '🚴';
            case 'hyrox': return '🔥';
            default: return '⚡';
        }
    };

    return (
        <Link
            to={`/u/${handle}`}
            className="flex flex-col md:flex-row items-center gap-6 p-6 rounded-3xl bg-white/5 border border-white/10 hover:border-emerald-500/50 transition-all group relative overflow-hidden"
        >
            <div className={`w-14 h-14 rounded-2xl overflow-hidden bg-slate-800 flex-shrink-0 relative ${isMe ? 'ring-2 ring-emerald-500' : ''}`}>
                {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-xl font-bold bg-slate-700">
                        {user.name?.[0] || user.username[0] || '?'}
                    </div>
                )}
            </div>

            <div className="flex-1 text-center md:text-left">
                <div className="flex flex-col md:flex-row items-center gap-3 mb-1">
                    <span className="text-xl font-black text-white group-hover:text-emerald-400 transition-colors uppercase tracking-tight line-clamp-1">
                        {user.name || user.username}
                        {age && <span className="text-sm font-medium text-gray-600 ml-2">· {age}</span>}
                    </span>
                    <div className="flex gap-2">
                        {user.role === 'admin' && <span className="px-2 py-0.5 rounded-lg bg-rose-500/10 text-rose-500 text-[8px] font-black border border-rose-500/20">STAFF</span>}
                        {isEvergreen && <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-[8px] font-black border border-emerald-500/20">EVERGREEN</span>}
                    </div>
                </div>
                <div className="text-xs text-emerald-500/60 font-bold">@{handle}</div>
            </div>

            <div className="hidden lg:flex items-center gap-8 px-10 border-x border-white/5 h-12">
                <div className="text-center">
                    <div className="text-xs font-black text-white">{stats.distance} <span className="text-gray-500">km</span></div>
                    <div className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">Running 30d</div>
                </div>
                <div className="text-center">
                    <div className="text-xs font-black text-white">{stats.tonnage > 1000 ? `${(stats.tonnage / 1000).toFixed(1)} T` : `${stats.tonnage} kg`}</div>
                    <div className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">Strength 30d</div>
                </div>
            </div>

            <div className="flex items-center gap-6">
                {latest && (
                    <div className="flex items-center gap-3">
                        <div className="text-2xl opacity-50">{getActivityEmoji(latest.type)}</div>
                        <div className="hidden sm:block text-[10px] text-gray-500 font-medium">
                            <div className="text-white font-bold">{latest.type}</div>
                            {new Date(latest.date).toLocaleDateString()}
                        </div>
                    </div>
                )}

                {!isMe && (
                    <button
                        onClick={(e) => onFollowToggle(user.id, e)}
                        className={`
                            px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all
                            ${isFollowing
                                ? 'bg-white/10 text-gray-500 hover:text-red-400'
                                : 'bg-emerald-500 text-white hover:bg-emerald-400'
                            }
                        `}
                    >
                        {isFollowing ? 'Följer' : 'Följ'}
                    </button>
                )}
            </div>
        </Link>
    );
};

export default UsersPage;
