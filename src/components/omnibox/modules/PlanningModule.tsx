import React from 'react';
import { Calendar, ArrowRight } from 'lucide-react';
import { PlannedActivity } from '../../../models/types.ts';

interface PlanningModuleProps {
    intent: any;
    handleExecutePlanning: (activity: Partial<PlannedActivity>) => void;
}

export const PlanningModule: React.FC<PlanningModuleProps> = ({
    intent,
    handleExecutePlanning
}) => {
    return (
        <div className="p-4 space-y-4 animate-in fade-in slide-in-from-top-2">
            <div className="px-3 py-2 bg-indigo-500/10 border-l-4 border-indigo-500 rounded-r-lg flex items-center gap-2">
                <Calendar size={16} className="text-indigo-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">Planera Träning</span>
            </div>

            <div className="bg-slate-800/50 rounded-2xl p-6 border border-white/5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Calendar size={64} />
                </div>
                <div className="space-y-4 relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center text-2xl shadow-inner">
                            {intent.data.type === 'RUN' ? '🏃' :
                                intent.data.type === 'STRENGTH' ? '🏋️' :
                                    intent.data.type === 'CARDIO' ? '🚴' : '✨'}
                        </div>
                        <div>
                            <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-0.5">
                                {intent.data.date === new Date().toISOString().split('T')[0] ? 'Idag' :
                                    intent.data.date === new Date(Date.now() + 86400000).toISOString().split('T')[0] ? 'Imorgon' : intent.data.date}
                                {intent.data.startTime ? ` • ${intent.data.startTime}` : ''}
                            </div>
                            <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase leading-none">
                                {intent.data.title}
                            </h3>
                        </div>
                    </div>

                    {intent.data.description && (
                        <p className="text-sm text-slate-400 font-medium leading-relaxed italic border-l-2 border-indigo-500/30 pl-3 py-1">
                            {intent.data.description}
                        </p>
                    )}

                    <div className="flex items-center gap-2 pt-2">
                        <div className="px-3 py-1.5 rounded-lg bg-indigo-500/20 border border-indigo-500/20 text-[10px] font-black text-indigo-300 uppercase tracking-widest">
                            {intent.data.category}
                        </div>
                        {intent.data.subType && (
                            <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                {intent.data.subType}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <button
                className="w-full py-4 bg-indigo-500 hover:bg-indigo-400 text-slate-950 font-black rounded-2xl shadow-xl shadow-indigo-500/20 flex items-center justify-center gap-2 transition-all uppercase tracking-widest text-xs"
                onClick={() => handleExecutePlanning(intent.data)}
            >
                <span>Schemalägg Pass</span>
                <ArrowRight size={16} />
            </button>

            <div className="text-center text-[10px] text-slate-500">
                💡 Tryck Enter för att spara planeringen
            </div>
        </div>
    );
};
