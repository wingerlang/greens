import React, { useState, useEffect, useRef } from 'react';
import { useSettings } from '../context/SettingsContext.tsx';
import { type MealType, MEAL_TYPE_LABELS } from '../models/types.ts';
import { useData } from '../context/DataContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { LoginStat } from '../api/db.ts';
import { StravaConnectionCard } from '../components/integrations/StravaConnectionCard.tsx';
import { ActivityInbox } from '../components/integrations/ActivityInbox.tsx';
import { profileService, ProfileData } from '../services/profileService.ts';
import './ProfilePage.css';

const ALL_MEALS: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

// Collapsible section wrapper
function CollapsibleSection({ id, title, icon, defaultOpen = true, children }: {
    id: string, title: string, icon: string, defaultOpen?: boolean, children: React.ReactNode
}) {
    const [open, setOpen] = useState(() => {
        const stored = localStorage.getItem(`section_${id}`);
        return stored !== null ? stored === 'true' : defaultOpen;
    });

    const toggle = () => {
        setOpen(!open);
        localStorage.setItem(`section_${id}`, (!open).toString());
    };

    return (
        <section className="bg-slate-900/50 rounded-2xl border border-white/5 backdrop-blur-sm overflow-hidden">
            <button
                onClick={toggle}
                className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-all"
            >
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>{icon}</span> {title}
                </h2>
                <span className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
            </button>
            {open && <div className="px-6 pb-6 pt-2">{children}</div>}
        </section>
    );
}

