import { readFileSync, writeFileSync } from 'fs';

let content = readFileSync('src/components/training/RaceList.tsx', 'utf-8');

// Imports
content = content.replace(
`import React, { useState, useMemo, useEffect } from 'react';`,
`import { useState, useMemo, useEffect } from 'react';`
);

content = content.replace(
`    Timer,
    Medal,`,
`    Timer,
    Copy as CopyIcon,
    Medal,`
);

// Upcoming Races Buttons
content = content.replace(
`<div className="flex gap-3 mt-4 md:mt-0">`,
`<div className="flex gap-3 mt-4 md:mt-0">
                        <div className="flex gap-2 mr-4">
                            <button
                                onClick={() => {
                                    const json = JSON.stringify(upcomingRaces, null, 2);
                                    const blob = new Blob([json], { type: 'application/json' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = 'kommande_tavlingar.json';
                                    a.click();
                                    URL.revokeObjectURL(url);
                                }}
                                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors border border-white/5"
                                title="Exportera kommande som JSON"
                            >
                                <Download size={16} />
                            </button>
                            <button
                                onClick={() => {
                                    const tsv = ['Datum\tTitel\tPlats\tDistans\tDagar kvar'].concat(
                                        upcomingRaces.map(r => {
                                            const diff = new Date(r.date).getTime() - new Date().getTime();
                                            const daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));
                                            return \`\${r.date}\t\${r.title}\t\${r.raceDetails?.logistics?.location || ''}\t\${r.estimatedDistance}\t\${daysLeft}\`;
                                        })
                                    ).join('\\n');
                                    navigator.clipboard.writeText(tsv);
                                }}
                                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors border border-white/5"
                                title="Kopiera kommande som tabell (TSV)"
                            >
                                <CopyIcon size={16} />
                            </button>
                        </div>`
);

// Add flex wraps around headers
content = content.replace(
`<div>
                        <h2 className="text-3xl font-black text-white flex items-center gap-3">
                            <Trophy className="text-amber-500" size={32} />
                            Kommande Tävlingar
                        </h2>
                        <p className="text-slate-400 mt-1">Förbered dig, planera dina mål och krossa motståndet.</p>
                    </div>`,
`<div className="flex justify-between w-full md:w-auto md:flex-1">
                        <div>
                            <h2 className="text-3xl font-black text-white flex items-center gap-3">
                                <Trophy className="text-amber-500" size={32} />
                                Kommande Tävlingar
                            </h2>
                            <p className="text-slate-400 mt-1">Förbered dig, planera dina mål och krossa motståndet.</p>
                        </div>
                    </div>`
);

content = content.replace(
`<div>
                        <h3 className="text-2xl font-bold text-white flex items-center gap-2 mb-2">
                            <Medal className="text-slate-400" size={24} />
                            Historik & Resultat
                        </h3>
                        <div className="flex gap-4 text-sm text-slate-400">
                            <span><strong className="text-white">{stats.count}</strong> lopp</span>
                            <span>•</span>
                            <span><strong className="text-white">{stats.totalDistance.toFixed(0)}</strong> km totalt</span>
                        </div>
                    </div>`,
`<div className="flex justify-between w-full md:w-auto md:flex-1">
                        <div>
                            <h3 className="text-2xl font-bold text-white flex items-center gap-2 mb-2">
                                <Medal className="text-slate-400" size={24} />
                                Historik & Resultat
                            </h3>
                            <div className="flex gap-4 text-sm text-slate-400">
                                <span><strong className="text-white">{stats.count}</strong> lopp</span>
                                <span>•</span>
                                <span><strong className="text-white">{stats.totalDistance.toFixed(0)}</strong> km totalt</span>
                            </div>
                        </div>
                    </div>`
);

