import React, { useState, useMemo } from 'react';
import { 
    Brain, 
    Zap, 
    Target, 
    TrendingUp, 
    ScrollText, 
    Lightbulb, 
    Activity, 
    Dumbbell, 
    HeartPulse,
    ChevronRight,
    Search,
    Plus,
    Sparkles,
    Cpu,
    ArrowRight,
    Atom,
    Flame
} from 'lucide-react';
import { useData } from '../context/DataContext.tsx';
import { useSettings } from '../context/SettingsContext.tsx';
import { useHealth } from '../hooks/useHealth.ts';

interface Optimization {
    id: string;
    title: string;
    description: string;
    status: 'testing' | 'proven' | 'discarded';
    category: 'training' | 'nutrition' | 'recovery' | 'gear';
    impact: number; // 1-10
}

export function MethodologyPage() {
    const { settings } = useSettings();
    const { unifiedActivities } = useData();
    const health = useHealth();
    
    const [activeTab, setActiveTab] = useState<'principles' | 'optimizations' | 'protocols'>('principles');
    
    // Example data - in a real app this would be in the DB
    const [optimizations, setOptimizations] = useState<Optimization[]>([
        { id: '1', title: 'Nocco 15min innan tröskel', description: 'Förbättrar fokus och sänker RPE vid hög intensitet.', status: 'proven', category: 'nutrition', impact: 8 },
        { id: '2', title: 'ZMA + Magnesium innan sömn', description: 'Testar om det minskar benkramper efter långpass.', status: 'testing', category: 'recovery', impact: 6 },
        { id: '3', title: 'Barfota-intervaller på gräs', description: 'Stärker fotleden och förbättrar löpstegsekonomi.', status: 'testing', category: 'training', impact: 7 },
    ]);

    // "Generated" Insights based on data
    const insights = useMemo(() => {
        const runningActs = unifiedActivities.filter(a => a.type === 'running' && a.distance > 0);
        const avgPace = runningActs.reduce((acc, a) => acc + (a.durationMinutes / a.distance), 0) / runningActs.length;
        
        return {
            volumeResponder: runningActs.length > 3 ? 'Hög' : 'Låg',
            dominantZone: 'Z2 (Aerob Bas)',
            efficiencyScore: 84, // Arbitrary for demo
        };
    }, [unifiedActivities]);

    return (
        <div className="min-h-screen bg-[#020617] text-slate-100 p-4 md:p-8 animate-in fade-in duration-700">
            {/* Background Glows */}
            <div className="fixed top-0 left-1/4 w-[500px] h-[500px] bg-emerald-500/10 blur-[120px] pointer-events-none rounded-full" />
            <div className="fixed bottom-0 right-1/4 w-[600px] h-[600px] bg-indigo-500/10 blur-[150px] pointer-events-none rounded-full" />

            <div className="max-w-6xl mx-auto relative z-10">
                <header className="mb-12">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                            <Brain className="text-white" size={24} />
                        </div>
                        <div>
                            <h1 className="text-4xl font-black tracking-tight text-white uppercase">Min Metodik</h1>
                            <p className="text-slate-400 text-sm font-medium tracking-wide">Systemet bakom resultaten</p>
                        </div>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left Sidebar: Navigation & Identity */}
                    <div className="lg:col-span-4 space-y-6">
                        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-6 overflow-hidden relative">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <Cpu size={80} />
                            </div>
                            
                            <h2 className="text-xs font-black text-emerald-500 uppercase tracking-widest mb-6">Tränarprofil</h2>
                            
                            <div className="space-y-6">
                                <div className="flex items-center justify-between group cursor-pointer">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                                            <Zap size={20} />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-white">Volym-respons</div>
                                            <div className="text-[10px] text-slate-500 uppercase font-black">{insights.volumeResponder}</div>
                                        </div>
                                    </div>
                                    <ChevronRight size={16} className="text-slate-700" />
                                </div>

                                <div className="flex items-center justify-between group cursor-pointer">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                                            <Activity size={20} />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-white">Dominant System</div>
                                            <div className="text-[10px] text-slate-500 uppercase font-black">{insights.dominantZone}</div>
                                        </div>
                                    </div>
                                    <ChevronRight size={16} className="text-slate-700" />
                                </div>

                                <div className="flex items-center justify-between group cursor-pointer">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                                            <Atom size={20} />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-white">Effektivitet</div>
                                            <div className="text-[10px] text-slate-500 uppercase font-black">{insights.efficiencyScore}% Optimal</div>
                                        </div>
                                    </div>
                                    <ChevronRight size={16} className="text-slate-700" />
                                </div>
                            </div>

                            <div className="mt-8 pt-6 border-t border-white/5">
                                <button className="w-full py-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">
                                    Uppdatera Analys
                                </button>
                            </div>
                        </div>

                        {/* Navigation Tabs */}
                        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-2">
                            {(['principles', 'optimizations', 'protocols'] as const).map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`w-full flex items-center gap-4 px-4 py-4 rounded-3xl transition-all ${activeTab === tab ? 'bg-white/5 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${activeTab === tab ? 'bg-emerald-500 text-white' : 'bg-slate-800'}`}>
                                        {tab === 'principles' ? <Target size={16} /> : tab === 'optimizations' ? <Zap size={16} /> : <ScrollText size={16} />}
                                    </div>
                                    <span className="text-sm font-bold capitalize">{tab === 'principles' ? 'Principer' : tab === 'optimizations' ? 'Optimeringar' : 'Protokoll'}</span>
                                    {activeTab === tab && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="lg:col-span-8">
                        {activeTab === 'principles' && (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-900/20 border border-emerald-500/20 p-8 rounded-[2.5rem] relative overflow-hidden group">
                                        <div className="absolute -top-4 -right-4 text-emerald-500/10 group-hover:scale-110 transition-transform">
                                            <TrendingUp size={120} />
                                        </div>
                                        <h3 className="text-xl font-black text-white mb-2">Progressiv Överbelastning</h3>
                                        <p className="text-sm text-slate-400 leading-relaxed mb-6">Att aldrig stagnera. Varje vecka ska innehålla en liten ökning i antingen volym, intensitet eller teknisk svårighet.</p>
                                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-500">
                                            <span>Aktiv Princip</span>
                                            <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                                        </div>
                                    </div>

                                    <div className="bg-gradient-to-br from-indigo-500/10 to-indigo-900/20 border border-indigo-500/20 p-8 rounded-[2.5rem] relative overflow-hidden group">
                                        <div className="absolute -top-4 -right-4 text-indigo-500/10 group-hover:scale-110 transition-transform">
                                            <HeartPulse size={120} />
                                        </div>
                                        <h3 className="text-xl font-black text-white mb-2">Återhämtning är Träning</h3>
                                        <p className="text-sm text-slate-400 leading-relaxed mb-6">Om kroppen inte kan absorbera belastningen är träningen meningslös. Sömn och nutrition är 50% av resultatet.</p>
                                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-500">
                                            <span>Prioritet 1</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-slate-900/40 border border-white/5 p-8 rounded-[2.5rem]">
                                    <div className="flex items-center justify-between mb-8">
                                        <h3 className="text-lg font-black text-white uppercase tracking-tight">Kärnvärden</h3>
                                        <button className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors">
                                            <Plus size={20} />
                                        </button>
                                    </div>
                                    
                                    <div className="space-y-4">
                                        {[
                                            { title: 'Data-driven beslutsfattning', desc: 'Låt siffrorna guida planen, inte känslan ensam.' },
                                            { title: 'Konsistens över intensitet', desc: 'Ett mediokert pass är bättre än inget pass.' },
                                            { title: 'Specifitet', desc: 'Träna på det du vill bli bra på.' }
                                        ].map((item, i) => (
                                            <div key={i} className="flex gap-4 p-4 hover:bg-white/5 rounded-2xl transition-colors cursor-pointer group">
                                                <div className="text-emerald-500 font-black opacity-20 group-hover:opacity-100 transition-opacity">0{i+1}</div>
                                                <div>
                                                    <div className="font-bold text-white mb-1">{item.title}</div>
                                                    <div className="text-xs text-slate-500">{item.desc}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'optimizations' && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <Sparkles className="text-amber-500" size={20} />
                                        <h3 className="text-lg font-black text-white uppercase">Marginal Gains</h3>
                                    </div>
                                    <button className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-600 transition-all">
                                        <Plus size={16} /> Ny Test
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 gap-4">
                                    {optimizations.map(opt => (
                                        <div key={opt.id} className="bg-slate-900/50 border border-white/5 p-5 rounded-3xl hover:border-emerald-500/30 transition-all group">
                                            <div className="flex items-start justify-between">
                                                <div className="flex gap-4">
                                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                                                        opt.category === 'nutrition' ? 'bg-orange-500/10 text-orange-500' :
                                                        opt.category === 'recovery' ? 'bg-indigo-500/10 text-indigo-500' :
                                                        'bg-emerald-500/10 text-emerald-500'
                                                    }`}>
                                                        {opt.category === 'nutrition' ? <Flame size={20} /> : <Zap size={20} />}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-white mb-1 group-hover:text-emerald-400 transition-colors">{opt.title}</h4>
                                                        <p className="text-xs text-slate-500 leading-relaxed">{opt.description}</p>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-2">
                                                    <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg ${
                                                        opt.status === 'proven' ? 'bg-emerald-500/10 text-emerald-500' :
                                                        'bg-amber-500/10 text-amber-500'
                                                    }`}>
                                                        {opt.status === 'proven' ? 'Verifierad' : 'Testar'}
                                                    </span>
                                                    <div className="text-[10px] font-bold text-slate-600">Impact: <span className="text-white">{opt.impact}/10</span></div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-12 p-8 rounded-[2.5rem] bg-indigo-500/5 border border-indigo-500/10 text-center">
                                    <Cpu className="mx-auto text-indigo-400 mb-4 opacity-50" size={32} />
                                    <h4 className="text-white font-black uppercase mb-2">Automatiska Förslag</h4>
                                    <p className="text-xs text-slate-500 mb-6 max-w-sm mx-auto">Baserat på dina senaste 10 pass ser vi att du presterar 12% bättre när du vilar minst 48h mellan intervaller.</p>
                                    <button className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">
                                        Godkänn som Optimering
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'protocols' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {[
                                    { title: 'Pre-Race 24h', icon: Target, items: ['Ingen fiber', 'Hög hydration', '9h sömn'] },
                                    { title: 'Efter Långpass', icon: HeartPulse, items: ['Protein inom 30min', 'Kompressionskläder', 'Cold plunge'] },
                                    { title: 'Tävlingsmorgon', icon: Zap, items: ['Gröt 3h innan', 'Dynamisk rörlighet', 'Mental visualisering'] },
                                    { title: 'Sjukdom/Känning', icon: Activity, items: ['Vila direkt', 'Dubbel dos Zink', 'Inget socker'] },
                                ].map((protocol, i) => (
                                    <div key={i} className="bg-slate-900/50 border border-white/5 p-6 rounded-[2rem] hover:bg-slate-900/80 transition-all cursor-pointer group">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-white group-hover:bg-emerald-500 transition-colors">
                                                <protocol.icon size={18} />
                                            </div>
                                            <h4 className="font-bold text-white">{protocol.title}</h4>
                                        </div>
                                        <ul className="space-y-3">
                                            {protocol.items.map((item, j) => (
                                                <li key={j} className="flex items-center gap-2 text-xs text-slate-400">
                                                    <div className="w-1 h-1 rounded-full bg-emerald-500" />
                                                    {item}
                                                </li>
                                            ))}
                                        </ul>
                                        <button className="mt-6 w-full flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors">
                                            Redigera <ArrowRight size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
