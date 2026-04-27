import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { format, startOfYear, eachMonthOfInterval } from 'date-fns';
import { sv } from 'date-fns/locale';
import { UniversalActivity } from '../../models/types.ts';

interface MonthlyVolumeBarChartProps {
    activities: UniversalActivity[];
    year: number;
}

export function MonthlyVolumeBarChart({ activities, year }: MonthlyVolumeBarChartProps) {
    const data = useMemo(() => {
        const months = eachMonthOfInterval({
            start: new Date(year, 0, 1),
            end: new Date(year, 11, 31)
        });

        return months.map(month => {
            const monthStr = format(month, 'yyyy-MM');
            const monthActivities = activities.filter(a => a.date.startsWith(monthStr));
            
            return {
                name: format(month, 'MMM', { locale: sv }),
                distance: Math.round(monthActivities.reduce((sum, a) => sum + (a.performance?.distanceKm || 0), 0)),
                duration: Math.round(monthActivities.reduce((sum, a) => sum + (a.performance?.durationMinutes || 0), 0) / 60), // in hours
                count: monthActivities.length
            };
        });
    }, [activities, year]);

    return (
        <div className="w-full h-full">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                    <XAxis 
                        dataKey="name" 
                        stroke="#94a3b8" 
                        fontSize={10} 
                        fontWeight="bold" 
                        axisLine={false}
                        tickLine={false}
                    />
                    <YAxis 
                        stroke="#94a3b8" 
                        fontSize={10} 
                        fontWeight="bold" 
                        axisLine={false}
                        tickLine={false}
                    />
                    <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                        itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    />
                    <Bar dataKey="distance" name="Distans (km)" fill="#10b981" radius={[4, 4, 0, 0]}>
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.distance > 100 ? '#10b981' : '#10b98180'} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
