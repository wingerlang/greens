import React from 'react';
import { useSettings } from '../../context/SettingsContext.tsx';

export const DoubleCircularProgress = ({
    value,
    max,
    innerValue,
    innerMax,
    label,
    subLabel,
    displayValue
}: {
    value: number,
    max: number,
    innerValue: number,
    innerMax: number,
    label: string,
    subLabel?: React.ReactNode,
    displayValue?: number | string
}) => {
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
            text: 'text-xl',
            icon: 14
        },
        slim: {
            radius: 85,
            stroke: 9,
            innerRadius: 65,
            innerStroke: 6,
            text: 'text-3xl',
            icon: 20
        },
        cozy: {
            radius: 110,
            stroke: 12,
            innerRadius: 85,
            innerStroke: 10,
            text: 'text-4xl',
            icon: 24
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
                    {displayValue !== undefined ? displayValue : Math.round(value)}
                </div>
                <div className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider">{label}</div>
            </div>
        </div>
    );
};
