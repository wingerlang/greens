import React, { useState, useEffect, useRef } from 'react';
import { useSettings } from '../context/SettingsContext.tsx';
import { type MealType, MEAL_TYPE_LABELS } from '../models/types.ts';
import { useData } from '../context/DataContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { LoginStat } from '../api/db.ts';
import { StravaConnectionCard } from '../components/integrations/StravaConnectionCard.tsx';
import { ActivityInbox } from '../components/integrations/ActivityInbox.tsx';
import './ProfilePage.css';

const ALL_MEALS: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

// Mock function to check handle availability
async function checkHandleAvailable(handle: string): Promise<boolean> {
    const taken = ['admin', 'winger', 'test', 'greens', 'support'];
    await new Promise(r => setTimeout(r, 300));
    return !taken.includes(handle.toLowerCase());
}

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

    // Profile data state (would come from backend in production)
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
        weekStartsOn: 1, // Monday
    });

    const [editingField, setEditingField] = useState<string | null>(null);
    const [handleStatus, setHandleStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');

    const updateProfile = (field: string, value: any) => {
        setProfile(prev => ({ ...prev, [field]: value }));
        if (field === 'handle') {
            setHandleStatus('checking');
            checkHandleAvailable(value).then(available => {
                setHandleStatus(available ? 'available' : 'taken');
            });
        }
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
                                onBlur={() => setEditingField(null)}
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
                                onBlur={() => setEditingField(null)}
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
                            onBlur={() => setEditingField(null)}
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
                            <StatBadge value="🔥 127" label="streak" />
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
                    <div className="grid md:grid-cols-3 gap-4">
                        <DataField label="Längd" value={settings.height?.toString() || ''} type="number" suffix="cm" onChange={(v) => updateSettings({ height: Number(v) })} />
                        <DataField label="Nuvarande Vikt" value={profile.weight.toString()} type="number" suffix="kg" onChange={(v) => updateProfile('weight', Number(v))} />
                        <DataField label="Målvikt" value={profile.targetWeight.toString()} type="number" suffix="kg" onChange={(v) => updateProfile('targetWeight', Number(v))} />
                        <DataField label="Kroppsfett" value={profile.bodyFat.toString()} type="number" suffix="%" onChange={(v) => updateProfile('bodyFat', Number(v))} />
                        <div className="md:col-span-2 bg-slate-800/50 rounded-xl p-4 flex items-center justify-between">
                            <span className="text-slate-400 text-sm">Till mål:</span>
                            <span className={`text-2xl font-black ${profile.weight > profile.targetWeight ? 'text-amber-400' : 'text-emerald-400'}`}>
                                {profile.weight > profile.targetWeight ? '📉' : '🎯'} {Math.abs(profile.weight - profile.targetWeight)} kg
                            </span>
                        </div>
                    </div>
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

                    <h3 className="text-xs font-bold text-slate-500 uppercase mt-6 mb-3">🏆 Personal Records</h3>
                    <div className="grid md:grid-cols-4 gap-3">
                        <DataField label="5 km" value={profile.pr5k} onChange={(v) => updateProfile('pr5k', v)} placeholder="mm:ss" />
                        <DataField label="10 km" value={profile.pr10k} onChange={(v) => updateProfile('pr10k', v)} placeholder="mm:ss" />
                        <DataField label="Halvmarathon" value={profile.prHalfMarathon} onChange={(v) => updateProfile('prHalfMarathon', v)} placeholder="h:mm:ss" />
                        <DataField label="Marathon" value={profile.prMarathon} onChange={(v) => updateProfile('prMarathon', v)} placeholder="h:mm:ss" />
                    </div>
                </CollapsibleSection>

                <CollapsibleSection id="privacy" title="Integritet" icon="🔒">
                    <div className="grid md:grid-cols-2 gap-3">
                        <PrivacyToggle label="Publik Profil" desc="Syns i sök" active={currentUser?.privacy?.isPublic ?? true} onToggle={() => { }} />
                        <PrivacyToggle label="Tillåt Följare" active={currentUser?.privacy?.allowFollowers ?? true} onToggle={() => { }} />
                        <PrivacyToggle label="Visa Vikt" active={currentUser?.privacy?.showWeight ?? false} onToggle={() => { }} />
                        <PrivacyToggle label="Visa Ålder" active={currentUser?.privacy?.showAge ?? false} onToggle={() => { }} />
                        <PrivacyToggle label="Visa Kalorier" active={currentUser?.privacy?.showCalories ?? false} onToggle={() => { }} />
                        <PrivacyToggle label="Visa Träning" active={currentUser?.privacy?.showDetailedTraining ?? true} onToggle={() => { }} />
                        <PrivacyToggle label="Visa Sömn" active={currentUser?.privacy?.showSleep ?? false} onToggle={() => { }} />
                        <PrivacyToggle label="Visa PRs" active={true} onToggle={() => { }} />
                    </div>
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
