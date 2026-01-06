// ProfilePage - Main orchestrator component
// All logic has been extracted into reusable hooks and components

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext.tsx';
import { type MealType, MEAL_TYPE_LABELS, type UserPrivacy } from '../models/types.ts';
import { useData } from '../context/DataContext.tsx';
import { profileService, type ProfileData } from '../services/profileService.ts';

// Import profile components
import {
    InlineEdit,
    InlineTextArea,
    StatBadge,
    InfoBadge,
    DataField
} from '../components/profile/atoms/index.ts';

import {
    PrivacySettingsSection,
    SessionsSection,
    DangerZoneSection,
} from '../components/profile/sections/index.ts';
import { MeasurementsModule } from '../components/profile/sections/MeasurementsModule.tsx';
import { ProfilePreviewMode } from '../components/profile/ProfilePreviewMode.tsx';

import './ProfilePage.css';

const ALL_MEALS: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

type TabType = 'profile' | 'physical' | 'goals' | 'privacy' | 'account';

const TAB_CONFIG: { id: TabType; label: string; icon: string }[] = [
    { id: 'profile', label: 'Profil', icon: '👤' },
    { id: 'biometrics', label: 'Biometri', icon: '🧬' },
    { id: 'goals', label: 'Mål', icon: '🎯' },
    { id: 'privacy', label: 'Integritet', icon: '🛡️' },
    { id: 'account', label: 'Konto', icon: '⚙️' },
];

