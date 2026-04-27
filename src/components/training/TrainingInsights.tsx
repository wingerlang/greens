import React, { useMemo } from 'react';
import { UniversalActivity } from '../../models/types.ts';
import { TrendingUp, Calendar, Zap, Clock, Award } from 'lucide-react';

interface TrainingInsightsProps {
    activities: UniversalActivity[];
}

export function TrainingInsights({ activities }: TrainingInsightsProps) {
    const insights = useMemo(() => {
        if (activities.length === 0) return [];

        const results: { icon: React.ReactNode; title: string; description: string; color: string }[] = [];

        // 1. Most active day of week
        const days = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];
        const dayCounts = new Array(7).fill(0);
        activities.forEach(a => {
            dayCounts[new Date(a.date).getDay()]++;
        });
        const bestDayIdx = dayCounts.indexOf(Math.max(...dayCounts));
        results.push({
            icon: <Calendar className="w-5 h-5" />,
            title: `Din favoritdag: ${days[bestDayIdx]}`,
            description: `Du har kört ${dayCounts[bestDayIdx]} pass på ${days[bestDayIdx].toLowerCase()}ar i år.`,
            color: 'text-emerald-400 bg-emerald-500/10'
        });

        // 2. Average Distance Trend (if running)
        const runActivities = activities.filter(a => a.plan?.activityType === 'running' || a.performance?.activityType === 'running');
        if (runActivities.length > 5) {
            const avgDist = runActivities.reduce((acc, a) => acc + (a.performance?.distanceKm || 0), 0) / runActivities.length;
            results.push({
                icon: <TrendingUp className="w-5 h-5" />,
                title: 'Snittdistans',
                description: `Dina löppass är i snitt ${avgDist.toFixed(1)} km långa.`,
                color: 'text-blue-400 bg-blue-500/10'
            });
        }

        // 3. Consistency check
        const today = new Date();
        const currentYear = today.getFullYear();
        const latestActivityDate = activities.length > 0 
            ? new Date(Math.max(...activities.map(a => new Date(a.date).getTime())))
            : today;
        const targetYear = latestActivityDate.getFullYear();
        
        let totalWeeks = 52;
        if (targetYear === currentYear) {
            const oneJan = new Date(targetYear, 0, 1);
            totalWeeks = Math.ceil((((today.getTime() - oneJan.getTime()) / 86400000) + oneJan.getDay() + 1) / 7);
            if (totalWeeks > 52) totalWeeks = 52;
            if (totalWeeks < 1) totalWeeks = 1;
        }

        const activeWeeks = new Set(activities.map(a => {
            const d = new Date(a.date);
            const oneJan = new Date(d.getFullYear(), 0, 1);
            return Math.ceil((((d.getTime() - oneJan.getTime()) / 86400000) + oneJan.getDay() + 1) / 7);
        })).size;
        
        if (activeWeeks > 0) {
            results.push({
                icon: <Zap className="w-5 h-5" />,
                title: 'Kontinuitet',
                description: `Du har varit aktiv ${activeWeeks} av årets ${totalWeeks} veckor (${Math.round((activeWeeks/totalWeeks)*100)}%).`,
                color: 'text-amber-400 bg-amber-500/10'
            });
        }

        // 4. Time of day
        const morning = activities.filter(a => {
            const h = a.performance?.startTimeLocal ? new Date(a.performance.startTimeLocal).getHours() : 0;
            return h >= 5 && h < 10;
        }).length;
        const evening = activities.filter(a => {
            const h = a.performance?.startTimeLocal ? new Date(a.performance.startTimeLocal).getHours() : 0;
            return h >= 17 && h < 22;
        }).length;

        if (morning > evening) {
            results.push({
                icon: <Clock className="w-5 h-5" />,
                title: 'Morgonpigg!',
                description: 'De flesta av dina pass sker innan klockan 10:00.',
                color: 'text-sky-400 bg-sky-500/10'
            });
        } else if (evening > morning) {
            results.push({
                icon: <Clock className="w-5 h-5" />,
                title: 'Kvällsmänniska',
                description: 'Du föredrar att träna när solen går ner.',
                color: 'text-indigo-400 bg-indigo-500/10'
            });
        }

        return results;
    }, [activities]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {insights.map((insight, i) => (
                <div key={i} className="bg-slate-900/50 border border-white/5 p-6 rounded-3xl flex flex-col gap-4 hover:border-white/10 transition-all group">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${insight.color} group-hover:scale-110 transition-transform`}>
                        {insight.icon}
                    </div>
                    <div>
                        <h4 className="text-white font-bold text-sm mb-1">{insight.title}</h4>
                        <p className="text-slate-500 text-xs leading-relaxed">{insight.description}</p>
                    </div>
                </div>
            ))}
        </div>
    );
}
