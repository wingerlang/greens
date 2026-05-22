async function main() {
    const path = "c:/repos/greens/src/components/training/races/RaceModals.tsx";
    let content = await Deno.readTextFile(path);

    // Update imports
    content = content.replace(
        "import { Trophy, Calendar, X, Target, Clock, Timer, Plus } from 'lucide-react';",
        "import { Trophy, Calendar, X, Target, Clock, Timer, Plus, MapPin, Navigation, Mountain, Link as LinkIcon, AlignLeft, Users, Medal, Activity, CheckSquare, Settings2, Info, History } from 'lucide-react';"
    );

    const startIdx = content.indexOf("export function AddRaceModal({");
    const endIdxStr = "export function BulkAddRaceModal";
    const endIdx = content.indexOf(endIdxStr);

    if (startIdx === -1 || endIdx === -1) {
        console.error("Could not find AddRaceModal bounds.");
        return;
    }

    const newComponent = `export function AddRaceModal({
    activityToEdit,
    onClose,
    onSave,
    races
}: AddRaceModalProps) {
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
            const query = form.title.toLowerCase().replace(/\\d{4}/g, '').trim();
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
            const match = s.match(/(\\d{1,2}):(\\d{2})/);
            if (!match) return 0;
            const parts = s.split(':').map(p => parseInt(p.replace(/\\D/g, '')));
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
                placement: (function() {
                    const val = form.placement.trim();
                    if (val.includes('/')) {
                        const parts = val.split('/');
                        return parseInt(parts[0]) || undefined;
                    }
                    return parseInt(val) || undefined;
                })(),
                totalParticipants: (function() {
                    const val = form.placement.trim();
                    if (val.includes('/')) {
                        const parts = val.split('/');
                        return parseInt(parts[1]) || parseInt(form.totalParticipants) || undefined;
                    }
                    return parseInt(form.totalParticipants) || undefined;
                })(),
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-white/10 rounded-[2rem] w-full max-w-3xl shadow-2xl flex flex-col max-h-full overflow-hidden relative">
                
                {/* Header */}
                <div className="p-6 sm:px-10 sm:py-8 border-b border-white/5 flex justify-between items-center bg-slate-900/50 relative z-10 backdrop-blur-xl">
                    <div className="flex-1">
                        <h3 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-3">
                            {form.type === 'RUN' ? <Trophy className="text-amber-500" size={32} /> : <Activity className="text-indigo-500" size={32} />}
                            {activityToEdit ? 'Redigera' : 'Planera'} {form.type === 'RUN' ? 'Tävling' : 'Aktivitet'}
                        </h3>
                        <p className="text-slate-400 text-sm font-medium mt-1">Fyll i detaljerna för att förbereda dig på bästa sätt.</p>
                    </div>
                    <button onClick={onClose} className="rounded-full p-2 bg-slate-800 hover:bg-slate-700 hover:text-white transition-colors text-slate-400 shrink-0">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 sm:p-10 overflow-y-auto custom-scrollbar flex-1 space-y-10 relative">
                    
                    {/* HUVUDINFO */}
                    <div className="space-y-4">
                        <input
                            type="text"
                            value={form.title}
                            onChange={e => setForm({ ...form, title: e.target.value })}
                            className="w-full bg-transparent border-b-2 border-white/10 hover:border-white/30 focus:border-amber-500 outline-none pb-2 text-3xl sm:text-4xl font-black text-white transition-colors placeholder:text-slate-700"
                            placeholder="Tävlingens Namn..."
                            autoFocus
                        />
                        {suggestedRace && (
                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-in slide-in-from-top-2">
                                <div>
                                    <div className="text-xs font-black text-amber-500 uppercase tracking-widest flex items-center gap-1.5"><History size={12}/> Du har sprungit detta förut!</div>
                                    <div className="text-xs font-bold text-amber-400/80 mt-1">
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
                                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 text-xs font-black uppercase tracking-widest rounded-lg transition-colors shadow-sm shrink-0"
                                >
                                    Auto-ifyll
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* KATEGORI */}
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Activity size={12}/> Kategori</label>
                            <div className="flex gap-2">
                                {[
                                    { id: 'RUN', label: 'Löpning', icon: '🏃' },
                                    { id: 'STRENGTH', label: 'Styrka', icon: '🏋️' },
                                    { id: 'CARDIO', label: 'Cardio', icon: '🚴' }
                                ].map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => setForm({ ...form, type: t.id as any, subType: '' })}
                                        className={\`flex-1 flex flex-col items-center justify-center py-4 px-2 rounded-2xl border transition-all \${form.type === t.id ? 'bg-amber-500/10 border-amber-500/50 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.1)]' : 'bg-slate-950/50 border-white/5 text-slate-500 hover:bg-slate-800'}\`}
                                    >
                                        <span className="text-2xl mb-1">{t.icon}</span>
                                        <span className="text-[10px] font-black uppercase tracking-wider">{t.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* STATUS */}
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Settings2 size={12}/> Status & Typ</label>
                            <div className="bg-slate-950/50 border border-white/5 rounded-2xl p-2 space-y-1">
                                <label className="flex justify-between items-center p-2.5 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer group">
                                    <span className="text-sm font-bold text-slate-300 group-hover:text-white flex items-center gap-2"><CheckSquare size={14} className="text-blue-500"/> Formellt anmäld</span>
                                    <input type="checkbox" checked={form.isRegistered} onChange={e => setForm({ ...form, isRegistered: e.target.checked })} className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500/50" />
                                </label>
                                <label className="flex justify-between items-center p-2.5 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer group">
                                    <span className="text-sm font-bold text-slate-300 group-hover:text-emerald-400 flex items-center gap-2"><Mountain size={14} className="text-emerald-500"/> Trail-lopp</span>
                                    <input type="checkbox" checked={form.isTrail} onChange={e => setForm({ ...form, isTrail: e.target.checked })} className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500/50" />
                                </label>
                                <label className="flex justify-between items-center p-2.5 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer group">
                                    <span className="text-sm font-bold text-slate-300 group-hover:text-purple-400 flex items-center gap-2"><MapPin size={14} className="text-purple-500"/> Virtuellt Lopp</span>
                                    <input type="checkbox" checked={form.isVirtual} onChange={e => setForm({ ...form, isVirtual: e.target.checked, location: e.target.checked ? '' : form.location })} className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-purple-500 focus:ring-purple-500/50" />
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* TID & PLATS */}
                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Calendar size={12}/> Tid & Plats</label>
                            
                            <div className="flex gap-3">
                                <div className="relative flex-1">
                                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none"><Calendar size={16} className="text-slate-500" /></div>
                                    <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="w-full bg-slate-950/50 border border-white/5 hover:border-white/10 rounded-xl py-4 pl-12 pr-4 text-white focus:border-amber-500 outline-none text-sm font-mono transition-colors" />
                                </div>
                                <div className="relative w-36">
                                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none"><Clock size={16} className="text-slate-500" /></div>
                                    <input type="time" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} className="w-full bg-slate-950/50 border border-white/5 hover:border-white/10 rounded-xl py-4 pl-12 pr-4 text-white focus:border-amber-500 outline-none text-sm font-mono transition-colors" />
                                </div>
                            </div>
                            
                            <div className="relative">
                                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none"><MapPin size={16} className="text-slate-500" /></div>
                                <input type="text" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} disabled={form.isVirtual} className="w-full bg-slate-950/50 border border-white/5 hover:border-white/10 rounded-xl py-4 pl-12 pr-4 text-white focus:border-amber-500 outline-none text-sm disabled:opacity-50 transition-colors font-bold" placeholder={form.isVirtual ? "Virtuellt" : "Startplats / Stad"} />
                            </div>

                            <div className="relative">
                                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none"><LinkIcon size={16} className="text-slate-500" /></div>
                                <input type="url" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} className="w-full bg-slate-950/50 border border-white/5 hover:border-white/10 rounded-xl py-4 pl-12 pr-4 text-white focus:border-amber-500 outline-none text-sm transition-colors font-mono" placeholder="https://loppets-hemsida.se" />
                            </div>
                        </div>

                        {/* DISTANS & PROFIL */}
                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Navigation size={12}/> Distans & Profil</label>
                            
                            <div className="relative">
                                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none"><Navigation size={16} className="text-slate-500" /></div>
                                <input type="number" value={form.distance} onChange={e => setForm({ ...form, distance: e.target.value })} className="w-full bg-slate-950/50 border border-white/5 hover:border-white/10 rounded-xl py-4 pl-12 pr-12 text-white focus:border-amber-500 outline-none text-xl font-black font-mono transition-colors" placeholder="21.1" />
                                <div className="absolute inset-y-0 right-5 flex items-center pointer-events-none text-slate-500 font-bold uppercase text-[10px] tracking-widest">km</div>
                            </div>

                            <div className="relative">
                                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none"><Mountain size={16} className="text-slate-500" /></div>
                                <input type="number" value={form.elevationGain} onChange={e => setForm({ ...form, elevationGain: e.target.value })} className="w-full bg-slate-950/50 border border-white/5 hover:border-white/10 rounded-xl py-4 pl-12 pr-12 text-white focus:border-amber-500 outline-none text-xl font-black font-mono transition-colors" placeholder="250" />
                                <div className="absolute inset-y-0 right-5 flex items-center pointer-events-none text-slate-500 font-bold uppercase text-[10px] tracking-widest">m</div>
                            </div>
                        </div>
                    </div>

                    <hr className="border-white/5" />

                    {/* MÅLSÄTTNINGAR */}
                    <div className="space-y-6">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Target size={12}/> Målsättningar</label>
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
                                        setForm(prev => ({ ...prev, goalB: \`\${formatActivityDuration(pb.durationMinutes)} (PB \${pb.date.split('-')[0]})\`, goalC: 'Gå i mål' }));
                                    }}
                                    className="text-[10px] bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 px-3 py-1.5 rounded-lg font-black uppercase tracking-widest border border-blue-500/20 transition-colors flex items-center gap-1.5"
                                >
                                    <History size={12} /> Från PB
                                </button>
                                <button
                                    onClick={() => {
                                        const dist = parseFloat(form.distance);
                                        if (isNaN(dist) || dist <= 0) return alert("Ange distans.");
                                        const recentRuns = races.filter(r => r.distance && r.distance >= 5 && r.durationMinutes > 0);
                                        if (recentRuns.length === 0) return alert("Behöver fler pass.");
                                        const currentVdot = recentRuns.map(r => calculateVDOT(r.distance!, r.durationMinutes * 60)).sort((a,b) => b-a)[0];
                                        const estimatedSecs = calculateAdjustedRaceTime(dist, parseFloat(form.elevationGain)||0, form.isTrail, currentVdot);
                                        setForm(prev => ({ ...prev, goalB: \`\${formatActivityDuration(estimatedSecs / 60)} (Est)\`, goalA: \`\${formatActivityDuration((estimatedSecs * 0.97) / 60)} (Dröm)\` }));
                                    }}
                                    className="text-[10px] bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-lg font-black uppercase tracking-widest border border-emerald-500/20 transition-colors flex items-center gap-1.5"
                                >
                                    <Target size={12} /> Auto-Estimerat
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="bg-emerald-500/5 p-5 rounded-2xl border border-emerald-500/10 focus-within:border-emerald-500/30 focus-within:bg-emerald-500/10 transition-colors">
                                <label className="flex items-center gap-2 text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-3"><Trophy size={14} /> Drömmål (A)</label>
                                <input type="text" value={form.goalA} onChange={e => setForm({...form, goalA: e.target.value})} className="w-full bg-slate-950/50 border border-white/5 rounded-xl p-3 text-white focus:border-emerald-500 outline-none text-sm transition-colors font-mono" placeholder="Sub 1:45" />
                            </div>
                            <div className="bg-blue-500/5 p-5 rounded-2xl border border-blue-500/10 focus-within:border-blue-500/30 focus-within:bg-blue-500/10 transition-colors">
                                <label className="flex items-center gap-2 text-[10px] font-black text-blue-500 uppercase tracking-widest mb-3"><Target size={14} /> Realistiskt (B)</label>
                                <input type="text" value={form.goalB} onChange={e => setForm({...form, goalB: e.target.value})} className="w-full bg-slate-950/50 border border-white/5 rounded-xl p-3 text-white focus:border-blue-500 outline-none text-sm transition-colors font-mono" placeholder="Sub 1:50" />
                            </div>
                            <div className="bg-amber-500/5 p-5 rounded-2xl border border-amber-500/10 focus-within:border-amber-500/30 focus-within:bg-amber-500/10 transition-colors">
                                <label className="flex items-center gap-2 text-[10px] font-black text-amber-500 uppercase tracking-widest mb-3"><CheckSquare size={14} /> Safe-mål (C)</label>
                                <input type="text" value={form.goalC} onChange={e => setForm({...form, goalC: e.target.value})} className="w-full bg-slate-950/50 border border-white/5 rounded-xl p-3 text-white focus:border-amber-500 outline-none text-sm transition-colors font-mono" placeholder="Gå i mål" />
                            </div>
                        </div>
                    </div>

                    <hr className="border-white/5" />

                    {/* EFTER LOPPET */}
                    <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Medal size={12}/> Resultat (Fylls i efter)</label>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="relative">
                                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none"><Medal size={16} className="text-slate-500" /></div>
                                <input type="text" value={form.placement} onChange={e => setForm({...form, placement: e.target.value})} className="w-full bg-slate-950/50 border border-white/5 hover:border-white/10 rounded-xl py-4 pl-12 pr-4 text-white focus:border-amber-500 outline-none text-sm transition-colors font-mono" placeholder="Placering (12/200)" />
                            </div>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none"><Users size={16} className="text-slate-500" /></div>
                                <input type="number" value={form.totalParticipants} onChange={e => setForm({...form, totalParticipants: e.target.value})} className="w-full bg-slate-950/50 border border-white/5 hover:border-white/10 rounded-xl py-4 pl-12 pr-4 text-white focus:border-amber-500 outline-none text-sm transition-colors font-mono" placeholder="Totalt deltagare" />
                            </div>
                        </div>

                        <div className="relative">
                            <div className="absolute top-4 left-4 pointer-events-none"><AlignLeft size={16} className="text-slate-500" /></div>
                            <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full bg-slate-950/50 border border-white/5 hover:border-white/10 rounded-xl py-4 pl-12 pr-4 text-white focus:border-amber-500 outline-none text-sm h-32 resize-none transition-colors custom-scrollbar" placeholder="Egna anteckningar om känslan, uppladdningen, vädret..." />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 sm:px-10 sm:py-6 border-t border-white/5 bg-slate-900 flex gap-4 rounded-b-[2rem] relative z-10">
                    <button onClick={onClose} className="px-8 py-4 rounded-2xl bg-slate-800 text-slate-300 font-black tracking-widest uppercase text-xs hover:bg-slate-700 hover:text-white transition-colors">
                        Avbryt
                    </button>
                    <button onClick={handleSubmit} disabled={!form.title} className="flex-1 px-8 py-4 rounded-2xl bg-amber-500 text-amber-950 font-black tracking-widest uppercase text-sm hover:bg-amber-400 hover:shadow-[0_0_30px_rgba(245,158,11,0.3)] transition-all disabled:opacity-50 disabled:hover:shadow-none flex justify-center items-center gap-2">
                        {activityToEdit ? 'Spara Ändringar' : 'Lägg Till Tävling'}
                    </button>
                </div>
            </div>
        </div>
    );
}`;

    const finalContent = content.substring(0, startIdx) + newComponent + "\n\n" + content.substring(endIdx);
    await Deno.writeTextFile(path, finalContent);
    console.log("Replaced AddRaceModal successfully");
}

main();
