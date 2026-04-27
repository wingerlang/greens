import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { format, startOfYear, eachDayOfInterval, isAfter, isBefore } from 'date-fns';
import { sv } from 'date-fns/locale';
import { UniversalActivity } from '../../models/types.ts';

interface CumulativeProgressChartProps {
    activities: UniversalActivity[];
    years: number[];
}

export function CumulativeProgressChart({ activities, years }: CumulativeProgressChartProps) {
    const data = useMemo(() => {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
        
        // Calculate cumulative distance for each year by day of year (1-366)
        const yearLines: any[] = [];
        
        years.forEach(year => {
            const startDate = startOfYear(new Date(year, 0, 1));
            const yearActivities = activities
                .filter(a => new Date(a.date).getFullYear() === year)
                .sort((a, b) => a.date.localeCompare(b.date));
            
            let cumulative = 0;
            const dailyData = new Map<number, number>();
            
            yearActivities.forEach(a => {
                const dayOfYear = Math.floor((new Date(a.date).getTime() - startDate.getTime()) / 86400000);
                cumulative += a.performance?.distanceKm || 0;
                dailyData.set(dayOfYear, cumulative);
            });
            
            yearLines.push({ year, data: dailyData });
        });

        // Create 12 data points (end of each month)
        return months.map((month, mIdx) => {
            const point: any = { month };
            const dateInYear = new Date(2024, mIdx + 1, 0); // Last day of month
            const dayOfYear = Math.floor((dateInYear.getTime() - new Date(2024, 0, 1).getTime()) / 86400000);

            yearLines.forEach(line => {
                // Find last recorded day before or on this day
                let lastVal = 0;
                for (let d = 0; d <= dayOfYear; d++) {
                    if (line.data.has(d)) lastVal = line.data.get(d);
                }
                
                // Don't show data for future months in current year
                const isCurrentYear = line.year === new Date().getFullYear();
                const isFuture = isCurrentYear && mIdx > new Date().getMonth();
                
                if (!isFuture) {
                    point[`year_${line.year}`] = Math.round(lastVal);
                }
            });
            return point;
        });
    }, [activities, years]);

    const colors = ['#10b981', '#06b6d4', '#8b5cf6', '#f59e0b', '#6366f1', '#ec4899'];

    return (
        <div className="w-full h-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                    <defs>
                        {years.map((year, i) => (
                            <linearGradient key={year} id={`colorYear_${year}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={colors[i % colors.length]} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={colors[i % colors.length]} stopOpacity={0} />
                            </linearGradient>
                        ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                    <XAxis 
                        dataKey="month" 
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
                        tickFormatter={(val) => `${val} km`}
                    />
                    <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                        itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                    />
                    <Legend />
                    {years.map((year, i) => (
                        <Area
                            key={year}
                            type="monotone"
                            dataKey={`year_${year}`}
                            name={year.toString()}
                            stroke={colors[i % colors.length]}
                            fillOpacity={1}
                            fill={`url(#colorYear_${year})`}
                            strokeWidth={3}
                            animationDuration={1500}
                        />
                    ))}
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
