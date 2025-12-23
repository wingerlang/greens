import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { User, UserPrivacy } from '../models/types.ts';
import { socialService } from '../services/socialService.ts';
import { useAuth } from '../context/AuthContext.tsx';

export function PublicProfilePage() {
    const { handle } = useParams<{ handle: string }>();
    const { user: currentUser } = useAuth(); // We need to know who is viewing
    const [profile, setProfile] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [following, setFollowing] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!handle) return;
        setLoading(true);
        socialService.getProfileByHandle(handle)
            .then(async (user) => {
                setProfile(user);
                if (user && currentUser) {
                    // Check if I follow them
                    const isFollowing = await socialService.checkIsFollowing(currentUser.id, user.id);
                    setFollowing(isFollowing);
                }
            })
            .catch(() => setError('Kunde inte hämta profil'))
            .finally(() => setLoading(false));
    }, [handle, currentUser]);

    const handleFollowToggle = async () => {
        if (!currentUser || !profile) return;

        try {
            if (following) {
                await socialService.unfollowUser(profile.id);
                setFollowing(false);
            } else {
                await socialService.followUser(profile.id);
                setFollowing(true);
            }
        } catch (e) {
            console.error("Follow action failed", e);
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Wait for it... 🏃‍♂️</div>;
    if (!profile) return <div className="p-8 text-center text-rose-500">Användaren hittades inte. 🤷‍♂️</div>;

    // Privacy Logic
    const isMe = currentUser?.id === profile.id || currentUser?.email === profile.email; // Fallback check
    const privacy = profile.privacy || { isPublic: true, showWeight: false };

    // If private and NOT me and NOT following (assuming private means followers-only or strict private)
    // For now, let's say Private = Locked completely unless Me.
    if (!privacy.isPublic && !isMe) {
        return (
            <div className="max-w-2xl mx-auto mt-10 p-8 content-card text-center">
                <div className="text-6xl mb-4">🔒</div>
                <h1 className="text-2xl font-black text-white">Denna profil är privat</h1>
                <p className="text-slate-500 mt-2">Du måste följa @{profile.handle} för att se deras aktivitet.</p>
                <button className="btn btn-primary mt-6" onClick={handleFollowToggle}>
                    {following ? 'Begärd' : 'Följ'}
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-20 fade-in">
            {/* Header Card */}
            <div className="content-card relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-r from-emerald-900/40 to-slate-900/40"></div>

                <div className="relative pt-16 px-4 flex flex-col md:flex-row items-center md:items-end gap-6">
                    {/* Avatar */}
                    <div className="w-32 h-32 rounded-full border-4 border-slate-950 bg-slate-800 flex items-center justify-center text-4xl shadow-2xl relative z-10">
                        {profile.avatarUrl ? <img src={profile.avatarUrl} className="w-full h-full rounded-full object-cover" /> : '👤'}
                    </div>

                    {/* Info */}
                    <div className="flex-1 text-center md:text-left mb-2">
                        <h1 className="text-3xl font-black text-white">{profile.name}</h1>
                        <div className="text-emerald-400 font-bold mb-2">@{profile.handle || 'unknown'}</div>
                        <p className="text-slate-400 max-w-md">{profile.bio || 'Ingen bio.'}</p>
                        {profile.location && <div className="text-xs text-slate-500 mt-1">📍 {profile.location}</div>}
                    </div>

                    {/* Stats & Action */}
                    <div className="flex flex-col items-center md:items-end gap-4 mb-2">
                        <div className="flex gap-6 text-center">
                            <div>
                                <div className="text-xl font-black text-white">{profile.followersCount}</div>
                                <div className="text-[10px] text-slate-500 uppercase font-bold">Följare</div>
                            </div>
                            <div>
                                <div className="text-xl font-black text-white">{profile.followingCount}</div>
                                <div className="text-[10px] text-slate-500 uppercase font-bold">Följer</div>
                            </div>
                        </div>

                        {!isMe && (
                            <button
                                onClick={handleFollowToggle}
                                className={`px-6 py-2 rounded-full font-bold transition-all ${following
                                    ? 'bg-slate-800 text-slate-300 border border-white/10'
                                    : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20'}`}
                            >
                                {following ? 'Följer' : 'Följ'}
                            </button>
                        )}
                        {isMe && (
                            <div className="bg-emerald-500/10 text-emerald-400 text-xs px-3 py-1 rounded-full border border-emerald-500/20">
                                👁️ Du ser din publika profil
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left Column: Stats */}
                <div className="space-y-6">
                    <div className="content-card">
                        <h3 className="section-title text-sm mb-4">Senaste 30 dagarna</h3>
                        {/* Mock Stats */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400 text-xs">Distans</span>
                                <span className="text-white font-bold">142 km</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400 text-xs">Tid</span>
                                <span className="text-white font-bold">12h 30m</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400 text-xs">Pass</span>
                                <span className="text-white font-bold">18 st</span>
                            </div>
                        </div>
                    </div>

                    {privacy.showWeight && (
                        <div className="content-card">
                            <h3 className="section-title text-sm mb-4">Fysik</h3>
                            <div className="text-center">
                                <div className="text-3xl font-black text-white">72.5 <span className="text-sm text-slate-500">kg</span></div>
                                <div className="text-[10px] text-slate-500 uppercase">Aktuell vikt</div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Column: Feed */}
                <div className="md:col-span-2 space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="font-bold text-slate-400 uppercase tracking-widest text-xs">Aktivitetslogg</h3>
                    </div>

                    {/* Mock Activity List */}
                    {[1, 2, 3].map(i => (
                        <div key={i} className="content-card hover:bg-slate-900/80 transition-all cursor-pointer group">
                            <div className="flex justify-between items-start">
                                <div className="flex gap-4">
                                    <div className="text-3xl bg-slate-800 w-12 h-12 flex items-center justify-center rounded-xl">🏃</div>
                                    <div>
                                        <div className="text-xs text-emerald-400 font-bold mb-0.5">Idag, 07:00</div>
                                        <h4 className="text-white font-bold">Morgonjogg i skogen 🌲</h4>
                                        <div className="text-xs text-slate-400 mt-1">Lätt distanspass med bra känsla.</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-white font-black">8.5 km</div>
                                    <div className="text-xs text-slate-500">5:12 /km</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
