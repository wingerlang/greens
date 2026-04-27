import { ExerciseEntry, PlannedActivity } from '../../../models/types.ts';

export interface RaceSeriesStats {
    count: number;
    pb: ExerciseEntry;
    avgDuration: number;
    years: string[];
}

export interface RaceSeries {
    name: string;
    races: ExerciseEntry[];
    stats: RaceSeriesStats;
}

export interface DashboardStats {
    totalDistance: number;
    count: number;
    chartData: { date: string, count: number, projected: number }[];
    goldCount: number;
    silverCount: number;
    bronzeCount: number;
    podiumCount: number;
    top10Count: number;
    avgPercent: number;
}

export interface SortConfig {
    key: string;
    direction: 'asc' | 'desc';
}

export type ViewMode = 'timeline' | 'series' | 'tours' | 'map';
export type UpcomingViewMode = 'cozy' | 'compact' | 'list';
export type SeriesSortMode = 'count' | 'name' | 'latest';