// History export buttons
content = content.replace(
`<div className="relative group">`,
`<div className="flex items-center gap-3">
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    const json = JSON.stringify(races, null, 2);
                                    const blob = new Blob([json], { type: 'application/json' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = 'historik_tavlingar.json';
                                    a.click();
                                    URL.revokeObjectURL(url);
                                }}
                                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors border border-white/5"
                                title="Exportera som JSON"
                            >
                                <Download size={16} />
                            </button>
                            <button
                                onClick={() => {
                                    const tsv = ['Datum\\tTitel\\tDistans\\tTid\\tTyp\\tPlats'].concat(
                                        races.map(r => \`\${r.date}\\t\${r.title || r.notes}\\t\${r.distance || ''}\\t\${r.durationMinutes}\\t\${r.type}\\t\${r.location || ''}\`)
                                    ).join('\\n');
                                    navigator.clipboard.writeText(tsv);
                                }}
                                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors border border-white/5"
                                title="Kopiera som tabell (TSV)"
                            >
                                <CopyIcon size={16} />
                            </button>
                        </div>
                    <div className="relative group">`
);

// Table compressions
content = content.replace(/px-6 py-4/g, "px-3 py-1.5");
content = content.replace(/border-l-4/g, "border-l-2");

// Upcoming table row styles
content = content.replace(
`const isTrail = isTrailRace(race.title);
                                        const isUltra = isUltraRace(race.title, race.estimatedDistance);`,
`const isTrail = race.raceDetails?.isTrail ?? isTrailRace(race.title);
                                        const isVirtual = race.raceDetails?.isVirtual;
                                        const isUltra = isUltraRace(race.title, race.estimatedDistance);`
);

content = content.replace(
`className="hover:bg-amber-500/5 transition-colors cursor-pointer group border-l-2 border-l-emerald-500/50 hover:border-l-emerald-400"
                                                onClick={() => handleEditClick(race)}
                                            >
                                                <td className="px-3 py-1.5">
                                                    <div className="flex flex-col">
                                                        <span className="font-mono font-bold text-emerald-400">{formatRaceDateCompact(race.date)}</span>
                                                        <span className="text-[10px] text-slate-500 uppercase font-black">{race.date.substring(0, 4)}</span>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-1.5">
                                                    <div className="font-bold text-white group-hover:text-emerald-400 transition-colors flex items-center gap-2">
                                                        {race.title}
                                                        {isUltra && <span className="text-[9px] bg-fuchsia-500/20 text-fuchsia-400 px-1.5 py-0.5 rounded border border-fuchsia-500/30 uppercase font-black tracking-widest shadow-[0_0_10px_rgba(217,70,239,0.2)]">Ultra</span>}
                                                        {isTrail && !isUltra && <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30 uppercase font-black tracking-widest">Trail</span>}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-1.5 text-slate-400 text-xs truncate max-w-[150px]">
                                                    {race.raceDetails?.logistics?.location || '-'}
                                                </td>`,
`className="hover:bg-amber-500/5 transition-colors cursor-pointer group border-l-2 border-l-emerald-500/50 hover:border-l-emerald-400"
                                                onClick={() => handleEditClick(race)}
                                            >
                                                <td className="px-3 py-1.5 whitespace-nowrap">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-mono text-xs font-bold text-emerald-400">{formatRaceDateCompact(race.date)}</span>
                                                        <span className="text-[9px] text-slate-500 uppercase font-black">{race.date.substring(2, 4)}</span>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-1.5">
                                                    <div className="font-bold text-white group-hover:text-emerald-400 transition-colors flex items-center gap-1 text-xs">
                                                        {race.title}
                                                        {isUltra && <span className="text-[8px] bg-fuchsia-500/20 text-fuchsia-400 px-1 py-0 rounded border border-fuchsia-500/30 uppercase font-black tracking-widest shadow-[0_0_10px_rgba(217,70,239,0.2)]">Ultra</span>}
                                                        {isTrail && !isUltra && <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-1 py-0 rounded border border-emerald-500/30 uppercase font-black tracking-widest">Trail</span>}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-1.5 text-slate-400 text-xs truncate max-w-[150px]">
                                                    {isVirtual ? <span className="text-[9px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Virtuellt</span> : (race.raceDetails?.logistics?.location || '-')}
                                                </td>`
);