export function ProfilePage() {
    const { settings, theme, toggleTheme, toggleMealVisibility, updateSettings } = useSettings();
    const { currentUser } = useData();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Profile data state
    const [profile, setProfile] = useState({
        name: currentUser?.name || 'Admin Anders',
        handle: currentUser?.handle || 'admin_anders',
        bio: currentUser?.bio || '',
        location: currentUser?.location || '',
        birthdate: '',
        email: currentUser?.email || 'admin@greens.app',
        phone: '',
        website: '',
        avatarUrl: currentUser?.avatarUrl || '',
        streak: 0,

        // Physical
        weight: 75,
        targetWeight: 70,
        bodyFat: 18,

        // Running
        maxHr: 190,
        restingHr: 55,
        lthr: 170,
        vdot: 45,
        ftp: 200,

        // Personal records
        pr5k: '22:30',
        pr10k: '48:00',
        prHalfMarathon: '1:50:00',
        prMarathon: '4:00:00',

        // Preferences
        preferredUnits: 'metric' as 'metric' | 'imperial',
        language: 'sv',
        weekStartsOn: 1,

        // Privacy
        privacy: {
            isPublic: true,
            allowFollowers: true,
            showWeight: false,
            showAge: false,
            showCalories: false,
            showDetailedTraining: true,
            showSleep: false,
        }
    });

    const [editingField, setEditingField] = useState<string | null>(null);
    const [handleStatus, setHandleStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
    const [saving, setSaving] = useState(false);

    // Fetch profile from backend on mount
    useEffect(() => {
        profileService.getProfile().then(data => {
            if (data) {
                setProfile(prev => ({ ...prev, ...data }));
            }
        });
    }, []);

    // Save profile field to backend (debounced)
    const saveField = async (field: string, value: any) => {
        setSaving(true);
        await profileService.updateProfile({ [field]: value });
        setSaving(false);
    };

    const updateProfile = async (field: string, value: any) => {
        setProfile(prev => ({ ...prev, [field]: value }));

        if (field === 'handle') {
            setHandleStatus('checking');
            const result = await profileService.checkHandle(value);
            setHandleStatus(result.available ? 'available' : 'taken');
        }
    };

    const commitField = (field: string) => {
        setEditingField(null);
        const value = (profile as any)[field];
        if (value !== undefined) {
            saveField(field, value);
        }
    };

    const updatePrivacy = async (key: string, value: boolean) => {
        const newPrivacy = { ...profile.privacy, [key]: value };
        setProfile(prev => ({ ...prev, privacy: newPrivacy }));
        await profileService.updatePrivacy({ [key]: value });
    };

    const handleAvatarClick = () => fileInputRef.current?.click();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                updateProfile('avatarUrl', e.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const calculateAge = (birthdate: string) => {
        if (!birthdate) return null;
        const age = Math.floor((Date.now() - new Date(birthdate).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        return age > 0 && age < 120 ? age : null;
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-16">
            {/* Hero Profile Card */}
            <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-8 border border-white/10 shadow-2xl">
                <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
                    {/* Avatar with Upload */}
                    <div className="relative group">
                        <div
                            className="w-32 h-32 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-[2.5rem] flex items-center justify-center text-6xl shadow-2xl shadow-emerald-500/30 ring-4 ring-white/10 cursor-pointer overflow-hidden"
                            onClick={handleAvatarClick}
                        >
                            {profile.avatarUrl ? (
                                <img src={profile.avatarUrl} className="w-full h-full object-cover" alt="Avatar" />
                            ) : (
                                <span>👤</span>
                            )}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                                <span className="text-2xl">📷</span>
                            </div>
                        </div>
                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                    </div>

                    {/* Main Info */}
                    <div className="flex-1 text-center md:text-left space-y-3">
                        {/* Name Row */}
                        <div className="flex items-center gap-3 justify-center md:justify-start flex-wrap">
                            <InlineEdit
                                value={profile.name}
                                isEditing={editingField === 'name'}
                                onEdit={() => setEditingField('name')}
                                onBlur={() => commitField('name')}
                                onChange={(v) => updateProfile('name', v)}
                                className="text-3xl font-black text-white"
                            />
                            <span className={`text-[10px] px-2.5 py-1 rounded-full uppercase tracking-widest font-bold ${currentUser?.plan === 'evergreen'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                }`}>
                                {currentUser?.plan === 'evergreen' ? '🌲 Evergreen' : '⭐ Pro'}
                            </span>
                        </div>

                        {/* Handle */}
                        <div className="flex items-center gap-2 justify-center md:justify-start">
                            <span className="text-emerald-400">@</span>
                            <InlineEdit
                                value={profile.handle}
                                isEditing={editingField === 'handle'}
                                onEdit={() => setEditingField('handle')}
                                onBlur={() => commitField('handle')}
                                onChange={(v) => updateProfile('handle', v.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                                className="text-emerald-400 font-mono text-sm"
                            />
                            {handleStatus === 'checking' && <span className="text-yellow-400 text-xs animate-spin">⏳</span>}
                            {handleStatus === 'available' && <span className="text-emerald-400 text-xs">✅</span>}
                            {handleStatus === 'taken' && <span className="text-red-400 text-xs">❌ Upptaget</span>}
                        </div>

                        {/* Bio */}
                        <InlineTextArea
                            value={profile.bio}
                            isEditing={editingField === 'bio'}
                            onEdit={() => setEditingField('bio')}
                            onBlur={() => commitField('bio')}
                            onChange={(v) => updateProfile('bio', v)}
                            placeholder="Lägg till din bio... 🏃‍♂️💪"
                        />

                        {/* Quick Info Row */}
                        <div className="flex flex-wrap gap-3 justify-center md:justify-start text-sm">
                            <InfoBadge icon="📍" value={profile.location} placeholder="Plats" field="location" editingField={editingField} onEdit={setEditingField} onChange={updateProfile} />
                            <InfoBadge icon="🌐" value={profile.website} placeholder="Hemsida" field="website" editingField={editingField} onEdit={setEditingField} onChange={updateProfile} />
                            <InfoBadge icon="📧" value={profile.email} placeholder="Email" field="email" editingField={editingField} onEdit={setEditingField} onChange={updateProfile} />
                        </div>

                        {/* Stats Row */}
                        <div className="flex gap-6 justify-center md:justify-start text-xs pt-2">
                            <StatBadge value={currentUser?.followersCount || 42} label="följare" />
                            <StatBadge value={currentUser?.followingCount || 18} label="följer" />
                            <StatBadge value={`🔥 ${profile.streak}`} label="streak" />
                            {calculateAge(profile.birthdate) && <StatBadge value={calculateAge(profile.birthdate)!} label="år" />}
                        </div>

                        <p className="text-slate-600 text-[10px] uppercase tracking-wider font-bold">
                            Medlem sedan {currentUser?.createdAt ? new Date(currentUser.createdAt).toLocaleDateString('sv-SE') : 'Dec 2024'}
                        </p>
                    </div>
                </div>
            </section>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                <QuickAction icon="👁️" label="Profil" href={`/u/${profile.handle}`} />
                <QuickAction icon="🔗" label="Kopiera" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/u/${profile.handle}`); }} />
                <QuickAction icon="📊" label="Export" onClick={() => alert('Export coming!')} />
                <QuickAction icon="🔄" label="Synka" onClick={() => alert('Syncing...')} />
                <QuickAction icon="⚙️" label="Avancerat" onClick={() => { }} />
            </div>

            {/* Collapsible Settings Sections */}
            <div className="space-y-4">

                <CollapsibleSection id="personal" title="Personuppgifter" icon="👤" defaultOpen={true}>
                    <div className="grid md:grid-cols-2 gap-4">
                        <DataField label="Födelsedatum" value={profile.birthdate} type="date" onChange={(v) => updateProfile('birthdate', v)} />
                        <DataField label="Ålder" value={calculateAge(profile.birthdate)?.toString() || '-'} readonly suffix="år" />
                        <DataField label="Kön" value={settings.gender || 'other'} type="select" options={[
                            { value: 'male', label: '👨 Man' },
                            { value: 'female', label: '👩 Kvinna' },
                            { value: 'other', label: '🧑 Annat' },
                        ]} onChange={(v) => updateSettings({ gender: v as any })} />
                        <DataField label="Telefon" value={profile.phone} onChange={(v) => updateProfile('phone', v)} placeholder="+46 7XX XXX XXX" />
                        <DataField label="Språk" value={profile.language} type="select" options={[
                            { value: 'sv', label: '🇸🇪 Svenska' },
                            { value: 'en', label: '🇬🇧 English' },
                            { value: 'no', label: '🇳🇴 Norsk' },
                        ]} onChange={(v) => updateProfile('language', v)} />
                        <DataField label="Enheter" value={profile.preferredUnits} type="select" options={[
                            { value: 'metric', label: '📏 Metriskt (kg, km)' },
                            { value: 'imperial', label: '📐 Imperial (lbs, mi)' },
                        ]} onChange={(v) => updateProfile('preferredUnits', v)} />
                    </div>
                </CollapsibleSection>

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
                    <div className="grid md:grid-cols-2 gap-3">
                        <PrivacyToggle label="Publik Profil" desc="Syns i sök" active={profile.privacy.isPublic} onToggle={() => updatePrivacy('isPublic', !profile.privacy.isPublic)} />
                        <PrivacyToggle label="Tillåt Följare" active={profile.privacy.allowFollowers} onToggle={() => updatePrivacy('allowFollowers', !profile.privacy.allowFollowers)} />
                        <PrivacyToggle label="Visa Vikt" active={profile.privacy.showWeight} onToggle={() => updatePrivacy('showWeight', !profile.privacy.showWeight)} />
                        <PrivacyToggle label="Visa Ålder" active={profile.privacy.showAge} onToggle={() => updatePrivacy('showAge', !profile.privacy.showAge)} />
                        <PrivacyToggle label="Visa Kalorier" active={profile.privacy.showCalories} onToggle={() => updatePrivacy('showCalories', !profile.privacy.showCalories)} />
                        <PrivacyToggle label="Visa Träning" active={profile.privacy.showDetailedTraining} onToggle={() => updatePrivacy('showDetailedTraining', !profile.privacy.showDetailedTraining)} />
                        <PrivacyToggle label="Visa Sömn" active={profile.privacy.showSleep} onToggle={() => updatePrivacy('showSleep', !profile.privacy.showSleep)} />
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
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${settings.visibleMeals.includes(meal)
                                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                            : 'bg-slate-800 text-slate-500'
                                            }`}
                                    >{MEAL_TYPE_LABELS[meal]}</button>
                                ))}
                            </div>
                        </div>
                    </div>
                </CollapsibleSection>

                <CollapsibleSection id="notifications" title="Notifikationer" icon="🔔" defaultOpen={false}>
                    <div className="grid md:grid-cols-2 gap-3">
                        <PrivacyToggle label="Daglig Påminnelse" desc="Logga mat" active={true} onToggle={() => { }} />
                        <PrivacyToggle label="Träningsreminder" active={true} onToggle={() => { }} />
                        <PrivacyToggle label="Nya Följare" active={true} onToggle={() => { }} />
                        <PrivacyToggle label="Veckosummering" desc="Söndagar 20:00" active={false} onToggle={() => { }} />
                        <PrivacyToggle label="Rekordvarning" desc="Nära PR" active={true} onToggle={() => { }} />
                        <PrivacyToggle label="Inaktivitetsvarning" desc="3 dagar utan träning" active={true} onToggle={() => { }} />
                    </div>
                </CollapsibleSection>

                <CollapsibleSection id="connections" title="Kopplingar" icon="🔗" defaultOpen={false}>
                    <div className="space-y-4">
                        <StravaConnectionCard />
                        <ActivityInbox />
                        <div className="bg-slate-800/50 rounded-xl p-4 flex items-center justify-between">
                            <div>
                                <div className="font-bold text-white">Garmin Connect</div>
                                <div className="text-xs text-slate-500">Synka aktiviteter från Garmin</div>
                            </div>
                            <button className="px-4 py-2 bg-slate-700 text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-600">Koppla</button>
                        </div>
                        <div className="bg-slate-800/50 rounded-xl p-4 flex items-center justify-between">
                            <div>
                                <div className="font-bold text-white">Apple Health</div>
                                <div className="text-xs text-slate-500">Synka hälsodata</div>
                            </div>
                            <button className="px-4 py-2 bg-slate-700 text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-600">Koppla</button>
                        </div>
                    </div>
                </CollapsibleSection>

                <CollapsibleSection id="history" title="Inloggningshistorik" icon="🔐" defaultOpen={false}>
                    <LoginHistoryTable />
                </CollapsibleSection>

                <CollapsibleSection id="danger" title="Farozon" icon="⚠️" defaultOpen={false}>
                    <div className="flex flex-wrap gap-3">
                        <button className="px-4 py-2 bg-amber-500/10 text-amber-400 rounded-xl text-sm font-bold hover:bg-amber-500/20 border border-amber-500/20"
                            onClick={() => { localStorage.clear(); window.location.reload(); }}>🗑️ Rensa Cache</button>
                        <button className="px-4 py-2 bg-red-500/10 text-red-400 rounded-xl text-sm font-bold hover:bg-red-500/20 border border-red-500/20"
                            onClick={() => { if (confirm('Radera ALL data?')) { localStorage.clear(); window.location.reload(); } }}>💀 Radera All Data</button>
                        <button className="px-4 py-2 bg-slate-800 text-slate-400 rounded-xl text-sm font-bold hover:bg-slate-700">📤 Exportera & Radera</button>
                        <button className="px-4 py-2 bg-slate-800 text-slate-400 rounded-xl text-sm font-bold hover:bg-slate-700">🚫 Inaktivera Konto</button>
                    </div>
                </CollapsibleSection>
            </div>
        </div>
    );
}

// === Reusable Components ===

function DataField({ label, value, type = 'text', suffix, placeholder, options, onChange, readonly }: {
    label: string, value: string, type?: 'text' | 'number' | 'date' | 'select', suffix?: string, placeholder?: string,
    options?: { value: string, label: string }[], onChange?: (v: string) => void, readonly?: boolean
}) {
    return (
        <div>
            <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">{label}</label>
            <div className="flex items-center gap-2 bg-slate-800 rounded-xl border border-white/10 p-2.5">
                {type === 'select' && options ? (
                    <select
                        value={value}
                        onChange={(e) => onChange?.(e.target.value)}
                        className="flex-1 bg-transparent text-white text-sm outline-none"
                        disabled={readonly}
                    >
                        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                ) : (
                    <input
                        type={type}
                        value={value}
                        onChange={(e) => onChange?.(e.target.value)}
                        placeholder={placeholder}
                        className="flex-1 bg-transparent text-white text-sm outline-none w-full"
                        readOnly={readonly}
                    />
                )}
                {suffix && <span className="text-slate-500 text-xs font-bold">{suffix}</span>}
            </div>
        </div>
    );
}

function InlineEdit({ value, isEditing, onEdit, onBlur, onChange, className }: {
    value: string, isEditing: boolean, onEdit: () => void, onBlur: () => void, onChange: (v: string) => void, className: string
}) {
    if (isEditing) {
        return <input value={value} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} autoFocus
            className={`${className} bg-transparent border-b-2 border-emerald-500 outline-none`} />;
    }
    return <span className={`${className} cursor-pointer hover:text-emerald-300 transition-colors`} onClick={onEdit}>{value || 'Klicka för att redigera'}</span>;
}

function InlineTextArea({ value, isEditing, onEdit, onBlur, onChange, placeholder }: {
    value: string, isEditing: boolean, onEdit: () => void, onBlur: () => void, onChange: (v: string) => void, placeholder: string
}) {
    if (isEditing) {
        return <textarea value={value} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} autoFocus rows={2}
            className="w-full bg-slate-800/50 rounded-xl p-3 text-slate-300 text-sm border border-white/10 outline-none focus:border-emerald-500" placeholder={placeholder} />;
    }
    return <p className="text-slate-400 text-sm cursor-pointer hover:text-white transition-colors" onClick={onEdit}>{value || placeholder}</p>;
}

