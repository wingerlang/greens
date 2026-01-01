/**
 * GoalProgressRing - Animated SVG progress ring component
 */

import React from 'react';

interface GoalProgressRingProps {
    percentage: number;
    size?: number;
    strokeWidth?: number;
    color?: string;
    bgColor?: string;
    children?: React.ReactNode;
    showPercentage?: boolean;
    animated?: boolean;
    className?: string;
}

export function GoalProgressRing({
    percentage,
    size = 120,
    strokeWidth = 8,
    color = '#10b981',
    bgColor = 'rgba(255,255,255,0.05)',
    children,
    showPercentage = true,
    animated = true,
    className = ''
}: GoalProgressRingProps) {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const progress = Math.min(100, Math.max(0, percentage));
    const offset = circumference - (progress / 100) * circumference;

    // Determine color based on percentage if not explicitly set
    const progressColor = color === '#10b981'
        ? progress >= 100
            ? '#10b981' // Emerald for complete
            : progress >= 75
                ? '#10b981' // Emerald
                : progress >= 50
                    ? '#3b82f6' // Blue
                    : progress >= 25
                        ? '#f59e0b' // Amber
                        : '#ef4444' // Red
        : color;

    return (
        <div className={`relative inline-flex items-center justify-center ${className}`}>
            <svg
                width={size}
                height={size}
                className="transform -rotate-90"
            >
                {/* Background circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={bgColor}
                    strokeWidth={strokeWidth}
                />
                {/* Progress circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={progressColor}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    style={{
                        transition: animated ? 'stroke-dashoffset 0.8s ease-out, stroke 0.3s ease' : 'none'
                    }}
                />
                {/* Glow effect for high progress */}
                {progress >= 75 && (
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke={progressColor}
                        strokeWidth={strokeWidth + 4}
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        opacity={0.2}
                        style={{
                            transition: animated ? 'stroke-dashoffset 0.8s ease-out' : 'none',
                            filter: 'blur(4px)'
                        }}
                    />
                )}
            </svg>

            {/* Center content */}
            <div className="absolute inset-0 flex items-center justify-center flex-col">
                {children ? (
                    children
                ) : showPercentage ? (
                    <>
                        <span
                            className="font-black text-white"
                            style={{ fontSize: size / 4 }}
                        >
                            {Math.round(progress)}
                        </span>
                        <span
                            className="text-slate-500 font-bold uppercase"
                            style={{ fontSize: size / 10 }}
                        >
                            %
                        </span>
                    </>
                ) : null}
            </div>

            {/* Completion burst effect */}
            {progress >= 100 && (
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        animation: 'pulse 2s ease-in-out infinite'
                    }}
                >
                    <svg width={size} height={size} className="transform -rotate-90">
                        <circle
                            cx={size / 2}
                            cy={size / 2}
                            r={radius + 4}
                            fill="none"
                            stroke={progressColor}
                            strokeWidth={2}
                            opacity={0.3}
                        />
                    </svg>
                </div>
            )}
        </div>
    );
}

// Mini version for compact displays
interface MiniProgressRingProps {
    percentage: number;
    size?: number;
    color?: string;
}

export function MiniProgressRing({
    percentage,
    size = 24,
    color
}: MiniProgressRingProps) {
    return (
        <GoalProgressRing
            percentage={percentage}
            size={size}
            strokeWidth={3}
            color={color}
            showPercentage={false}
            animated={true}
        />
    );
}
