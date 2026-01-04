import React, { useState } from 'react';
import { calculateCooperVO2, getCooperGrade } from '../../utils/runningCalculator.ts';

export function ToolsCooperPage() {
    const [distance, setDistance] = useState(2400); // meters
    const [age, setAge] = useState(30);
    const [gender, setGender] = useState<'male' | 'female'>('male');

    const vo2 = calculateCooperVO2(distance);
    const grade = getCooperGrade(distance, age, gender);

    const gradeColors: Record<string, string> = {
        'Excellent': 'text-emerald-400',
        'Good': 'text-teal-400',
        'Average': 'text-yellow-400',
        'Bad': 'text-orange-400',
        'Very Bad': 'text-rose-400'
    };

    return (
        <div className="space-y-8 animate-fade-in">
             <div>
                <h1 className="text-3xl font-bold text-white mb-2">Coopers Test</h1>
                <p className="text-slate-400">Spring så långt du kan på 12 minuter.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-slate-900 border border-white/5 rounded-3xl p-6 h-fit">
                    <h2 className="text-xl font-bold text-white mb-6">Ditt resultat</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Distans (meter)</label>
                            <input
                                type="number"
                                value={distance}
                                onChange={(e) => setDistance(Number(e.target.value))}
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Ålder</label>
                                <input
                                    type="number"
                                    value={age}
                                    onChange={(e) => setAge(Number(e.target.value))}
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Kön</label>
                                <div className="flex bg-slate-950 rounded-xl border border-white/10 p-1">
                                    <button
                                        onClick={() => setGender('male')}
                                        className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${gender === 'male' ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-white'}`}
                                    >
                                        Man
                                    </button>
                                    <button
                                        onClick={() => setGender('female')}
                                        className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${gender === 'female' ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-white'}`}
                                    >
                                        Kvinna
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900 border border-white/5 rounded-3xl p-6 flex flex-col justify-center text-center">
                    <div className="mb-8">
                        <div className="text-sm text-slate-500 font-bold uppercase tracking-wider mb-2">UPPSKATTAT VO2MAX</div>
                        <div className="text-6xl font-bold text-white mb-2">{vo2}</div>
                        <div className="text-sm text-slate-400">ml/kg/min</div>
                    </div>

                    <div className="border-t border-white/5 pt-8">
                        <div className="text-sm text-slate-500 font-bold uppercase tracking-wider mb-2">BEDÖMNING</div>
                        <div className={`text-4xl font-bold ${gradeColors[grade] || 'text-white'}`}>{grade}</div>
                        <div className="text-xs text-slate-500 mt-2">Baserat på standardtabeller för {age} år ({gender === 'male' ? 'Man' : 'Kvinna'}).</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
