import React from 'react';
import { useSettings } from '../../context/SettingsContext.tsx';

interface DoubleCircularProgressProps {
    value: number;
    max: number;
    innerValue: number;
    innerMax: number;
    label: string;
    subLabel?: React.ReactNode;
}

/**
 * Enhanced double circular progress indicator.
 * Shows two concentric progress rings - outer for calories, inner for protein.
 * Automatically adapts to density settings.
 */
export const DoubleCircularProgress = ({
    value,
    max,
    innerValue,
    innerMax,
    label,
    subLabel
}: DoubleCircularProgressProps) => {
    const isProteinMet = innerValue >= innerMax;
    const isOver = value > max;

    const { settings } = useSettings();
    const density = settings.densityMode || 'cozy';

    // Density mapping
    const sizes = {
        compact: {
            radius: 50,
            stroke: 6,
            innerRadius: 36,
            innerStroke: 4,
            text: 'text-2xl',
            icon: 16
        },
        slim: {
            radius: 85,
            stroke: 9,
            innerRadius: 65,
            innerStroke: 6,
            text: 'text-4xl',
            icon: 24
        },
        cozy: {
            radius: 110,
            stroke: 12,
            innerRadius: 85,
            innerStroke: 10,
            text: 'text-5xl',
            icon: 28
        }
    }[density];

    const r = sizes.radius;
    const s = sizes.stroke;
    const ir = sizes.innerRadius;
    const is = sizes.innerStroke;

    const normalizedRadius = r - s * 2;
    const circumference = normalizedRadius * 2 * Math.PI;
    const strokeDashoffset = circumference - (Math.min(value, max * 1.5) / max) * circumference;

    const normalizedInnerRadius = ir - is * 2;
    const innerCircumference = normalizedInnerRadius * 2 * Math.PI;
    const innerStrokeDashoffset = innerCircumference - (Math.min(innerValue, innerMax) / innerMax) * innerCircumference;

    return (
        <div className="relative flex items-center justify-center">
            <svg
                height={r * 2}
                width={r * 2}
                className="transform -rotate-90"
            >
                <circle
                    stroke="currentColor"
                    className="text-slate-100 dark:text-slate-800"
                    strokeWidth={s}
                    fill="transparent"
                    r={normalizedRadius}
                    cx={r}
                    cy={r}
                />
                <circle
                    stroke="currentColor"
                    className={`${isOver ? 'text-rose-500' : 'text-slate-900 dark:text-white'} transition-colors duration-500`}
                    strokeWidth={s}
                    strokeDasharray={circumference + ' ' + circumference}
                    style={{ strokeDashoffset, transition: 'stroke-dashoffset 0.5s ease-in-out' }}
                    strokeLinecap="round"
                    fill="transparent"
                    r={normalizedRadius}
                    cx={r}
                    cy={r}
                />
                <circle
                    stroke="currentColor"
                    className="text-slate-100 dark:text-slate-800/50"
                    strokeWidth={is}
                    fill="transparent"
                    r={normalizedInnerRadius}
                    cx={r}
                    cy={r}
                />
                <circle
                    stroke="currentColor"
                    className={`${isProteinMet ? 'text-emerald-500' : 'text-orange-400'} transition-colors duration-500`}
                    strokeWidth={is}
                    strokeDasharray={innerCircumference + ' ' + innerCircumference}
                    style={{ strokeDashoffset: innerStrokeDashoffset, transition: 'stroke-dashoffset 0.5s ease-in-out' }}
                    strokeLinecap="round"
                    fill="transparent"
                    r={normalizedInnerRadius}
                    cx={r}
                    cy={r}
                />
            </svg>
            <div className="absolute flex flex-col items-center justify-center text-center">
                <div className={`${sizes.text} font-bold leading-none ${isOver ? 'text-rose-500' : 'text-slate-900 dark:text-white'}`}>
                    {Math.round(value)}
                </div>
                <div className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider">{label}</div>
                <div className="mt-2 flex items-center gap-1.5 text-xs font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                    <div className={`w-2 h-2 rounded-full ${isProteinMet ? 'bg-emerald-500' : 'bg-orange-400'}`} />
                    <span className="text-slate-700 dark:text-slate-300">
                        {Math.round(innerValue)}/{innerMax}g
                    </span>
                </div>

                {/* Micro-nutrient indicator (mock) */}
                <div className="mt-1 flex gap-0.5">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="w-1 h-1 rounded-full bg-emerald-500/50" />
                    ))}
                </div>
            </div>
        </div>
    );
};
