// src/components/admin/RoadmapModule.tsx
import React from 'react';

const ROADMAP_ITEMS = [
    {
        title: 'Hushållskonto (Shared Planning)',
        description: 'Dela din vecka, planering och skafferi med upp till 5 familjemedlemmar. Samtidigt som ni behåller individuell kaloritracking.',
        status: 'planned',
        tags: ['Premium', 'Household']
    },
    {
        title: 'AI Receptgenerator',
        description: 'Skapa skräddarsydda recept baserat på vad du har i skafferiet just nu med hjälp av GPT-4.',
        status: 'research',
        tags: ['AI', 'Pantry']
    },
    {
        title: 'Smart Inköpslista v2',
        description: 'Automatisk kategorisering av inköpslistan baserat på butikslayout och optimering för billigaste butiksval.',
        status: 'in-progress',
        tags: ['Shopping']
    },
    {
        title: 'Mobil App (PWA Enchancements)',
        description: 'Bättre offline-stöd och push-notiser när det är dags att börja laga middagen.',
        status: 'planned',
        tags: ['Mobile']
    },
    {
        title: 'Vatten & Sömn Tracking',
        description: 'Integrera holistisk hälsa med din kost för en komplett bild av ditt välmående.',
        status: 'planned',
        tags: ['Health']
    },
    {
        title: 'Exportera till PDF / Utskrift',
        description: 'Skriv ut din veckoplan eller enskilda recept med snygg layout för köksväggen.',
        status: 'planned',
        tags: ['Utilities']
    }
];

export const RoadmapModule: React.FC = () => {
    return (
        <div className="space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
                <span className="p-2 bg-purple-500/10 rounded-lg text-purple-400">🚀</span>
                Kommande Funktioner & Roadmap
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ROADMAP_ITEMS.map((item, i) => (
                    <div key={i} className="bg-slate-900 border border-slate-800 p-5 rounded-2xl hover:bg-slate-800/50 transition-all group">
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="font-bold text-white group-hover:text-purple-400 transition-colors">{item.title}</h3>
                            <span className={`text-[10px] px-2 py-1 rounded-full uppercase tracking-widest font-bold ${item.status === 'in-progress' ? 'bg-amber-500/10 text-amber-500' :
                                    item.status === 'research' ? 'bg-sky-500/10 text-sky-500' :
                                        'bg-slate-800 text-gray-400'
                                }`}>
                                {item.status === 'in-progress' ? 'Pågår' : item.status === 'research' ? 'Utforskas' : 'Planerad'}
                            </span>
                        </div>
                        <p className="text-sm text-gray-400 leading-relaxed mb-4">
                            {item.description}
                        </p>
                        <div className="flex gap-2">
                            {item.tags.map(tag => (
                                <span key={tag} className="text-[10px] text-gray-500 bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
