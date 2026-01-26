import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DailyIntakeCard } from '../features/dashboard/components/DailyIntakeCard.tsx';
import { HealthMetricsCard } from '../features/dashboard/components/HealthMetricsCard.tsx';
import { calculateAverage1RM } from '../utils/strengthCalculators.ts';
import { ChevronRight, Dumbbell, TrendingUp, Utensils, Zap, Lock, BarChart3, Calculator, Trophy } from 'lucide-react';

export function LandingPage() {
    const navigate = useNavigate();

    // -- Dummy Data for Components --
    const dummyIntakeProps = {
        isDone: false,
        onToggle: () => navigate('/login'),
        density: 'cozy',
        selectedDate: new Date().toISOString().split('T')[0],
        consumed: 2150,
        target: 2500,
        proteinCurrent: 165,
        proteinTarget: 180,
        carbsCurrent: 220,
        carbsTarget: 280,
        fatCurrent: 65,
        fatTarget: 80,
        burned: 450,
        baseTarget: 2500,
        trainingGoal: 'balance',
        latestWeightVal: 82.5,
        proteinRatio: 2.0,
        targetProteinRatio: 2.2,
        onHoverTraining: () => { }
    };

    const dummyHealthProps = {
        density: 'cozy',
        latestWeightVal: 82.5,
        latestWaist: 88,
        latestChest: 105,
        bmi: 24.5,
        weightDiffRange: -1.2,
        weightRange: '30d' as const,
        setWeightRange: () => { },
        weightTrendEntries: Array.from({ length: 30 }, (_, i) => ({
            date: new Date(Date.now() - (29 - i) * 86400000).toISOString(),
            weight: 84 - (i * 0.05) + (Math.random() * 0.4 - 0.2),
            waist: 89 - (i * 0.03),
            chest: 104 + (i * 0.03)
        })),
        unifiedHistory: [],
        onOpenWeightModal: () => navigate('/login')
    };

    return (
        <div className="min-h-screen bg-slate-900 text-white selection:bg-emerald-500/30">
            {/* Navbar */}
            <nav className="fixed top-0 w-full z-50 backdrop-blur-md bg-slate-900/80 border-b border-white/5">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                            <Zap size={20} className="text-white fill-white" />
                        </div>
                        <span className="text-2xl font-black tracking-tighter text-white">GREENS</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <Link to="/login" className="px-5 py-2.5 text-sm font-bold text-slate-300 hover:text-white transition-colors">Logga in</Link>
                        <Link to="/register" className="px-6 py-2.5 bg-white text-slate-900 text-sm font-black rounded-xl hover:bg-emerald-400 transition-all transform hover:-translate-y-0.5 shadow-xl shadow-white/5">
                            Bli medlem
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <header className="relative pt-40 pb-20 px-6 overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-emerald-500/20 via-slate-900/0 to-slate-900/0 pointer-events-none" />
                <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center relative z-10">
                    <div className="space-y-8">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-bold uppercase tracking-widest text-emerald-400">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            Greens 3.0 är här
                        </div>
                        <h1 className="text-5xl lg:text-7xl font-black tracking-tighter leading-[0.9]">
                            Optimera din <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">fysik & hälsa</span>
                        </h1>
                        <p className="text-xl text-slate-400 font-medium leading-relaxed max-w-lg">
                            Det kompletta verktyget för dig som tar din träning och kost på allvar.
                            Avancerad statistik, smart planering och kraftfulla verktyg.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <Link to="/register" className="px-8 py-4 bg-emerald-500 text-white font-black rounded-2xl hover:bg-emerald-400 transition-all transform hover:-translate-y-1 shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2">
                                Gå med nu <ChevronRight size={18} />
                            </Link>
                            <Link to="/login" className="px-8 py-4 bg-slate-800 text-white font-bold rounded-2xl hover:bg-slate-700 border border-white/5 transition-all flex items-center justify-center">
                                Logga in
                            </Link>
                        </div>

                        <div className="pt-8 flex items-center gap-8 text-slate-500">
                            <div className="flex items-center gap-2">
                                <CheckCircle /> <span className="text-sm font-bold">Gratis konto</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <CheckCircle /> <span className="text-sm font-bold">Inga dolda avgifter</span>
                            </div>
                        </div>
                    </div>

                    {/* Hero Visuals - Floating Modules */}
                    <div className="relative hidden lg:block perspective-1000">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/20 blur-[100px] rounded-full pointer-events-none" />

                        {/* Fake Dashboard Grid */}
                        <div className="grid grid-cols-2 gap-6 rotate-y-12 rotate-x-6 transform-gpu transition-transform hover:rotate-0 duration-700 ease-out">
                            {/* Card 1: Nutrition */}
                            <div className="col-span-2 bg-slate-800/80 backdrop-blur-xl border border-white/10 rounded-3xl p-2 shadow-2xl">
                                <div className="pointer-events-none opacity-90 scale-[0.98]">
                                    <DailyIntakeCard {...dummyIntakeProps} />
                                </div>
                            </div>

                            {/* Card 2: Stats */}
                            <div className="col-span-1 bg-slate-800/80 backdrop-blur-xl border border-white/10 rounded-3xl p-2 shadow-2xl h-64 overflow-hidden relative">
                                <div className="pointer-events-none opacity-90 scale-[0.6] origin-top-left w-[160%] h-[160%]">
                                    <HealthMetricsCard {...dummyHealthProps} />
                                </div>
                            </div>

                             {/* Card 3: Feature Highlight */}
                             <div className="col-span-1 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl p-6 shadow-2xl flex flex-col justify-between text-white relative overflow-hidden">
                                <Dumbbell size={100} className="absolute -bottom-4 -right-4 text-white/20 rotate-[-15deg]" />
                                <div>
                                    <h3 className="text-lg font-black uppercase mb-1">Beast Mode</h3>
                                    <p className="text-xs font-bold opacity-80">Gamifiera din träning</p>
                                </div>
                                <div className="text-4xl font-black">94<span className="text-lg opacity-60">/100</span></div>
                             </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Features Grid */}
            <section className="py-32 px-6 bg-slate-900 relative">
                 <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-24">
                        <h2 className="text-3xl md:text-5xl font-black tracking-tighter mb-6">Allt du behöver på ett ställe</h2>
                        <p className="text-slate-400 max-w-2xl mx-auto text-lg">
                            Sluta hoppa mellan olika appar. Greens samlar din kost, din träning och din hälsodata i ett enda kraftfullt ekosystem.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        <FeatureCard
                            icon={<Utensils size={32} className="text-emerald-400" />}
                            title="Kost & Makros"
                            desc="Detaljerad spårning av kalorier och makrofördelning. Anpassa efter dina mål, vare sig det är deff, bulk eller balans."
                        />
                        <FeatureCard
                            icon={<BarChart3 size={32} className="text-blue-400" />}
                            title="Avancerad Analys"
                            desc="Se trender över tid. Viktkurvor, kroppsmått och styrkeutveckling visualiserat på ett sätt du förstår."
                        />
                         <FeatureCard
                            icon={<Trophy size={32} className="text-amber-400" />}
                            title="Tävlingar & Community"
                            desc="Utmana dina vänner i stegtävlingar eller styrkelyft. Klättra på topplistorna och nå nya nivåer."
                        />
                    </div>
                 </div>
            </section>

            {/* Live Tool Section */}
            <section className="py-32 px-6 bg-slate-800/50 border-y border-white/5">
                <div className="max-w-4xl mx-auto">
                     <div className="grid md:grid-cols-2 gap-16 items-center">
                        <div>
                             <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold uppercase tracking-widest text-emerald-400 mb-6">
                                <Calculator size={12} /> Live Verktyg
                            </div>
                            <h2 className="text-4xl font-black tracking-tighter mb-6">Beräkna ditt max</h2>
                            <p className="text-slate-400 text-lg mb-8">
                                Osäker på vad du klarar i bänkpress? Använd vår 1RM-kalkylator som använder en genomsnittsberäkning av 7 olika formler för maximal precision.
                            </p>
                            <ul className="space-y-4">
                                <li className="flex items-center gap-3 text-sm font-bold text-slate-300">
                                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">1</div>
                                    Ange vikten du lyft
                                </li>
                                <li className="flex items-center gap-3 text-sm font-bold text-slate-300">
                                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">2</div>
                                    Ange antal repetitioner
                                </li>
                                <li className="flex items-center gap-3 text-sm font-bold text-slate-300">
                                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">3</div>
                                    Få ditt uppskattade maxlyft direkt
                                </li>
                            </ul>
                        </div>

                        <div className="bg-slate-900 rounded-3xl p-8 border border-white/10 shadow-2xl">
                           <OneRepMaxTool />
                        </div>
                     </div>
                </div>
            </section>

             {/* CTA Footer */}
             <section className="py-32 px-6 text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-slate-900 to-emerald-950/20 pointer-events-none" />
                <div className="relative z-10 max-w-2xl mx-auto">
                    <h2 className="text-4xl md:text-6xl font-black tracking-tighter mb-8">Redo att börja?</h2>
                    <p className="text-slate-400 text-xl mb-10">Skapa ett konto helt gratis och börja din resa mot en starkare version av dig själv.</p>
                    <Link to="/register" className="inline-flex px-12 py-5 bg-white text-slate-900 font-black text-lg rounded-2xl hover:bg-emerald-400 hover:scale-105 transition-all shadow-xl shadow-white/5">
                        Skapa konto nu
                    </Link>
                    <p className="mt-8 text-sm font-bold text-slate-500">
                        Redan medlem? <Link to="/login" className="text-emerald-400 hover:underline">Logga in här</Link>
                    </p>
                </div>
             </section>

             <footer className="py-12 border-t border-white/5 text-center text-slate-600 text-sm font-bold">
                <p>&copy; {new Date().getFullYear()} Greens. Alla rättigheter reserverade.</p>
             </footer>
        </div>
    );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
    return (
        <div className="p-8 rounded-3xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group">
            <div className="w-14 h-14 rounded-2xl bg-slate-900 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform border border-white/5">
                {icon}
            </div>
            <h3 className="text-xl font-black mb-3">{title}</h3>
            <p className="text-slate-400 leading-relaxed font-medium">
                {desc}
            </p>
        </div>
    );
}