content = content.replace(
`className="hover:bg-emerald-500/5 transition-colors cursor-pointer group bg-emerald-950/20"
                                                onClick={() => handleEditClick(race)}
                                            >
                                                <td className="px-3 py-1.5 border-l-2 border-l-emerald-500/50 group-hover:border-l-emerald-400">
                                                    <div className="flex flex-col">
                                                        <span className="font-mono font-bold text-emerald-400">{formatRaceDateCompact(race.date)}</span>
                                                        <span className="text-[10px] text-slate-500 uppercase font-black">{race.date.substring(0, 4)}</span>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-1.5">
                                                    <div className="font-bold text-white group-hover:text-emerald-400 transition-colors flex items-center gap-2 flex-wrap">
                                                        <Target size={14} className="text-emerald-500 shrink-0" />
                                                        <span>{race.title} <span className="text-slate-500 font-normal text-xs">(Planerad)</span></span>
                                                        {isUltra && <span className="text-[9px] bg-fuchsia-500/20 text-fuchsia-400 px-1.5 py-0.5 rounded border border-fuchsia-500/30 uppercase font-black tracking-widest shadow-[0_0_10px_rgba(217,70,239,0.2)]">Ultra</span>}
                                                        {isTrail && !isUltra && <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30 uppercase font-black tracking-widest">Trail</span>}
                                                        <span className="bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded uppercase font-black text-[9px]">{daysLeft} dagar till start</span>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-1.5 text-slate-400 text-xs">
                                                    {race.raceDetails?.logistics?.location || '-'}
                                                </td>`,
`className="hover:bg-emerald-500/5 transition-colors cursor-pointer group bg-emerald-950/20"
                                                onClick={() => handleEditClick(race)}
                                            >
                                                <td className="px-3 py-1.5 border-l-2 border-l-emerald-500/50 group-hover:border-l-emerald-400 whitespace-nowrap">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-mono text-xs font-bold text-emerald-400">{formatRaceDateCompact(race.date)}</span>
                                                        <span className="text-[9px] text-slate-500 uppercase font-black">{race.date.substring(2, 4)}</span>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-1.5">
                                                    <div className="font-bold text-white group-hover:text-emerald-400 transition-colors flex items-center gap-1.5 flex-wrap text-xs">
                                                        <Target size={12} className="text-emerald-500 shrink-0" />
                                                        <span className="truncate max-w-[200px]">{race.title} <span className="text-slate-500 font-normal text-[10px]">(Planerad)</span></span>
                                                        {isUltra && <span className="text-[8px] bg-fuchsia-500/20 text-fuchsia-400 px-1 py-0 rounded border border-fuchsia-500/30 uppercase font-black tracking-widest shadow-[0_0_10px_rgba(217,70,239,0.2)]">Ultra</span>}
                                                        {isTrail && !isUltra && <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-1 py-0 rounded border border-emerald-500/30 uppercase font-black tracking-widest">Trail</span>}
                                                        <span className="bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded uppercase font-black text-[9px] whitespace-nowrap">{daysLeft} dagar</span>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-1.5 text-slate-400 text-xs truncate max-w-[150px]">
                                                    {isVirtual ? <span className="text-[9px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Virtuellt</span> : (race.raceDetails?.logistics?.location || '-')}
                                                </td>`
);

