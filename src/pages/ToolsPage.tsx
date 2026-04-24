import React from 'react';
import { Link } from 'react-router-dom';

export default function ToolsPage() {
    const categories = [
        {
            title: "Styrka",
            icon: "💪",
            tools: [
                {
                    name: "1RM & Lastning",
                    desc: "Beräkna ditt max och se hur du ska lasta stången.",
                    path: "/tools/1rm",
                    color: "from-blue-500 to-indigo-500"
                },
                {
                    name: "Styrkestandard",
                    desc: "Wilks & IPF poäng för att jämföra din styrka.",
                    path: "/tools/standards",
                    color: "from-indigo-500 to-violet-500"
                },
                {
                    name: "Tyngdlyftning (Olympic)",
                    desc: "Sinclair-poäng och teknisk analys för Ryck & Stöt.",
                    path: "/tools/olympic",
                    color: "from-rose-500 to-pink-500"
                },
                {
                    name: "Smart Belastning",
                    desc: "Analysera effektiv volym och styrkeutveckling utan RPE.",
                    path: "/tools/load-analysis",
                    color: "from-cyan-500 to-blue-500"
                },
                {
                    name: "Interferensanalys",
                    desc: "Undvik krockar mellan mTOR (styrka) och AMPK (kardio).",
                    path: "/tools/interference",
                    color: "from-indigo-500 to-purple-500"
                }
            ]
        },
        {
            title: "Löpning & Cardio",
            icon: "🏃",
            tools: [
                {
                    name: "Running Tools",
                    desc: "Enhetligt gränssnitt för Pace, Race Predictor, Coopers och Pulszoner.",
                    path: "/tools/running",
                    color: "from-emerald-500 to-teal-500"
                },
                {
                    name: "Energiberäknare",
                    desc: "Räkna ut kalorier för Cykling (Watt) och Löpning.",
                    path: "/tools/power",
                    color: "from-blue-500 to-indigo-500"
                },
                {
                    name: "Hyrox Predictor",
                    desc: "Simulera lopp, analysera splits och skapa strategi.",
                    path: "/tools/hyrox",
                    color: "from-amber-500 to-orange-500"
                }
            ]
        },
        {
            title: "Hälsa & Kropp",
            icon: "🧬",
            tools: [
                {
                    name: "Hälsokalkylator",
                    desc: "BMI, BMR, TDEE och kalkylator för viktnedgång.",
                    path: "/tools/health",
                    color: "from-rose-500 to-pink-500"
                },
                {
                    name: "Makrofördelning",
                    desc: "Räkna ut fördelning av Protein, Kolhydrater och Fett.",
                    path: "/tools/macros",
                    color: "from-pink-500 to-fuchsia-500"
                }
            ]
        },
        {
            title: "Data & Visualisering",
            icon: "📊",
            tools: [
                {
                    name: "Replay Mode",
                    desc: "Återupplev dina framsteg med en animerad tidslinje.",
                    path: "/tools/replay",
                    color: "from-amber-500 to-orange-500"
                },
                {
                    name: "Djupanalys & Rapport",
                    desc: "Generera en detaljerad rapport om din träningskarriär, styrka och konsistens för AI-analys.",
                    path: "/tools/report",
                    color: "from-indigo-500 to-purple-500"
                }
            ]
        }
    ];

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-12 animate-fade-in">
            <div className="text-center space-y-4">
                <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">
                    Verktygslådan
                </h1>
                <p className="text-lg text-slate-400 max-w-2xl mx-auto">
                    Smarta kalkyleringsverktyg för att optimera din träning, hälsa och prestation. Determinism i sin renaste form.
                </p>
            </div>

            <div className="grid gap-12">
                {categories.map((cat, idx) => (
                    <div key={idx} className="space-y-6">
                        <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                            <span className="text-2xl">{cat.icon}</span>
                            <h2 className="text-2xl font-bold text-white">{cat.title}</h2>
                        </div>

                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {cat.tools.map((tool, tIdx) => (
                                <Link
                                    key={tIdx}
                                    to={tool.path}
                                    className="group relative bg-slate-900 border border-white/5 rounded-3xl p-6 hover:border-white/10 transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/50 overflow-hidden"
                                >
                                    <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${tool.color} opacity-5 rounded-full blur-2xl -mr-10 -mt-10 transition-opacity group-hover:opacity-10`}></div>

                                    <div className="relative z-10">
                                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${tool.color} flex items-center justify-center text-white font-bold text-xl mb-4 shadow-lg`}>
                                            {tool.name.substring(0, 1)}
                                        </div>

                                        <h3 className="text-xl font-bold text-white mb-2 group-hover:text-emerald-400 transition-colors">
                                            {tool.name}
                                        </h3>
                                        <p className="text-sm text-slate-400 leading-relaxed">
                                            {tool.desc}
                                        </p>
                                    </div>

                                    <div className="absolute bottom-6 right-6 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-emerald-400">
                                        ➔
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
