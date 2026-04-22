import React, { useState, useEffect, useMemo, useRef } from 'react';
import { WorkoutDefinition, RunBlock, RunUnit, IntensityZone } from '../../models/workout.ts';
import { generateId } from '../../models/types.ts';
import { Plus, X, Activity, Timer, Navigation, Sparkles, GripVertical } from 'lucide-react';

interface RunWorkoutBuilderProps {
    workout: WorkoutDefinition;
    updateWorkout: (field: keyof WorkoutDefinition, value: any) => void;
}

const ZONES: IntensityZone[] = [
    'Zon 1 (Återhämtning)',
    'Zon 2 (Distans)',
    'Zon 3 (Tempo)',
    'Zon 4 (Tröskel)',
    'Zon 5 (VO2 Max)'
];

const ZONE_PACE_ESTIMATES: Record<IntensityZone, number> = {
    'Zon 1 (Återhämtning)': 6.5,
    'Zon 2 (Distans)': 5.5,
    'Zon 3 (Tempo)': 4.8,
    'Zon 4 (Tröskel)': 4.2,
    'Zon 5 (VO2 Max)': 3.5
};

// NLP Parser Function
function parseRunInput(text: string): Partial<RunBlock> | null {
    if (!text.trim()) return null;
    let block: Partial<RunBlock> = { id: generateId() };
    const lower = text.toLowerCase();

    // 1. Detect Type
    if (lower.includes('uppjogg') || lower.includes('uppvärmning') || lower.includes('wu') || lower.includes('warmup') || lower.match(/\bupp\b/)) {
        block.type = 'warmup';
        block.zone = 'Zon 1 (Återhämtning)';
    } else if (lower.includes('nedjogg') || lower.includes('nerjogg') || lower.includes('nedvärmning') || lower.includes('cd') || lower.includes('cooldown')) {
        block.type = 'cooldown';
        block.zone = 'Zon 1 (Återhämtning)';
    } else if (lower.match(/\d+\s*[xX*]\s*\d+/) || lower.includes('backintervall') || lower.includes('backe')) {
        block.type = 'interval';
    } else {
        block.type = 'continuous';
    }

    // 2. Detect Sets & Amount/Unit (Intervals)
    const intervalMatch = lower.match(/(\d+)\s*[xX*]\s*(\d+(?:[.,]\d+)?)\s*(km|k|min|m|s)?/);
    if (intervalMatch && block.type === 'interval') {
        block.sets = parseInt(intervalMatch[1]);
        block.amount = parseFloat(intervalMatch[2].replace(',', '.'));
        const u = intervalMatch[3] || 'm'; // default to meters for intervals if not specified
        block.unit = (u === 'k' || u === 'km') ? 'km' : (u === 'min' ? 'min' : (u === 's' ? 's' : 'm'));
    } else {
        // Detect standalone distance/time: "5k", "10 km", "45 min"
        const distMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(km|k|min|m|s)/);
        if (distMatch) {
            block.amount = parseFloat(distMatch[1].replace(',', '.'));
            const u = distMatch[2];
            block.unit = (u === 'k' || u === 'km') ? 'km' : (u === 'min' ? 'min' : (u === 's' ? 's' : 'm'));
        }
    }

    // 3. Detect Zone / Pace
    if (lower.includes('zon 1') || lower.includes('z1') || lower.includes('återhämtning')) block.zone = 'Zon 1 (Återhämtning)';
    else if (lower.includes('zon 2') || lower.includes('z2') || lower.includes('distans')) block.zone = 'Zon 2 (Distans)';
    else if (lower.includes('zon 3') || lower.includes('z3') || lower.includes('tempo')) block.zone = 'Zon 3 (Tempo)';
    else if (lower.includes('zon 4') || lower.includes('z4') || lower.includes('tröskel')) block.zone = 'Zon 4 (Tröskel)';
    else if (lower.includes('zon 5') || lower.includes('z5') || lower.includes('vo2') || lower.includes('max')) block.zone = 'Zon 5 (VO2 Max)';
    else if (block.type === 'continuous' && !block.zone) block.zone = 'Zon 2 (Distans)'; // Default continuous zone

    // Smart default interval zones based on distance
    if (block.type === 'interval' && !block.zone && block.amount) {
        const intervalMeters = block.unit === 'km' ? block.amount * 1000 : (block.unit === 'm' ? block.amount : (block.unit === 'min' ? block.amount * 250 : 0));
        if (intervalMeters > 0 && intervalMeters < 1000) block.zone = 'Zon 5 (VO2 Max)';
        else block.zone = 'Zon 4 (Tröskel)'; // fallback
    }

    const paceMatch = lower.match(/@?\s*(\d{1,2}:\d{2}|at|lt|vo2|tröskel|tempo|återhämtning)\b/i);
    if (paceMatch) {
        block.targetPace = paceMatch[1].toUpperCase();
    }

    const hrMatch = lower.match(/(?:hr|bpm|puls)\s*(\d+(?:-\d+)?)/) || lower.match(/(\d+(?:-\d+)?)\s*(?:hr|bpm|puls)/);
    if (hrMatch) {
        block.targetHr = hrMatch[1] || hrMatch[2];
        // Auto map hr to zone if no explicit zone word was found
        if (!block.zone) {
            const hrVal = parseInt(block.targetHr.split('-')[0]); // take lower bound if range
            if (hrVal < 135) block.zone = 'Zon 1 (Återhämtning)';
            else if (hrVal < 150) block.zone = 'Zon 2 (Distans)';
            else if (hrVal < 165) block.zone = 'Zon 3 (Tempo)';
            else if (hrVal < 175) block.zone = 'Zon 4 (Tröskel)';
            else block.zone = 'Zon 5 (VO2 Max)';
        }
    }

    // 4. Detect Rest
    if (block.type === 'interval' || lower.includes('vila') || lower.includes('/')) {
        // Match explicit strings first: "60s gåvila", "vila 1 min"
        let restMatch = lower.match(/vila:?\s*(\d+(?:[.,]\d+)?)\s*(km|k|min|m|s)/) || lower.match(/(\d+(?:[.,]\d+)?)\s*(km|k|min|m|s)\s*(?:gå|stå|jogg)?vila/);
        
        // Match slash syntax: "12x500m / 200m" or "5x1k / 60s"
        if (!restMatch) {
            restMatch = lower.match(/\/\s*(\d+(?:[.,]\d+)?)\s*(km|k|min|m|s)/);
        }

        if (restMatch) {
            block.restAmount = parseFloat(restMatch[1].replace(',', '.'));
            const ru = restMatch[2];
            block.restUnit = (ru === 'k' || ru === 'km') ? 'km' : (ru === 'min' ? 'min' : (ru === 's' ? 's' : 'm'));
        } else if (!block.restAmount) {
            // Default rest if interval and none specified
            block.restAmount = 60;
            block.restUnit = 's';
        }

        // Determine rest type
        if (lower.includes('gåvila')) block.restType = 'Gåvila';
        else if (lower.includes('ståvila')) block.restType = 'Ståvila';
        else if (lower.includes('joggvila') || block.restUnit === 'm' || block.restUnit === 'km') {
            block.restType = 'Joggvila'; // Auto joggvila if rest unit is distance
        } else {
            block.restType = 'Ståvila'; // default
        }
    }

    // 5. Default Paces based on Zone or Type
    if (!block.targetPace) {
        if (block.zone) {
            const p = ZONE_PACE_ESTIMATES[block.zone];
            const mins = Math.floor(p);
            const secs = Math.round((p - mins) * 60);
            block.targetPace = `${mins}:${secs.toString().padStart(2, '0')}`;
        } else if (block.type === 'warmup' || block.type === 'cooldown') {
            block.targetPace = '6:00'; // Fallback
        } else if (block.type === 'continuous') {
            block.targetPace = '5:00'; // Fallback
        }
    }

    if (!block.amount) return null; // We at least need an amount to consider it valid

    return block as RunBlock;
}

