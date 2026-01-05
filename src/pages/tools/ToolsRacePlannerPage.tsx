import React, { useState, useEffect, useMemo } from 'react';
import {
    RaceProfile,
    RunnerProfile,
    IntakeEvent,
    PacingStrategy,
    simulateRace,
    calculateWeatherPenaltyFactor,
    generateSplits,
    calculateDropbagLogistics,
    NutritionProduct,
    // NEW imports
    SWEAT_RATE_PRESETS,
    CAFFEINE_PRESETS,
    CARB_TARGET_PRESETS,
    CARB_SOURCE_PRESETS,
    TEMPO_PRESETS,
    WEATHER_PRESETS,
    suggestSweatPreset,
    suggestCarbSourceDistribution,
    generateIntakeEvents,
    calculateHydrationSummary,
    calculateEnergyBreakdown,
    HydrationSummary,
    EnergyBreakdown
} from '../../utils/racePlannerCalculators';
import { useAuth } from '../../context/AuthContext';
import { ArrowLeft, Play, Save, Trash2, Battery, Droplet, Thermometer, ShoppingBag, Clock, AlertTriangle, ChevronDown, ChevronUp, Coffee, Zap, Settings2, Sparkles, Activity } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Link } from 'react-router-dom';

// --- Constants & Presets ---
const PRESET_PRODUCTS: NutritionProduct[] = [
    { name: "Maurten Gel 100", carbsG: 25, caffeineMg: 0, sodiumMg: 0, liquidMl: 0, isDrink: false },
    { name: "Maurten Gel 100 Caf 100", carbsG: 25, caffeineMg: 100, sodiumMg: 0, liquidMl: 0, isDrink: false },
    { name: "Maurten Drink Mix 320", carbsG: 80, caffeineMg: 0, sodiumMg: 0, liquidMl: 500, isDrink: true },
    { name: "Maurten Drink Mix 160", carbsG: 40, caffeineMg: 0, sodiumMg: 0, liquidMl: 500, isDrink: true },
    { name: "Umara Gel U", carbsG: 20, caffeineMg: 0, sodiumMg: 0, liquidMl: 0, isDrink: false },
    { name: "Umara Sports Drink", carbsG: 30, caffeineMg: 0, sodiumMg: 0, liquidMl: 500, isDrink: true },
    { name: "Banana (Medium)", carbsG: 27, caffeineMg: 0, sodiumMg: 0, liquidMl: 0, isDrink: false },
    { name: "Water (250ml)", carbsG: 0, caffeineMg: 0, sodiumMg: 0, liquidMl: 250, isDrink: true },
];

const DISTANCE_PRESETS = [
    { label: "5 km", val: 5 },
    { label: "10 km", val: 10 },
    { label: "Halvmara (21.1 km)", val: 21.1 },
    { label: "Marathon (42.2 km)", val: 42.2 },
    { label: "Lidingö (30 km)", val: 30 },
    { label: "Ultravasan 45", val: 45 },
    { label: "Ultravasan 90", val: 90 },
    { label: "100 km", val: 100 },
    { label: "100 miles", val: 160.9 },
];

// --- Sub-components ---

