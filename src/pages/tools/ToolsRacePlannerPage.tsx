import React, { useState, useEffect } from 'react';
import {
    RaceProfile,
    RunnerProfile,
    IntakeEvent,
    PacingStrategy,
    NutritionStrategy,
    simulateRace,
    calculateWeatherPenaltyFactor,
    generateSplits,
    calculateDropbagLogistics,
    generateNutritionPlan,
    NutritionProduct,
    SWEAT_RATES,
    SweatProfile
} from '../../utils/racePlannerCalculators.ts';
import { useAuth } from '../../context/AuthContext';
import { ArrowLeft, Play, Save, Trash2, Battery, Droplet, Thermometer, ShoppingBag, Clock, AlertTriangle, ChevronDown, ChevronUp, Zap, Scale } from 'lucide-react';
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

function ConfigSection({ title, icon, children }: { title: string, icon: any, children: React.ReactNode }) {
    return (
        <div className="bg-slate-900 border border-white/5 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-emerald-400 border-b border-white/5 pb-2 mb-2">
                {icon}
                <h3 className="font-bold uppercase tracking-wider text-sm">{title}</h3>
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
        sweatProfile: 'medium',
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

    const [nutritionStrategy, setNutritionStrategy] = useState<NutritionStrategy>({
        carbsPerHour: 60,
        drinkRatio: 0.3, // 30% drink, 70% gel
        useCaffeine: false
    });

    // Logistics
    const [dropbagKms, setDropbagKms] = useState<number[]>([]);
    const [intakeEvents, setIntakeEvents] = useState<IntakeEvent[]>([]);

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
    const [paceTuning, setPaceTuning] = useState(1.0);
    const [warnings, setWarnings] = useState<string[]>([]);

    // --- Effects ---

    useEffect(() => {
        loadPlans();
    }, [token]);

    // Auto-generate nutrition when strategy changes (debounce slightly or just effect?)
    // To avoid overwriting manual changes, we should maybe have a "Sync" flag or button?
    // Let's make it auto-update IF the intakeEvents seem to be "generated" or empty.
    // Simpler: Just regenerate whenever Strategy OR Distance OR Time changes.
    // User can manually edit AFTER, but if they change strategy again, it resets.
    useEffect(() => {
        const events = generateNutritionPlan(raceProfile.distanceKm, raceProfile.targetTimeSeconds, nutritionStrategy);
        setIntakeEvents(events);
    }, [raceProfile.distanceKm, raceProfile.targetTimeSeconds, nutritionStrategy]);

    // Recalculate simulation whenever inputs change
    useEffect(() => {
        runSimulation();
    }, [raceProfile, runnerProfile, environment, pacingStrategy, dropbagKms, intakeEvents, paceTuning]);

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
            nutritionStrategy,
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

        // 2. Sim
        const res = simulateRace(raceProfile, runnerProfile, intakeEvents, 500, penalty, paceTuning);
        setSimResult(res);

        // 3. Splits
        const adjustedTargetSeconds = raceProfile.targetTimeSeconds * penalty * paceTuning;
        const s = generateSplits(raceProfile.distanceKm, adjustedTargetSeconds, pacingStrategy.type as any);
        setSplits(s);

        // 4. Logistics
        const l = calculateDropbagLogistics(intakeEvents, dropbagKms);
        setLogistics(l);

        // 5. Warnings
        const newWarnings = [];
        if (penalty > 1.05) newWarnings.push(`Varning: Vädret beräknas sänka din prestation med ${Math.round((penalty-1)*100)}%. Sänk tempot!`);
        if (res.crashTime !== null) newWarnings.push(`CRASH WARNING: Glykogendepåerna tar slut vid ${Math.floor(res.crashTime/60)} minuter!`);
        if (res.finalWeightLossKg > (runnerProfile.weightKg * 0.02)) newWarnings.push(`Varning: Vätskeförlust > 2% av kroppsvikt (${res.finalWeightLossKg}kg). Risk för sänkt prestation.`);

        setWarnings(newWarnings);
    };

    // --- Helpers ---

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
                                Race Commander 2.0
                            </h1>
                            <p className="text-xs text-slate-400">Optimization Engine</p>
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
                                {isSaving ? 'Sparar...' : 'Spara'}
                            </button>
                        )}
                    </div>
                </div>

                {/* Tabs */}
                <div className="max-w-7xl mx-auto px-4 flex gap-6 text-sm border-t border-white/5 mt-2 pt-1 overflow-x-auto">
                    {[
                        { id: 'config', label: '1. Konfiguration' },
                        { id: 'plan', label: '2. Dashboard' },
                        { id: 'logistics', label: '3. Logistik' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`pb-3 border-b-2 transition-colors whitespace-nowrap ${
                                activeTab === tab.id
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
                                    onChange={e => setRaceProfile({...raceProfile, distanceKm: parseFloat(e.target.value)})}
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
                                        onChange={e => setRaceProfile({...raceProfile, distanceKm: parseFloat(e.target.value)})}
                                    />
                                )}
                            </InputGroup>

                            <InputGroup label="Måltid (HH:MM:SS)">
                                <input
                                    type="text"
                                    className="w-full bg-slate-800 border border-white/10 rounded-lg p-2.5 text-white"
                                    placeholder="04:00:00"
                                    key={raceProfile.targetTimeSeconds}
                                    defaultValue={formatTime(raceProfile.targetTimeSeconds)}
                                    onBlur={e => {
                                        let val = e.target.value;
                                        const parts = val.split(':').map(Number);
                                        let secs = 0;
                                        if (parts.length === 3) {
                                            secs = parts[0]*3600 + parts[1]*60 + parts[2];
                                        } else if (parts.length === 2) {
                                            secs = parts[0]*3600 + parts[1]*60;
                                        } else if (parts.length === 1) {
                                            secs = parts[0] * 60;
                                        }
                                        if (secs > 0) {
                                            setRaceProfile({...raceProfile, targetTimeSeconds: secs});
                                        }
                                    }}
                                />
                            </InputGroup>

                            <InputGroup label="Starttid">
                                <input
                                    type="time"
                                    className="w-full bg-slate-800 border border-white/10 rounded-lg p-2.5 text-white"
                                    value={raceProfile.startTime}
                                    onChange={e => setRaceProfile({...raceProfile, startTime: e.target.value})}
                                />
                            </InputGroup>
                        </ConfigSection>

                        {/* Runner Data */}
                        <ConfigSection title="Löpare & Miljö" icon={<Battery size={18} />}>
                            <div className="grid grid-cols-2 gap-4">
                                <InputGroup label="Vikt (kg)" suffix="kg">
                                    <input
                                        type="number"
                                        className="w-full bg-slate-800 border border-white/10 rounded-lg p-2.5 text-white"
                                        value={runnerProfile.weightKg}
                                        onChange={e => setRunnerProfile({...runnerProfile, weightKg: parseFloat(e.target.value)})}
                                    />
                                </InputGroup>
                                <InputGroup label="Svettprofil">
                                    <select
                                        className="w-full bg-slate-800 border border-white/10 rounded-lg p-2.5 text-white text-sm"
                                        value={runnerProfile.sweatProfile}
                                        onChange={e => setRunnerProfile({...runnerProfile, sweatProfile: e.target.value as any})}
                                    >
                                        <option value="low">Låg (0.8 L/h)</option>
                                        <option value="medium">Medel (1.2 L/h)</option>
                                        <option value="high">Hög (1.8 L/h)</option>
                                        <option value="custom">Anpassad</option>
                                    </select>
                                    {runnerProfile.sweatProfile === 'custom' && (
                                        <input
                                            type="number"
                                            step="0.1"
                                            placeholder="L/h"
                                            className="mt-2 w-full bg-slate-800 border border-white/10 rounded-lg p-2.5 text-white text-sm"
                                            value={runnerProfile.customSweatRateLh || ''}
                                            onChange={e => setRunnerProfile({...runnerProfile, customSweatRateLh: parseFloat(e.target.value)})}
                                        />
                                    )}
                                </InputGroup>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5 mt-2">
                                <InputGroup label="Temp" suffix="°C">
                                    <input
                                        type="number"
                                        className="w-full bg-slate-800 border border-white/10 rounded-lg p-2.5 text-white"
                                        value={environment.temperatureC}
                                        onChange={e => setEnvironment({...environment, temperatureC: parseFloat(e.target.value)})}
                                    />
                                </InputGroup>
                                <InputGroup label="Fuktighet" suffix="%">
                                    <input
                                        type="number"
                                        className="w-full bg-slate-800 border border-white/10 rounded-lg p-2.5 text-white"
                                        value={environment.humidityPercent}
                                        onChange={e => setEnvironment({...environment, humidityPercent: parseFloat(e.target.value)})}
                                    />
                                </InputGroup>
                            </div>
                        </ConfigSection>

                        {/* Nutrition Strategy */}
                        <ConfigSection title="Nutrition Strategi" icon={<Zap size={18} />}>
                            {/* Carbs Per Hour */}
                            <InputGroup label={`Energi: ${nutritionStrategy.carbsPerHour}g / timme`}>
                                <input
                                    type="range"
                                    min="20" max="120" step="10"
                                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                    value={nutritionStrategy.carbsPerHour}
                                    onChange={e => setNutritionStrategy({...nutritionStrategy, carbsPerHour: parseInt(e.target.value)})}
                                />
                                <div className="flex justify-between text-xs text-slate-500 mt-1">
                                    <span>20g</span>
                                    <span>60g</span>
                                    <span>90g</span>
                                    <span>120g</span>
                                </div>
                            </InputGroup>

                            {/* Drink Ratio */}
                            <InputGroup label={`Källa: ${(1-nutritionStrategy.drinkRatio)*100}% Gel / ${nutritionStrategy.drinkRatio*100}% Sportdryck`}>
                                <input
                                    type="range"
                                    min="0" max="1" step="0.1"
                                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                    value={nutritionStrategy.drinkRatio}
                                    onChange={e => setNutritionStrategy({...nutritionStrategy, drinkRatio: parseFloat(e.target.value)})}
                                />
                                <div className="flex justify-between text-xs text-slate-500 mt-1">
                                    <span>Bara Gels</span>
                                    <span>50/50</span>
                                    <span>Bara Dryck</span>
                                </div>
                            </InputGroup>

                            {/* Caffeine */}
                            <div className="flex items-center justify-between bg-slate-800 p-3 rounded-lg border border-white/5">
                                <div className="flex items-center gap-2">
                                    <Battery className="text-amber-400" size={16} />
                                    <span className="text-sm font-bold">Optimera Koffein</span>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={nutritionStrategy.useCaffeine}
                                    onChange={e => setNutritionStrategy({...nutritionStrategy, useCaffeine: e.target.checked})}
                                    className="w-5 h-5 rounded border-gray-600 text-emerald-500 focus:ring-emerald-500"
                                />
                            </div>

                            <div className="text-xs text-slate-500 mt-2">
                                * Planen genereras automatiskt. Du kan justera individuella händelser under Logistik om det behövs.
                            </div>
                        </ConfigSection>

                        {/* Dropbags */}
                        <ConfigSection title="Dropbags" icon={<ShoppingBag size={18} />}>
                            <div className="space-y-2">
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

                        {/* Tuning Controls */}
                        <div className="bg-slate-900 border border-white/5 rounded-xl p-4 flex flex-col md:flex-row gap-6 items-center">
                            <div className="flex-1 w-full">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-sm font-bold text-emerald-400">Justera Tempo (Tuning)</span>
                                    <span className="text-sm font-mono">{Math.round((paceTuning-1)*100)}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="0.8" max="1.2" step="0.01"
                                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                                    value={paceTuning}
                                    onChange={e => setPaceTuning(parseFloat(e.target.value))}
                                />
                                <div className="flex justify-between text-xs text-slate-500 mt-1">
                                    <span>Snabbare (Risk)</span>
                                    <span>Normal</span>
                                    <span>Långsammare (Safe)</span>
                                </div>
                            </div>
                            <div className="text-center px-4 border-l border-white/10">
                                <div className="text-xs text-slate-400 uppercase">Est Sluttid</div>
                                <div className="text-2xl font-black">{formatTime(simResult.finishTime)}</div>
                            </div>
                        </div>

                        {/* Summary Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-slate-900 rounded-xl p-4 border border-white/5">
                                <div className="text-slate-400 text-xs font-bold uppercase mb-1">Crash Point</div>
                                <div className={`text-2xl font-black ${simResult.crashTime ? 'text-red-500' : 'text-emerald-500'}`}>
                                    {simResult.crashTime ? `${Math.round(simResult.crashTime/60)} min` : 'Aldrig'}
                                </div>
                                <div className="text-xs text-slate-500">Glykogen tar slut</div>
                            </div>
                            <div className="bg-slate-900 rounded-xl p-4 border border-white/5">
                                <div className="text-slate-400 text-xs font-bold uppercase mb-1">Vätskeförlust</div>
                                <div className="text-2xl font-black text-blue-400">
                                    {simResult.finalWeightLossKg}kg
                                </div>
                                <div className="text-xs text-slate-500">Estimerad viktnedgång</div>
                            </div>
                            <div className="bg-slate-900 rounded-xl p-4 border border-white/5">
                                <div className="text-slate-400 text-xs font-bold uppercase mb-1">Total Energi</div>
                                <div className="text-2xl font-black text-amber-400">
                                    {intakeEvents.reduce((acc, e) => acc + (e.product?.carbsG || 0) * e.amount, 0)}g
                                </div>
                                <div className="text-xs text-slate-500">{nutritionStrategy.carbsPerHour}g/h snitt</div>
                            </div>
                            <div className="bg-slate-900 rounded-xl p-4 border border-white/5">
                                <div className="text-slate-400 text-xs font-bold uppercase mb-1">Väderfaktor</div>
                                <div className="text-2xl font-black text-purple-400">
                                    {Math.round((weatherPenalty - 1) * 100)}%
                                </div>
                                <div className="text-xs text-slate-500">Tidspåslag</div>
                            </div>
                        </div>

                        {/* Timeline Chart */}
                        <div className="bg-slate-900 border border-white/5 rounded-2xl p-6 h-96">
                            <h3 className="font-bold text-lg mb-4">Body Battery & Hydration</h3>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={simResult.timeline}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                    <XAxis
                                        dataKey="distanceKm"
                                        stroke="#666"
                                        tickFormatter={(val) => Math.round(val).toString()}
                                    />
                                    <YAxis
                                        yAxisId="glyco"
                                        stroke="#eab308"
                                        label={{ value: 'Glykogen (g)', angle: -90, position: 'insideLeft' }}
                                    />
                                    <YAxis
                                        yAxisId="fluid"
                                        orientation="right"
                                        stroke="#3b82f6"
                                        label={{ value: 'Vätskebrist (L)', angle: 90, position: 'insideRight' }}
                                        reversed // Deficit grows down visually? Or up? Deficit is positive number in model.
                                    />
                                    <RechartsTooltip
                                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#333' }}
                                        labelFormatter={(val) => `Distans: ${Math.round(val)} km`}
                                    />
                                    <Legend />
                                    <Line
                                        yAxisId="glyco"
                                        type="monotone"
                                        dataKey="glycogenStoreG"
                                        stroke="#eab308"
                                        strokeWidth={2}
                                        name="Glykogen (g)"
                                        dot={false}
                                    />
                                    <Line
                                        yAxisId="fluid"
                                        type="monotone"
                                        dataKey="fluidDeficitL"
                                        stroke="#3b82f6"
                                        strokeWidth={2}
                                        name="Vätskebrist (L)"
                                        dot={false}
                                    />
                                    {nutritionStrategy.useCaffeine && (
                                         <Line
                                            yAxisId="glyco"
                                            type="monotone"
                                            dataKey="caffeineMg"
                                            stroke="#10b981"
                                            strokeDasharray="5 5"
                                            strokeWidth={1}
                                            name="Koffein (mg)"
                                            dot={false}
                                        />
                                    )}
                                    <ReferenceLine y={0} yAxisId="glyco" stroke="red" strokeDasharray="3 3" />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Split Table */}
                        <div className="bg-slate-900 border border-white/5 rounded-2xl overflow-hidden">
                            <div className="p-4 border-b border-white/5 font-bold">Splits & Action Plan</div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-950 text-slate-400 uppercase font-bold text-xs">
                                        <tr>
                                            <th className="px-4 py-3">Km</th>
                                            <th className="px-4 py-3">Tid</th>
                                            <th className="px-4 py-3">Tempo</th>
                                            <th className="px-4 py-3">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {splits.map((split, i) => {
                                            const exactActions = intakeEvents.filter(e => Math.abs(e.distanceKm - split.km) < 0.5);
                                            if (split.km % 5 !== 0 && exactActions.length === 0 && split.km !== Math.ceil(raceProfile.distanceKm)) return null;

                                            return (
                                                <tr key={i} className="hover:bg-white/5">
                                                    <td className="px-4 py-3 font-mono">{split.km}</td>
                                                    <td className="px-4 py-3 font-mono text-slate-300">{formatTime(split.cumulativeSeconds)}</td>
                                                    <td className="px-4 py-3 font-mono text-emerald-400">{split.paceMinKm}</td>
                                                    <td className="px-4 py-3">
                                                        {exactActions.map((a, ai) => (
                                                            <div key={ai} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 text-xs mr-2 mb-1 border border-white/10">
                                                                {a.type === 'drink' ? <Droplet size={10} className="text-blue-400"/> : <Zap size={10} className="text-amber-400"/>}
                                                                <span className={a.product?.caffeineMg ? 'text-emerald-400 font-bold' : 'text-slate-300'}>
                                                                    {a.product?.name}
                                                                </span>
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

                        {/* Manual Override */}
                        <div className="space-y-6">
                            <div className="bg-slate-900 border border-white/5 rounded-2xl p-6">
                                <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
                                    <Scale className="text-emerald-400" />
                                    Manuell Justering
                                </h2>
                                <p className="text-sm text-slate-400 mb-4">
                                    Om den genererade planen inte passar, kan du lägga till egna händelser här.
                                    OBS: Om du ändrar strategin under konfigurationen så skrivs dessa över.
                                </p>

                                <div className="max-h-96 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
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
                                        + Lägg till manuellt
                                    </button>
                                </div>
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
                                                if (p.nutritionStrategy) setNutritionStrategy(p.nutritionStrategy);
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
