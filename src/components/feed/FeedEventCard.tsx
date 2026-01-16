import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Dumbbell,
    Activity,
    Utensils,
    Droplets,
    Moon,
    Scale,
    Trophy,
    Users,
    ChevronDown,
    ChevronUp,
    Clock,
    MapPin,
    Lock,
    Unlock,
    Eye,
    EyeOff,
    MoreHorizontal,
    Globe,
    RefreshCw
} from 'lucide-react';
import type { FeedEvent, FeedEventType } from '../../models/feedTypes.ts';
import { useData } from '../../context/DataContext.tsx';

interface FeedEventCardProps {
    event: FeedEvent;
    userName?: string;
    userAvatar?: string;
    showUser?: boolean;
    compact?: boolean;
    onUpdate?: () => void;
}

// Icon mapping for event types
const EVENT_ICONS: Record<FeedEventType, React.ReactNode> = {
    'WORKOUT_STRENGTH': <Dumbbell className="text-emerald-400" size={20} />,
    'WORKOUT_CARDIO': <Activity className="text-blue-400" size={20} />,
    'NUTRITION_MEAL': <Utensils className="text-amber-400" size={20} />,
    'HYDRATION': <Droplets className="text-cyan-400" size={20} />,
    'HEALTH_SLEEP': <Moon className="text-indigo-400" size={20} />,
    'BODY_METRIC': <Scale className="text-purple-400" size={20} />,
    'MILESTONE': <Trophy className="text-yellow-400" size={20} />,
    'SOCIAL': <Users className="text-pink-400" size={20} />,
};

// Background color classes for event types
const EVENT_COLORS: Record<FeedEventType, string> = {
    'WORKOUT_STRENGTH': 'from-emerald-500/10 to-emerald-500/5 border-emerald-500/20',
    'WORKOUT_CARDIO': 'from-blue-500/10 to-blue-500/5 border-blue-500/20',
    'NUTRITION_MEAL': 'from-amber-500/10 to-amber-500/5 border-amber-500/20',
    'HYDRATION': 'from-cyan-500/10 to-cyan-500/5 border-cyan-500/20',
    'HEALTH_SLEEP': 'from-indigo-500/10 to-indigo-500/5 border-indigo-500/20',
    'BODY_METRIC': 'from-purple-500/10 to-purple-500/5 border-purple-500/20',
    'MILESTONE': 'from-yellow-500/10 to-yellow-500/5 border-yellow-500/20',
    'SOCIAL': 'from-pink-500/10 to-pink-500/5 border-pink-500/20',
};