export function RunWorkoutBuilder({ workout, updateWorkout }: RunWorkoutBuilderProps) {
    const [omnibox, setOmnibox] = useState('');
    const [parsedPreview, setParsedPreview] = useState<Partial<RunBlock> | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const blocks = workout.runBlocks || [];

    useEffect(() => {
        if (!workout.runBlocks) {
            updateWorkout('runBlocks', []);
            updateWorkout('subCategory', 'Distans');
        }
    }, []);

    // Live parse the omnibox input
    useEffect(() => {
        if (omnibox.trim().length > 2) {
            setParsedPreview(parseRunInput(omnibox));
        } else {
            setParsedPreview(null);
        }
    }, [omnibox]);

    const handleOmniboxSubmit = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (parsedPreview && parsedPreview.amount) {
            // Add block
            const newBlock = { ...parsedPreview, id: generateId() } as RunBlock;
            const newBlocks = [...blocks];
            
            // Smart insertion (warmup first, cooldown last, else append)
            if (newBlock.type === 'warmup') {
                newBlocks.unshift(newBlock);
            } else if (newBlock.type === 'cooldown') {
                newBlocks.push(newBlock);
            } else {
                // Insert before cooldown if exists, else append
                const cdIndex = newBlocks.findIndex(b => b.type === 'cooldown');
                if (cdIndex !== -1) newBlocks.splice(cdIndex, 0, newBlock);
                else newBlocks.push(newBlock);
            }
            
            updateWorkout('runBlocks', newBlocks);

            // Auto-update category if we added intervals
            if (newBlock.type === 'interval' && workout.subCategory !== 'Intervall') {
                updateWorkout('subCategory', 'Intervall');
            }

            setOmnibox('');
            setParsedPreview(null);
        }
    };

    const updateBlock = (id: string, updates: Partial<RunBlock>) => {
        updateWorkout('runBlocks', blocks.map(b => b.id === id ? { ...b, ...updates } : b));
    };

    const handleBlockZoneChange = (id: string, newZone: IntensityZone | undefined, block: RunBlock) => {
        let updates: Partial<RunBlock> = { zone: newZone };
        
        if (newZone) {
            let baseDecimal = ZONE_PACE_ESTIMATES[newZone];
            
            // Note: Removed the aggressive interval distance modifiers that broke VO2 max predictions.
            // We now just use the base zone estimates unless we build a full user-profile-based VDOT table.
            
            const mins = Math.floor(baseDecimal);
            const secs = Math.round((baseDecimal - mins) * 60);
            updates.targetPace = `${mins}:${secs.toString().padStart(2, '0')}`;
            
            // Update HR defaults
            switch (newZone) {
                case 'Zon 1 (Återhämtning)': updates.targetHr = '125-135'; break;
                case 'Zon 2 (Distans)': updates.targetHr = '135-150'; break;
                case 'Zon 3 (Tempo)': updates.targetHr = '150-165'; break;
                case 'Zon 4 (Tröskel)': updates.targetHr = '165-175'; break;
                case 'Zon 5 (VO2 Max)': updates.targetHr = '175+'; break;
            }
        } else {
            updates.targetHr = '';
            updates.targetPace = '';
        }
        
        updateBlock(id, updates);
    };

    const removeBlock = (id: string) => {
        updateWorkout('runBlocks', blocks.filter(b => b.id !== id));
    };

    const estimates = useMemo(() => {
        let totalKm = 0;
        let totalMin = 0;

        blocks.forEach(b => {
            const pace = b.zone ? ZONE_PACE_ESTIMATES[b.zone] : 5.0;
            let blockKm = 0;
            let blockMin = 0;

            if (b.type === 'interval') {
                const sets = b.sets || 1;
                if (b.unit === 'km') { blockKm += b.amount * sets; blockMin += (b.amount * pace) * sets; }
                else if (b.unit === 'm') { blockKm += (b.amount / 1000) * sets; blockMin += ((b.amount / 1000) * pace) * sets; }
                else if (b.unit === 'min') { blockMin += b.amount * sets; blockKm += (b.amount / pace) * sets; }

                if (b.restType === 'Joggvila' || b.restType === 'Gåvila') {
                    const restPace = b.restType === 'Joggvila' ? ZONE_PACE_ESTIMATES['Zon 1 (Återhämtning)'] : 10.0;
                    const rAmount = b.restAmount || 0;
                    if (b.restUnit === 'min') { blockMin += rAmount * sets; blockKm += (rAmount / restPace) * sets; }
                    else if (b.restUnit === 's') { blockMin += (rAmount / 60) * sets; blockKm += ((rAmount / 60) / restPace) * sets; }
                } else {
                    const rAmount = b.restAmount || 0;
                    if (b.restUnit === 'min') blockMin += rAmount * sets;
                    else if (b.restUnit === 's') blockMin += (rAmount / 60) * sets;
                }
            } else {
                if (b.unit === 'km') { blockKm += b.amount; blockMin += b.amount * pace; }
                else if (b.unit === 'm') { blockKm += b.amount / 1000; blockMin += (b.amount / 1000) * pace; }
                else if (b.unit === 'min') { blockMin += b.amount; blockKm += b.amount / pace; }
            }

            totalKm += blockKm;
            totalMin += blockMin;
        });

        return { distance: Math.round(totalKm * 10) / 10, duration: Math.round(totalMin) };
    }, [blocks]);

    useEffect(() => {
        if (workout.durationMin !== estimates.duration) updateWorkout('durationMin', estimates.duration);
        if (workout.estimatedDistance !== estimates.distance) updateWorkout('estimatedDistance', estimates.distance);
    }, [estimates]);

    const isInterval = workout.subCategory === 'Intervall';

    // Helper to render the ghost text
    const getBlockSummary = (b: Partial<RunBlock>) => {
        let zoneStr = '';
        if (b.zone) {
            // "Zon 4 (Tröskel)" -> "Zon 4"
            const nameMatch = b.zone.match(/^(Zon \d+)/);
            const zName = nameMatch ? nameMatch[1] : b.zone.split(' (')[0];
            zoneStr = ` i ${zName}`;
        }
        
        const hrStr = b.targetHr ? ` (${b.targetHr} bpm)` : '';
        const paceStr = b.targetPace ? ` @ ${b.targetPace}` : '';
        
        if (b.type === 'interval') {
            const restStr = b.restAmount ? ` | Vila: ${b.restAmount}${b.restUnit} ${b.restType}` : '';
            return `${b.sets}x${b.amount}${b.unit}${zoneStr}${hrStr}${paceStr}${restStr}`;
        }
        const name = b.type === 'warmup' ? 'Uppjogg' : b.type === 'cooldown' ? 'Nedjogg' : 'Distans';
        return `${name}: ${b.amount}${b.unit}${zoneStr}${hrStr}${paceStr}`;
    };

    return (
        <div className="flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-4">
            
            {/* OMNIBOX & SUMMARY HEADER */}
            <div className="bg-indigo-950/30 border border-indigo-500/30 rounded-[2rem] p-6 shadow-2xl relative">
                <div className="absolute inset-0 overflow-hidden rounded-[2rem] pointer-events-none">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[100px] rounded-full"></div>
                </div>
                
                <div className="flex items-start justify-between gap-8 relative z-50">
                    <div className="flex-1 space-y-2">
                        <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                            <Sparkles className="w-3 h-3" /> Smart inmatning
                        </label>
                        <form onSubmit={handleOmniboxSubmit} className="relative">
                            <input 
                                ref={inputRef}
                                type="text"
                                value={omnibox}
                                onChange={e => setOmnibox(e.target.value)}
                                placeholder='T.ex. "15min uppjogg", "5x1000m @ zon 4 med 60s ståvila"'
                                className="w-full bg-slate-900/50 border border-white/10 rounded-2xl px-6 py-5 text-xl font-medium text-white focus:outline-none focus:border-indigo-500 focus:bg-slate-900 transition-all placeholder-white/20"
                                autoFocus
                            />
                            
                            {/* Ghost Preview */}
                            {parsedPreview && (
                                <div className="absolute top-[calc(100%+8px)] left-0 w-full bg-indigo-600/95 backdrop-blur-xl text-white rounded-2xl px-6 py-5 shadow-[0_20px_50px_rgba(79,70,229,0.3)] flex items-center justify-between border border-indigo-400 animate-in fade-in slide-in-from-top-2 z-[9999] overflow-hidden">
                                    <div className="flex items-center gap-4 flex-wrap w-[80%]">
                                        <span className="bg-white/20 text-[10px] font-black uppercase px-2 py-1 rounded shadow-inner shrink-0">Förslag</span>
                                        <span className="font-bold text-lg leading-tight break-words">{getBlockSummary(parsedPreview)}</span>
                                    </div>
                                    <span className="text-[10px] font-black uppercase opacity-70 bg-black/20 px-3 py-1.5 rounded-full shrink-0">Tryck Enter ↵</span>
                                </div>
                            )}
                        </form>
                    </div>

                    <div className="flex flex-col items-end gap-1 pt-6 pr-4">
                        <div className="flex items-center gap-2 text-indigo-300">
                            <Navigation className="w-5 h-5 text-indigo-400" />
                            <span className="text-3xl font-black tracking-tight">{estimates.distance} <span className="text-sm font-medium text-indigo-500">km</span></span>
                        </div>
                        <div className="flex items-center gap-2 text-emerald-300">
                            <Timer className="w-5 h-5 text-emerald-400" />
                            <span className="text-3xl font-black tracking-tight">~{estimates.duration} <span className="text-sm font-medium text-emerald-500">min</span></span>
                        </div>
                    </div>
                </div>
            </div>

            {/* THE BLOCKS (DRAGGABLE/EDITABLE) */}
            <div className="space-y-3">
                {blocks.length === 0 && (
                    <div className="text-center py-12 border-2 border-dashed border-white/5 rounded-3xl text-slate-500">
                        Skriv i rutan ovan för att bygga ditt pass! 🏃‍♂️
                    </div>
                )}
                {blocks.map((block, idx) => (
                    <div key={block.id} className="group relative flex items-center gap-4 bg-slate-900 border border-white/5 p-4 rounded-2xl hover:border-white/10 transition-colors">
                        <div className="w-10 h-10 rounded-xl bg-slate-950 border border-white/5 flex items-center justify-center text-xl shrink-0">
                            {block.type === 'warmup' ? '🔥' : block.type === 'cooldown' ? '❄️' : block.type === 'interval' ? '⚡' : '🏃'}
                        </div>
                        
                        <div className="flex-1 flex flex-col xl:flex-row xl:items-center gap-3 xl:gap-6">
                            
                            {/* Identifier & Core Data Row */}
                            <div className="flex items-center gap-4">
                                <span className="text-sm font-bold text-white capitalize w-[80px] shrink-0">
                                    {block.type === 'interval' ? 'Intervaller' : block.type === 'continuous' ? 'Distans' : block.type === 'warmup' ? 'Uppjogg' : 'Nedjogg'}
                                </span>

                                {/* Core Data */}
                                {block.type === 'interval' ? (
                                    <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-white/5 shrink-0">
                                        <input type="number" value={block.sets} onChange={e => updateBlock(block.id, { sets: parseInt(e.target.value) || 1 })} className="w-8 bg-transparent text-white font-bold outline-none text-center" />
                                        <span className="text-slate-500 font-bold">x</span>
                                        <input type="number" value={block.amount} onChange={e => updateBlock(block.id, { amount: parseFloat(e.target.value) || 0 })} className="w-12 bg-transparent text-white font-bold outline-none text-center" />
                                        <select value={block.unit} onChange={e => updateBlock(block.id, { unit: e.target.value as RunUnit })} className="bg-transparent text-slate-400 text-xs font-bold outline-none cursor-pointer">
                                            <option value="m">m</option><option value="km">km</option><option value="min">min</option>
                                        </select>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-white/5 shrink-0">
                                        <input type="number" value={block.amount} onChange={e => updateBlock(block.id, { amount: parseFloat(e.target.value) || 0 })} className="w-12 bg-transparent text-white font-bold outline-none text-center" />
                                        <select value={block.unit} onChange={e => updateBlock(block.id, { unit: e.target.value as RunUnit })} className="bg-transparent text-slate-400 text-xs font-bold outline-none cursor-pointer">
                                            <option value="km">km</option><option value="min">min</option><option value="m">m</option>
                                        </select>
                                    </div>
                                )}
                            </div>

                            {/* Zone, Pace, HR & Rest */}
                            <div className="flex flex-wrap items-center gap-3">
                                {/* Zone/Pace/HR Pill */}
                                <div className="flex items-center gap-2 bg-slate-950/40 border border-white/5 p-1.5 rounded-2xl">
                                    <select value={block.zone || ''} onChange={e => handleBlockZoneChange(block.id, e.target.value as IntensityZone || undefined, block)} className="bg-transparent border-none px-2 py-1 text-sm font-bold text-indigo-400 outline-none max-w-[140px] cursor-pointer">
                                        <option value="">Ingen Zon</option>
                                        {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
                                    </select>
                                    
                                    <div className="w-px h-5 bg-white/10"></div>
                                    
                                    <input 
                                        type="text" 
                                        value={block.targetPace || ''} 
                                        onChange={e => updateBlock(block.id, { targetPace: e.target.value })} 
                                        placeholder="Tempo/Känsla" 
                                        className="w-28 bg-transparent px-2 py-1 text-sm text-white outline-none placeholder-slate-600" 
                                    />
                                    
                                    <div className="w-px h-5 bg-white/10"></div>

                                    <input 
                                        type="text" 
                                        value={block.targetHr || ''} 
                                        onChange={e => updateBlock(block.id, { targetHr: e.target.value })} 
                                        placeholder="Puls" 
                                        className="w-20 bg-transparent px-2 py-1 text-sm text-white outline-none placeholder-slate-600" 
                                    />
                                </div>

                                {/* Rest Pill */}
                                {block.type === 'interval' && (
                                    <div className="flex items-center gap-2 bg-slate-950/40 border border-white/5 p-1.5 rounded-2xl pl-4">
                                        <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest shrink-0">Vila</span>
                                        <div className="flex items-center bg-slate-900 border border-white/5 rounded-xl px-2 py-1">
                                            <input type="number" value={block.restAmount} onChange={e => updateBlock(block.id, { restAmount: parseFloat(e.target.value) || 0 })} className="w-10 bg-transparent text-white font-bold text-sm outline-none text-center" />
                                            <select value={block.restUnit} onChange={e => updateBlock(block.id, { restUnit: e.target.value as RunUnit })} className="bg-transparent text-slate-400 text-xs font-bold outline-none cursor-pointer">
                                                <option value="s">s</option><option value="min">min</option>
                                            </select>
                                        </div>
                                        <select value={block.restType} onChange={e => updateBlock(block.id, { restType: e.target.value as any })} className="bg-transparent px-2 py-1 text-xs font-bold text-white outline-none cursor-pointer">
                                            <option>Ståvila</option><option>Gåvila</option><option>Joggvila</option>
                                        </select>
                                    </div>
                                )}
                            </div>
                            
                            {/* Extreme Distance Warning */}
                            {block.type === 'interval' && ((block.unit === 'km' && block.amount > 10) || (block.unit === 'm' && block.amount > 10000)) && (
                                <div className="flex items-center gap-2 mt-2 xl:mt-0 bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-lg w-full xl:w-auto">
                                    <span className="text-xs text-rose-400 font-bold">⚠️ Lång intervall ({block.amount}{block.unit}). Menade du Distans?</span>
                                </div>
                            )}
                        </div>

                        <button onClick={() => removeBlock(block.id)} className="opacity-0 group-hover:opacity-100 p-2 text-slate-500 hover:text-rose-400 transition-all">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                ))}
            </div>

            {/* Flexibility (Bottom) */}
            {blocks.length > 0 && !isInterval && (
                <div className="flex items-center justify-end gap-3 px-4 opacity-50 hover:opacity-100 transition-opacity">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Flexibilitet (Mål)</span>
                    <input type="number" value={workout.flexibilityMin || ""} onChange={e => updateWorkout('flexibilityMin', parseFloat(e.target.value) || undefined)} placeholder="Min km" className="w-20 bg-slate-900 border border-white/5 rounded-lg px-3 py-1.5 text-sm text-center outline-none" />
                    <span className="text-slate-500">-</span>
                    <input type="number" value={workout.flexibilityMax || ""} onChange={e => updateWorkout('flexibilityMax', parseFloat(e.target.value) || undefined)} placeholder="Max km" className="w-20 bg-slate-900 border border-white/5 rounded-lg px-3 py-1.5 text-sm text-center outline-none" />
                </div>
            )}
        </div>
    );
}