export function ProfilePage() {
    const { settings, updateSettings, toggleMealVisibility, theme, toggleTheme } = useSettings();
    const {
        users,
        currentUser,
        updateCurrentUser,
        weightEntries,
        getLatestWeight,
        trainingPeriods // To check for active plans
    } = useData();
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
            whitelistedUsers: [], showWeight: false, showHeight: false, showBirthYear: false, showDetailedTraining: true,
            categoryOverrides: {}
        }
    };
    const [profile, setProfile] = useState<ProfileData>(DEFAULT_PROFILE);
    const [isLoading, setIsLoading] = useState(true);
    const { tab } = useParams();
    const [activeTab, setActiveTab] = useState<TabType>((tab as TabType) || 'profile');
    const [editingField, setEditingField] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Individual Sharing State
    const [showAddOverride, setShowAddOverride] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState<string>('');
    const [isPreviewMode, setIsPreviewMode] = useState(false);

    // Load profile on mount
    useEffect(() => {
        loadProfile();
    }, []);

    // Sync activeTab with URL params
    useEffect(() => {
        if (tab && tab !== activeTab && TAB_CONFIG.some(t => t.id === tab)) {
            setActiveTab(tab as TabType);
        }
    }, [tab]);

    const handleTabChange = (newTab: TabType) => {
        setActiveTab(newTab);
        navigate(`/profile/${newTab}`);
    };

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

    // Check for active training period
    const activePeriod = React.useMemo(() => {
        const now = new Date().toISOString().split('T')[0];
        return trainingPeriods.find(p => p.startDate <= now && p.endDate >= now);
    }, [trainingPeriods]);

    if (isLoading) {
        return <div className="min-h-screen flex items-center justify-center text-slate-400">Laddar profil...</div>;
    }

    // Individual Sharing Helpers
    const categoryOverrides = profile.privacy?.categoryOverrides || {};
    const availableUsers = users.filter(u => u.id !== currentUser?.id && !categoryOverrides[u.id]);

    const toggleCategoryOverride = async (userId: string, category: string) => {
        const currentOverrides = { ...categoryOverrides };
        const userOverrides = currentOverrides[userId] || {};
        const currentValue = userOverrides[category as keyof typeof userOverrides];

        // Cycle: undefined -> true -> false -> undefined
        let newValue: boolean | undefined;
        if (currentValue === undefined) newValue = true;
        else if (currentValue === true) newValue = false;
        else newValue = undefined;

        if (newValue === undefined) {
            delete (userOverrides as any)[category];
        } else {
            (userOverrides as any)[category] = newValue;
        }

        // Clean up empty override objects
        if (Object.keys(userOverrides).length === 0) {
            delete currentOverrides[userId];
        } else {
            currentOverrides[userId] = userOverrides;
        }

        setProfile(prev => ({
            ...prev,
            privacy: { ...prev.privacy, categoryOverrides: currentOverrides }
        }));
        await profileService.updatePrivacy({ categoryOverrides: currentOverrides });
    };

    const addUserOverride = async () => {
        if (!selectedUserId) return;
        const newOverrides = {
            ...categoryOverrides,
            [selectedUserId]: {}
        };
        setProfile(prev => ({
            ...prev,
            privacy: { ...prev.privacy, categoryOverrides: newOverrides }
        }));
        await profileService.updatePrivacy({ categoryOverrides: newOverrides });
        setSelectedUserId('');
        setShowAddOverride(false);
    };

    const removeUserOverride = async (userId: string) => {
        const newOverrides = { ...categoryOverrides };
        delete newOverrides[userId];
        setProfile(prev => ({
            ...prev,
            privacy: { ...prev.privacy, categoryOverrides: newOverrides }
        }));
        await profileService.updatePrivacy({ categoryOverrides: newOverrides });
    };

    const CATEGORY_ICONS: Record<string, { label: string; icon: string }> = {
        training: { label: 'Träning', icon: '🏋️' },
        nutrition: { label: 'Kost', icon: '🥗' },
        health: { label: 'Hälsa', icon: '💤' },
        social: { label: 'Social', icon: '👥' },
        body: { label: 'Kropp', icon: '⚖️' },
    };

    const content = (displayProfile: ProfileData) => (
        <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 pb-24">
            {/* Hidden file input for avatar */}
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />

            {/* Profile Header */}
            <div className="relative">
                <div className="h-32 bg-gradient-to-r from-emerald-600 to-teal-500" />

                {/* View As Button (Only if not already in preview) */}
                {!isPreviewMode && (
                    <button
                        onClick={() => setIsPreviewMode(true)}
                        className="absolute top-4 right-4 bg-black/30 backdrop-blur-md text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-black/50 transition-all flex items-center gap-2 border border-white/10"
                    >
                        👁️ Visa som...
                    </button>
                )}

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
                            {/* Read Only if Preview Mode */}
                            {isPreviewMode ? (
                                <>
                                    <div className="text-3xl font-black text-white block">{displayProfile.name}</div>
                                    <div className="text-slate-400">@{displayProfile.handle}</div>
                                </>
                            ) : (
                                <>
                                    <InlineEdit
                                        value={displayProfile.name || ''}
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
                                            value={displayProfile.handle || ''}
                                            isEditing={editingField === 'handle'}
                                            onEdit={() => setEditingField('handle')}
                                            onBlur={() => commitField('handle')}
                                            onChange={v => setProfile(p => ({ ...p, handle: v }))}
                                            className="text-slate-400"
                                            placeholder="handle"
                                        />
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Stats - Reduced to just Streak as requested to remove "Stats" */}
                        <div className="flex gap-4 bg-slate-900/50 rounded-xl px-4 py-2">
                            <StatBadge value={displayProfile.streak || 0} label="🔥 Streak" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="px-6 mb-6 overflow-x-auto">
                <div className="flex gap-1 border-b border-white/10 min-w-max">
                    {TAB_CONFIG.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => handleTabChange(tab.id)}
                            className={`px-6 py-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === tab.id
                                    ? 'border-emerald-500 text-white'
                                    : 'border-transparent text-slate-500 hover:text-slate-300'
                                }`}
                        >
                            <span className="text-lg">{tab.icon}</span>
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div className="px-6 space-y-8 max-w-4xl mx-auto">

                {/* === PROFIL TAB === */}
                {activeTab === 'profile' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <section className="bg-slate-900/50 border border-white/5 rounded-2xl p-6">
                            <h3 className="text-lg font-bold text-white mb-4">Om mig</h3>

                            {/* Logic to hide/blur if restricted? Handled by passing partial object? */}
                            {displayProfile.bio !== undefined ? (
                                isPreviewMode ? (
                                    <p className="text-slate-300 whitespace-pre-wrap">{displayProfile.bio || 'Ingen biografi.'}</p>
                                ) : (
                                    <InlineTextArea
                                        value={displayProfile.bio || ''}
                                        isEditing={editingField === 'bio'}
                                        onEdit={() => setEditingField('bio')}
                                        onBlur={() => commitField('bio')}
                                        onChange={v => setProfile(p => ({ ...p, bio: v }))}
                                        placeholder="Berätta lite om dig själv..."
                                    />
                                )
                            ) : (
                                <div className="text-slate-600 italic">Dold (Privat)</div>
                            )}

                            <div className="mt-6 space-y-4">
                                {displayProfile.location !== undefined ? (
                                    isPreviewMode ? (
                                        <div className="flex items-center gap-2 text-slate-300">
                                            <span>📍</span> {displayProfile.location || '-'}
                                        </div>
                                    ) : (
                                        <InfoBadge
                                            icon="📍"
                                            value={displayProfile.location || ''}
                                            placeholder="Lägg till plats"
                                            field="location"
                                            editingField={editingField}
                                            onEdit={setEditingField}
                                            onChange={(f: any, v: any) => setProfile(p => ({ ...p, [f]: v }))}
                                            onBlur={() => commitField('location')}
                                        />
                                    )
                                ) : null}

                                {displayProfile.website !== undefined ? (
                                    isPreviewMode ? (
                                        <div className="flex items-center gap-2 text-emerald-400">
                                            <span>🌐</span> {displayProfile.website || '-'}
                                        </div>
                                    ) : (
                                        <InfoBadge
                                            icon="🌐"
                                            value={displayProfile.website || ''}
                                            placeholder="Lägg till webbsida"
                                            field="website"
                                            editingField={editingField}
                                            onEdit={setEditingField}
                                            onChange={(f: any, v: any) => setProfile(p => ({ ...p, [f]: v }))}
                                            onBlur={() => commitField('website')}
                                        />
                                    )
                                ) : null}
                            </div>
                        </section>
                    </div>
                )}

                {/* === FYSISK TAB === */}
                {activeTab === 'biometrics' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        {/* Only show MeasurementsModule if weight is visible (not hidden by privacy) */}
                        {displayProfile.weight !== undefined ? (
                            <MeasurementsModule targetWeight={profile.targetWeight || 0} height={settings.height} />
                        ) : (
                            <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-12 text-center">
                                <div className="text-4xl mb-4">🔒</div>
                                <h3 className="text-xl font-bold text-white mb-2">Privat Innehåll</h3>
                                <p className="text-slate-400">Denna sektion är dold för besökaren.</p>
                            </div>
                        )}

                         {/* Basic Bio-metrics */}
                         <section className="bg-slate-900/50 border border-white/5 rounded-2xl p-6">
                            <h3 className="text-lg font-bold text-white mb-6">Grundläggande Biometri</h3>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-4 p-4 bg-white/5 rounded-xl">
                                    <div className="space-y-3">
                                        <label className="flex items-center justify-between">
                                            <span className="text-slate-200 text-sm">Längd (cm)</span>
                                            <input
                                                type="number"
                                                className="bg-white/10 border-none rounded-lg p-1 w-20 text-right text-white text-sm"
                                                value={settings.height || ''}
                                                onChange={e => updateSettings({ height: parseInt(e.target.value) || undefined })}
                                                placeholder="--"
                                            />
                                        </label>
                                        <label className="flex items-center justify-between">
                                            <div className="flex flex-col">
                                                <span className="text-slate-200 text-sm">Födelseår</span>
                                                {settings.birthYear && (
                                                    <span className="text-[10px] text-slate-500 font-bold uppercase">
                                                        {new Date().getFullYear() - settings.birthYear} år gammal
                                                    </span>
                                                )}
                                            </div>
                                            <input
                                                type="number"
                                                className="bg-white/10 border-none rounded-lg p-1 w-20 text-right text-white text-sm"
                                                value={settings.birthYear || ''}
                                                onChange={e => updateSettings({ birthYear: parseInt(e.target.value) || undefined })}
                                                placeholder="YYYY"
                                                min="1900"
                                                max={new Date().getFullYear()}
                                            />
                                        </label>
                                        <label className="flex items-center justify-between">
                                            <span className="text-slate-200 text-sm">Kön</span>
                                            <select
                                                className="bg-slate-800 border-none rounded-lg p-1 text-white text-sm focus:ring-1 focus:ring-sky-500 outline-none"
                                                value={settings.gender || ''}
                                                onChange={e => updateSettings({ gender: (e.target.value as any) || undefined })}
                                            >
                                                <option value="">Välj...</option>
                                                <option value="male">Man</option>
                                                <option value="female">Kvinna</option>
                                                <option value="other">Annat</option>
                                            </select>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>
                )}

                {/* === MÅL TAB === */}
                {activeTab === 'goals' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">

                        {/* Nutrition Goals - Overshadowed by Period? */}
                        <section className={`bg-slate-900/50 border border-white/5 rounded-2xl p-6 relative overflow-hidden ${activePeriod ? 'border-amber-500/30' : ''}`}>
                            {activePeriod && (
                                <div className="absolute top-0 right-0 bg-amber-500/10 border-l border-b border-amber-500/20 px-3 py-1 text-xs text-amber-500 font-bold rounded-bl-xl">
                                    🔒 Styrs av {activePeriod.name}
                                </div>
                            )}

                            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                <span>🥗</span> Kostmål
                            </h3>

                            <div className="grid md:grid-cols-4 gap-3">
                                <DataField
                                    label="Kalorier"
                                    value={activePeriod?.nutritionGoal?.calories.toString() || settings.dailyCalorieGoal?.toString() || ''}
                                    type="number"
                                    suffix="kcal"
                                    readOnly={!!activePeriod}
                                    onChange={(v: string) => updateSettings({ dailyCalorieGoal: Number(v) })}
                                />
                                <DataField
                                    label="Protein"
                                    value={activePeriod?.nutritionGoal?.protein?.toString() || settings.dailyProteinGoal?.toString() || ''}
                                    type="number"
                                    suffix="g"
                                    readOnly={!!activePeriod}
                                    onChange={(v: string) => updateSettings({ dailyProteinGoal: Number(v) })}
                                />
                                <DataField
                                    label="Kolhydrater"
                                    value={activePeriod?.nutritionGoal?.carbs?.toString() || settings.dailyCarbsGoal?.toString() || ''}
                                    type="number"
                                    suffix="g"
                                    readOnly={!!activePeriod}
                                    onChange={(v: string) => updateSettings({ dailyCarbsGoal: Number(v) })}
                                />
                                <DataField
                                    label="Fett"
                                    value={activePeriod?.nutritionGoal?.fat?.toString() || settings.dailyFatGoal?.toString() || ''}
                                    type="number"
                                    suffix="g"
                                    readOnly={!!activePeriod}
                                    onChange={(v: string) => updateSettings({ dailyFatGoal: Number(v) })}
                                />
                            </div>

                            {activePeriod && (
                                <p className="text-xs text-amber-500/70 mt-4 italic">
                                    Dessa mål hanteras automatiskt av din aktiva träningsperiod. Ändra i perioden för att uppdatera.
                                </p>
                            )}
                        </section>

                        {/* Lifestyle / Habits */}
                        <section className="bg-slate-900/50 border border-white/5 rounded-2xl p-6">
                            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                <span>💤</span> Livsstil & Vanor
                            </h3>
                            <div className="grid md:grid-cols-3 gap-3">
                                <DataField
                                    label="Sömn"
                                    value={settings.dailySleepGoal?.toString() || ''}
                                    type="number"
                                    suffix="h"
                                    onChange={(v: string) => updateSettings({ dailySleepGoal: Number(v) })}
                                />
                                <DataField
                                    label="Vatten"
                                    value={(settings as any).dailyWaterGoal?.toString() || '8'}
                                    type="number"
                                    suffix="glas"
                                    onChange={(v: string) => updateSettings({ dailyWaterGoal: Number(v) } as any)}
                                />
                                <DataField
                                    label="Steg"
                                    value={(settings as any).dailyStepGoal?.toString() || '10000'}
                                    type="number"
                                    suffix=""
                                    onChange={(v: string) => updateSettings({ dailyStepGoal: Number(v) } as any)}
                                />
                                <DataField
                                    label="Koffein Max"
                                    value={(settings as any).dailyCaffeineMax?.toString() || '400'}
                                    type="number"
                                    suffix="mg"
                                    onChange={(v: string) => updateSettings({ dailyCaffeineMax: Number(v) } as any)}
                                />
                                <DataField
                                    label="Träning (min/dag)"
                                    value={settings.dailyTrainingGoal?.toString() || '60'}
                                    type="number"
                                    suffix="min"
                                    onChange={(v: string) => updateSettings({ dailyTrainingGoal: Number(v) } as any)}
                                />
                            </div>
                        </section>
                    </div>
                )}

                {/* === INTEGRITET TAB === */}
                {activeTab === 'privacy' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <section className="bg-slate-900/50 border border-white/5 rounded-2xl p-6">
                            <PrivacySettingsSection
                                privacy={profile.privacy as any}
                                onToggle={updatePrivacy}
                                onUpdateSharing={updateSharing}
                            />
                        </section>

                        {/* Custom Individual Overrides - MOVED HERE FROM SETTINGS */}
                        <section className="bg-slate-900/50 border border-white/5 rounded-2xl p-6">
                            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <span>🔐</span> Individuella Delningar
                            </h2>
                            <p className="text-sm text-slate-400 mb-6">
                                Ge specifika personer tillgång till kategorier som annars är privata.
                                <span className="text-emerald-400 ml-2"> ✓ = Tillåt</span>,
                                <span className="text-rose-400 ml-2"> ✗ = Neka</span>,
                                <span className="text-slate-500 ml-2"> ○ = Följ standard</span>
                            </p>

                            <div className="space-y-4">
                                {Object.entries(categoryOverrides).length === 0 ? (
                                    <div className="text-center py-8 text-slate-500 bg-white/5 rounded-xl border border-dashed border-white/10">
                                        <div className="text-2xl mb-2">🔒</div>
                                        <p>Inga individuella delningar inställda.</p>
                                    </div>
                                ) : (
                                    Object.entries(categoryOverrides).map(([userId, overrides]) => {
                                        const targetUser = users.find(u => u.id === userId);
                                        if (!targetUser) return null;

                                        return (
                                            <div key={userId} className="p-4 bg-white/5 rounded-xl border border-white/5">
                                                <div className="flex items-center justify-between mb-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                                                            {targetUser.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-white text-sm">{targetUser.name}</div>
                                                            <div className="text-xs text-slate-500">@{targetUser.handle || targetUser.username}</div>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => removeUserOverride(userId)}
                                                        className="px-3 py-1 text-xs text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                                                    >
                                                        Ta bort
                                                    </button>
                                                </div>

                                                <div className="grid grid-cols-5 gap-2">
                                                    {Object.entries(CATEGORY_ICONS).map(([key, { label, icon }]) => {
                                                        const value = (overrides as any)[key];
                                                        const isAllowed = value === true;
                                                        const isDenied = value === false;

                                                        return (
                                                            <button
                                                                key={key}
                                                                onClick={() => toggleCategoryOverride(userId, key)}
                                                                className={`flex flex-col items-center p-2 rounded-lg transition-all ${isAllowed
                                                                        ? 'bg-emerald-500/20 border border-emerald-500/30'
                                                                        : isDenied
                                                                            ? 'bg-rose-500/20 border border-rose-500/30'
                                                                            : 'bg-white/5 border border-white/10 hover:bg-white/10 opacity-50 hover:opacity-100'
                                                                    }`}
                                                                title={`${label}: ${isAllowed ? 'Tillåten' : isDenied ? 'Nekad' : 'Standard'}`}
                                                            >
                                                                <span className="text-lg mb-1">{icon}</span>
                                                                <span className={`text-[10px] font-medium uppercase ${isAllowed ? 'text-emerald-400' : isDenied ? 'text-rose-400' : 'text-slate-500'
                                                                    }`}>
                                                                    {isAllowed ? 'Tillåten' : isDenied ? 'Nekad' : 'Auto'}
                                                                </span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}

                                {/* Add new override UI */}
                                {showAddOverride ? (
                                    <div className="p-4 bg-sky-500/10 border border-sky-500/20 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-2">
                                        <div className="flex items-center gap-2">
                                            <select
                                                value={selectedUserId}
                                                onChange={e => setSelectedUserId(e.target.value)}
                                                className="flex-1 bg-slate-800 border-none rounded-lg p-2 text-white text-sm focus:ring-1 focus:ring-sky-500 outline-none"
                                            >
                                                <option value="">Välj person...</option>
                                                {availableUsers.map(u => (
                                                    <option key={u.id} value={u.id}>{u.name} (@{u.handle || u.username})</option>
                                                ))}
                                            </select>
                                            <button
                                                onClick={addUserOverride}
                                                disabled={!selectedUserId}
                                                className="px-4 py-2 bg-sky-500 hover:bg-sky-600 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg text-sm font-bold transition-colors"
                                            >
                                                Lägg till
                                            </button>
                                            <button
                                                onClick={() => { setShowAddOverride(false); setSelectedUserId(''); }}
                                                className="px-3 py-2 text-slate-400 hover:text-white transition-colors"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setShowAddOverride(true)}
                                        className="w-full p-4 border border-dashed border-white/10 rounded-xl text-slate-400 hover:text-white hover:border-white/30 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <span>+</span> Lägg till person
                                    </button>
                                )}
                            </div>
                        </section>
                    </div>
                )}

                {/* === KONTO TAB === */}
                {activeTab === 'account' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        {/* Account Info */}
                        <section className="bg-slate-900/50 border border-white/5 rounded-2xl p-6">
                            <h3 className="text-lg font-bold text-white mb-4">Inloggning & Konto</h3>
                             <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                                <div>
                                    <div className="font-bold text-white">{profile.name}</div>
                                    <div className="text-sm text-slate-400">{profile.email}</div>
                                </div>
                                <div className="px-3 py-1 bg-sky-500/10 text-sky-400 rounded-lg text-xs font-bold border border-sky-500/20">
                                    Aktiv
                                </div>
                            </div>
                        </section>

                        {/* Appearance */}
                         <section className="bg-slate-900/50 border border-white/5 rounded-2xl p-6">
                            <h3 className="text-lg font-bold text-white mb-4">Utseende</h3>
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
                        </section>

                        {/* Sessions */}
                        <section className="bg-slate-900/50 border border-white/5 rounded-2xl p-6">
                            <h3 className="text-lg font-bold text-white mb-4">Aktiva Sessioner</h3>
                            <SessionsSection />
                        </section>

                        {/* Data Export & Danger */}
                        <section className="bg-slate-900/50 border border-white/5 rounded-2xl p-6">
                            <h3 className="text-lg font-bold text-white mb-4">Datahantering</h3>
                             <div className="p-4 bg-white/5 rounded-xl mb-4 flex items-center justify-between">
                                <div>
                                    <h4 className="font-bold text-white text-sm">Exportera Data</h4>
                                    <p className="text-xs text-slate-400">Ladda ner all din data som JSON.</p>
                                </div>
                                <button className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-bold transition-colors">
                                    Exportera
                                </button>
                            </div>
                            <DangerZoneSection />
                        </section>
                    </div>
                )}

            </div>
        </div>
    );

    if (isPreviewMode) {
        return (
            <ProfilePreviewMode
                profile={profile as any}
                currentUserId={currentUser?.id || ''}
                users={users}
                onExit={() => setIsPreviewMode(false)}
            >
                {(filteredProfile) => content(filteredProfile as ProfileData)}
            </ProfilePreviewMode>
        );
    }

    return content(profile);
}