function InfoBadge({ icon, value, placeholder, field, editingField, onEdit, onChange }: {
    icon: string, value: string, placeholder: string, field: string, editingField: string | null, onEdit: (f: string | null) => void, onChange: (f: string, v: string) => void
}) {
    const isEditing = editingField === field;
    return (
        <div className="flex items-center gap-1 text-slate-400">
            <span>{icon}</span>
            {isEditing ? (
                <input value={value} onChange={(e) => onChange(field, e.target.value)} onBlur={() => onEdit(null)} autoFocus
                    className="bg-transparent border-b border-emerald-500 outline-none text-sm w-32" placeholder={placeholder} />
            ) : (
                <span className="cursor-pointer hover:text-white text-sm" onClick={() => onEdit(field)}>{value || placeholder}</span>
            )}
        </div>
    );
}

function StatBadge({ value, label }: { value: string | number, label: string }) {
    return <div><span className="font-black text-white text-lg">{value}</span><span className="text-slate-500 ml-1">{label}</span></div>;
}

function QuickAction({ icon, label, href, onClick }: { icon: string, label: string, href?: string, onClick?: () => void }) {
    const cls = "flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 hover:text-white border border-white/5 transition-all cursor-pointer";
    if (href) return <a href={href} target="_blank" className={cls}><span className="text-xl">{icon}</span><span className="text-[9px] font-bold uppercase">{label}</span></a>;
    return <button onClick={onClick} className={cls}><span className="text-xl">{icon}</span><span className="text-[9px] font-bold uppercase">{label}</span></button>;
}