export function FeedEventCard({
    event,
    userName,
    userAvatar,
    showUser = true,
    compact = false,
    onUpdate
}: FeedEventCardProps) {
    const { currentUser } = useData();
    const [expanded, setExpanded] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [showPrivacyMenu, setShowPrivacyMenu] = useState(false);

    const icon = EVENT_ICONS[event.type];
    const colorClass = EVENT_COLORS[event.type];

    // Format relative time
    const getRelativeTime = (timestamp: string): string => {
        const now = Date.now();
        const then = new Date(timestamp).getTime();
        const diffMs = now - then;

        const minutes = Math.floor(diffMs / (1000 * 60));
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (minutes < 1) return 'Just nu';
        if (minutes < 60) return `${minutes}m`;
        if (hours < 24) return `${hours}h`;
        if (days === 1) return 'Igår';
        if (days < 7) return `${days}d`;

        return new Date(timestamp).toLocaleDateString('sv-SE', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    // Check if this is a PB/milestone
    const isPB = event.type === 'MILESTONE' ||
        (event.payload as any)?.newPBs > 0;

    return (
        <div
            className={`
                relative rounded-2xl border bg-gradient-to-br transition-all duration-200
                ${colorClass}
                ${isPB ? 'ring-2 ring-yellow-500/30' : ''}
                ${expanded ? 'p-5' : compact ? 'p-3' : 'p-4'}
                hover:border-white/20 cursor-pointer
            `}
            onClick={() => setExpanded(!expanded)}
        >
            {/* Header / Privacy Toggle for own events */}
            {(event.userId === currentUser?.id || userName === 'Du') ? (
                <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
                    {updating ? (
                        <div className="flex items-center gap-2 px-2 py-1 bg-white/5 rounded-lg text-[10px] text-slate-400">
                            <RefreshCw size={12} className="animate-spin" />
                            <span>Uppdaterar...</span>
                        </div>
                    ) : (
                        <div className="relative">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowPrivacyMenu(!showPrivacyMenu);
                                }}
                                className={`
                                    flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-all
                                    ${event.visibility === 'PRIVATE' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                                        event.visibility === 'FRIENDS' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                                            'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}
                                    hover:bg-white/10 hover:scale-105 active:scale-95
                                `}
                            >
                                {event.visibility === 'PRIVATE' ? <Lock size={12} /> :
                                    event.visibility === 'FRIENDS' ? <Users size={12} /> :
                                        <Globe size={12} />}
                                {event.visibility === 'PRIVATE' ? 'Dold' :
                                    event.visibility === 'FRIENDS' ? 'Vänner' : 'Publik'}
                            </button>

                            {showPrivacyMenu && (
                                <>
                                    <div
                                        className="fixed inset-0 z-20"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowPrivacyMenu(false);
                                        }}
                                    />
                                    <div className="absolute top-full right-0 mt-2 w-40 bg-slate-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-30 animate-in fade-in slide-in-from-top-2">
                                        <div className="px-3 py-2 border-b border-white/5 bg-white/[0.02]">
                                            <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Vem får se?</p>
                                        </div>
                                        {[
                                            { level: 'PUBLIC', label: 'Alla (Publik)', icon: <Globe size={14} />, color: 'text-emerald-400' },
                                            { level: 'FRIENDS', label: 'Följare', icon: <Users size={14} />, color: 'text-blue-400' },
                                            { level: 'PRIVATE', label: 'Bara jag (Dold)', icon: <Lock size={14} />, color: 'text-red-400' },
                                        ].map((opt) => (
                                            <button
                                                key={opt.level}
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    setShowPrivacyMenu(false);
                                                    if (opt.level === event.visibility) return;

                                                    setUpdating(true);
                                                    try {
                                                        const token = localStorage.getItem('auth_token');
                                                        const res = await fetch(`/api/feed/events/${event.id}/visibility`, {
                                                            method: 'PATCH',
                                                            headers: {
                                                                'Content-Type': 'application/json',
                                                                'Authorization': `Bearer ${token}`
                                                            },
                                                            body: JSON.stringify({ visibility: opt.level })
                                                        });

                                                        if (res.ok) {
                                                            if (onUpdate) onUpdate();
                                                        } else {
                                                            const error = await res.json();
                                                            alert(`Kunde inte uppdatera: ${error.error || 'Okänt fel'}`);
                                                        }
                                                    } catch (err) {
                                                        console.error('Failed to update visibility:', err);
                                                        alert('Nätverksfel vid uppdatering av integritet.');
                                                    } finally {
                                                        setUpdating(false);
                                                    }
                                                }}
                                                className={`
                                                    w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold transition-colors
                                                    ${event.visibility === opt.level ? 'bg-white/5 opacity-50 cursor-default' : 'hover:bg-white/10'}
                                                `}
                                            >
                                                <span className={opt.color}>{opt.icon}</span>
                                                <span className="text-slate-200">{opt.label}</span>
                                                {event.visibility === opt.level && (
                                                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white/20" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            ) : null}

            {/* PB Badge */}
            {isPB && (
                <div className="absolute -top-2 -right-2 bg-gradient-to-br from-yellow-400 to-amber-500 text-black text-[9px] font-black px-2 py-0.5 rounded-full shadow-lg">
                    🏆 PB!
                </div>
            )}

            {/* Aggregation indicator */}
            {event.aggregatedFrom && event.aggregatedFrom.length > 1 && (
                <div className="absolute -top-2 left-4 bg-slate-800 text-slate-400 text-[9px] font-bold px-2 py-0.5 rounded-full border border-white/10">
                    +{event.aggregatedFrom.length - 1} mer
                </div>
            )}

            {/* Header: Icon + User + Time */}
            <div className="flex items-start gap-3">
                {/* Event Icon */}
                <div className="w-10 h-10 rounded-xl bg-slate-900/50 flex items-center justify-center flex-shrink-0">
                    {icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    {/* User info (optional) */}
                    {showUser && userName && (
                        <div className="flex items-center gap-2 mb-1">
                            {userAvatar ? (
                                <img
                                    src={userAvatar}
                                    alt={userName}
                                    className="w-5 h-5 rounded-full object-cover"
                                />
                            ) : (
                                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-500 to-blue-500 flex items-center justify-center text-[9px] font-black text-white">
                                    {userName.charAt(0).toUpperCase()}
                                </div>
                            )}
                            <span className="text-xs font-bold text-slate-300">{userName}</span>
                            <span className="text-[10px] text-slate-600">•</span>
                            <span className="text-[10px] text-slate-500">{getRelativeTime(event.timestamp)}</span>
                        </div>
                    )}

                    {/* Title */}
                    <h4 className={`font-bold text-white ${compact ? 'text-sm' : 'text-base'}`}>
                        {event.title}
                    </h4>

                    {/* Summary */}
                    {event.summary && (
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                            {event.summary}
                        </p>
                    )}

                    {/* Metrics Row */}
                    {event.metrics && event.metrics.length > 0 && (
                        <div className="flex flex-wrap gap-3 mt-2">
                            {event.metrics.slice(0, expanded ? undefined : 3).map((metric, i) => (
                                <div key={i} className="flex items-center gap-1">
                                    {metric.icon && <span className="text-xs">{metric.icon}</span>}
                                    <span className="text-xs font-bold text-white">{metric.value}</span>
                                    {metric.unit && <span className="text-[10px] text-slate-500">{metric.unit}</span>}
                                    {metric.label && !compact && (
                                        <span className="text-[10px] text-slate-600">{metric.label}</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Expand indicator */}
                {!compact && (
                    <button
                        className="text-slate-500 hover:text-white transition-colors p-1"
                        onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                    >
                        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                )}
            </div>

            {/* Expanded Content */}
            {expanded && (
                <div className="mt-4 pt-4 border-t border-white/5">
                    {/* Workout details */}
                    {event.type === 'WORKOUT_STRENGTH' && (
                        <WorkoutStrengthDetails payload={event.payload as any} />
                    )}

                    {event.type === 'WORKOUT_CARDIO' && (
                        <WorkoutCardioDetails payload={event.payload as any} />
                    )}

                    {event.type === 'NUTRITION_MEAL' && (
                        <NutritionDetails payload={event.payload as any} />
                    )}

                    {event.type === 'HEALTH_SLEEP' && (
                        <SleepDetails payload={event.payload as any} />
                    )}

                    {/* Timestamp */}
                    <div className="flex items-center gap-2 mt-3 text-[10px] text-slate-600">
                        <Clock size={12} />
                        <span>
                            {new Date(event.timestamp).toLocaleDateString('sv-SE', {
                                weekday: 'long',
                                day: 'numeric',
                                month: 'long',
                                hour: '2-digit',
                                minute: '2-digit',
                            })}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}

// ============================================
// Detail Components
// ============================================

function WorkoutStrengthDetails({ payload }: { payload: any }) {
    return (
        <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
                <StatBox label="Övningar" value={payload.exerciseCount} />
                <StatBox label="Set" value={payload.setCount} />
                <StatBox label="Volym" value={`${Math.round(payload.totalVolume / 1000)}t`} />
            </div>
            {payload.exercises && payload.exercises.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                    {payload.exercises.slice(0, 6).map((ex: string, i: number) => (
                        <span key={i} className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded">
                            {ex}
                        </span>
                    ))}
                    {payload.exercises.length > 6 && (
                        <span className="text-[10px] text-slate-600">+{payload.exercises.length - 6} mer</span>
                    )}
                </div>
            )}
        </div>
    );
}

function WorkoutCardioDetails({ payload }: { payload: any }) {
    return (
        <div className="grid grid-cols-3 gap-2">
            {payload.distance && <StatBox label="Distans" value={`${payload.distance}km`} />}
            <StatBox label="Tid" value={`${payload.duration}min`} />
            {payload.avgPace && <StatBox label="Tempo" value={payload.avgPace} />}
            {payload.avgHeartRate && <StatBox label="Puls" value={`${payload.avgHeartRate}bpm`} />}
            {payload.elevationGain && <StatBox label="Höjdmeter" value={`${payload.elevationGain}m`} />}
        </div>
    );
}

function NutritionDetails({ payload }: { payload: any }) {
    return (
        <div className="grid grid-cols-4 gap-2">
            <StatBox label="Kalorier" value={Math.round(payload.calories)} accent="amber" />
            <StatBox label="Protein" value={`${Math.round(payload.protein)}g`} accent="emerald" />
            <StatBox label="Kolhydrater" value={`${Math.round(payload.carbs)}g`} accent="blue" />
            <StatBox label="Fett" value={`${Math.round(payload.fat)}g`} accent="purple" />
        </div>
    );
}

function SleepDetails({ payload }: { payload: any }) {
    const score = payload.score || 0;
    const scoreColor = score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-blue-400' : score >= 40 ? 'text-amber-400' : 'text-rose-400';

    return (
        <div className="grid grid-cols-3 gap-2">
            <StatBox label="Timmar" value={payload.hours.toFixed(1)} accent="indigo" />
            <div className="bg-slate-900/50 rounded-lg p-2 text-center">
                <div className={`text-sm font-black ${scoreColor}`}>{score}</div>
                <div className="text-[9px] text-slate-500 uppercase font-bold">Poäng</div>
            </div>
            {payload.bedtime && payload.wakeTime && (
                <StatBox
                    label="Period"
                    value={`${payload.bedtime.slice(0, 5)} - ${payload.wakeTime.slice(0, 5)}`}
                />
            )}
        </div>
    );
}

const ACCENT_COLORS: Record<string, string> = {
    'amber': 'text-amber-400',
    'emerald': 'text-emerald-400',
    'blue': 'text-blue-400',
    'purple': 'text-purple-400',
    'indigo': 'text-indigo-400',
    'rose': 'text-rose-400',
};

function StatBox({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
    const accentClass = accent ? (ACCENT_COLORS[accent] || 'text-white') : 'text-white';
    return (
        <div className="bg-slate-900/50 rounded-lg p-2 text-center">
            <div className={`text-sm font-black ${accentClass}`}>{value}</div>
            <div className="text-[9px] text-slate-500 uppercase font-bold">{label}</div>
        </div>
    );
}

export default FeedEventCard;
