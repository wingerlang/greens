import { useState, useEffect } from 'react';
import { Trophy, Calendar, X, Target, Clock, Timer, Plus } from 'lucide-react';
import { PlannedActivity, ExerciseEntry, generateId } from '../../../models/types.ts';
import { normalizeRaceTitle, isTrailRace, getAvgElevation, formatRaceDateCompact, MONTH_MAP } from './utils.ts';
import { formatActivityDuration } from '../../../utils/formatters.ts';
import { calculateVDOT } from '../../../utils/runningCalculator.ts';
import { calculateAdjustedRaceTime } from '../../../utils/racePlannerCalculators.ts';

interface AddRaceModalProps {
    activityToEdit?: PlannedActivity | null;
    onClose: () => void;
    onSave: (activity: PlannedActivity) => void;
    races: ExerciseEntry[];
}

export function AddRaceModal({
    activityToEdit,
    onClose,
    onSave,
    races
}: AddRaceModalProps) {
    const [page, setPage] = useState<'basics' | 'details'>('basics');
    const [suggestedRace, setSuggestedRace] = useState<ExerciseEntry | null>(null);
    const [form, setForm] = useState({
        title: '',
        date: new Date().toISOString().split('T')[0],
        distance: '',
        startTime: '10:00',
        location: '',
        url: '',
        isRegistered: true,
        isVirtual: false,
        isTrail: false,
        elevationGain: '',
        goalA: '',
        goalB: '',
        goalC: '',
        description: '',
        type: 'RUN' as PlannedActivity['type'],
        subType: '' as string,
        placement: '',
        totalParticipants: ''
    });

    // Watch title for historic matches
    useEffect(() => {
        if (form.title.length > 3 && !activityToEdit) {
            const query = form.title.toLowerCase().replace(/\d{4}/g, '').trim();
            const match = races.find(r => {
                const title = r.title || r.notes || '';
                return title.toLowerCase().includes(query);
            });
            setSuggestedRace(match || null);
        } else {
            setSuggestedRace(null);
        }
    }, [form.title, races, activityToEdit]);

    // Populate form if editing
    useEffect(() => {
        if (activityToEdit) {
            const currentElev = activityToEdit.raceDetails?.elevationGain;
            let autoElev = '';
            
            // If elevation is missing but we have history, auto-fill it
            if (!currentElev && activityToEdit.title) {
                const avg = getAvgElevation(activityToEdit.title, activityToEdit.estimatedDistance, races);
                if (avg) autoElev = avg.toString();
            }

            setForm({
                title: activityToEdit.title,
                date: activityToEdit.date,
                distance: activityToEdit.estimatedDistance.toString(),
                startTime: activityToEdit.startTime || '10:00',
                location: activityToEdit.raceDetails?.logistics?.location || '',
                url: activityToEdit.raceUrl || '',
                isRegistered: activityToEdit.raceDetails?.isRegistered ?? true,
                isVirtual: activityToEdit.raceDetails?.isVirtual ?? false,
                isTrail: activityToEdit.raceDetails?.isTrail ?? false,
                elevationGain: currentElev?.toString() || autoElev || '',
                goalA: activityToEdit.raceDetails?.goals?.a || '',
                goalB: activityToEdit.raceDetails?.goals?.b || '',
                goalC: activityToEdit.raceDetails?.goals?.c || '',
                description: activityToEdit.description || '',
                type: activityToEdit.type || 'RUN',
                subType: activityToEdit.subType || '',
                placement: activityToEdit.raceDetails?.placement?.toString() || '',
                totalParticipants: activityToEdit.raceDetails?.totalParticipants?.toString() || ''
            });
        }
    }, [activityToEdit, races]);

    // Close on ESC
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const handleSubmit = () => {
        if (!form.title || !form.date) return;

        const parseDuration = (s: string) => {
            const match = s.match(/(\d{1,2}):(\d{2})/);
            if (!match) return 0;
            const parts = s.split(':').map(p => parseInt(p.replace(/\D/g, '')));
            if (parts.length === 3) return parts[0] * 60 + parts[1];
            if (parts.length === 2) {
                const dist = parseFloat(form.distance);
                if (dist > 10 && parts[0] < 5) return parts[0] * 60 + parts[1]; 
                return parts[0] + parts[1] / 60;
            }
            return 0;
        };

        let durationMins = parseDuration(form.goalB) || parseDuration(form.goalA) || parseDuration(form.goalC);
        if (!durationMins && form.distance) {
            durationMins = parseFloat(form.distance) * 5.5;
        }

        const newActivity: PlannedActivity = {
            id: activityToEdit?.id || generateId(),
            title: form.title,
            date: form.date,
            startTime: form.startTime,
            type: form.type,
            category: form.type === 'RUN' ? 'RACE' : form.type === 'STRENGTH' ? 'STRENGTH' : 'CARDIO',
            subType: form.subType as any || undefined,
            isRace: form.type === 'RUN',
            raceUrl: form.url,
            description: form.description,
            estimatedDistance: parseFloat(form.distance) || 0,
            durationMinutes: durationMins || undefined,
            status: 'PLANNED',
            structure: { warmupKm: 0, mainSet: [], cooldownKm: 0 },
            targetPace: '',
            targetHrZone: 0,
            raceDetails: {
                isRegistered: form.isRegistered,
                isVirtual: form.isVirtual,
                isTrail: form.isTrail,
                elevationGain: parseFloat(form.elevationGain) || 0,
                goals: {
                    a: form.goalA,
                    b: form.goalB,
                    c: form.goalC
                },
                logistics: {
                    location: form.location
                },
                placement: parseInt(form.placement) || undefined,
                totalParticipants: parseInt(form.totalParticipants) || undefined,
                checklist: activityToEdit?.raceDetails?.checklist || [
                    { id: '1', item: 'Anmäld & Betald', checked: false, category: 'logistics' },
                    { id: '2', item: 'Boende bokat', checked: false, category: 'logistics' },
                    { id: '3', item: 'Transport planerad', checked: false, category: 'logistics' },
                    { id: '4', item: 'Energiplan spikad', checked: false, category: 'nutrition' },
                ]
            }
        };

        onSave(newActivity);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-slate-950">
                    <h3 className="text-xl font-black text-white flex items-center gap-2">
                        {form.type === 'RUN' ? <Trophy className="text-amber-500" /> : <Calendar className="text-indigo-500" />}
                        {activityToEdit ? 'Redigera' : 'Planera'} {form.type === 'RUN' ? 'Tävling' : 'Aktivitet'}
                    </h3>
                    <button onClick={onClose} className="rounded-full p-1 hover:bg-white/10 transition-colors">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                    {page === 'basics' ? (
                        <div className="space-y-4 animate-in slide-in-from-left-4 duration-300">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Loppets Namn</label>
                                <input
                                    type="text"
                                    value={form.title}
                                    onChange={e => setForm({ ...form, title: e.target.value })}
                                    className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-white focus:border-amber-500 outline-none font-bold"
                                    placeholder="t.ex. Göteborgsvarvet 2026"
                                    autoFocus
                                />
                                {suggestedRace && (
                                    <div className="mt-2 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex justify-between items-center animate-in slide-in-from-top-2">
                                        <div>
                                            <div className="text-xs font-bold text-amber-500">Du har sprungit detta förut!</div>
                                            <div className="text-[10px] text-amber-400/80">
                                                Senast: {suggestedRace.date} • {suggestedRace.distance?.toFixed(1) || '?'} km • {formatActivityDuration(suggestedRace.durationMinutes)}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                const dist = parseFloat(form.distance) || suggestedRace.distance || 0;
                                                const avgElev = getAvgElevation(form.title, dist, races);

                                                setForm(prev => ({
                                                    ...prev,
                                                    distance: suggestedRace.distance?.toString() || prev.distance,
                                                    location: suggestedRace.location || prev.location,
                                                    isVirtual: (suggestedRace.tags || []).includes('virtual'),
                                                    isTrail: (suggestedRace.tags || []).includes('trail') || isTrailRace(suggestedRace.title || ''),
                                                    elevationGain: avgElev?.toString() || prev.elevationGain || suggestedRace.elevationGain?.toString() || suggestedRace.raceDetails?.elevationGain?.toString() || ''
                                                }));
                                                setSuggestedRace(null);
                                            }}
                                            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-900 text-[10px] font-black uppercase rounded-md transition-colors shadow-sm"
                                        >
                                            Auto-ifyll
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { id: 'RUN', label: 'Löpning', icon: '🏃' },
                                    { id: 'STRENGTH', label: 'Styrka', icon: '🏋️' },
                                    { id: 'CARDIO', label: 'Cardio', icon: '🚴' }
                                ].map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => setForm({ ...form, type: t.id as any, subType: '' })}
                                        className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${form.type === t.id ? 'bg-amber-500/20 border-amber-500 text-white' : 'bg-slate-800/50 border-white/5 text-slate-400 hover:border-white/10'}`}
                                    >
                                        <span className="text-xl">{t.icon}</span>
                                        <span className="text-[10px] font-bold uppercase">{t.label}</span>
                                    </button>
                                ))}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Datum</label>
                                    <input
                                        type="date"
                                        value={form.date}
                                        onChange={e => setForm({ ...form, date: e.target.value })}
                                        className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-white focus:border-amber-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Starttid</label>
                                    <input
                                        type="time"
                                        value={form.startTime}
                                        onChange={e => setForm({ ...form, startTime: e.target.value })}
                                        className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-white focus:border-amber-500 outline-none"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Distans (km)</label>
                                    <input
                                        type="number"
                                        value={form.distance}
                                        onChange={e => setForm({ ...form, distance: e.target.value })}
                                        className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-white focus:border-amber-500 outline-none"
                                        placeholder="21.1"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ort / Plats</label>
                                    <input
                                        type="text"
                                        value={form.location}
                                        onChange={e => setForm({ ...form, location: e.target.value })}
                                        disabled={form.isVirtual}
                                        className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-white focus:border-amber-500 outline-none disabled:opacity-50"
                                        placeholder={form.isVirtual ? "Virtuellt" : "Göteborg"}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Höjdmeter (m)</label>
                                    <input
                                        type="number"
                                        value={form.elevationGain}
                                        onChange={e => setForm({ ...form, elevationGain: e.target.value })}
                                        className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-white focus:border-amber-500 outline-none"
                                        placeholder="t.ex. 250"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Länk till loppet</label>
                                    <input
                                        type="url"
                                        value={form.url}
                                        onChange={e => setForm({ ...form, url: e.target.value })}
                                        className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-white focus:border-amber-500 outline-none text-sm"
                                        placeholder="https://..."
                                    />
                                </div>
                            </div>

                            <div className="flex gap-6 pt-2">
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={form.isTrail}
                                        onChange={e => setForm({ ...form, isTrail: e.target.checked })}
                                        className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500/50"
                                    />
                                    <span className="text-sm text-slate-300 font-bold group-hover:text-emerald-400 transition-colors">Trail-lopp</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={form.isVirtual}
                                        onChange={e => {
                                            setForm({ ...form, isVirtual: e.target.checked, location: e.target.checked ? '' : form.location });
                                        }}
                                        className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-purple-500 focus:ring-purple-500/50"
                                    />
                                    <span className="text-sm text-slate-300 font-bold group-hover:text-purple-400 transition-colors">Virtuellt Lopp</span>
                                </label>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                            <div className="bg-slate-800/50 p-4 rounded-xl border border-white/5 flex items-center justify-between">
                                <div>
                                    <h4 className="text-sm font-bold text-white">Anmäld till loppet</h4>
                                    <p className="text-xs text-slate-400">Markera om du är formellt anmäld och har en startplats.</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={form.isRegistered}
                                        onChange={e => setForm({ ...form, isRegistered: e.target.checked })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                                </label>
                            </div>

                            <div className="flex justify-between items-end border-b border-white/10 pb-2">
                                <h4 className="text-sm font-bold text-white">Målsättningar</h4>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={() => {
                                            const dist = parseFloat(form.distance);
                                            if (isNaN(dist) || dist <= 0) return alert("Du måste ange distans.");
                                            const normTitle = normalizeRaceTitle(form.title);
                                            const matches = races.filter(r => normalizeRaceTitle(r.title || r.notes || '') === normTitle || (r.distance && Math.abs(r.distance - dist) / dist < 0.1));
                                            if (matches.length === 0) return alert("Ingen historik hittades.");
                                            matches.sort((a, b) => a.durationMinutes - b.durationMinutes);
                                            const pb = matches[0];
                                            setForm(prev => ({
                                                ...prev,
                                                goalB: `${formatActivityDuration(pb.durationMinutes)} (Historik ${pb.date.substring(0,4)})`,
                                                goalC: 'Gå i mål'
                                            }));
                                        }}
                                        className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-1 rounded font-black uppercase tracking-wider border border-blue-500/30 flex items-center gap-1"
                                    >
                                        <Trophy size={10} /> Från historik
                                    </button>
                                    <button
                                        onClick={() => {
                                            const dist = parseFloat(form.distance);
                                            if (isNaN(dist) || dist <= 0) return alert("Ange distans.");
                                            const recentRuns = races.filter(r => r.distance && r.distance >= 5 && r.durationMinutes > 0);
                                            if (recentRuns.length === 0) return alert("Behöver fler pass.");
                                            const currentVdot = recentRuns.map(r => calculateVDOT(r.distance!, r.durationMinutes * 60)).sort((a,b) => b-a)[0];
                                            const estimatedSecs = calculateAdjustedRaceTime(dist, parseFloat(form.elevationGain)||0, form.isTrail, currentVdot);
                                            setForm(prev => ({
                                                ...prev,
                                                goalB: `${formatActivityDuration(estimatedSecs / 60)} (Form-est)`,
                                                goalA: `${formatActivityDuration((estimatedSecs * 0.97) / 60)} (Drömmål)`
                                            }));
                                        }}
                                        className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded font-black uppercase tracking-wider border border-emerald-500/30 flex items-center gap-1"
                                    >
                                        <Target size={10} /> Form-estimerat
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">
                                    <label className="block text-[10px] font-black text-emerald-400 uppercase mb-1">Mål A (Dröm)</label>
                                    <input type="text" value={form.goalA} onChange={e => setForm({...form, goalA: e.target.value})} className="w-full bg-slate-900/50 border border-white/5 rounded-lg p-2 text-white focus:border-emerald-500 outline-none text-sm" placeholder="Sub 1:45" />
                                </div>
                                <div className="bg-blue-500/10 p-3 rounded-xl border border-blue-500/20">
                                    <label className="block text-[10px] font-black text-blue-400 uppercase mb-1">Mål B (Real)</label>
                                    <input type="text" value={form.goalB} onChange={e => setForm({...form, goalB: e.target.value})} className="w-full bg-slate-900/50 border border-white/5 rounded-lg p-2 text-white focus:border-blue-500 outline-none text-sm" placeholder="Sub 1:50" />
                                </div>
                                <div className="bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
                                    <label className="block text-[10px] font-black text-amber-500 uppercase mb-1">Mål C (Safe)</label>
                                    <input type="text" value={form.goalC} onChange={e => setForm({...form, goalC: e.target.value})} className="w-full bg-slate-900/50 border border-white/5 rounded-lg p-2 text-white focus:border-amber-500 outline-none text-sm" placeholder="Gå i mål" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/10">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">🏁 Din Placering</label>
                                    <input type="number" value={form.placement} onChange={e => setForm({...form, placement: e.target.value})} className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-white outline-none" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Deltagare</label>
                                    <input type="number" value={form.totalParticipants} onChange={e => setForm({...form, totalParticipants: e.target.value})} className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-white outline-none" />
                                </div>
                            </div>

                            {/* Historic Matches Preview */}
                            {(() => {
                                const dist = parseFloat(form.distance);
                                if (!dist) return null;
                                const normTitle = normalizeRaceTitle(form.title);
                                const matches = races.filter(r => normalizeRaceTitle(r.title || r.notes || '') === normTitle).sort((a,b) => b.date.localeCompare(a.date));
                                if (matches.length === 0) return null;
                                return (
                                    <div className="p-3 bg-amber-500/5 rounded-xl border border-amber-500/10 space-y-2">
                                        <h5 className="text-[9px] font-black uppercase text-amber-500 flex items-center gap-1"><Timer size={10} /> Tidigare resultat</h5>
                                        {matches.slice(0,3).map(m => (
                                            <div key={m.id} className="flex justify-between text-[11px]">
                                                <span className="text-slate-400 font-bold">{m.date.split('-')[0]} - {formatActivityDuration(m.durationMinutes)}</span>
                                                {m.raceDetails?.placement && <span className="text-amber-500 font-black">#{m.raceDetails.placement}</span>}
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}

                            <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-white outline-none h-20 resize-none text-sm" placeholder="Anteckningar..." />
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-white/10 bg-slate-950 flex gap-3">
                    <button onClick={page === 'details' ? () => setPage('basics') : onClose} className="px-6 py-3 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition-colors">
                        {page === 'details' ? '← Tillbaka' : 'Avbryt'}
                    </button>
                    {page === 'basics' ? (
                        <button onClick={() => setPage('details')} className="flex-1 px-6 py-3 rounded-xl bg-slate-800 text-white font-bold hover:bg-slate-700 transition-colors border border-white/10">Nästa →</button>
                    ) : (
                        <button onClick={handleSubmit} disabled={!form.title} className="flex-1 px-6 py-3 rounded-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition-colors disabled:opacity-50">Spara</button>
                    )}
                </div>
            </div>
        </div>
    );
}

// Minimalist BulkAddRaceModal (as requested - building it back but compact)
export function BulkAddRaceModal({ onClose, onSaveAll }: { onClose: () => void, onSaveAll: (activities: PlannedActivity[]) => void }) {
    const [step, setStep] = useState<'input' | 'edit'>('input');
    const [rawText, setRawText] = useState('');
    const [parsedRaces, setParsedRaces] = useState<any[]>([]);

    const handleParse = () => {
        const lines = rawText.split('\n').filter(l => l.trim() !== '');
        const currentYear = new Date().getFullYear();
        const races = lines.map(line => {
            const match = line.trim().match(/^(\d{1,2})\s+([a-zA-ZåäöÅÄÖ]+)\s+(.+)$/);
            return {
                id: generateId(),
                date: match ? `${currentYear}-${(MONTH_MAP[match[2].toLowerCase()] || '01')}-${match[1].padStart(2, '0')}` : `${currentYear}-01-01`,
                title: match ? match[3] : line.trim(),
                distance: '', location: '', url: '', isRegistered: false
            };
        });
        setParsedRaces(races); setStep('edit');
    };

    const handleSave = () => {
        onSaveAll(parsedRaces.map(pr => ({
            id: pr.id, title: pr.title, date: pr.date, startTime: '10:00', type: 'RUN', category: 'RACE', isRace: true, raceUrl: pr.url,
            description: '', estimatedDistance: parseFloat(pr.distance) || 0, status: 'PLANNED', structure: { warmupKm: 0, mainSet: [], cooldownKm: 0 },
            targetPace: '', targetHrZone: 0, raceDetails: { logistics: { location: pr.location }, checklist: [] }
        })));
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-slate-950 rounded-t-3xl">
                    <h3 className="text-xl font-black text-white flex items-center gap-2"><Trophy className="text-amber-500" /> Bulk-skapa</h3>
                    <button onClick={onClose}><X size={20} className="text-slate-400" /></button>
                </div>
                <div className="p-6 overflow-y-auto flex-1">
                    {step === 'input' ? (
                        <textarea value={rawText} onChange={e => setRawText(e.target.value)} className="w-full bg-slate-800 border border-white/10 rounded-xl p-4 text-white outline-none h-64 font-mono text-sm resize-none" placeholder="29 mars Genarps Trail..." />
                    ) : (
                        <div className="overflow-x-auto"><table className="w-full text-left text-sm whitespace-nowrap min-w-max">
                            <thead className="bg-slate-950 text-xs uppercase text-slate-500 border-b border-white/5"><tr><th className="px-4 py-3">Datum</th><th className="px-4 py-3">Namn</th><th className="px-4 py-3">Distans</th><th className="px-4 py-3">Plats</th></tr></thead>
                            <tbody className="divide-y divide-white/5">{parsedRaces.map(r => (
                                <tr key={r.id} className="hover:bg-white/5 border-white/5"><td className="px-4 py-3 font-mono">{r.date}</td><td className="px-4 py-3 font-bold">{r.title}</td><td className="px-4"><input value={r.distance} onChange={e => setParsedRaces(prev => prev.map(pr => pr.id === r.id ? {...pr, distance: e.target.value} : pr))} className="bg-slate-800 rounded px-1 w-16" /></td><td className="px-4"><input value={r.location} onChange={e => setParsedRaces(prev => prev.map(pr => pr.id === r.id ? {...pr, location: e.target.value} : pr))} className="bg-slate-800 rounded px-1 w-32" /></td></tr>
                            ))}</tbody>
                        </table></div>
                    )}
                </div>
                <div className="p-6 border-t border-white/10 bg-slate-950 rounded-b-3xl flex gap-3">
                    <button onClick={step === 'edit' ? () => setStep('input') : onClose} className="px-6 py-3 rounded-xl bg-slate-800 text-slate-300 font-bold">Avbryt</button>
                    <button onClick={step === 'input' ? handleParse : handleSave} className="flex-1 px-6 py-3 rounded-xl bg-amber-500 text-slate-950 font-bold">Spara</button>
                </div>
            </div>
        </div>
    );
}


