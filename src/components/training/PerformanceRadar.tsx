import React, { useMemo } from 'react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts';

interface PerformanceRadarProps {
    stats: {
        totalDist: number;
        totalTime: number;
        activeDays: number;
        totalTonnage: number;
        totalSessions: number;
        activePercentage: number;
        types: any[];
    };
    years: number[];
}

export function PerformanceRadar({ stats, years }: PerformanceRadarProps) {
    const data = useMemo(() => {
        // Normalize values between 0-100 based on some reasonable goals
        const goals = {
            dist: 2000 * years.length, // 2000km/year
            time: 300 * 60 * years.length, // 300h/year
            consistency: 80, // 80% active days
            tonnage: 1000000 * years.length, // 1000 tons/year
            variety: 5 // 5 different activity types
        };

        return [
            { subject: 'Uthållighet', A: Math.min(100, (stats.totalDist / goals.dist) * 100), fullMark: 100 },
            { subject: 'Styrka', A: Math.min(100, (stats.totalTonnage / goals.tonnage) * 100), fullMark: 100 },
            { subject: 'Kontinuitet', A: Math.min(100, (stats.activePercentage / goals.consistency) * 100), fullMark: 100 },
            { subject: 'Volym', A: Math.min(100, (stats.totalTime / goals.time) * 100), fullMark: 100 },
            { subject: 'Variatier', A: Math.min(100, (stats.types.length / goals.variety) * 100), fullMark: 100 },
        ];
    }, [stats, years]);

    return (
        <div className="w-full h-full flex flex-col items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
                    <PolarGrid stroke="#ffffff10" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar
                        name="Din Profil"
                        dataKey="A"
                        stroke="#10b981"
                        strokeWidth={3}
                        fill="#10b981"
                        fillOpacity={0.4}
                    />
                    <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                        itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                    />
                </RadarChart>
            </ResponsiveContainer>
        </div>
    );
}
