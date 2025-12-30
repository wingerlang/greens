/**
 * Skeleton loading components for StrengthPage and related views.
 * Provides animated placeholders for better perceived performance.
 */
import React from 'react';

// Base skeleton animation class
const shimmerClass = "animate-pulse bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 bg-[length:200%_100%]";

/**
 * Skeleton for StatCard component
 */
export function StatCardSkeleton() {
    return (
        <div className="bg-slate-900/50 border border-white/5 rounded-xl p-4 text-center">
            <div className={`h-8 w-16 mx-auto rounded ${shimmerClass}`} />
            <div className={`h-3 w-20 mx-auto mt-2 rounded ${shimmerClass}`} />
        </div>
    );
}

/**
 * Skeleton for WorkoutCard component
 */
export function WorkoutCardSkeleton() {
    return (
        <div className="bg-slate-900/50 border border-white/5 rounded-xl p-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`h-6 w-24 rounded ${shimmerClass}`} />
                    <div>
                        <div className={`h-4 w-32 rounded ${shimmerClass}`} />
                        <div className={`h-3 w-48 mt-1 rounded ${shimmerClass}`} />
                    </div>
                </div>
                <div className="text-right">
                    <div className={`h-4 w-16 rounded ${shimmerClass}`} />
                    <div className={`h-3 w-24 mt-1 rounded ${shimmerClass}`} />
                </div>
            </div>
        </div>
    );
}

/**
 * Skeleton for chart containers
 */
export function ChartSkeleton({ height = 160 }: { height?: number }) {
    return (
        <div
            className={`w-full rounded-xl ${shimmerClass}`}
            style={{ height }}
        />
    );
}

/**
 * Skeleton for section headers
 */
export function SectionHeaderSkeleton() {
    return (
        <div className="flex items-center gap-3 mb-4">
            <div className={`w-8 h-8 rounded-full ${shimmerClass}`} />
            <div>
                <div className={`h-3 w-32 rounded ${shimmerClass}`} />
                <div className={`h-2 w-48 mt-1 rounded ${shimmerClass}`} />
            </div>
        </div>
    );
}

/**
 * Skeleton for exercise table rows
 */
export function ExerciseRowSkeleton() {
    return (
        <div className="flex items-center justify-between py-2 border-b border-white/5">
            <div className={`h-4 w-40 rounded ${shimmerClass}`} />
            <div className="flex gap-4">
                <div className={`h-4 w-12 rounded ${shimmerClass}`} />
                <div className={`h-4 w-16 rounded ${shimmerClass}`} />
            </div>
        </div>
    );
}

/**
 * Full page skeleton for StrengthPage initial load
 */
export function StrengthPageSkeleton() {
    return (
        <div className="space-y-8 animate-in fade-in duration-300">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => <StatCardSkeleton key={i} />)}
            </div>

            {/* Chart Section */}
            <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-5">
                <SectionHeaderSkeleton />
                <ChartSkeleton height={200} />
            </div>

            {/* Workouts List */}
            <div className="space-y-3">
                <SectionHeaderSkeleton />
                {[1, 2, 3].map(i => <WorkoutCardSkeleton key={i} />)}
            </div>
        </div>
    );
}

/**
 * Inline skeleton for small loading states
 */
export function InlineSkeleton({ width = 60, height = 16 }: { width?: number; height?: number }) {
    return (
        <span
            className={`inline-block rounded ${shimmerClass}`}
            style={{ width, height }}
        />
    );
}
