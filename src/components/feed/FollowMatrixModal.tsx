import React, { useState, useEffect } from 'react';
import {
    X,
    Check,
    Bell,
    BellOff,
    Settings2,
    Dumbbell,
    Utensils,
    Moon,
    Scale,
    Users,
    ChevronRight,
    Lock
} from 'lucide-react';
import type { FeedEventCategory, FollowPreference } from '../../models/feedTypes.ts';

interface FollowMatrixModalProps {
    isOpen: boolean;
    onClose: () => void;
    targetUserId: string;
    targetUserName: string;
}

const CATEGORIES: { id: FeedEventCategory; label: string; icon: React.ReactNode; color: string }[] = [
    { id: 'TRAINING', label: 'Träning', icon: <Dumbbell size={18} />, color: 'bg-emerald-500' },
    { id: 'NUTRITION', label: 'Kost & Recept', icon: <Utensils size={18} />, color: 'bg-amber-500' },
    { id: 'HEALTH', label: 'Hälsa & Mått', icon: <Moon size={18} />, color: 'bg-indigo-500' },
    { id: 'SOCIAL', label: 'Social Aktivitet', icon: <Users size={18} />, color: 'bg-pink-500' },
];

export function FollowMatrixModal({ isOpen, onClose, targetUserId, targetUserName }: FollowMatrixModalProps) {
    const [preference, setPreference] = useState<Partial<FollowPreference>>({
        targetUserId,
        subscribedCategories: ['TRAINING'],
        detailLevel: 'full',
        notificationsEnabled: false,
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchPreference();
        }
    }, [isOpen, targetUserId]);

    const fetchPreference = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('auth_token');
            const res = await fetch(`/api/feed/preferences/${targetUserId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                if (data.preference) {
                    setPreference(data.preference);
                }
            }
        } catch (err) {
            console.error('Failed to fetch preference:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const token = localStorage.getItem('auth_token');
            const res = await fetch(`/api/feed/preferences/${targetUserId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(preference)
            });
            if (res.ok) {
                onClose();
            }
        } catch (err) {
            console.error('Failed to save preference:', err);
        } finally {
            setSaving(false);
        }
    };

    const toggleCategory = (cat: FeedEventCategory) => {
        setPreference((prev: Partial<FollowPreference>) => {
            const current = prev.subscribedCategories || [];
            if (current.includes(cat)) {
                return { ...prev, subscribedCategories: current.filter((c: FeedEventCategory) => c !== cat) };
            } else {
                return { ...prev, subscribedCategories: [...current, cat] };
            }
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-lg bg-slate-900 border-t sm:border border-white/10 rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden transition-all duration-300 transform animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-10">

                {/* Header */}
                <div className="p-6 pb-2 flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <h2 className="text-xl font-black text-white">The Follow Matrix</h2>
                            <div className="px-2 py-0.5 rounded-full bg-slate-800 border border-white/5 text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                <Lock size={10} /> PRIVACY
                            </div>
                        </div>
                        <p className="text-sm text-slate-400 font-medium">
                            Välj vad du vill se från <span className="text-emerald-400">@{targetUserName}</span>
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="py-20 flex justify-center">
                            <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Category Grid */}
                            <div className="grid grid-cols-1 gap-3">
                                {CATEGORIES.map(cat => (
                                    <button
                                        key={cat.id}
                                        onClick={() => toggleCategory(cat.id)}
                                        className={`
                                            flex items-center justify-between p-4 rounded-2xl border transition-all duration-200 group
                                            ${preference.subscribedCategories?.includes(cat.id)
                                                ? 'bg-white border-white'
                                                : 'bg-slate-950 border-white/5 hover:border-white/20'}
                                        `}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`
                                                w-10 h-10 rounded-xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110
                                                ${preference.subscribedCategories?.includes(cat.id)
                                                    ? 'bg-slate-900 text-white'
                                                    : `${cat.color} text-white shadow-${cat.color.split('-')[1]}-500/20`}
                                            `}>
                                                {cat.icon}
                                            </div>
                                            <div className="text-left">
                                                <div className={`font-bold ${preference.subscribedCategories?.includes(cat.id) ? 'text-slate-900' : 'text-white'}`}>
                                                    {cat.label}
                                                </div>
                                                <div className={`text-[10px] font-bold uppercase ${preference.subscribedCategories?.includes(cat.id) ? 'text-slate-500' : 'text-slate-600'}`}>
                                                    Prenumerera på uppdateringar
                                                </div>
                                            </div>
                                        </div>
                                        <div className={`
                                            w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all
                                            ${preference.subscribedCategories?.includes(cat.id)
                                                ? 'bg-emerald-500 border-emerald-500 text-white'
                                                : 'border-white/10 text-transparent'}
                                        `}>
                                            <Check size={14} />
                                        </div>
                                    </button>
                                ))}
                            </div>

                            {/* Additional Settings */}
                            <div className="space-y-3 pt-4 border-t border-white/5">
                                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest px-1">Inställningar</h3>

                                {/* Detail Level */}
                                <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-950 border border-white/5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                                            <Settings2 size={16} />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-white">Detaljnivå</div>
                                            <div className="text-[10px] text-slate-500 font-bold uppercase">Hur mycket info visas?</div>
                                        </div>
                                    </div>
                                    <select
                                        value={preference.detailLevel}
                                        onChange={(e) => setPreference({ ...preference, detailLevel: e.target.value as any })}
                                        className="bg-slate-900 text-xs font-bold px-3 py-1.5 rounded-lg border border-white/10 outline-none"
                                    >
                                        <option value="highlights">Höjdpunkter</option>
                                        <option value="full">Allt</option>
                                    </select>
                                </div>

                                {/* Notifications */}
                                <button
                                    onClick={() => setPreference({ ...preference, notificationsEnabled: !preference.notificationsEnabled })}
                                    className="w-full flex items-center justify-between p-4 rounded-2xl bg-slate-950 border border-white/5 hover:border-white/20 transition-all"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${preference.notificationsEnabled ? 'bg-amber-500/10 text-amber-500' : 'bg-slate-800 text-slate-500'}`}>
                                            {preference.notificationsEnabled ? <Bell size={16} /> : <BellOff size={16} />}
                                        </div>
                                        <div className="text-left">
                                            <div className="text-sm font-bold text-white">Push-notiser</div>
                                            <div className="text-[10px] text-slate-500 font-bold uppercase">Avisera när något händer</div>
                                        </div>
                                    </div>
                                    <div className={`w-10 h-5 rounded-full p-1 transition-colors ${preference.notificationsEnabled ? 'bg-emerald-500' : 'bg-slate-800'}`}>
                                        <div className={`w-3 h-3 bg-white rounded-full transition-transform ${preference.notificationsEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                                    </div>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 bg-slate-950 border-t border-white/5 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-4 px-6 rounded-2xl bg-slate-900 border border-white/5 text-sm font-black text-slate-400 hover:text-white transition-all"
                    >
                        AVBRYT
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-[2] py-4 px-6 rounded-2xl bg-emerald-500 text-sm font-black text-black hover:bg-emerald-400 transition-all shadow-xl shadow-emerald-500/20 disabled:opacity-50"
                    >
                        {saving ? 'SPARAR...' : 'SPARA MATRIX'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default FollowMatrixModal;