function PrivacyToggle({ label, desc, active, onToggle }: { label: string, desc?: string, active: boolean, onToggle: () => void }) {
    return (
        <div className="flex items-center justify-between p-3 bg-slate-800/30 rounded-xl cursor-pointer hover:bg-slate-800/50 transition-all" onClick={onToggle}>
            <div><div className="font-medium text-white text-sm">{label}</div>{desc && <div className="text-[10px] text-slate-500">{desc}</div>}</div>
            <div className={`text-lg ${active ? '' : 'grayscale opacity-40'}`}>{active ? '✅' : '⬜'}</div>
        </div>
    );
}

function LoginHistoryTable() {
    const { fetchStats } = useAuth();
    const [stats, setStats] = useState<LoginStat[]>([]);
    useEffect(() => { fetchStats().then(setStats); }, []);
    if (!stats.length) return <p className="text-slate-500 text-sm">Ingen historik.</p>;
    return (
        <div className="overflow-hidden rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/50 text-slate-500 uppercase font-bold">
                    <tr><th className="p-3">Tid</th><th className="p-3">IP</th><th className="p-3">Status</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-slate-300">
                    {stats.slice(0, 10).map(s => (
                        <tr key={s.timestamp} className="hover:bg-white/5">
                            <td className="p-3 font-mono text-[10px]">{new Date(s.timestamp).toLocaleString('sv-SE')}</td>
                            <td className="p-3 font-mono text-[10px] opacity-70">{s.ip}</td>
                            <td className="p-3"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${s.success ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>{s.success ? '✓' : '✗'}</span></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ==========================================
// PR Manager Section (with detection + manual entry)
// ==========================================

const PR_CATEGORIES = ['1 km', '5 km', '10 km', 'Halvmarathon', 'Marathon'];

function PRManagerSection() {
    const [prs, setPRs] = useState<any[]>([]);
    const [detected, setDetected] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showManual, setShowManual] = useState(false);
    const [manualCategory, setManualCategory] = useState('5 km');
    const [manualTime, setManualTime] = useState('');
    const [manualDate, setManualDate] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        const [currentPRs, detectedPRs] = await Promise.all([
            profileService.getPRs(),
            profileService.detectPRs()
        ]);
        setPRs(currentPRs);
        setDetected(detectedPRs);
        setLoading(false);
    };

    const approvePR = async (pr: any) => {
        await profileService.savePR({
            category: pr.category,
            time: pr.time,
            date: pr.date,
            activityId: pr.activityId,
            isManual: false
        });
        await loadData();
    };

    const saveManualPR = async () => {
        if (!manualTime) return;
        await profileService.savePR({
            category: manualCategory,
            time: manualTime,
            date: manualDate || new Date().toISOString().split('T')[0],
            isManual: true
        });
        setManualTime('');
        setManualDate('');
        setShowManual(false);
        await loadData();
    };

    const deletePR = async (category: string) => {
        if (confirm(`Radera PR för ${category}?`)) {
            await profileService.deletePR(category);
            await loadData();
        }
    };

    if (loading) return <div className="text-slate-500 text-center py-4">Laddar...</div>;

    return (
        <div className="space-y-4">
            {/* Current PRs */}
            <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Dina Rekord</h4>
                {prs.length === 0 ? (
                    <p className="text-slate-500 text-sm">Inga PRs sparade ännu.</p>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                        {prs.map(pr => (
                            <div key={pr.category} className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-xl p-3 border border-amber-500/20">
                                <div className="text-amber-400 text-xs font-bold">{pr.category}</div>
                                <div className="text-white text-xl font-black">{pr.time}</div>
                                <div className="text-slate-500 text-[10px]">{pr.date} {pr.isManual ? '✏️' : '✓'}</div>
                                <button onClick={() => deletePR(pr.category)} className="text-red-400 text-[10px] mt-1 hover:underline">Radera</button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Detected PRs to approve */}
            {detected.length > 0 && (
                <div>
                    <h4 className="text-xs font-bold text-emerald-400 uppercase mb-3">🎉 Upptäckta Rekord (Godkänn eller Ignorera)</h4>
                    <div className="space-y-2">
                        {detected.map(pr => (
                            <div key={pr.category} className="flex items-center justify-between bg-emerald-500/10 rounded-xl p-3 border border-emerald-500/20">
                                <div className="flex-1">
                                    <span className="text-emerald-400 font-bold">{pr.category}</span>
                                    <span className="text-white font-black text-xl mx-3">{pr.time}</span>
                                    {pr.isBetterThanCurrent && (
                                        <span className="text-amber-400 text-xs">📈 Bättre än {pr.currentTime}</span>
                                    )}
                                    <div className="text-slate-500 text-xs">{pr.activityName} • {pr.date}</div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => approvePR(pr)} className="px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-sm font-bold hover:bg-emerald-600">✓ Godkänn</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Manual Entry */}
            <div className="border-t border-slate-800 pt-4">
                {showManual ? (
                    <div className="bg-slate-800/50 rounded-xl p-4 space-y-3">
                        <h4 className="text-sm font-bold text-white">Lägg till manuellt</h4>
                        <div className="grid grid-cols-3 gap-3">
                            <select value={manualCategory} onChange={e => setManualCategory(e.target.value)}
                                className="bg-slate-900 rounded-lg p-2 text-white text-sm border border-white/10">
                                {PR_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <input type="text" placeholder="Tid (mm:ss eller h:mm:ss)" value={manualTime} onChange={e => setManualTime(e.target.value)}
                                className="bg-slate-900 rounded-lg p-2 text-white text-sm border border-white/10" />
                            <input type="date" value={manualDate} onChange={e => setManualDate(e.target.value)}
                                className="bg-slate-900 rounded-lg p-2 text-white text-sm border border-white/10" />
                        </div>
                        <div className="flex gap-2">
                            <button onClick={saveManualPR} className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-bold hover:bg-emerald-600">Spara</button>
                            <button onClick={() => setShowManual(false)} className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm font-bold hover:bg-slate-600">Avbryt</button>
                        </div>
                    </div>
                ) : (
                    <button onClick={() => setShowManual(true)} className="text-emerald-400 text-sm font-medium hover:underline">+ Lägg till PR manuellt</button>
                )}
            </div>

            {/* Detect button */}
            <button onClick={loadData} className="text-slate-400 text-xs hover:text-white">🔄 Skanna aktiviteter igen</button>
        </div>
    );
}

// ==========================================
// Weight History Section (with mini chart)
// ==========================================

function WeightHistorySection({ currentWeight, targetWeight }: { currentWeight: number, targetWeight: number }) {
    const [history, setHistory] = useState<{ weight: number, date: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [newWeight, setNewWeight] = useState('');
    const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        profileService.getWeightHistory().then(h => {
            setHistory(h);
            setLoading(false);
        });
    }, []);

    const logWeight = async () => {
        if (!newWeight) return;
        await profileService.logWeight(Number(newWeight), newDate);
        const updated = await profileService.getWeightHistory();
        setHistory(updated);
        setNewWeight('');
    };

    const exportData = async () => {
        const data = await profileService.exportData();
        if (data) {
            profileService.downloadExport(data);
        }
    };

    if (loading) return <div className="text-slate-500 text-center py-4">Laddar...</div>;

    // Simple sparkline chart
    const maxW = Math.max(...history.map(h => h.weight), currentWeight, targetWeight);
    const minW = Math.min(...history.map(h => h.weight), currentWeight, targetWeight) - 2;
    const range = maxW - minW || 1;

    return (
        <div className="space-y-4">
            {/* Chart */}
            {history.length > 1 && (
                <div className="bg-slate-800/50 rounded-xl p-4">
                    <div className="flex items-end gap-1 h-24">
                        {history.slice(-30).map((h, i) => {
                            const height = ((h.weight - minW) / range) * 100;
                            const isLatest = i === history.slice(-30).length - 1;
                            return (
                                <div key={h.date} className="flex-1 flex flex-col items-center">
                                    <div
                                        className={`w-full rounded-t ${isLatest ? 'bg-emerald-400' : 'bg-slate-600'}`}
                                        style={{ height: `${height}%` }}
                                        title={`${h.date}: ${h.weight} kg`}
                                    />
                                </div>
                            );
                        })}
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500 mt-2">
                        <span>{history[0]?.date}</span>
                        <span className="text-emerald-400 font-bold">{currentWeight} kg</span>
                        <span>{history[history.length - 1]?.date}</span>
                    </div>
                    {/* Target line */}
                    <div className="text-center text-xs text-amber-400 mt-2">
                        Målvikt: {targetWeight} kg ({currentWeight > targetWeight ? `${currentWeight - targetWeight} kg kvar` : '🎯 Uppnått!'})
                    </div>
                </div>
            )}

            {/* Log new weight */}
            <div className="flex gap-2">
                <input type="number" step="0.1" placeholder="Vikt (kg)" value={newWeight} onChange={e => setNewWeight(e.target.value)}
                    className="flex-1 bg-slate-800 rounded-lg p-2 text-white text-sm border border-white/10" />
                <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
                    className="bg-slate-800 rounded-lg p-2 text-white text-sm border border-white/10" />
                <button onClick={logWeight} className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-bold hover:bg-emerald-600">Logga</button>
            </div>

            {/* History table */}
            {history.length > 0 && (
                <div className="max-h-48 overflow-y-auto">
                    <table className="w-full text-xs">
                        <thead className="text-slate-500 uppercase">
                            <tr><th className="text-left p-2">Datum</th><th className="text-right p-2">Vikt</th><th className="text-right p-2">Δ</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {history.slice().reverse().slice(0, 20).map((h, i, arr) => {
                                const prev = arr[i + 1];
                                const delta = prev ? h.weight - prev.weight : 0;
                                return (
                                    <tr key={h.date} className="text-slate-300">
                                        <td className="p-2">{h.date}</td>
                                        <td className="p-2 text-right font-mono">{h.weight} kg</td>
                                        <td className={`p-2 text-right font-mono ${delta > 0 ? 'text-red-400' : delta < 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                                            {delta !== 0 && (delta > 0 ? '+' : '')}{delta.toFixed(1)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Export button */}
            <button onClick={exportData} className="w-full py-2 bg-slate-800 text-slate-300 rounded-lg text-sm font-bold hover:bg-slate-700 flex items-center justify-center gap-2">
                📤 Exportera all data (JSON)
            </button>
        </div>
    );
}

// ==========================================
// HR Zones Section (with auto-detection)
// ==========================================

function HRZonesSection({ onUpdateProfile }: { onUpdateProfile: (field: string, value: any) => void }) {
    const [detected, setDetected] = useState<any>(null);
    const [saved, setSaved] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadZones();
    }, []);

    const loadZones = async () => {
        setLoading(true);
        const [savedZones, detectedZones] = await Promise.all([
            profileService.getHRZones(),
            profileService.detectHRZones()
        ]);
        setSaved(savedZones);
        setDetected(detectedZones);
        setLoading(false);
    };

    const applyDetected = async () => {
        if (!detected) return;
        await profileService.saveHRZones(detected);
        onUpdateProfile('maxHr', detected.maxHR);
        onUpdateProfile('restingHr', detected.estimatedRestingHR);
        onUpdateProfile('lthr', detected.estimatedLTHR);
        setSaved(detected);
    };

    if (loading) return <div className="text-slate-500 text-center py-4">Analyserar aktiviteter...</div>;

    const zones = saved || detected;

    return (
        <div className="space-y-4">
            {/* Detection info */}
            {detected && !saved && (
                <div className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-500/20">
                    <div className="flex items-center justify-between mb-2">
                        <div>
                            <span className="text-emerald-400 font-bold">🎯 Automatiskt detekterat från {detected.activitiesAnalyzed} aktiviteter</span>
                            <span className={`ml-2 text-xs px-2 py-0.5 rounded ${detected.confidence === 'high' ? 'bg-emerald-500/20 text-emerald-400' :
                                detected.confidence === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                                    'bg-red-500/20 text-red-400'
                                }`}>
                                {detected.confidence === 'high' ? 'Hög' : detected.confidence === 'medium' ? 'Medium' : 'Låg'} konfidens
                            </span>
                        </div>
                        <button onClick={applyDetected} className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-bold hover:bg-emerald-600">
                            ✓ Använd dessa
                        </button>
                    </div>
                    {detected.maxHRActivity && (
                        <div className="text-slate-400 text-xs">
                            Max puls {detected.maxHR} bpm under "{detected.maxHRActivity.name}" ({detected.maxHRActivity.date})
                        </div>
                    )}
                </div>
            )}

            {/* Key metrics */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                    <div className="text-red-400 text-3xl font-black">{zones?.maxHR || '—'}</div>
                    <div className="text-slate-500 text-xs uppercase">Max Puls</div>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                    <div className="text-blue-400 text-3xl font-black">{zones?.estimatedRestingHR || '—'}</div>
                    <div className="text-slate-500 text-xs uppercase">Vila Puls</div>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                    <div className="text-amber-400 text-3xl font-black">{zones?.estimatedLTHR || '—'}</div>
                    <div className="text-slate-500 text-xs uppercase">LTHR</div>
                </div>
            </div>

            {/* Zone visualization */}
            {zones?.zones && (
                <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-500 uppercase">Träningszoner</h4>
                    {Object.entries(zones.zones).map(([key, zone]: [string, any], i) => {
                        const colors = ['bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-orange-500', 'bg-red-500'];
                        return (
                            <div key={key} className="flex items-center gap-3">
                                <div className={`w-4 h-4 rounded ${colors[i]}`} />
                                <div className="flex-1">
                                    <div className="flex justify-between">
                                        <span className="text-white text-sm font-medium">{zone.name}</span>
                                        <span className="text-slate-400 text-sm font-mono">{zone.min}-{zone.max} bpm</span>
                                    </div>
                                    <div className="w-full h-2 bg-slate-800 rounded-full mt-1 overflow-hidden">
                                        <div
                                            className={`h-full ${colors[i]}`}
                                            style={{ width: `${((zone.max - zone.min) / (zones.maxHR - (zones.estimatedRestingHR || 50))) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <button onClick={loadZones} className="text-slate-400 text-xs hover:text-white">🔄 Skanna aktiviteter igen</button>
        </div>
    );
}

// ==========================================
// Activity Stats Section
// ==========================================

function formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

function formatPace(secPerKm: number): string {
    if (!secPerKm || !isFinite(secPerKm)) return '—';
    const m = Math.floor(secPerKm / 60);
    const s = Math.floor(secPerKm % 60);
    return `${m}:${s.toString().padStart(2, '0')}/km`;
}

function ActivityStatsSection() {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        profileService.getActivityStats().then(s => {
            setStats(s);
            setLoading(false);
        });
    }, []);

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
                        {Object.entries(stats.byType).map(([type, data]: [string, any]) => (
                            <div key={type} className="bg-slate-800/30 rounded-lg p-3 flex items-center gap-3">
                                <span className="text-2xl">
                                    {type === 'Run' ? '🏃' : type === 'Ride' ? '🚴' : type === 'Swim' ? '🏊' : type === 'Walk' ? '🚶' : '💪'}
                                </span>
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
            {stats.thisWeek.activities > 0 || stats.lastWeek.activities > 0 ? (
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
            ) : null}

            {/* Recent activities */}
            {stats.recentActivities?.length > 0 && (
                <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Senaste Aktiviteter</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {stats.recentActivities.slice(0, 5).map((act: any, i: number) => (
                            <div key={i} className="flex items-center justify-between bg-slate-800/30 rounded-lg p-2 px-3">
                                <div className="flex items-center gap-2">
                                    <span>{act.type === 'Run' ? '🏃' : act.type === 'Ride' ? '🚴' : '💪'}</span>
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

// ==========================================
// Notification Settings Section
// ==========================================

function NotificationSettingsSection() {
    const [settings, setSettings] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        profileService.getNotifications().then(s => {
            setSettings(s);
            setLoading(false);
        });
    }, []);

    const toggle = async (key: string) => {
        const newValue = !settings[key];
        setSettings({ ...settings, [key]: newValue });
        await profileService.updateNotifications({ [key]: newValue });
    };

    if (loading) return <div className="text-slate-500 text-center py-4">Laddar...</div>;
    if (!settings) return null;

    const options = [
        { key: 'emailDigest', label: 'Daglig Email-sammanfattning', icon: '📧' },
        { key: 'weeklyReport', label: 'Veckorapport via Email', icon: '📊' },
        { key: 'pushWorkouts', label: 'Push: Träningspåminnelser', icon: '💪' },
        { key: 'pushGoals', label: 'Push: Måluppdateringar', icon: '🎯' },
        { key: 'pushSocial', label: 'Push: Sociala notiser', icon: '👥' },
        { key: 'pushReminders', label: 'Push: Generella påminnelser', icon: '⏰' },
        { key: 'marketingEmails', label: 'Marknadsförings-email', icon: '📢' },
    ];

    return (
        <div className="space-y-2">
            {options.map(opt => (
                <div
                    key={opt.key}
                    className="flex items-center justify-between p-3 bg-slate-800/30 rounded-xl cursor-pointer hover:bg-slate-800/50 transition-all"
                    onClick={() => toggle(opt.key)}
                >
                    <div className="flex items-center gap-3">
                        <span className="text-lg">{opt.icon}</span>
                        <span className="text-white text-sm">{opt.label}</span>
                    </div>
                    <div className={`text-lg ${settings[opt.key] ? '' : 'grayscale opacity-40'}`}>
                        {settings[opt.key] ? '✅' : '⬜'}
                    </div>
                </div>
            ))}
        </div>
    );
}

// ==========================================
// Sessions Section
// ==========================================

function SessionsSection() {
    const [sessions, setSessions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadSessions();
    }, []);

    const loadSessions = async () => {
        setLoading(true);
        const s = await profileService.getSessions();
        setSessions(s);
        setLoading(false);
    };

    const revokeSession = async (token: string) => {
        if (confirm('Logga ut från denna session?')) {
            await profileService.revokeSession(token);
            await loadSessions();
        }
    };

    const revokeAll = async () => {
        if (confirm('Logga ut från alla andra sessioner?')) {
            await profileService.revokeAllOtherSessions();
            await loadSessions();
        }
    };

    if (loading) return <div className="text-slate-500 text-center py-4">Laddar...</div>;

    return (
        <div className="space-y-4">
            {sessions.length === 0 ? (
                <p className="text-slate-500 text-sm">Inga aktiva sessioner hittades.</p>
            ) : (
                <div className="space-y-2">
                    {sessions.map((s, i) => (
                        <div key={i} className={`flex items-center justify-between p-3 rounded-xl ${s.isCurrent ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-slate-800/30'}`}>
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">{s.isCurrent ? '📱' : '💻'}</span>
                                <div>
                                    <div className="text-white text-sm font-medium">
                                        {s.isCurrent && <span className="text-emerald-400 mr-2">(Denna enhet)</span>}
                                        {s.token}
                                    </div>
                                    <div className="text-slate-500 text-xs">
                                        Skapad: {s.createdAt ? new Date(s.createdAt).toLocaleString('sv-SE') : 'Okänd'}
                                    </div>
                                </div>
                            </div>
                            {!s.isCurrent && (
                                <button
                                    onClick={() => revokeSession(s.token)}
                                    className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-xs font-bold hover:bg-red-500/30"
                                >
                                    Logga ut
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {sessions.filter(s => !s.isCurrent).length > 0 && (
                <button
                    onClick={revokeAll}
                    className="w-full py-2 bg-red-500/10 text-red-400 rounded-lg text-sm font-bold hover:bg-red-500/20"
                >
                    🚪 Logga ut från alla andra sessioner
                </button>
            )}

            <div className="text-slate-500 text-xs text-center">
                {sessions.length} aktiv{sessions.length !== 1 ? 'a' : ''} session{sessions.length !== 1 ? 'er' : ''}
            </div>
        </div>
    );
}

// ==========================================
// Body Measurements Section (with timestamped data)
// ==========================================

function BodyMeasurementsSection({ targetWeight, height }: { targetWeight: number, height?: number }) {
    const [history, setHistory] = useState<{ weight: number, date: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newWeight, setNewWeight] = useState('');
    const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        const h = await profileService.getWeightHistory();
        setHistory(h);
        setLoading(false);
    };

    const addWeight = async () => {
        if (!newWeight) return;
        await profileService.logWeight(Number(newWeight), newDate);
        setNewWeight('');
        setShowAddForm(false);
        await loadData();
    };

    if (loading) return <div className="text-slate-500 text-center py-4">Laddar mätdata...</div>;

    const latestWeight = history.length > 0 ? history[history.length - 1] : null;
    const previousWeight = history.length > 1 ? history[history.length - 2] : null;

    // Calculate trend (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const recentEntries = history.filter(h => new Date(h.date) >= weekAgo);
    const weekTrend = recentEntries.length >= 2
        ? recentEntries[recentEntries.length - 1].weight - recentEntries[0].weight
        : null;

    // Calculate progress to goal
    const toGoal = latestWeight ? latestWeight.weight - targetWeight : null;

    return (
        <div className="space-y-4">
            {/* Latest Weight - Big Display */}
            {latestWeight ? (
                <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 rounded-2xl p-6 border border-emerald-500/20">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <div className="text-slate-400 text-xs uppercase font-bold mb-1">Senaste Vikt</div>
                            <div className="text-white text-5xl font-black">{latestWeight.weight} <span className="text-2xl text-slate-400">kg</span></div>
                        </div>
                        <div className="text-right">
                            <div className="text-slate-400 text-xs">Registrerad</div>
                            <div className="text-white font-bold text-lg">{formatSwedishDate(latestWeight.date)}</div>
                            <div className="text-slate-500 text-xs">{getRelativeTime(latestWeight.date)}</div>
                        </div>
                    </div>

                    {/* Change indicators */}
                    <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/10">
                        {previousWeight && (
                            <div className="text-center">
                                <div className="text-slate-500 text-xs uppercase">Sedan Förra</div>
                                <div className={`text-lg font-bold ${latestWeight.weight < previousWeight.weight ? 'text-emerald-400' : latestWeight.weight > previousWeight.weight ? 'text-red-400' : 'text-slate-400'}`}>
                                    {latestWeight.weight < previousWeight.weight ? '↓' : latestWeight.weight > previousWeight.weight ? '↑' : '→'}
                                    {Math.abs(latestWeight.weight - previousWeight.weight).toFixed(1)} kg
                                </div>
                            </div>
                        )}
                        {weekTrend !== null && (
                            <div className="text-center">
                                <div className="text-slate-500 text-xs uppercase">Senaste 7 Dagar</div>
                                <div className={`text-lg font-bold ${weekTrend < 0 ? 'text-emerald-400' : weekTrend > 0 ? 'text-red-400' : 'text-slate-400'}`}>
                                    {weekTrend < 0 ? '📉' : weekTrend > 0 ? '📈' : '➡️'} {weekTrend > 0 ? '+' : ''}{weekTrend.toFixed(1)} kg
                                </div>
                            </div>
                        )}
                        {toGoal !== null && (
                            <div className="text-center">
                                <div className="text-slate-500 text-xs uppercase">Till Målvikt</div>
                                <div className={`text-lg font-bold ${toGoal <= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                    {toGoal <= 0 ? '🎯 Uppnått!' : `${toGoal.toFixed(1)} kg kvar`}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="bg-slate-800/50 rounded-2xl p-8 text-center border border-dashed border-slate-600">
                    <div className="text-4xl mb-3">⚖️</div>
                    <div className="text-slate-400 mb-4">Ingen vikt registrerad ännu</div>
                    <button
                        onClick={() => setShowAddForm(true)}
                        className="px-6 py-3 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-all"
                    >
                        + Registrera din första vikt
                    </button>
                </div>
            )}

            {/* Add Weight Form */}
            {showAddForm && (
                <div className="bg-slate-800/70 rounded-xl p-4 border border-slate-700">
                    <h4 className="text-white font-bold mb-3">Ny Viktregistrering</h4>
                    <div className="flex gap-3">
                        <input
                            type="number"
                            step="0.1"
                            placeholder="Vikt (kg)"
                            value={newWeight}
                            onChange={e => setNewWeight(e.target.value)}
                            className="flex-1 bg-slate-900 rounded-lg p-3 text-white border border-white/10 focus:border-emerald-500 outline-none"
                            autoFocus
                        />
                        <input
                            type="date"
                            value={newDate}
                            onChange={e => setNewDate(e.target.value)}
                            className="bg-slate-900 rounded-lg p-3 text-white border border-white/10"
                        />
                        <button onClick={addWeight} className="px-5 py-3 bg-emerald-500 text-white rounded-lg font-bold hover:bg-emerald-600">Spara</button>
                        <button onClick={() => setShowAddForm(false)} className="px-5 py-3 bg-slate-700 text-slate-300 rounded-lg font-bold hover:bg-slate-600">Avbryt</button>
                    </div>
                </div>
            )}

            {/* Quick Add Button (when data exists) */}
            {latestWeight && !showAddForm && (
                <button
                    onClick={() => setShowAddForm(true)}
                    className="w-full py-3 bg-slate-800/50 text-slate-300 rounded-xl font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                >
                    <span>⚖️</span> Registrera ny vikt
                </button>
            )}

            {/* Other Measurements */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-800/50 rounded-xl p-4">
                    <div className="text-slate-500 text-xs uppercase font-bold">Längd</div>
                    <div className="text-white text-2xl font-black">{height || '—'} <span className="text-sm text-slate-400">cm</span></div>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4">
                    <div className="text-slate-500 text-xs uppercase font-bold">Målvikt</div>
                    <div className="text-amber-400 text-2xl font-black">{targetWeight} <span className="text-sm text-slate-400">kg</span></div>
                </div>
            </div>

            {/* Mini History (last 5 entries) */}
            {history.length > 0 && (
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-slate-500 text-xs uppercase font-bold">Senaste Registreringar</span>
                        <a href="#weight-history" className="text-emerald-400 text-xs hover:underline">Visa all historik →</a>
                    </div>
                    <div className="space-y-1">
                        {history.slice(-5).reverse().map((h, i) => (
                            <div key={h.date} className={`flex items-center justify-between p-2 rounded-lg ${i === 0 ? 'bg-emerald-500/10' : 'bg-slate-800/30'}`}>
                                <span className="text-slate-400 text-sm">{formatSwedishDate(h.date)}</span>
                                <span className={`font-bold ${i === 0 ? 'text-emerald-400' : 'text-white'}`}>{h.weight} kg</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function formatSwedishDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getRelativeTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Idag';
    if (diffDays === 1) return 'Igår';
    if (diffDays < 7) return `${diffDays} dagar sedan`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} veckor sedan`;
    return `${Math.floor(diffDays / 30)} månader sedan`;
}
