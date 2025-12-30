// ProfilePage - Main orchestrator component
// All logic has been extracted into reusable hooks and components

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext.tsx';
import { type MealType, MEAL_TYPE_LABELS } from '../models/types.ts';
import { useData } from '../context/DataContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { profileService, type ProfileData } from '../services/profileService.ts';

// Import profile components
import {
    InlineEdit,
    InlineTextArea,
    StatBadge,
    CollapsibleSection,
    InfoBadge,
    QuickAction,
    DataField
} from '../components/profile/atoms/index.ts';

import {
    BodyMeasurementsSection,
    PRManagerSection,
    HRZonesSection,
    ActivityStatsSection,
    PrivacySettingsSection,
    SessionsSection,
    WeightHistorySection,
    DangerZoneSection,
    NotificationSettingsSection
} from '../components/profile/sections/index.ts';
import { FeedEventCard } from '../components/feed/FeedEventCard.tsx';
import { FeedEvent } from '../models/feedTypes.ts';

import './ProfilePage.css';

const ALL_MEALS: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export function ProfilePage() {
    const { settings, updateSettings, toggleMealVisibility, theme, toggleTheme } = useSettings();
    const { user: authUser } = useAuth();
    const { users } = useData();
    const navigate = useNavigate();

    // Profile state
    const DEFAULT_PROFILE: ProfileData = {
        name: '', handle: '', bio: '', location: '', birthdate: '', email: '', phone: '', website: '',
        avatarUrl: '', streak: 0, weight: 0, targetWeight: 0, maxHr: 0, restingHr: 0, lthr: 0,
        vdot: 0, ftp: 0, weekStartsOn: 1, preferredUnits: 'metric',
        privacy: {
            isPublic: true, allowFollowers: true, sharing: {
                training: 'FRIENDS', nutrition: 'FRIENDS', health: 'PRIVATE', social: 'FRIENDS', body: 'PRIVATE'
            },
            whitelistedUsers: [], showWeight: false, showHeight: false, showBirthYear: false, showDetailedTraining: true
        }
    };
    const [profile, setProfile] = useState<ProfileData>(DEFAULT_PROFILE);
    const [isLoading, setIsLoading] = useState(true);
    const [feedEvents, setFeedEvents] = useState<FeedEvent[]>([]);
    const [feedLoading, setFeedLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'activity'>('overview');
    const [editingField, setEditingField] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Load profile on mount
    useEffect(() => {
        loadProfile();
    }, []);

    const { weightEntries, getLatestWeight } = useData();

    // Sync weight from DataContext (for immediate updates from Command Palette/Modal)
    useEffect(() => {
        const latest = getLatestWeight();
        if (latest > 0 && latest !== profile.weight) {
            setProfile(prev => ({ ...prev, weight: latest }));
        }
    }, [weightEntries, getLatestWeight]);

    const loadProfile = async () => {
        setIsLoading(true);
        const data = await profileService.getProfile();
        if (data) {
            setProfile(prev => ({
                ...prev,
                ...data,
                privacy: { ...prev.privacy, ...data.privacy }
            }));
        }
        setIsLoading(false);
    };

    // Profile update helpers
    const saveField = async (field: string, value: any) => {
        await profileService.updateProfile({ [field]: value });
    };

    const updateProfile = <K extends keyof ProfileData>(field: K, value: ProfileData[K]) => {
        setProfile(prev => ({ ...prev, [field]: value }));
        saveField(field as string, value);
    };

    const commitField = <K extends keyof ProfileData>(field: K) => {
        setEditingField(null);
        saveField(field as string, profile[field]);
    };

    const fetchFeed = async () => {
        setFeedLoading(true);
        try {
            const token = localStorage.getItem('auth_token');
            const res = await fetch(`http://localhost:8000/api/feed/me?limit=10`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setFeedEvents(data.events || []);
            }
        } catch (e) {
            console.error("Failed to fetch personal feed:", e);
        } finally {
            setFeedLoading(false);
        }
    };

    useEffect(() => {
        if (!isLoading) {
            fetchFeed();
        }
    }, [isLoading]);

    const updatePrivacy = async (key: string, value: any) => {
        setProfile(prev => {
            if (!prev.privacy) return prev;
            return {
                ...prev,
                privacy: { ...prev.privacy, [key]: value }
            };
        });
        await profileService.updatePrivacy({ [key]: value });
    };

    const updateSharing = async (category: string, level: string) => {
        setProfile(prev => {
            if (!prev.privacy) return prev;
            const newSharing = { ...(prev.privacy.sharing || {}), [category]: level };
            return {
                ...prev,
                privacy: { ...prev.privacy, sharing: newSharing }
            } as ProfileData;
        });
        await profileService.updatePrivacy({ sharing: { [category]: level } as any });
    };

    // Avatar handling
    const handleAvatarClick = () => fileInputRef.current?.click();
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64 = e.target?.result as string;
            updateProfile('avatarUrl', base64);
        };
        reader.readAsDataURL(file);
    };

    const calculateAge = (birthdate: string) => {
        if (!birthdate) return null;
        const birth = new Date(birthdate);
        const now = new Date();
        return now.getFullYear() - birth.getFullYear();
    };

    if (isLoading) {
        return <div className="min-h-screen flex items-center justify-center text-slate-400">Laddar profil...</div>;
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 pb-24">
            {/* Hidden file input for avatar */}
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />

            {/* Profile Header */}
            <div className="relative">
                <div className="h-32 bg-gradient-to-r from-emerald-600 to-teal-500" />
                <div className="px-6 pb-6">
                    <div className="relative -mt-16 flex flex-col md:flex-row md:items-end gap-4">
                        {/* Avatar */}
                        <div
                            onClick={handleAvatarClick}
                            className="w-28 h-28 rounded-2xl bg-slate-800 border-4 border-slate-900 overflow-hidden cursor-pointer hover:opacity-90 transition-opacity relative group"
                        >
                            {profile.avatarUrl ? (
                                <img src={profile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-4xl">👤</div>
                            )}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <span className="text-white text-sm">📷 Byt</span>
                            </div>
                        </div>

                        {/* Name & Handle */}
                        <div className="flex-1 pt-2">
                            <InlineEdit
                                value={profile.name || ''}
                                isEditing={editingField === 'name'}
                                onEdit={() => setEditingField('name')}
                                onBlur={() => commitField('name')}
                                onChange={v => setProfile(p => ({ ...p, name: v }))}
                                className="text-3xl font-black text-white block"
                                placeholder="Ditt namn"
                            />
                            <div className="flex items-center gap-1 text-slate-400">
                                <span>@</span>
                                <InlineEdit
                                    value={profile.handle || ''}
                                    isEditing={editingField === 'handle'}
                                    onEdit={() => setEditingField('handle')}
                                    onBlur={() => commitField('handle')}
                                    onChange={v => setProfile(p => ({ ...p, handle: v }))}
                                    className="text-slate-400"
                                    placeholder="handle"
                                />
                            </div>
                        </div>

                        {/* Stats */}
                        <div className="flex gap-4 bg-slate-900/50 rounded-xl px-4 py-2">
                            <StatBadge value={profile.streak || 0} label="🔥 Streak" />
                            <StatBadge value={0} label="Följare" />
                            <StatBadge value={0} label="Följer" />
                        </div>
                    </div>

                    {/* Bio */}
                    <div className="mt-4">
                        <InlineTextArea
                            value={profile.bio || ''}
                            isEditing={editingField === 'bio'}
                            onEdit={() => setEditingField('bio')}
                            onBlur={() => commitField('bio')}
                            onChange={v => setProfile(p => ({ ...p, bio: v }))}
                            placeholder="Berätta lite om dig själv..."
                        />
                    </div>

                    {/* Info Badges */}
                    <div className="flex flex-wrap gap-2 mt-4">
                        <InfoBadge icon="📍" value={profile.location || ''} placeholder="Plats" field="location" editingField={editingField} onEdit={setEditingField} onChange={(f: any, v: any) => setProfile(p => ({ ...p, [f]: v }))} onBlur={() => commitField('location')} />
                        <InfoBadge icon="🌐" value={profile.website || ''} placeholder="Webbsida" field="website" editingField={editingField} onEdit={setEditingField} onChange={(f: any, v: any) => setProfile(p => ({ ...p, [f]: v }))} onBlur={() => commitField('website')} />
                        <InfoBadge icon="🎂" value={profile.birthdate ? `${calculateAge(profile.birthdate)} år` : ''} placeholder="Ålder" field="birthdate" editingField={editingField} onEdit={setEditingField} onChange={(f: any, v: any) => setProfile(p => ({ ...p, [f]: v }))} />
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="px-6 mb-6">
                <div className="grid grid-cols-4 gap-3">
                    <QuickAction icon="📊" label="Statistik" href="#activity-stats" />
                    <QuickAction icon="⚖️" label="Vikthistorik" href="#weight-history" />
                    <QuickAction icon="🏆" label="Rekord" href="#prs" />
                    <QuickAction icon="⚙️" label="Inställningar" href="#appearance" />
                </div>
            </div>

            {/* Sections */}
            <div className="px-6 space-y-4">
                <CollapsibleSection id="body" title="Kropp & Mått" icon="📏">
                    <BodyMeasurementsSection targetWeight={profile.targetWeight || 0} height={settings.height} />
                </CollapsibleSection>

                <CollapsibleSection id="goals" title="Dagliga Mål" icon="🎯">
                    <div className="grid md:grid-cols-4 gap-3">
                        <DataField label="Kalorier" value={settings.dailyCalorieGoal?.toString() || ''} type="number" suffix="kcal" onChange={(v: string) => updateSettings({ dailyCalorieGoal: Number(v) })} />
                        <DataField label="Protein" value={settings.dailyProteinGoal?.toString() || ''} type="number" suffix="g" onChange={(v: string) => updateSettings({ dailyProteinGoal: Number(v) })} />
                        <DataField label="Kolhydrater" value={settings.dailyCarbsGoal?.toString() || ''} type="number" suffix="g" onChange={(v: string) => updateSettings({ dailyCarbsGoal: Number(v) })} />
                        <DataField label="Fett" value={settings.dailyFatGoal?.toString() || ''} type="number" suffix="g" onChange={(v: string) => updateSettings({ dailyFatGoal: Number(v) })} />
                        <DataField label="Sömn" value={settings.dailySleepGoal?.toString() || ''} type="number" suffix="h" onChange={(v: string) => updateSettings({ dailySleepGoal: Number(v) })} />
                        <DataField label="Vatten" value={(settings as any).dailyWaterGoal?.toString() || '8'} type="number" suffix="glas" onChange={(v: string) => updateSettings({ dailyWaterGoal: Number(v) } as any)} />
                        <DataField label="Steg" value={(settings as any).dailyStepGoal?.toString() || '10000'} type="number" suffix="" onChange={(v: string) => updateSettings({ dailyStepGoal: Number(v) } as any)} />
                        <DataField label="Koffein Max" value={(settings as any).dailyCaffeineMax?.toString() || '400'} type="number" suffix="mg" onChange={(v: string) => updateSettings({ dailyCaffeineMax: Number(v) } as any)} />
                    </div>
                </CollapsibleSection>

                <CollapsibleSection id="running" title="Löpning & Cykel" icon="🏃">
                    <div className="grid md:grid-cols-4 gap-3">
                        <DataField label="Max Puls" value={profile.maxHr?.toString() || '0'} type="number" suffix="bpm" onChange={(v: string) => updateProfile('maxHr', Number(v))} />
                        <DataField label="Vila Puls" value={profile.restingHr?.toString() || '0'} type="number" suffix="bpm" onChange={(v: string) => updateProfile('restingHr', Number(v))} />
                        <DataField label="Laktattröskel" value={profile.lthr?.toString() || '0'} type="number" suffix="bpm" onChange={(v: string) => updateProfile('lthr', Number(v))} />
                        <DataField label="VDOT" value={profile.vdot?.toString() || '0'} type="number" onChange={(v: string) => updateProfile('vdot', Number(v))} />
                        <DataField label="FTP (Cykel)" value={profile.ftp?.toString() || '0'} type="number" suffix="W" onChange={(v: string) => updateProfile('ftp', Number(v))} />
                    </div>
                </CollapsibleSection>

                <CollapsibleSection id="prs" title="Personal Records" icon="🏆">
                    <PRManagerSection />
                </CollapsibleSection>

                <CollapsibleSection id="weight-history" title="Vikthistorik" icon="⚖️" defaultOpen={false}>
                    <WeightHistorySection currentWeight={profile.weight || 0} targetWeight={profile.targetWeight || 0} />
                </CollapsibleSection>

                <CollapsibleSection id="hr-zones" title="Pulszoner" icon="💓" defaultOpen={false}>
                    <HRZonesSection onUpdateProfile={updateProfile} />
                </CollapsibleSection>

                <CollapsibleSection id="activity-stats" title="Aktivitetsstatistik" icon="📊" defaultOpen={false}>
                    <ActivityStatsSection />
                </CollapsibleSection>

                <CollapsibleSection id="privacy" title="Integritet & Delning" icon="🔒">
                    <PrivacySettingsSection
                        privacy={profile.privacy as any}
                        onToggle={updatePrivacy}
                        onUpdateSharing={updateSharing}
                    />
                </CollapsibleSection>

                <CollapsibleSection id="activity-stream" title="Mitt Flöde (Senaste)" icon="⛲">
                    <div className="space-y-4">
                        {feedLoading ? (
                            <div className="py-8 text-center text-slate-500">Laddar händelser...</div>
                        ) : feedEvents.length > 0 ? (
                            <div className="grid gap-4">
                                {feedEvents.map(event => (
                                    <FeedEventCard key={event.id} event={event} />
                                ))}
                                <button
                                    onClick={() => navigate('/feed')}
                                    className="w-full py-3 rounded-xl bg-slate-800/50 text-slate-400 text-sm font-bold hover:bg-slate-800"
                                >
                                    Visa allt i The Stream
                                </button>
                            </div>
                        ) : (
                            <div className="py-12 text-center bg-slate-800/30 rounded-2xl border border-dashed border-slate-700">
                                <p className="text-slate-500 text-sm">Inga händelser ännu.</p>
                                <p className="text-slate-600 text-[10px] mt-1 italic">Logga träning eller mat för att se dem här.</p>
                            </div>
                        )}
                    </div>
                </CollapsibleSection>

                <CollapsibleSection id="notifications" title="Notifikationer" icon="🔔" defaultOpen={false}>
                    <NotificationSettingsSection />
                </CollapsibleSection>

                <CollapsibleSection id="sessions" title="Aktiva Sessioner" icon="📱" defaultOpen={false}>
                    <SessionsSection />
                </CollapsibleSection>

                <CollapsibleSection id="appearance" title="Utseende" icon="🎨">
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs text-slate-500 uppercase font-bold mb-2 block">Tema</label>
                            <div className="flex gap-2">
                                <button
                                    className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${theme === 'light' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                                    onClick={() => theme !== 'light' && toggleTheme()}
                                >☀️ Ljust</button>
                                <button
                                    className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${theme === 'dark' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                                    onClick={() => theme !== 'dark' && toggleTheme()}
                                >🌙 Mörkt</button>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-slate-500 uppercase font-bold mb-2 block">Synliga Måltider</label>
                            <div className="flex flex-wrap gap-2">
                                {ALL_MEALS.map(meal => (
                                    <button key={meal} onClick={() => toggleMealVisibility(meal)}
                                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${settings.visibleMeals.includes(meal) ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-500'}`}>
                                        {MEAL_TYPE_LABELS[meal]}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <DataField label="Första dag i veckan" value={profile.weekStartsOn === 0 ? 'sunday' : 'monday'} type="select" options={[
                            { value: 'monday', label: 'Måndag' },
                            { value: 'sunday', label: 'Söndag' },
                        ]} onChange={(v: any) => updateProfile('weekStartsOn', v === 'sunday' ? 0 : 1)} />
                        <DataField label="Enheter" value={profile.preferredUnits || 'metric'} type="select" options={[
                            { value: 'metric', label: '📐 Metriskt (kg, km)' },
                            { value: 'imperial', label: '📐 Imperial (lbs, mi)' },
                        ]} onChange={(v: any) => updateProfile('preferredUnits', v)} />
                    </div>
                </CollapsibleSection>

                <DangerZoneSection />
            </div>
        </div>
    );
}
