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
    const [sort, setSort] = useState<'relevance' | 'name' | 'newest'>('relevance');
    const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');

    const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

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
        let result = users;

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
        return result.sort((a, b) => {
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

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-end gap-6 border-b border-slate-800 pb-8">
                <div>
                    <h1 className="text-4xl font-black text-white mb-2 tracking-tight">Community</h1>
                    <p className="text-gray-400">
                        {users.length} medlemmar • {followingIds.size} följer du
                    </p>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 bg-slate-900/50 p-1 rounded-xl border border-slate-800">
                    <Link
                        to="/community"
                        className="px-6 py-2 rounded-lg text-sm font-bold transition-all bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
                    >
                        Medlemmar
                    </Link>
                    <Link
                        to="/community/stats"
                        className="px-6 py-2 rounded-lg text-sm font-bold transition-all text-gray-400 hover:text-white hover:bg-slate-800"
                    >
                        Statistik
                    </Link>
                </div>

                {/* Controls */}
                <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto items-center">
                    <div className="relative group min-w-[300px] w-full md:w-auto">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-gray-500 group-focus-within:text-emerald-400 transition-colors">🔍</span>
                        </div>
                        <input
                            type="text"
                            placeholder="Sök användare..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="bg-slate-900/50 border border-slate-700 text-white rounded-xl py-3 pl-10 pr-4 w-full focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-lg shadow-black/20"
                        />
                    </div>

                    <div className="flex gap-2 bg-slate-900/50 p-1 rounded-xl border border-slate-700">
                        {(['relevance', 'name', 'newest'] as const).map(s => (
                            <button
                                key={s}
                                onClick={() => setSort(s)}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${sort === s
                                    ? 'bg-slate-700 text-white shadow-md'
                                    : 'text-gray-400 hover:text-white hover:bg-slate-800'
                                    }`}
                            >
                                {s === 'relevance' ? 'Relevant' : s === 'name' ? 'Namn' : 'Nyast'}
                            </button>
                        ))}
                    </div>

                    {/* View Toggle */}
                    <div className="flex gap-1 bg-slate-900/50 p-1 rounded-xl border border-slate-700">
                        <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-slate-700 text-white' : 'text-gray-400 hover:text-white'}`} title="Lista">
                            📄
                        </button>
                        <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-slate-700 text-white' : 'text-gray-400 hover:text-white'}`} title="Rutnät">
                            🧊
                        </button>
                    </div>
                </div>
            </div>

            {/* List View */}
            {viewMode === 'list' && (
                <div className="grid grid-cols-1 gap-2">
                    {filteredUsers.map(user => {
                        const isMe = user.id === currentUser?.id;
                        const isFollowing = followingIds.has(user.id);
                        const isAdmin = user.role === 'admin';
                        const handle = user.handle || user.username;

                        return (
                            <Link
                                to={`/u/${handle}`}
                                key={user.id}
                                className={`
                                    group flex items-center justify-between p-4 rounded-xl transition-all duration-200
                                    ${isMe
                                        ? 'bg-emerald-900/10 border border-emerald-500/30 hover:bg-emerald-900/20'
                                        : 'bg-slate-900/40 border border-slate-800 hover:bg-slate-800 hover:border-slate-700'
                                    }
                                `}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full overflow-hidden bg-slate-800 flex-shrink-0 ${isMe ? 'ring-2 ring-emerald-500' : ''}`}>
                                        {user.avatarUrl ? (
                                            <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-sm">
                                                {user.name?.[0] || user.username[0] || '?'}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className={`font-bold ${isMe ? 'text-emerald-400' : 'text-white'}`}>
                                                {user.name || user.username}
                                            </span>
                                            {isAdmin && <span className="text-[10px] bg-rose-500/10 text-rose-500 px-1.5 py-0.5 rounded border border-rose-500/20">ADMIN</span>}
                                            {isMe && <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded border border-emerald-500/20">DU</span>}
                                        </div>
                                        <div className="text-xs text-gray-500">@{handle}</div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    {!isMe && (
                                        <button
                                            onClick={(e) => handleFollowToggle(user.id, e)}
                                            className={`
                                                px-3 py-1.5 rounded-lg text-xs font-bold transition-all
                                                ${isFollowing
                                                    ? 'bg-slate-800 text-gray-400 hover:text-red-400'
                                                    : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/20'
                                                }
                                            `}
                                        >
                                            {isFollowing ? 'Följer' : 'Följ'}
                                        </button>
                                    )}
                                    <span className="text-gray-600 group-hover:text-emerald-500 transition-colors">→</span>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}

            {/* Grid View */}
            {viewMode === 'grid' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredUsers.map(user => {
                        const isMe = user.id === currentUser?.id;
                        const isFollowing = followingIds.has(user.id);
                        const isAdmin = user.role === 'admin';
                        const handle = user.handle || user.username;

                        return (
                            <Link
                                to={`/u/${handle}`}
                                key={user.id}
                                className={`
                                    relative group overflow-hidden rounded-3xl p-6 transition-all duration-300
                                    ${isMe
                                        ? 'bg-gradient-to-br from-emerald-900/20 to-slate-900 border-2 border-emerald-500/50 shadow-[0_0_30px_-10px_rgba(16,185,129,0.3)]'
                                        : 'bg-slate-900/50 border border-slate-800 hover:border-slate-600 hover:shadow-xl hover:-translate-y-1'
                                    }
                                `}
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="relative">
                                        <div className={`w-16 h-16 rounded-2xl overflow-hidden bg-slate-800 ${isMe ? 'ring-2 ring-emerald-500 ring-offset-2 ring-offset-slate-900' : ''}`}>
                                            {user.avatarUrl ? (
                                                <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-2xl">
                                                    {user.name?.[0] || user.username[0] || '?'}
                                                </div>
                                            )}
                                        </div>
                                        {isAdmin && (
                                            <div className="absolute -bottom-2 -right-2 bg-slate-900 p-1 rounded-full text-lg" title="Admin">
                                                🛡️
                                            </div>
                                        )}
                                    </div>

                                    {!isMe && (
                                        <button
                                            onClick={(e) => handleFollowToggle(user.id, e)}
                                            className={`
                                                p-2 rounded-full transition-all duration-300
                                                ${isFollowing
                                                    ? 'bg-yellow-400/10 text-yellow-400 hover:bg-red-500/10 hover:text-red-500'
                                                    : 'bg-slate-800 text-gray-400 hover:bg-emerald-500 hover:text-white'
                                                }
                                            `}
                                        >
                                            {isFollowing ? '★' : '+'}
                                        </button>
                                    )}
                                    {isMe && (
                                        <span className="bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                                            Du
                                        </span>
                                    )}
                                </div>

                                <div>
                                    <h3 className="font-bold text-white text-lg truncate flex items-center gap-2">
                                        {user.name || user.username}
                                        {isAdmin && <span className="text-xs bg-rose-500/10 text-rose-500 px-1.5 py-0.5 rounded border border-rose-500/20">ADMIN</span>}
                                    </h3>
                                    <p className="text-emerald-500/80 text-sm font-medium mb-2">@{handle}</p>

                                    <p className="text-gray-400 text-xs line-clamp-2 h-8 mb-4">
                                        {user.bio || 'Ingen presentation än...'}
                                    </p>

                                    <div className="flex items-center gap-4 text-[10px] text-gray-500 font-medium uppercase tracking-wider border-t border-white/5 pt-4">
                                        <span className="flex items-center gap-1">
                                            📅 {new Date(user.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}

            {filteredUsers.length === 0 && (
                <div className="text-center py-20 text-gray-500">
                    <div className="text-4xl mb-4">👻</div>
                    <p>Inga användare hittades.</p>
                </div>
            )}
        </div>
    );
}