content = content.replace(
`const resolvedTitle = getRaceTitle(race) || '';
                                        const isTrail = isTrailRace(resolvedTitle);
                                        const isUltra = isUltraRace(resolvedTitle, race.distance);`,
`const resolvedTitle = getRaceTitle(race) || '';
                                        // No explicit raceDetails available on historical generic exercise entries, rely on naming/location tagging
                                        const hasVirtualTag = (race.tags || []).includes('virtual') || resolvedTitle.toLowerCase().includes('virtual') || (race.location || '').toLowerCase().includes('virtuellt');
                                        const isTrail = (race.tags || []).includes('trail') || isTrailRace(resolvedTitle);
                                        const isVirtual = hasVirtualTag;
                                        const isUltra = isUltraRace(resolvedTitle, race.distance);`
);

content = content.replace(
`className="hover:bg-amber-500/5 transition-colors cursor-pointer group"
                                                onClick={() => setSelectedActivity(race)}
                                            >
                                                <td className="px-3 py-1.5">
                                                    <div className="flex flex-col">
                                                        <span className="font-mono font-bold text-slate-300">{formatRaceDateCompact(race.date)}</span>
                                                        <span className="text-[10px] text-slate-500 uppercase font-black">{race.date.substring(0, 4)}</span>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-1.5">
                                                    <div className="font-bold text-white group-hover:text-amber-400 transition-colors flex items-center gap-2 flex-wrap">
                                                        {resolvedTitle}
                                                        {isUltra && <span className="text-[9px] bg-fuchsia-500/20 text-fuchsia-400 px-1.5 py-0.5 rounded border border-fuchsia-500/30 uppercase font-black tracking-widest shadow-[0_0_10px_rgba(217,70,239,0.2)]">Ultra</span>}
                                                        {isTrail && !isUltra && <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20 uppercase font-black tracking-widest">Trail</span>}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-1.5 text-slate-400 text-xs">
                                                    {race.location || '-'}
                                                </td>
                                                <td className="px-3 py-1.5 text-right">
                                                    {race.distance ? (
                                                        <span className={\`px-2 py-1 rounded-md text-xs font-bold border \${distStyle} whitespace-nowrap opacity-80 group-hover:opacity-100 transition-opacity\`}>
                                                            {race.distance.toFixed(1)} km
                                                        </span>
                                                    ) : '-'}
                                                </td>
                                                <td className="px-3 py-1.5 text-right font-mono text-amber-300">
                                                    {formatActivityDuration(race.durationMinutes)}
                                                </td>
                                                <td className="px-3 py-1.5 text-right font-mono text-slate-400">
                                                    {calcPace(race.distance, race.durationMinutes)}
                                                </td>`,
`className="hover:bg-amber-500/5 transition-colors cursor-pointer group border-l-2 border-transparent hover:border-l-amber-500/50"
                                                onClick={() => setSelectedActivity(race)}
                                            >
                                                <td className="px-3 py-1.5 whitespace-nowrap">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-mono text-xs font-bold text-slate-300">{formatRaceDateCompact(race.date)}</span>
                                                        <span className="text-[9px] text-slate-500 uppercase font-black">{race.date.substring(2, 4)}</span>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-1.5">
                                                    <div className="font-bold text-white group-hover:text-amber-400 transition-colors flex items-center gap-1.5 flex-wrap text-xs">
                                                        <span className="truncate max-w-[200px]">{resolvedTitle}</span>
                                                        {isUltra && <span className="text-[8px] bg-fuchsia-500/20 text-fuchsia-400 px-1 py-0 rounded border border-fuchsia-500/30 uppercase font-black tracking-widest shadow-[0_0_10px_rgba(217,70,239,0.2)]">Ultra</span>}
                                                        {isTrail && !isUltra && <span className="text-[8px] bg-emerald-500/10 text-emerald-400 px-1 py-0 rounded border border-emerald-500/20 uppercase font-black tracking-widest">Trail</span>}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-1.5 text-slate-400 text-xs truncate max-w-[150px]">
                                                    {isVirtual ? <span className="text-[9px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Virtuellt</span> : (race.location || '-')}
                                                </td>
                                                <td className="px-3 py-1.5 text-right">
                                                    {race.distance ? (
                                                        <span className={\`px-2 py-0.5 rounded-md text-[10px] font-bold border \${distStyle} whitespace-nowrap opacity-80 group-hover:opacity-100 transition-opacity\`}>
                                                            {race.distance.toFixed(1)} km
                                                        </span>
                                                    ) : '-'}
                                                </td>
                                                <td className="px-3 py-1.5 text-right font-mono text-amber-300 text-xs">
                                                    {formatActivityDuration(race.durationMinutes)}
                                                </td>
                                                <td className="px-3 py-1.5 text-right font-mono text-slate-400 text-xs">
                                                    {calcPace(race.distance, race.durationMinutes)}
                                                </td>`
);


