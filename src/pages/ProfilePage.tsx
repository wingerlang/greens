// ProfilePage - Main orchestrator component
// All logic has been extracted into reusable hooks and components

import React, { useState, useEffect, useRef } from 'react';
import { useSettings } from '../context/SettingsContext.tsx';
import { type MealType, MEAL_TYPE_LABELS } from '../models/types.ts';
import { useData } from '../context/DataContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { profileService, ProfileData } from '../services/profileService.ts';

// Import profile components
import {
    CollapsibleSection,
    DataField,
    InlineEdit,
    InlineTextArea,
    InfoBadge,
    StatBadge,
    QuickAction,
} from '../components/profile/atoms/index.ts';

import {
    BodyMeasurementsSection,
    PRManagerSection,
    HRZonesSection,
    ActivityStatsSection,
    NotificationSettingsSection,
    SessionsSection,
    WeightHistorySection,
    PrivacySettingsSection,
    DangerZoneSection
} from '../components/profile/sections/index.ts';

import './ProfilePage.css';

const ALL_MEALS: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export function ProfilePage() {
    const { settings, updateSettings, toggleMealVisibility, theme, toggleTheme } = useSettings();
    const { user: authUser } = useAuth();
    const { users } = useData();

    // Profile state
    const [profile, setProfile] = useState({
        name: '', handle: '', bio: '', location: '', birthdate: '', email: '', phone: '', website: '',
        avatarUrl: '', streak: 0, weight: 0, targetWeight: 0, bodyFat: 0, maxHr: 0, restingHr: 0, lthr: 0,
        vdot: 0, ftp: 0, weeklyDistanceGoal: 0, weeklyCalorieGoal: 0, sleepGoal: 8, waterGoal: 8,
        preferredUnits: 'metric', weekStartsOn: 1,
        privacy: {
            isPublic: true, allowFollowers: true, showWeight: false, showAge: true,
            showCalories: true, showDetailedTraining: true, showSleep: false
        }
    });
    const [editingField, setEditingField] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
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

    const updateProfile = (field: string, value: any) => {
        setProfile(prev => ({ ...prev, [field]: value }));
        saveField(field, value);
    };

    const commitField = (field: string) => {
        setEditingField(null);
        saveField(field, (profile as any)[field]);
    };

    const updatePrivacy = async (key: string, value: boolean) => {
        setProfile(prev => ({ ...prev, privacy: { ...prev.privacy, [key]: value } }));
        await profileService.updatePrivacy({ [key]: value });
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
                                value={profile.name}
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
                                    value={profile.handle}
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
                            <StatBadge value={profile.streak} label="🔥 Streak" />
                            <StatBadge value={0} label="Följare" />
                            <StatBadge value={0} label="Följer" />
                        </div>
                    </div>

                    {/* Bio */}
                    <div className="mt-4">
                        <InlineTextArea
                            value={profile.bio}
                            isEditing={editingField === 'bio'}
                            onEdit={() => setEditingField('bio')}
                            onBlur={() => commitField('bio')}
                            onChange={v => setProfile(p => ({ ...p, bio: v }))}
                            placeholder="Berätta lite om dig själv..."
                        />
                    </div>

                    {/* Info Badges */}
                    <div className="flex flex-wrap gap-2 mt-4">
                        <InfoBadge icon="📍" value={profile.location} placeholder="Plats" field="location" editingField={editingField} onEdit={setEditingField} onChange={(f, v) => setProfile(p => ({ ...p, [f]: v }))} onBlur={() => commitField('location')} />
                        <InfoBadge icon="🌐" value={profile.website} placeholder="Webbsida" field="website" editingField={editingField} onEdit={setEditingField} onChange={(f, v) => setProfile(p => ({ ...p, [f]: v }))} onBlur={() => commitField('website')} />
                        <InfoBadge icon="🎂" value={profile.birthdate ? `${calculateAge(profile.birthdate)} år` : ''} placeholder="Ålder" field="birthdate" editingField={editingField} onEdit={setEditingField} onChange={(f, v) => setProfile(p => ({ ...p, [f]: v }))} />
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
                    <BodyMeasurementsSection targetWeight={profile.targetWeight} height={settings.height} />
                </CollapsibleSection>

                <CollapsibleSection id="goals" title="Dagliga Mål" icon="🎯">
                    <div className="grid md:grid-cols-4 gap-3">
                        <DataField label="Kalorier" value={settings.dailyCalorieGoal?.toString() || ''} type="number" suffix="kcal" onChange={(v) => updateSettings({ dailyCalorieGoal: Number(v) })} />
                        <DataField label="Protein" value={settings.dailyProteinGoal?.toString() || ''} type="number" suffix="g" onChange={(v) => updateSettings({ dailyProteinGoal: Number(v) })} />
                        <DataField label="Kolhydrater" value={settings.dailyCarbsGoal?.toString() || ''} type="number" suffix="g" onChange={(v) => updateSettings({ dailyCarbsGoal: Number(v) })} />
                        <DataField label="Fett" value={settings.dailyFatGoal?.toString() || ''} type="number" suffix="g" onChange={(v) => updateSettings({ dailyFatGoal: Number(v) })} />
                        <DataField label="Sömn" value={settings.dailySleepGoal?.toString() || ''} type="number" suffix="h" onChange={(v) => updateSettings({ dailySleepGoal: Number(v) })} />
                        <DataField label="Vatten" value={(settings as any).dailyWaterGoal?.toString() || '8'} type="number" suffix="glas" onChange={(v) => updateSettings({ dailyWaterGoal: Number(v) } as any)} />
                        <DataField label="Steg" value={(settings as any).dailyStepGoal?.toString() || '10000'} type="number" suffix="" onChange={(v) => updateSettings({ dailyStepGoal: Number(v) } as any)} />
                        <DataField label="Koffein Max" value={(settings as any).dailyCaffeineMax?.toString() || '400'} type="number" suffix="mg" onChange={(v) => updateSettings({ dailyCaffeineMax: Number(v) } as any)} />
                    </div>
                </CollapsibleSection>

                <CollapsibleSection id="running" title="Löpning & Cykel" icon="🏃">
                    <div className="grid md:grid-cols-4 gap-3">
                        <DataField label="Max Puls" value={profile.maxHr.toString()} type="number" suffix="bpm" onChange={(v) => updateProfile('maxHr', Number(v))} />
                        <DataField label="Vila Puls" value={profile.restingHr.toString()} type="number" suffix="bpm" onChange={(v) => updateProfile('restingHr', Number(v))} />
                        <DataField label="Laktattröskel" value={profile.lthr.toString()} type="number" suffix="bpm" onChange={(v) => updateProfile('lthr', Number(v))} />
                        <DataField label="VDOT" value={profile.vdot.toString()} type="number" onChange={(v) => updateProfile('vdot', Number(v))} />
                        <DataField label="FTP (Cykel)" value={profile.ftp.toString()} type="number" suffix="W" onChange={(v) => updateProfile('ftp', Number(v))} />
                    </div>
                </CollapsibleSection>

                <CollapsibleSection id="prs" title="Personal Records" icon="🏆">
                    <PRManagerSection />
                </CollapsibleSection>

                <CollapsibleSection id="weight-history" title="Vikthistorik" icon="⚖️" defaultOpen={false}>
                    <WeightHistorySection currentWeight={profile.weight} targetWeight={profile.targetWeight} />
                </CollapsibleSection>

                <CollapsibleSection id="hr-zones" title="Pulszoner" icon="💓" defaultOpen={false}>
                    <HRZonesSection onUpdateProfile={updateProfile} />
                </CollapsibleSection>

                <CollapsibleSection id="activity-stats" title="Aktivitetsstatistik" icon="📊" defaultOpen={false}>
                    <ActivityStatsSection />
                </CollapsibleSection>

                <CollapsibleSection id="privacy" title="Integritet" icon="🔒">
                    <PrivacySettingsSection privacy={profile.privacy} onToggle={updatePrivacy} />
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
                        ]} onChange={(v) => updateProfile('weekStartsOn', v === 'sunday' ? 0 : 1)} />
                        <DataField label="Enheter" value={profile.preferredUnits} type="select" options={[
                            { value: 'metric', label: '📐 Metriskt (kg, km)' },
                            { value: 'imperial', label: '📐 Imperial (lbs, mi)' },
                        ]} onChange={(v) => updateProfile('preferredUnits', v)} />
                    </div>
                </CollapsibleSection>

                <DangerZoneSection />
            </div>
        </div>
    );
}