function ConfigSection({ title, icon, children, badge }: { title: string, icon: any, children: React.ReactNode, badge?: string }) {
    return (
        <div className="bg-slate-900 border border-white/5 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-emerald-400 border-b border-white/5 pb-2 mb-2">
                {icon}
                <h3 className="font-bold uppercase tracking-wider text-sm">{title}</h3>
                {badge && <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">{badge}</span>}
            </div>
            {children}
        </div>
    );
}

function InputGroup({ label, suffix, children }: { label: string, suffix?: string, children: React.ReactNode }) {
    return (
        <div className="space-y-1">
            <label className="text-xs text-slate-400 uppercase font-bold">{label}</label>
            <div className="relative">
                {children}
                {suffix && <span className="absolute right-3 top-2.5 text-slate-500 text-sm">{suffix}</span>}
            </div>
        </div>
    );
}

function PresetButton({ label, active, onClick, desc }: { label: string, active: boolean, onClick: () => void, desc?: string }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`px-3 py-2 rounded-lg text-sm font-bold transition-all ${active
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
            title={desc}
        >
            {label}
        </button>
    );
}

// --- Main Page Component ---

export function ToolsRacePlannerPage() {
    const { user, token } = useAuth();

    // -- State --

    // Config
    const [raceProfile, setRaceProfile] = useState<RaceProfile>({
        distanceKm: 42.2,
        targetTimeSeconds: 4 * 3600, // 4h
        date: new Date().toISOString().split('T')[0],
        startTime: "09:00"
    });

    const [runnerProfile, setRunnerProfile] = useState<RunnerProfile>({
        weightKg: 75,
        maxHr: 190,
        restingHr: 50,
        sweatRateLh: 0.8, // Default to "normal"
        caffeineToleranceMg: 300
    });

    const [environment, setEnvironment] = useState({
        temperatureC: 15,
        humidityPercent: 50,
        sunsetTime: "20:00"
    });

    const [pacingStrategy, setPacingStrategy] = useState<PacingStrategy>({
        type: 'stable',
        description: 'Jämnt tempo hela loppet'
    });

    // Logistics
    const [dropbagKms, setDropbagKms] = useState<number[]>([]);
    const [intakeEvents, setIntakeEvents] = useState<IntakeEvent[]>([]);

    // NEW: Nutrition Mode & Settings
    const [nutritionMode, setNutritionMode] = useState<'simple' | 'advanced'>('simple');
    const [carbsPerHour, setCarbsPerHour] = useState(60);
    const [carbSourcePreset, setCarbSourcePreset] = useState('auto'); // Default to Auto
    const [caffeinePreset, setCaffeinePreset] = useState('moderate');
    const [includePreRaceCaffeine, setIncludePreRaceCaffeine] = useState(true);

    // UI State
    const [activeTab, setActiveTab] = useState<'config' | 'plan' | 'logistics'>('config');
    const [savedPlans, setSavedPlans] = useState<any[]>([]);
    const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Simulation Result
    const [simResult, setSimResult] = useState<any>(null);
    const [splits, setSplits] = useState<any[]>([]);
    const [logistics, setLogistics] = useState<any[]>([]);
    const [weatherPenalty, setWeatherPenalty] = useState(1.0);
    const [warnings, setWarnings] = useState<string[]>([]);

    // NEW: Calculated summaries
    const [hydrationSummary, setHydrationSummary] = useState<HydrationSummary | null>(null);
    const [energyBreakdown, setEnergyBreakdown] = useState<EnergyBreakdown | null>(null);

    // --- Effects ---

    useEffect(() => {
        loadPlans();
    }, [token]);

    // Recalculate whenever inputs change
    useEffect(() => {
        runSimulation();
    }, [raceProfile, runnerProfile, environment, pacingStrategy, dropbagKms, intakeEvents]);

    // --- Logic ---

    const loadPlans = async () => {
        if (!token) return;
        try {
            const res = await fetch('/api/race-plans', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setSavedPlans(data);
            }
        } catch (e) {
            console.error("Failed to load plans", e);
        }
    };

    const savePlan = async () => {
        if (!token) return;
        setIsSaving(true);
        const planName = `${raceProfile.distanceKm}km - ${raceProfile.date}`;

        const payload = {
            id: selectedPlanId || undefined,
            name: planName,
            raceProfile,
            runnerProfile,
            environment,
            pacingStrategy,
            intakeEvents,
            dropbagKms
        };

        try {
            const res = await fetch('/api/race-plans', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const saved = await res.json();
                setSelectedPlanId(saved.id);
                loadPlans();
                alert("Plan sparad!");
            }
        } catch (e) {
            alert("Kunde inte spara");
        } finally {
            setIsSaving(false);
        }
    };

    const runSimulation = () => {
        // 1. Weather
        const penalty = calculateWeatherPenaltyFactor(environment.temperatureC, environment.humidityPercent);
        setWeatherPenalty(penalty);

        // 2. Pre-race caffeine from preset
        const caffeinePresetData = CAFFEINE_PRESETS.find(p => p.id === caffeinePreset);
        const preRaceCaffeine = includePreRaceCaffeine ? (caffeinePresetData?.preRaceMg || 0) : 0;

        // 3. Sim with hydration & caffeine tracking
        const res = simulateRace(raceProfile, runnerProfile, intakeEvents, 500, penalty, preRaceCaffeine);
        setSimResult(res);

        // 3. Splits
        // Adjust target time by penalty?
        const adjustedTargetSeconds = raceProfile.targetTimeSeconds * penalty;
        const s = generateSplits(raceProfile.distanceKm, adjustedTargetSeconds, pacingStrategy.type as any);
        setSplits(s);

        // 4. Logistics
        const l = calculateDropbagLogistics(intakeEvents, dropbagKms);
        setLogistics(l);

        // 5. NEW: Hydration Summary
        const hydration = calculateHydrationSummary(
            runnerProfile.weightKg,
            runnerProfile.sweatRateLh,
            adjustedTargetSeconds / 60,
            intakeEvents
        );
        setHydrationSummary(hydration);

        // 6. NEW: Energy Breakdown
        const energy = calculateEnergyBreakdown(
            runnerProfile.weightKg,
            raceProfile.distanceKm,
            adjustedTargetSeconds / 60,
            intakeEvents
        );
        setEnergyBreakdown(energy);

        // 7. Warnings
        const newWarnings: string[] = [];
        if (penalty > 1.05) newWarnings.push(`Varning: Vädret beräknas sänka din prestation med ${Math.round((penalty - 1) * 100)}%. Sänk tempot!`);
        if (res.crashTime !== null) newWarnings.push(`CRASH WARNING: Glykogendepåerna tar slut vid ${Math.floor(res.crashTime / 60)} minuter! Öka intaget.`);

        // Check hourly carbs
        const totalCarbs = intakeEvents.reduce((acc, e) => acc + (e.product?.carbsG || 0) * e.amount, 0);
        const hours = adjustedTargetSeconds / 3600;
        const gPerH = totalCarbs / hours;
        if (gPerH > 90) newWarnings.push(`Högt kolhydratsintag (${Math.round(gPerH)}g/h). Risk för magproblem om du inte tränat på det.`);
        if (gPerH < 30 && raceProfile.distanceKm > 21) newWarnings.push(`Lågt kolhydratsintag (${Math.round(gPerH)}g/h). Rekommenderas 60-90g/h för ultra.`);

        // Hydration warning
        if (hydration.hydrationStatus === 'critical') {
            newWarnings.push(`⚠️ Kritisk dehydrering (${hydration.dehydrationPercent}%)! Öka vätskeintaget.`);
        } else if (hydration.hydrationStatus === 'warning') {
            newWarnings.push(`Vätskebalans: ${hydration.dehydrationPercent}% kroppsvikt förlust. Överväg mer dryck.`);
        }

        setWarnings(newWarnings);
    };

    // --- Suggested values based on conditions ---
    const suggestedSweatPresetId = useMemo(() =>
        suggestSweatPreset(environment.temperatureC, environment.humidityPercent),
        [environment.temperatureC, environment.humidityPercent]
    );

    const suggestedCarbSource = useMemo(() =>
        suggestCarbSourceDistribution(environment.temperatureC),
        [environment.temperatureC]
    );

    // --- Helpers ---

    const handleGenerateSimpleIntake = () => {
        const carbSource = CARB_SOURCE_PRESETS.find(p => p.id === carbSourcePreset) || CARB_SOURCE_PRESETS[0];
        const caffeinePresetData = CAFFEINE_PRESETS.find(p => p.id === caffeinePreset);

        // Resolve Auto preset
        let gelPercent: number = carbSource.gelPct;
        let drinkPercent: number = carbSource.drinkPct;

        if (carbSource.id === 'auto') {
            gelPercent = suggestedCarbSource.gelPct;
            drinkPercent = suggestedCarbSource.drinkPct;
        }

        const result = generateIntakeEvents({
            distanceKm: raceProfile.distanceKm,
            targetTimeMinutes: raceProfile.targetTimeSeconds / 60,
            carbsPerHour,
            gelPercent,
            drinkPercent,
            includeCaffeine: (caffeinePresetData?.duringRaceMg || 0) > 0,
            caffeineInLastThird: true // Will use the 50% start rule logic
        });

        setIntakeEvents(result.events);
    };

    const handleAddIntake = () => {
        if (nutritionMode === 'simple') {
            handleGenerateSimpleIntake();
        } else {
            // Legacy: One Gel every 5km
            const count = Math.floor(raceProfile.distanceKm / 5);
            const newEvents: IntakeEvent[] = [];
            for (let i = 1; i <= count; i++) {
                newEvents.push({
                    distanceKm: i * 5,
                    type: 'gel',
                    amount: 1,
                    product: PRESET_PRODUCTS[0] // Default Maurten 100
                });
            }
            setIntakeEvents(newEvents);
        }
    };

    const formatTime = (secs: number) => {
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = Math.round(secs % 60);
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white pb-20">
            {/* Header */}
            <div className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-md border-b border-white/5">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link to="/tools" className="p-2 hover:bg-white/5 rounded-full text-slate-400 hover:text-white transition-colors">
                            <ArrowLeft size={20} />
                        </Link>
                        <div>
                            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-400">
                                Race Commander
                            </h1>
                            <p className="text-xs text-slate-400">Ultra-Optimization Engine</p>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        {user && (
                            <button
                                onClick={savePlan}
                                disabled={isSaving}
                                className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-400 rounded-full hover:bg-emerald-500/20 text-sm font-bold transition-all"
                            >
                                <Save size={16} />
                                {isSaving ? 'Sparar...' : 'Spara Plan'}
                            </button>
                        )}
                    </div>
                </div>

                {/* Tabs */}
                <div className="max-w-7xl mx-auto px-4 flex gap-6 text-sm border-t border-white/5 mt-2 pt-1 overflow-x-auto">
                    {[
                        { id: 'config', label: '1. Konfiguration' },
                        { id: 'plan', label: '2. Dashboard' },
                        { id: 'logistics', label: '3. Packlista & Logistik' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`pb-3 border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id
                                ? 'border-emerald-500 text-emerald-400 font-bold'
                                : 'border-transparent text-slate-400 hover:text-white'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-8">

                {/* Warnings Area */}
                {warnings.length > 0 && (
                    <div className="mb-8 space-y-2">
                        {warnings.map((w, i) => (
                            <div key={i} className="bg-amber-500/10 border border-amber-500/20 text-amber-200 p-4 rounded-xl flex items-start gap-3">
                                <AlertTriangle className="shrink-0 mt-0.5" size={18} />
                                <span className="text-sm font-medium">{w}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* --- TAB 1: CONFIG --- */}
                {activeTab === 'config' && (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">

                        {/* Race Data */}
                        <ConfigSection title="Loppdata" icon={<Play size={18} />}>
                            <InputGroup label="Distans (km)">
                                <select
                                    className="w-full bg-slate-800 border border-white/10 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                    value={raceProfile.distanceKm}
                                    onChange={e => setRaceProfile({ ...raceProfile, distanceKm: parseFloat(e.target.value) })}
                                >
                                    {DISTANCE_PRESETS.map(p => (
                                        <option key={p.val} value={p.val}>{p.label}</option>
                                    ))}
                                    <option value={0}>Annan...</option>
                                </select>
                                {raceProfile.distanceKm === 0 && (
                                    <input
                                        type="number"
                                        className="mt-2 w-full bg-slate-800 border border-white/10 rounded-lg p-2.5 text-white"
                                        placeholder="Ange distans..."
                                        onChange={e => setRaceProfile({ ...raceProfile, distanceKm: parseFloat(e.target.value) })}
                                    />
                                )}
                            </InputGroup>

                            <InputGroup label="Måltid (HH:MM:SS)">
                                <input
                                    type="text"
                                    className="w-full bg-slate-800 border border-white/10 rounded-lg p-2.5 text-white"
                                    placeholder="04:00:00"
                                    key={raceProfile.targetTimeSeconds} // Force re-render on external update
                                    defaultValue={formatTime(raceProfile.targetTimeSeconds)}
                                    onBlur={e => {
                                        let val = e.target.value;
                                        // Auto-fix "3:30" -> "03:30:00" logic
                                        const parts = val.split(':').map(Number);
                                        let secs = 0;
                                        if (parts.length === 3) {
                                            secs = parts[0] * 3600 + parts[1] * 60 + parts[2];
                                        } else if (parts.length === 2) {
                                            secs = parts[0] * 3600 + parts[1] * 60;
                                        } else if (parts.length === 1) {
                                            // Assume minutes if < 10, else seconds? Let's assume hours if small number?
                                            // Safer: Assume minutes.
                                            secs = parts[0] * 60;
                                        }

                                        if (secs > 0) {
                                            setRaceProfile({ ...raceProfile, targetTimeSeconds: secs });
                                        }
                                    }}
                                />
                            </InputGroup>

                            <InputGroup label="Starttid">
                                <input
                                    type="time"
                                    className="w-full bg-slate-800 border border-white/10 rounded-lg p-2.5 text-white"
                                    value={raceProfile.startTime}
                                    onChange={e => setRaceProfile({ ...raceProfile, startTime: e.target.value })}
                                />
                            </InputGroup>
                        </ConfigSection>

                        {/* Runner Data */}
                        <ConfigSection title="Löpare" icon={<Battery size={18} />}>
                            <div className="grid grid-cols-2 gap-4">
                                <InputGroup label="Vikt (kg)" suffix="kg">
                                    <input
                                        type="number"
                                        className="w-full bg-slate-800 border border-white/10 rounded-lg p-2.5 text-white"
                                        value={runnerProfile.weightKg}
                                        onChange={e => setRunnerProfile({ ...runnerProfile, weightKg: parseFloat(e.target.value) })}
                                    />
                                </InputGroup>
                            </div>

                            {/* Sweat Rate Presets */}
                            <div className="space-y-2">
                                <label className="text-xs text-slate-400 uppercase font-bold flex items-center gap-2">
                                    Svettintensitet
                                    {suggestedSweatPresetId && (
                                        <span className="text-[10px] text-emerald-400">(Förslag: {SWEAT_RATE_PRESETS.find(p => p.id === suggestedSweatPresetId)?.label})</span>
                                    )}
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {SWEAT_RATE_PRESETS.map(preset => (
                                        <PresetButton
                                            key={preset.id}
                                            label={preset.label}
                                            active={runnerProfile.sweatRateLh === preset.value}
                                            onClick={() => setRunnerProfile({ ...runnerProfile, sweatRateLh: preset.value })}
                                            desc={preset.desc}
                                        />
                                    ))}
                                </div>
                                <p className="text-[10px] text-slate-500">{runnerProfile.sweatRateLh} L/h</p>
                            </div>
                        </ConfigSection>

                        {/* Environment */}
                        <ConfigSection title="Miljö" icon={<Thermometer size={18} />}>
                            <div className="flex gap-2 mb-4 overflow-x-auto pb-1 no-scrollbar">
                                {WEATHER_PRESETS.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => setEnvironment({
                                            ...environment,
                                            temperatureC: p.temp,
                                            humidityPercent: p.humidity
                                        })}
                                        className="bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-lg px-3 py-2 text-xs flex items-center gap-2 transition-colors whitespace-nowrap min-w-fit"
                                    >
                                        <span className="text-base">{p.icon}</span>
                                        <span className="font-medium text-slate-300">{p.label}</span>
                                    </button>
                                ))}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <InputGroup label="Temp" suffix="°C">
                                    <input
                                        type="number"
                                        className="w-full bg-slate-800 border border-white/10 rounded-lg p-2.5 text-white"
                                        value={environment.temperatureC}
                                        onChange={e => setEnvironment({ ...environment, temperatureC: parseFloat(e.target.value) })}
                                    />
                                </InputGroup>
                                <InputGroup label="Fuktighet" suffix="%">
                                    <input
                                        type="number"
                                        className="w-full bg-slate-800 border border-white/10 rounded-lg p-2.5 text-white"
                                        value={environment.humidityPercent}
                                        onChange={e => setEnvironment({ ...environment, humidityPercent: parseFloat(e.target.value) })}
                                    />
                                </InputGroup>
                            </div>
                            {weatherPenalty > 1.0 && (
                                <div className="text-xs text-amber-400 font-mono mt-2">
                                    Väderjustering: +{Math.round((weatherPenalty - 1) * 100)}% tid
                                </div>
                            )}
                        </ConfigSection>

                        {/* Nutrition - NEW WITH SIMPLE/ADVANCED MODES */}
                        <ConfigSection title="Energi & Nutrition" icon={<Zap size={18} />} badge={nutritionMode === 'simple' ? 'Enkel' : 'Avancerad'}>
                            {/* Mode Toggle */}
                            <div className="flex gap-2 mb-4">
                                <button
                                    onClick={() => setNutritionMode('simple')}
                                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${nutritionMode === 'simple' ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400'
                                        }`}
                                >
                                    <Sparkles size={14} /> Enkel
                                </button>
                                <button
                                    onClick={() => setNutritionMode('advanced')}
                                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${nutritionMode === 'advanced' ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400'
                                        }`}
                                >
                                    <Settings2 size={14} /> Avancerad
                                </button>
                            </div>

                            {nutritionMode === 'simple' ? (
                                <div className="space-y-6">
                                    {/* Carbs Per Hour */}
                                    <div className="space-y-2">
                                        <label className="text-xs text-slate-400 uppercase font-bold">Kolhydrater per timme</label>
                                        <div className="flex flex-wrap gap-2">
                                            {CARB_TARGET_PRESETS.map(preset => (
                                                <PresetButton
                                                    key={preset.id}
                                                    label={preset.label}
                                                    active={carbsPerHour === preset.value}
                                                    onClick={() => setCarbsPerHour(preset.value)}
                                                    desc={preset.desc}
                                                />
                                            ))}
                                        </div>
                                        <div className="flex items-center gap-2 mt-2">
                                            <input
                                                type="number"
                                                className="w-20 bg-slate-800 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm"
                                                value={carbsPerHour}
                                                onChange={e => setCarbsPerHour(parseInt(e.target.value) || 60)}
                                            />
                                            <span className="text-xs text-slate-500">g/h (anpassat)</span>
                                        </div>
                                    </div>

                                    {/* Carb Source Distribution */}
                                    <div className="space-y-2">
                                        <label className="text-xs text-slate-400 uppercase font-bold flex items-center gap-2">
                                            Energikälla
                                            <span className="text-[10px] text-emerald-400">({suggestedCarbSource.reason})</span>
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            {CARB_SOURCE_PRESETS.map(preset => (
                                                <PresetButton
                                                    key={preset.id}
                                                    label={preset.label}
                                                    active={carbSourcePreset === preset.id}
                                                    onClick={() => setCarbSourcePreset(preset.id)}
                                                />
                                            ))}
                                        </div>
                                        {carbSourcePreset === 'auto' && (
                                            <p className="text-[10px] text-emerald-400 mt-1">
                                                Valt baserat på väder: {suggestedCarbSource.gelPct}% Gel / {suggestedCarbSource.drinkPct}% Dryck
                                            </p>
                                        )}
                                    </div>

                                    {/* Caffeine */}
                                    <div className="space-y-2">
                                        <label className="text-xs text-slate-400 uppercase font-bold flex items-center gap-2">
                                            <Coffee size={12} /> Koffein
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            {CAFFEINE_PRESETS.map(preset => (
                                                <PresetButton
                                                    key={preset.id}
                                                    label={preset.label}
                                                    active={caffeinePreset === preset.id}
                                                    onClick={() => setCaffeinePreset(preset.id)}
                                                    desc={preset.desc}
                                                />
                                            ))}
                                        </div>
                                        {caffeinePreset !== 'none' && (
                                            <div className="space-y-2 mt-2">
                                                <label className="flex items-center gap-2 text-sm">
                                                    <input
                                                        type="checkbox"
                                                        checked={includePreRaceCaffeine}
                                                        onChange={(e) => setIncludePreRaceCaffeine(e.target.checked)}
                                                        className="rounded bg-slate-800 border-white/20"
                                                    />
                                                    <span className="text-slate-300">Koffein före start (30 min)</span>
                                                    <span className="text-emerald-400 text-xs">
                                                        +{CAFFEINE_PRESETS.find(p => p.id === caffeinePreset)?.preRaceMg}mg
                                                    </span>
                                                </label>
                                                <p className="text-[10px] text-slate-500">
                                                    Totalt: {includePreRaceCaffeine ? CAFFEINE_PRESETS.find(p => p.id === caffeinePreset)?.preRaceMg : 0}mg före +
                                                    {CAFFEINE_PRESETS.find(p => p.id === caffeinePreset)?.duringRaceMg}mg under lopp
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Generate Button */}
                                    <button
                                        onClick={handleAddIntake}
                                        className="w-full py-3 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 font-bold transition-all"
                                    >
                                        ✨ Generera Energiplan
                                    </button>

                                    {/* Summary */}
                                    {intakeEvents.length > 0 && (
                                        <div className="bg-slate-800/50 rounded-lg p-4 space-y-2">
                                            <div className="text-xs font-bold text-slate-300 uppercase">Genererad Plan</div>
                                            <div className="grid grid-cols-3 gap-2 text-center">
                                                <div>
                                                    <div className="text-xl font-black text-emerald-400">{intakeEvents.reduce((s, e) => s + (e.product?.carbsG || 0), 0)}g</div>
                                                    <div className="text-[10px] text-slate-500">Kolhydrater</div>
                                                </div>
                                                <div>
                                                    <div className="text-xl font-black text-blue-400">{intakeEvents.reduce((s, e) => s + (e.product?.liquidMl || 0), 0)}ml</div>
                                                    <div className="text-[10px] text-slate-500">Vätska</div>
                                                </div>
                                                <div>
                                                    <div className="text-xl font-black text-amber-400">{intakeEvents.length}</div>
                                                    <div className="text-[10px] text-slate-500">Intag</div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* Advanced Mode - Original functionality */
                                <div>
                                    <button
                                        onClick={handleAddIntake}
                                        className="w-full py-3 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 font-bold transition-all mb-4"
                                    >
                                        Auto-generera (1 gel / 5km)
                                    </button>

                                    <div className="max-h-64 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                        {intakeEvents.map((evt, idx) => (
                                            <div key={idx} className="flex items-center gap-2 bg-slate-800 p-2 rounded text-sm">
                                                <input
                                                    type="number"
                                                    className="w-16 bg-slate-900 border border-white/10 rounded px-2 py-1 text-right"
                                                    value={evt.distanceKm}
                                                    onChange={(e) => {
                                                        const newEvents = [...intakeEvents];
                                                        newEvents[idx].distanceKm = parseFloat(e.target.value);
                                                        setIntakeEvents(newEvents);
                                                    }}
                                                />
                                                <span className="text-slate-500 text-xs">km</span>
                                                <select
                                                    className="flex-1 bg-slate-900 border border-white/10 rounded px-2 py-1 truncate"
                                                    value={evt.product?.name}
                                                    onChange={(e) => {
                                                        const prod = PRESET_PRODUCTS.find(p => p.name === e.target.value);
                                                        const newEvents = [...intakeEvents];
                                                        newEvents[idx].product = prod;
                                                        setIntakeEvents(newEvents);
                                                    }}
                                                >
                                                    {PRESET_PRODUCTS.map(p => (
                                                        <option key={p.name} value={p.name}>{p.name}</option>
                                                    ))}
                                                </select>
                                                <button
                                                    onClick={() => {
                                                        const newEvents = [...intakeEvents];
                                                        newEvents.splice(idx, 1);
                                                        setIntakeEvents(newEvents);
                                                    }}
                                                    className="text-slate-500 hover:text-red-400"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))}
                                        <button
                                            onClick={() => setIntakeEvents([...intakeEvents, { distanceKm: 0, type: 'gel', amount: 1, product: PRESET_PRODUCTS[0] }])}
                                            className="w-full py-2 border border-dashed border-white/20 rounded text-slate-400 text-xs hover:text-white hover:border-white/40"
                                        >
                                            + Lägg till intag
                                        </button>
                                    </div>
                                </div>
                            )}
                        </ConfigSection>

                        {/* Dropbags */}
                        <ConfigSection title="Dropbags" icon={<ShoppingBag size={18} />}>
                            <div className="space-y-2">
                                <p className="text-xs text-slate-400">Ange vid vilka KM du har dropbags:</p>
                                {dropbagKms.map((km, idx) => (
                                    <div key={idx} className="flex gap-2">
                                        <input
                                            type="number"
                                            value={km}
                                            onChange={e => {
                                                const newKms = [...dropbagKms];
                                                newKms[idx] = parseFloat(e.target.value);
                                                setDropbagKms(newKms);
                                            }}
                                            className="flex-1 bg-slate-800 border border-white/10 rounded p-2"
                                        />
                                        <button
                                            onClick={() => {
                                                const newKms = [...dropbagKms];
                                                newKms.splice(idx, 1);
                                                setDropbagKms(newKms);
                                            }}
                                            className="p-2 text-slate-500 hover:text-red-400"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                                <button
                                    onClick={() => setDropbagKms([...dropbagKms, 0])}
                                    className="text-emerald-400 text-xs font-bold hover:underline"
                                >
                                    + Lägg till dropbag
                                </button>
                            </div>
                        </ConfigSection>

                    </div>
                )}

                {/* --- TAB 2: DASHBOARD --- */}
                {activeTab === 'plan' && simResult && (
                    <div className="space-y-8 animate-fade-in">

                        {/* Summary Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                            {/* Editable Target Time */}
                            <div className="bg-slate-900 rounded-xl p-3 border border-emerald-500/30 flex flex-col justify-between">
                                <div className="text-slate-400 text-[10px] font-bold uppercase mb-1 flex items-center gap-1">
                                    <Clock size={12} /> Måltid
                                </div>
                                <div className="flex items-center justify-center bg-slate-950/50 rounded p-1 border border-white/5 mb-1">
                                    <input
                                        type="number"
                                        min={0}
                                        max={24}
                                        value={Math.floor(raceProfile.targetTimeSeconds / 3600)}
                                        onChange={(e) => {
                                            const h = parseInt(e.target.value) || 0;
                                            const m = Math.floor((raceProfile.targetTimeSeconds % 3600) / 60);
                                            setRaceProfile({ ...raceProfile, targetTimeSeconds: h * 3600 + m * 60 });
                                        }}
                                        className="w-7 bg-transparent text-lg font-black text-white text-center outline-none p-0 appearance-none"
                                    />
                                    <span className="text-slate-600 text-sm pb-1">:</span>
                                    <input
                                        type="number"
                                        min={0}
                                        max={59}
                                        value={Math.floor((raceProfile.targetTimeSeconds % 3600) / 60)}
                                        onChange={(e) => {
                                            const h = Math.floor(raceProfile.targetTimeSeconds / 3600);
                                            const m = parseInt(e.target.value) || 0;
                                            setRaceProfile({ ...raceProfile, targetTimeSeconds: h * 3600 + m * 60 });
                                        }}
                                        className="w-7 bg-transparent text-lg font-black text-white text-center outline-none p-0 appearance-none"
                                    />
                                </div>
                                <button
                                    onClick={runSimulation}
                                    className="text-[10px] text-emerald-400 hover:text-emerald-300 text-center w-full uppercase font-bold tracking-wider"
                                >
                                    ↻ Uppdatera
                                </button>
                            </div>

                            {/* Estimated Time */}
                            <div className="bg-slate-900 rounded-xl p-3 border border-white/5 flex flex-col justify-between">
                                <div className="text-slate-400 text-[10px] font-bold uppercase mb-1 flex items-center gap-1">
                                    <Activity size={12} /> Sluttid (Est)
                                </div>
                                <div className="text-xl font-black text-white">
                                    {formatTime(simResult.finishTime)}
                                </div>
                                <div className="text-[10px] text-slate-500">
                                    {formatTime(simResult.finishTime / raceProfile.distanceKm).substring(3, 8)}/km
                                </div>
                            </div>

                            {/* Bonk Prediction */}
                            <div className={`rounded-xl p-3 border flex flex-col justify-between ${simResult.crashTime ? 'bg-red-900/10 border-red-500/50' : 'bg-slate-900 border-white/5'}`}>
                                <div className="text-slate-400 text-[10px] font-bold uppercase mb-1 flex items-center gap-1">
                                    <AlertTriangle size={12} className={simResult.crashTime ? "text-red-500" : "text-slate-600"} />
                                    Väggen?
                                </div>
                                <div className={`text-xl font-black ${simResult.crashTime ? 'text-red-500' : 'text-emerald-500'}`}>
                                    {simResult.crashTime ? `${Math.floor(simResult.crashTime / 60)} min` : "Nej"}
                                </div>
                                <div className="text-[10px] text-slate-500">
                                    {simResult.crashTime ? `~${(simResult.crashTime / 60 / (simResult.finishTime / 60) * raceProfile.distanceKm).toFixed(1)} km` : "Energi räcker"}
                                </div>
                            </div>

                            {/* Hydration Status */}
                            {hydrationSummary && (
                                <div className={`rounded-xl p-3 border flex flex-col justify-between ${hydrationSummary.hydrationStatus === 'critical' ? 'bg-red-900/10 border-red-500/50' :
                                    hydrationSummary.hydrationStatus === 'warning' ? 'bg-amber-900/10 border-amber-500/50' : 'bg-slate-900 border-white/5'
                                    }`}>
                                    <div className="text-slate-400 text-[10px] font-bold uppercase mb-1 flex items-center gap-1">
                                        <Droplet size={12} /> Vätskebalans
                                    </div>
                                    <div className={`text-xl font-black ${hydrationSummary.hydrationStatus === 'critical' ? 'text-red-500' :
                                        hydrationSummary.hydrationStatus === 'warning' ? 'text-amber-400' : 'text-blue-400'
                                        }`}>
                                        -{hydrationSummary.netDeficitL}L
                                    </div>
                                    <div className="text-[10px] text-slate-500">
                                        {hydrationSummary.dehydrationPercent}% av BV
                                    </div>
                                </div>
                            )}

                            {/* Caffeine Peak */}
                            <div className="bg-slate-900 rounded-xl p-3 border border-white/5 flex flex-col justify-between">
                                <div className="text-slate-400 text-[10px] font-bold uppercase mb-1 flex items-center gap-1">
                                    <Coffee size={12} /> Koffein Peak
                                </div>
                                <div className="text-xl font-black text-amber-500">
                                    {simResult.peakCaffeineMg} mg
                                </div>
                                <div className="text-[10px] text-slate-500">
                                    Vid {Math.round(simResult.peakCaffeineTimeMin)} min
                                </div>
                            </div>
                        </div>



                        {/* Timeline Chart - ENHANCED */}
                        <div className="bg-slate-900 border border-white/5 rounded-2xl p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold flex items-center gap-2 text-sm"><Activity size={16} className="text-emerald-400" /> Lopp-Simulator</h3>
                                <div className="flex gap-4 text-[10px]">
                                    <span className="flex items-center gap-1"><span className="w-3 h-1 bg-emerald-500 rounded-full"></span> Glykogen</span>
                                    <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-500 border-dashed border-t border-transparent" style={{ borderTopStyle: 'dashed', borderWidth: '1px' }}></span> Vätska</span>
                                    <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-amber-500 border-dashed border-t border-transparent" style={{ borderTopStyle: 'dashed', borderWidth: '1px' }}></span> Koffein</span>
                                </div>
                            </div>
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={simResult.timeline}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                        <XAxis
                                            dataKey="distanceKm"
                                            stroke="#666"
                                            label={{ value: 'Km', position: 'insideBottomRight', offset: -5 }}
                                            tickFormatter={(val) => Math.round(val).toString()}
                                        />
                                        {/* Glycogen Y-Axis (left) */}
                                        <YAxis
                                            yAxisId="glyco"
                                            orientation="left"
                                            stroke="#eab308"
                                            domain={[0, 600]}
                                            label={{ value: 'Glykogen (g)', angle: -90, position: 'insideLeft' }}
                                        />
                                        {/* Hydration Y-Axis (right, hidden) */}
                                        <YAxis
                                            yAxisId="fluid"
                                            orientation="right"
                                            stroke="#3b82f6"
                                            domain={[-3, 1]}
                                            hide
                                        />
                                        {/* Caffeine Y-Axis (right) */}
                                        <YAxis
                                            yAxisId="caffeine"
                                            orientation="right"
                                            stroke="#f59e0b"
                                            domain={[0, 400]}
                                            label={{ value: 'Koffein (mg)', angle: 90, position: 'insideRight' }}
                                        />
                                        <RechartsTooltip
                                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#333' }}
                                            labelFormatter={(val) => `Distans: ${Math.round(val)} km`}
                                            formatter={(value: number, name: string) => {
                                                if (name.includes('Vätska')) return [`${value.toFixed(2)} L`, name];
                                                if (name.includes('Koffein')) return [`${Math.round(value)} mg`, name];
                                                return [`${Math.round(value)} g`, name];
                                            }}
                                        />
                                        <Legend />
                                        {/* Glycogen Line */}
                                        <Line
                                            yAxisId="glyco"
                                            type="monotone"
                                            dataKey="glycogenStoreG"
                                            stroke="#10b981"
                                            strokeWidth={3}
                                            dot={false}
                                            name="Glykogen (g)"
                                            activeDot={{ r: 4, stroke: '#fff', strokeWidth: 2 }}
                                            isAnimationActive={false}
                                            style={{ filter: 'drop-shadow(0px 0px 4px rgba(16, 185, 129, 0.5))' }}
                                        />
                                        {/* Fluid Balance Line */}
                                        <Line
                                            yAxisId="fluid"
                                            type="monotone"
                                            dataKey="fluidBalanceL"
                                            stroke="#3b82f6"
                                            strokeWidth={2}
                                            name="Vätska (L)"
                                            dot={false}
                                            strokeDasharray="4 4"
                                            isAnimationActive={false}
                                        />
                                        {/* Caffeine Line */}
                                        <Line
                                            yAxisId="caffeine"
                                            type="monotone"
                                            dataKey="caffeineMg"
                                            stroke="#f59e0b"
                                            strokeWidth={2}
                                            name="Koffein (mg)"
                                            dot={false}
                                            strokeDasharray="4 4"
                                            isAnimationActive={false}
                                        />
                                        {/* Zero reference for glycogen */}
                                        <ReferenceLine y={0} yAxisId="glyco" stroke="red" strokeDasharray="3 3" />
                                        {/* Warning level for dehydration */}
                                        <ReferenceLine y={-1.5} yAxisId="fluid" stroke="#f59e0b" strokeDasharray="3 3" label={{ value: '-2% BW', fill: '#f59e0b', fontSize: 10 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Pre/Post & Advice */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-slate-900 border border-white/5 rounded-2xl p-4 flex flex-col">
                                <h4 className="font-bold text-emerald-400 mb-3 flex items-center gap-2 text-xs uppercase tracking-wider">
                                    <Clock size={14} /> Före Loppet
                                </h4>
                                <ul className="space-y-3 text-xs text-slate-300 flex-1">
                                    <li className="flex gap-2 items-start">
                                        <span className="text-emerald-500 font-bold">✓</span>
                                        <span><b>Carbo-load:</b> Ät extra kolhydrater (8-10g/kg) dagen innan.</span>
                                    </li>
                                    <li className="flex gap-2 items-start">
                                        <span className="text-emerald-500 font-bold">✓</span>
                                        <span><b>Frukost:</b> Lättsmält frukost 3-4h innan start.</span>
                                    </li>
                                    {includePreRaceCaffeine ? (
                                        <li className="flex gap-2 items-start">
                                            <span className="text-emerald-500 font-bold">✓</span>
                                            <span><b>Koffein:</b> Inta {CAFFEINE_PRESETS.find(p => p.id === caffeinePreset)?.preRaceMg}mg koffein 30-45 min innan start.</span>
                                        </li>
                                    ) : (
                                        <li className="flex gap-2 items-start">
                                            <span className="text-slate-600 font-bold">-</span>
                                            <span className="text-slate-500">Inget koffein innan start valt.</span>
                                        </li>
                                    )}
                                    <li className="flex gap-2 items-start">
                                        <span className="text-emerald-500 font-bold">✓</span>
                                        <span><b>Hydrering:</b> Drick 500ml vatten 2h innan start.</span>
                                    </li>
                                </ul>
                            </div>
                            <div className="bg-slate-900 border border-white/5 rounded-2xl p-4 flex flex-col">
                                <h4 className="font-bold text-blue-400 mb-3 flex items-center gap-2 text-xs uppercase tracking-wider">
                                    <Sparkles size={14} /> Efter Målgång
                                </h4>
                                <ul className="space-y-3 text-xs text-slate-300 flex-1">
                                    <li className="flex gap-2 items-start">
                                        <span className="text-blue-500 font-bold">✓</span>
                                        <span><b>Refill:</b> 1g kolhydrater/kg kroppsvikt direkt efter mål.</span>
                                    </li>
                                    <li className="flex gap-2 items-start">
                                        <span className="text-blue-500 font-bold">✓</span>
                                        <span><b>Protein:</b> Få i dig 20-30g protein för muskelreparation.</span>
                                    </li>
                                    {hydrationSummary && hydrationSummary.netDeficitL > 0.5 && (
                                        <li className="flex gap-2 items-start">
                                            <span className="text-blue-500 font-bold">✓</span>
                                            <span><b>Vätska:</b> Drick ca {(hydrationSummary.netDeficitL * 1.5).toFixed(1)}L vätska under em/kvällen.</span>
                                        </li>
                                    )}
                                </ul>
                            </div>
                        </div>

                        {/* Split Table */}
                        <div className="bg-slate-900 border border-white/5 rounded-2xl overflow-hidden mt-6">
                            <div className="p-3 border-b border-white/5 font-bold flex justify-between items-center bg-slate-950/30">
                                <span className="text-sm">Splits & Action Plan</span>
                                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Schema</span>
                            </div>
                            <div className="overflow-x-auto max-h-[400px] custom-scrollbar">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-950 text-slate-500 uppercase font-bold text-[10px] sticky top-0 z-10 border-b border-white/10">
                                        <tr>
                                            <th className="px-3 py-2 w-16">Km</th>
                                            <th className="px-3 py-2 w-20">Tid</th>
                                            <th className="px-3 py-2 w-20">Tempo</th>
                                            <th className="px-3 py-2">Energi & Vätska</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5 text-[11px]">
                                        {splits.map((split, i) => {
                                            const exactActions = intakeEvents.filter(e => Math.abs(e.distanceKm - split.km) < 0.5);
                                            // Show every 5km OR if there is an action
                                            if (split.km % 5 !== 0 && exactActions.length === 0 && split.km !== Math.ceil(raceProfile.distanceKm)) return null;

                                            const isActionRow = exactActions.length > 0;

                                            return (
                                                <tr key={i} className={`hover:bg-white/5 transition-colors ${isActionRow ? 'bg-emerald-900/5' : ''}`}>
                                                    <td className="px-3 py-1.5 font-mono text-slate-400 border-r border-white/5">{split.km}</td>
                                                    <td className="px-3 py-1.5 font-mono text-slate-300">{formatTime(split.cumulativeSeconds)}</td>
                                                    <td className="px-3 py-1.5 font-mono text-emerald-500">{split.paceMinKm}</td>
                                                    <td className="px-3 py-1.5">
                                                        {exactActions.map((a, ai) => (
                                                            <div key={ai} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 text-[10px] mr-2 shadow-sm">
                                                                {a.product?.type === 'liquid' ? <Droplet size={8} className="text-blue-400" /> : <Zap size={8} className="text-amber-400" />}
                                                                <span className="font-bold text-white">{a.amount}x</span> {a.product?.name}
                                                            </div>
                                                        ))}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                    </div>
                )}

                {/* --- TAB 3: LOGISTICS --- */}
                {activeTab === 'logistics' && (
                    <div className="grid md:grid-cols-2 gap-8 animate-fade-in">
                        {/* Packing List */}
                        <div className="bg-slate-900 border border-white/5 rounded-2xl p-6 space-y-6">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <ShoppingBag className="text-emerald-400" />
                                Packlista
                            </h2>

                            <div className="space-y-6">
                                {logistics.map((leg, i) => (
                                    <div key={i} className="bg-slate-950 rounded-xl p-4 border border-white/5">
                                        <div className="font-bold text-slate-300 mb-3 border-b border-white/5 pb-2">
                                            {leg.location}
                                        </div>
                                        <ul className="space-y-2">
                                            {Object.entries(leg.items).map(([name, count]: any) => (
                                                <li key={name} className="flex justify-between text-sm">
                                                    <span>{name}</span>
                                                    <span className="font-mono font-bold text-emerald-400">x{count}</span>
                                                </li>
                                            ))}
                                            {Object.keys(leg.items).length === 0 && (
                                                <li className="text-slate-600 text-xs italic">Ingenting att hämta här.</li>
                                            )}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Equipment & Coach */}
                        <div className="space-y-6">
                            <div className="bg-slate-900 border border-white/5 rounded-2xl p-6">
                                <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
                                    <Battery className="text-emerald-400" />
                                    Utrustningskoll
                                </h2>
                                <ul className="space-y-3 text-sm text-slate-300">
                                    {/* Headlamp Logic */}
                                    {(() => {
                                        const finishDate = new Date(`${raceProfile.date}T${raceProfile.startTime}`);
                                        finishDate.setSeconds(finishDate.getSeconds() + (simResult?.finishTime || 0));
                                        const sunsetDate = new Date(`${raceProfile.date}T${environment.sunsetTime}`);

                                        if (finishDate > sunsetDate) {
                                            return (
                                                <li className="flex items-start gap-3 text-amber-300">
                                                    <div className="mt-1 w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                                                    <div>
                                                        <strong>Pannlampa krävs!</strong><br />
                                                        Du går i mål ca {finishDate.toTimeString().substring(0, 5)}, vilket är efter solnedgång ({environment.sunsetTime}).
                                                    </div>
                                                </li>
                                            );
                                        }
                                        return null;
                                    })()}

                                    {/* Weather Gear */}
                                    {environment.temperatureC < 5 && (
                                        <li className="flex items-start gap-3">
                                            <div className="mt-1 w-2 h-2 rounded-full bg-blue-400" />
                                            <span>Kallt väder ({environment.temperatureC}°C). Ta med handskar och buff.</span>
                                        </li>
                                    )}
                                    {environment.temperatureC > 20 && (
                                        <li className="flex items-start gap-3">
                                            <div className="mt-1 w-2 h-2 rounded-full bg-red-400" />
                                            <span>Varmt väder! Is-bandana eller keps rekommenderas.</span>
                                        </li>
                                    )}
                                </ul>
                            </div>

                            {/* Saved Plans */}
                            <div className="bg-slate-900 border border-white/5 rounded-2xl p-6">
                                <h2 className="text-xl font-bold mb-4">Sparade Planer</h2>
                                <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                                    {savedPlans.map(p => (
                                        <div key={p.id} className="flex items-center justify-between p-3 bg-slate-950 rounded hover:bg-slate-800 transition-colors cursor-pointer"
                                            onClick={() => {
                                                setRaceProfile(p.raceProfile);
                                                setRunnerProfile(p.runnerProfile);
                                                setEnvironment(p.environment);
                                                setIntakeEvents(p.intakeEvents);
                                                setDropbagKms(p.dropbagKms);
                                                setSelectedPlanId(p.id);
                                                setActiveTab('config');
                                            }}
                                        >
                                            <div>
                                                <div className="font-bold text-sm">{p.name}</div>
                                                <div className="text-xs text-slate-500">{new Date(p.updatedAt).toLocaleDateString()}</div>
                                            </div>
                                            {selectedPlanId === p.id && <div className="text-emerald-400 text-xs">Aktiv</div>}
                                        </div>
                                    ))}
                                    {savedPlans.length === 0 && <div className="text-slate-500 text-sm">Inga sparade planer.</div>}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