// Modals

content = content.replace(
`function AddRaceModal({
    activityToEdit,
    onClose,
    onSave
}: {
    activityToEdit?: PlannedActivity | null,
    onClose: () => void,
    onSave: (activity: PlannedActivity) => void
}) {`,
`function AddRaceModal({
    activityToEdit,
    onClose,
    onSave,
    races
}: {
    activityToEdit?: PlannedActivity | null,
    onClose: () => void,
    onSave: (activity: PlannedActivity) => void,
    races: ExerciseEntry[]
}) {`
);

content = content.replace(
`<AddRaceModal
                    activityToEdit={editingRace}
                    onClose={() => {`,
`<AddRaceModal
                    activityToEdit={editingRace}
                    races={races}
                    onClose={() => {`
);

content = content.replace(
`    const [page, setPage] = useState<'basics' | 'details'>('basics');
    const [form, setForm] = useState({
        title: '',
        date: new Date().toISOString().split('T')[0],
        distance: '',
        startTime: '10:00',
        location: '',
        url: '',
        isRegistered: true,
        goalA: '',
        goalB: '',
        goalC: '',
        description: ''
    });

    // Populate form if editing
    useEffect(() => {`,
`    const [page, setPage] = useState<'basics' | 'details'>('basics');
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
        goalA: '',
        goalB: '',
        goalC: '',
        description: ''
    });

    // Watch title for historic matches
    useEffect(() => {
        if (form.title.length > 3 && !activityToEdit) {
            const query = form.title.toLowerCase().replace(/\\d{4}/g, '').trim(); // Remove years like 2024
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
    useEffect(() => {`
);

content = content.replace(
`url: activityToEdit.raceUrl || '',
                isRegistered: activityToEdit.raceDetails?.isRegistered ?? true,
                goalA: activityToEdit.raceDetails?.goals?.a || '',`,
`url: activityToEdit.raceUrl || '',
                isRegistered: activityToEdit.raceDetails?.isRegistered ?? true,
                isVirtual: activityToEdit.raceDetails?.isVirtual ?? false,
                isTrail: activityToEdit.raceDetails?.isTrail ?? false,
                goalA: activityToEdit.raceDetails?.goals?.a || '',`
);

content = content.replace(
`raceDetails: {
                isRegistered: form.isRegistered,
                goals: {`,
`raceDetails: {
                isRegistered: form.isRegistered,
                isVirtual: form.isVirtual,
                isTrail: form.isTrail,
                goals: {`
);

content = content.replace(
`                                <input
                                    type="text"
                                    value={form.title}
                                    onChange={e => setForm({ ...form, title: e.target.value })}
                                    className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-white focus:border-amber-500 outline-none font-bold"
                                    placeholder="t.ex. Göteborgsvarvet 2026"
                                    autoFocus
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">`,
`                                <input
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
                                                setForm(prev => ({
                                                    ...prev,
                                                    distance: suggestedRace.distance?.toString() || prev.distance,
                                                    location: suggestedRace.location || prev.location,
                                                    isVirtual: (suggestedRace.tags || []).includes('virtual'),
                                                    isTrail: (suggestedRace.tags || []).includes('trail') || isTrailRace(suggestedRace.title || '')
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
                            <div className="grid grid-cols-2 gap-4">`
);

