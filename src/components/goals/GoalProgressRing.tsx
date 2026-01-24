/**
 * GoalProgressRing - Animated SVG progress ring component v2
 * Enhanced with smoother animations and better visual effects
 */

import React, { useEffect, useState } from "react";

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
  color,
  bgColor = "rgba(255,255,255,0.05)",
  children,
  showPercentage = true,
  animated = true,
  className = "",
}: GoalProgressRingProps) {
  // Animate progress from 0 on mount
  const [displayProgress, setDisplayProgress] = useState(
    animated ? 0 : percentage,
  );

  useEffect(() => {
    if (animated) {
      const timer = setTimeout(() => {
        setDisplayProgress(percentage);
      }, 100);
      return () => clearTimeout(timer);
    } else {
      setDisplayProgress(percentage);
    }
  }, [percentage, animated]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(100, Math.max(0, displayProgress));
  const offset = circumference - (progress / 100) * circumference;

  // Smart color selection based on progress
  const getProgressColor = () => {
    if (color) return color;
    if (progress >= 100) return "#10b981"; // Emerald - complete
    if (progress >= 80) return "#10b981"; // Emerald - almost there
    if (progress >= 60) return "#3b82f6"; // Blue - good progress
    if (progress >= 40) return "#8b5cf6"; // Purple - okay
    if (progress >= 20) return "#f59e0b"; // Amber - needs work
    return "#ef4444"; // Red - just started
  };

  const progressColor = getProgressColor();

  // Create gradient ID unique to this instance
  const gradientId = `ring-gradient-${Math.random().toString(36).slice(2)}`;

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
    >
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
        style={{
          filter: progress >= 75
            ? `drop-shadow(0 0 ${strokeWidth}px ${progressColor}40)`
            : "none",
        }}
      >
        {/* Gradient definition */}
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={progressColor} />
            <stop offset="100%" stopColor={progressColor} stopOpacity={0.7} />
          </linearGradient>
        </defs>

        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={bgColor}
          strokeWidth={strokeWidth}
        />

        {/* Subtle track marks for visual interest */}
        {size >= 80 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.02)"
            strokeWidth={strokeWidth - 2}
            strokeDasharray="2 8"
          />
        )}

        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: animated
              ? "stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.3s ease"
              : "none",
          }}
        />

        {/* Glow effect for high progress */}
        {progress >= 60 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={progressColor}
            strokeWidth={strokeWidth + 6}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            opacity={0.15}
            style={{
              transition: animated
                ? "stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)"
                : "none",
              filter: "blur(6px)",
            }}
          />
        )}

        {/* Progress tip highlight */}
        {progress > 5 && progress < 100 && size >= 60 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="white"
            strokeWidth={strokeWidth * 0.6}
            strokeLinecap="round"
            strokeDasharray={`${strokeWidth * 0.3} ${circumference}`}
            strokeDashoffset={offset - strokeWidth * 0.15}
            opacity={0.5}
            style={{
              transition: animated
                ? "stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)"
                : "none",
            }}
          />
        )}
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex items-center justify-center flex-col">
        {children ? children : showPercentage
          ? (
            <>
              <span
                className="font-black text-white leading-none"
                style={{
                  fontSize: size / 3.5,
                  letterSpacing: "-0.03em",
                }}
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
          )
          : null}
      </div>

      {/* Completion celebration effect */}
      {progress >= 100 && (
        <>
          {/* Outer pulse ring */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              animation: "ringPulse 2s ease-in-out infinite",
            }}
          >
            <svg width={size} height={size} className="transform -rotate-90">
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius + 6}
                fill="none"
                stroke={progressColor}
                strokeWidth={1.5}
                opacity={0.4}
              />
            </svg>
          </div>

          {/* Inner shimmer */}
          <div
            className="absolute inset-0 pointer-events-none rounded-full"
            style={{
              background:
                `radial-gradient(circle, ${progressColor}10 0%, transparent 70%)`,
              animation: "shimmer 3s ease-in-out infinite",
            }}
          />
        </>
      )}

      <style>
        {`
                @keyframes ringPulse {
                    0%, 100% { 
                        transform: scale(1);
                        opacity: 0.4;
                    }
                    50% { 
                        transform: scale(1.05);
                        opacity: 0.2;
                    }
                }
                @keyframes shimmer {
                    0%, 100% { opacity: 0.3; }
                    50% { opacity: 0.6; }
                }
            `}
      </style>
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
  color,
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
