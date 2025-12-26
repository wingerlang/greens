import React, { useState } from 'react';
import { BodyPart, InjuryLog } from '../../models/types.ts';

interface InteractiveBodyMapProps {
    injuryLogs: InjuryLog[];
    acuteLoad?: Record<BodyPart, number>;
    onBodyPartClick: (part: BodyPart) => void;
}

export function InteractiveBodyMap({ injuryLogs, acuteLoad, onBodyPartClick }: InteractiveBodyMapProps) {
    const [view, setView] = useState<'front' | 'back'>('front');

    const getStatusColor = (part: BodyPart) => {
        const active = injuryLogs.find(l => l.bodyPart === part && (l.status === 'active' || l.status === 'recovering'));
        if (active) {
            if (active.severity >= 7) return "fill-rose-500 animate-pulse";
            if (active.severity >= 4) return "fill-orange-500";
            return "fill-amber-400";
        }

        // Heatmap Logic (if no active injury)
        if (acuteLoad) {
            const load = acuteLoad[part] || 0;
            if (load > 60) return "fill-purple-500/60"; // Very High
            if (load > 40) return "fill-indigo-500/50"; // High
            if (load > 20) return "fill-sky-500/30";    // Moderate
        }

        return "fill-slate-800/50 hover:fill-emerald-500/20";
    };

    const BodyPartPath = ({ id, d, label }: { id: BodyPart, d: string, label: string }) => (
        <g
            onClick={() => onBodyPartClick(id)}
            className="cursor-pointer group transition-all duration-300"
        >
            <path
                d={d}
                className={`stroke-slate-700 stroke-2 transition-colors duration-300 ${getStatusColor(id)}`}
            />
            {/* Tooltip-ish label on hover */}
            <text
                x="0"
                y="-20"
                className="opacity-0 group-hover:opacity-100 fill-white text-[10px] font-bold uppercase transition-opacity pointer-events-none text-center"
                textAnchor="middle"
                style={{ transformBox: "fill-box", transformOrigin: "center" }}
            >
                {label}
            </text>
        </g>
    );

    return (
        <div className="flex flex-col items-center">
            {/* View Toggle */}
            <div className="flex bg-slate-900 rounded-lg p-1 mb-6 border border-slate-800">
                <button
                    onClick={() => setView('front')}
                    className={`px-4 py-1 rounded-md text-xs font-bold transition-all ${view === 'front' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    FRAMSIDA
                </button>
                <button
                    onClick={() => setView('back')}
                    className={`px-4 py-1 rounded-md text-xs font-bold transition-all ${view === 'back' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    BAKSIDA
                </button>
            </div>

            {/* SVG Map */}
            <div className="relative w-64 h-[500px]">
                <svg viewBox="0 0 200 500" className="w-full h-full drop-shadow-[0_0_15px_rgba(0,0,0,0.5)]">
                    {/* Silhouette Outline (Ghost) */}
                    <path
                        d={view === 'front'
                            ? "M100,20 C115,20 125,30 125,45 L135,45 C150,45 160,55 160,70 L170,160 L155,160 L150,110 L150,200 L140,200 L140,300 L130,480 L110,480 L110,320 L90,320 L90,480 L70,480 L60,300 L60,200 L50,200 L50,110 L45,160 L30,160 L40,70 C40,55 50,45 65,45 L75,45 C75,30 85,20 100,20 Z"
                            : "M100,20 C115,20 125,30 125,45 L135,45 C150,45 160,55 160,70 L170,160 L155,160 L150,110 L150,200 L140,200 L140,300 L130,480 L110,480 L110,320 L90,320 L90,480 L70,480 L60,300 L60,200 L50,200 L50,110 L45,160 L30,160 L40,70 C40,55 50,45 65,45 L75,45 C75,30 85,20 100,20 Z"
                        }
                        className="fill-none stroke-slate-800/30 stroke-1"
                    />

                    {view === 'front' ? (
                        <>
                            {/* Head/Neck */}
                            <BodyPartPath id="neck" label="Nacke" d="M85,45 L115,45 L115,55 L85,55 Z" />

                            {/* Shoulders */}
                            <BodyPartPath id="shoulders" label="Axlar" d="M65,55 L85,55 L85,75 L50,70 Z M135,55 L115,55 L115,75 L150,70 Z" />

                            {/* Chest */}
                            <BodyPartPath id="chest" label="Bröst" d="M85,60 L115,60 L115,95 L85,95 Z M60,75 L85,85 L85,95 L65,90 Z M140,75 L115,85 L115,95 L135,90 Z" />

                            {/* Abs */}
                            <BodyPartPath id="abs" label="Mage" d="M85,100 L115,100 L110,160 L90,160 Z" />

                            {/* Biceps/Arms */}
                            <BodyPartPath id="biceps" label="Biceps" d="M50,75 L65,75 L60,110 L45,110 Z M150,75 L135,75 L140,110 L155,110 Z" />
                            <BodyPartPath id="forearms" label="Underarmar" d="M45,115 L60,115 L55,150 L40,150 Z M155,115 L140,115 L145,150 L160,150 Z" />

                            {/* Hands */}
                            <BodyPartPath id="hands" label="Händer" d="M40,155 L55,155 L55,170 L40,170 Z M160,155 L145,155 L145,170 L160,170 Z" />

                            {/* Quads */}
                            <BodyPartPath id="quads" label="Framsida Lår" d="M70,170 L95,170 L95,250 L75,250 Z M130,170 L105,170 L105,250 L125,250 Z" />

                            {/* Knees */}
                            <BodyPartPath id="knees" label="Knän" d="M75,255 L95,255 L95,280 L75,280 Z M125,255 L105,255 L105,280 L125,280 Z" />

                            {/* Shins */}
                            <BodyPartPath id="shins" label="Smalben" d="M75,285 L95,285 L90,360 L80,360 Z M125,285 L105,285 L110,360 L120,360 Z" />

                            {/* Feet */}
                            <BodyPartPath id="feet" label="Fötter" d="M75,365 L95,365 L100,380 L70,380 Z M125,365 L105,365 L100,380 L130,380 Z" />

                            {/* Hips/Adductors context */}
                            <BodyPartPath id="hips" label="Höfter" d="M65,145 L85,145 L85,165 L65,165 Z M135,145 L115,145 L115,165 L135,165 Z" />
                            <BodyPartPath id="adductors" label="Insida Lår" d="M95,175 L105,175 L103,240 L97,240 Z" />

                        </>
                    ) : (
                        <>
                            {/* Neck Back */}
                            <BodyPartPath id="neck" label="Nacke" d="M85,45 L115,45 L115,55 L85,55 Z" />

                            {/* Upper Back / Traps / Lats */}
                            <BodyPartPath id="upper_back" label="Övre Rygg" d="M85,55 L115,55 L110,110 L90,110 Z M65,60 L85,60 L90,100 L65,85 Z M135,60 L115,60 L110,100 L135,85 Z" />

                            {/* Lower Back */}
                            <BodyPartPath id="lower_back" label="Ländrygg" d="M90,115 L110,115 L115,150 L85,150 Z" />

                            {/* Triceps */}
                            <BodyPartPath id="triceps" label="Triceps" d="M45,75 L60,75 L65,110 L50,110 Z M155,75 L140,75 L135,110 L150,110 Z" />
                            <BodyPartPath id="forearms" label="Underarmar" d="M48,115 L63,115 L58,150 L43,150 Z M152,115 L137,115 L142,150 L157,150 Z" />

                            {/* Glutes */}
                            <BodyPartPath id="glutes" label="Sätesmuskler" d="M75,155 L100,155 L95,195 L65,190 Z M125,155 L100,155 L105,195 L135,190 Z" />

                            {/* Hamstrings */}
                            <BodyPartPath id="hamstrings" label="Baksida Lår" d="M70,200 L95,200 L95,260 L75,260 Z M130,200 L105,200 L105,260 L125,260 Z" />

                            {/* Calves */}
                            <BodyPartPath id="calves" label="Vader" d="M75,265 L95,265 L90,340 L80,340 Z M125,265 L105,265 L110,340 L120,340 Z" />

                            {/* Feet */}
                            <BodyPartPath id="feet" label="Hälar" d="M80,345 L90,345 L90,360 L80,360 Z M120,345 L110,345 L110,360 L120,360 Z" />
                        </>
                    )}
                </svg>
            </div>
        </div>
    );
}