content = content.replace(
`<div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ort / Plats</label>
                                    <input
                                        type="text"
                                        value={form.location}
                                        onChange={e => setForm({ ...form, location: e.target.value })}
                                        className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-white focus:border-amber-500 outline-none"
                                        placeholder="Göteborg"
                                    />
                                </div>`,
`<div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ort / Plats</label>
                                    <input
                                        type="text"
                                        value={form.location}
                                        onChange={e => setForm({ ...form, location: e.target.value })}
                                        disabled={form.isVirtual}
                                        className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-white focus:border-amber-500 outline-none disabled:opacity-50"
                                        placeholder={form.isVirtual ? "Virtuellt" : "Göteborg"}
                                    />
                                </div>`
);

content = content.replace(
`placeholder="https://..."
                                />
                            </div>
                        </div>
                    ) : (`,
`placeholder="https://..."
                                />
                            </div>

                            {/* Race Type Flags */}
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
                    ) : (`
);


content = content.replace(
`</label>
                            </div>

                            <div className="bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20">`,
`</label>
                            </div>

                            <div className="flex justify-between items-end border-b border-white/10 pb-2">
                                <h4 className="text-sm font-bold text-white">Målsättningar</h4>
                                <button
                                    onClick={() => {
                                        const dist = parseFloat(form.distance);
                                        if (isNaN(dist) || dist <= 0) {
                                            alert("Du måste ange en distans för att använda estimeringen.");
                                            return;
                                        }

                                        // 1. Find best comparable race
                                        const comps = races.filter(r => r.distance && Math.abs(r.distance - dist) / dist < 0.1 && r.durationMinutes > 0);
                                        comps.sort((a, b) => a.durationMinutes - b.durationMinutes);
                                        const pb = comps[0];

                                        if (pb) {
                                            const pbPaceDec = pb.durationMinutes / pb.distance!;

                                            // A Goal: 2.5% faster than PB
                                            const aPace = pbPaceDec * 0.975;
                                            const aTime = aPace * dist;

                                            // B Goal: PB
                                            const bTime = pb.durationMinutes;

                                            // C Goal: Finish or 5% slower
                                            const cTime = pb.durationMinutes * 1.05;

                                            setForm(prev => ({
                                                ...prev,
                                                goalA: \`Sub \${formatActivityDuration(aTime)} (PB -2.5%)\`,
                                                goalB: \`Sub \${formatActivityDuration(bTime)} (Tidigare PB)\`,
                                                goalC: \`Sub \${formatActivityDuration(cTime)}\`
                                            }));
                                        } else {
                                            // Naive extrapolation based on a general user profile
                                            // Assumes user is a ~5:00/km runner
                                            const basePaceDec = 5.0; // 5 min/km
                                            const targetDec = dist > 21 ? basePaceDec * 1.05 : (dist > 10 ? basePaceDec : basePaceDec * 0.95);

                                            setForm(prev => ({
                                                ...prev,
                                                goalA: \`Sub \${formatActivityDuration((targetDec * 0.95) * dist)}\`,
                                                goalB: \`Sub \${formatActivityDuration(targetDec * dist)}\`,
                                                goalC: 'Finish'
                                            }));
                                        }
                                    }}
                                    className="text-[10px] bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 px-2 py-1 rounded font-black uppercase tracking-wider transition-colors border border-indigo-500/30 flex items-center gap-1"
                                >
                                    <Clock size={10} /> Smart Estimate
                                </button>
                            </div>

                            <div className="bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20">`
);

// Final text fixes
content = content.replace(/text-xs uppercase font-bold text-slate-500/g, "text-[10px] uppercase font-bold text-slate-500");

writeFileSync('src/components/training/RaceList.tsx', content);