function CheckCircle() {
    return (
        <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <svg className="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
        </div>
    );
}

function OneRepMaxTool() {
    const [weight, setWeight] = useState<string>('100');
    const [reps, setReps] = useState<string>('5');

    const w = parseFloat(weight) || 0;
    const r = parseFloat(reps) || 0;

    const result = (w > 0 && r > 0) ? calculateAverage1RM(w, r).average : 0;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-black uppercase text-white">1RM Kalkylator</h3>
                <TrendingUp size={20} className="text-emerald-500" />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label htmlFor="rm-weight" className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Vikt (kg)</label>
                    <input
                        id="rm-weight"
                        type="number"
                        value={weight}
                        onChange={e => setWeight(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                </div>
                <div>
                    <label htmlFor="rm-reps" className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Reps</label>
                    <input
                        id="rm-reps"
                        type="number"
                        value={reps}
                        onChange={e => setReps(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                </div>
            </div>

            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6 text-center">
                <div className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-1">Uppskattat 1RM</div>
                <div className="text-5xl font-black text-white tracking-tighter">
                    {result} <span className="text-2xl text-emerald-500/50">kg</span>
                </div>
            </div>

            <p className="text-[10px] text-slate-500 text-center leading-relaxed">
                Baserat på ett genomsnitt av 7 erkända formler (Epley, Brzycki, m.fl.) för högsta möjliga noggrannhet.
            </p>

            {!result && (
                <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center rounded-3xl">
                   <Lock className="text-slate-500 mb-2" />
                </div>
            )}
        </div>
    );
}
