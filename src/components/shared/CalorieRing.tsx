import React from 'react';

interface CalorieRingProps {
    calories: number;
    calorieGoal: number;
    protein: number;
    proteinGoal: number;
    /** Size: 'sm', 'md', 'lg' */
    size?: 'sm' | 'md' | 'lg';
}

/**
 * Double circular progress component for calories (outer) and protein (inner).
 * Extracted from Dashboard for reuse.
 */
export function CalorieRing({
    calories,
    calorieGoal,
    protein,
    proteinGoal,
    size = 'md'
}: CalorieRingProps) {
    const isProteinMet = protein >= proteinGoal;
    const isOver = calories > calorieGoal;

    const sizes = {
        sm: { radius: 50, stroke: 6, innerRadius: 36, innerStroke: 4, text: 'text-xl', icon: 14 },
        md: { radius: 85, stroke: 9, innerRadius: 65, innerStroke: 6, text: 'text-3xl', icon: 20 },
        lg: { radius: 110, stroke: 12, innerRadius: 85, innerStroke: 10, text: 'text-4xl', icon: 24 }
    }[size];

    const r = sizes.radius;
    const s = sizes.stroke;
    const ir = sizes.innerRadius;
    const is = sizes.innerStroke;

    const normalizedRadius = r - s * 2;
    const circumference = normalizedRadius * 2 * Math.PI;
    const strokeDashoffset = circumference - (Math.min(calories, calorieGoal * 1.5) / calorieGoal) * circumference;

    const normalizedInnerRadius = ir - is * 2;
    const innerCircumference = normalizedInnerRadius * 2 * Math.PI;
    const innerStrokeDashoffset = innerCircumference - (Math.min(protein, proteinGoal) / proteinGoal) * innerCircumference;

    return (
        <div className="relative flex items-center justify-center">
            <svg
                height={r * 2}
                width={r * 2}
                className="transform -rotate-90"
            >
                {/* Outer background */}
                <circle
                    stroke="currentColor"
                    className="text-slate-100 dark:text-slate-800"
                    strokeWidth={s}
                    fill="transparent"
                    r={normalizedRadius}
                    cx={r}
                    cy={r}
                />
                {/* Outer progress */}
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
                {/* Inner background */}
                <circle
                    stroke="currentColor"
                    className="text-slate-100 dark:text-slate-800/50"
                    strokeWidth={is}
                    fill="transparent"
                    r={normalizedInnerRadius}
                    cx={r}
                    cy={r}
                />
                {/* Inner progress */}
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
                    {Math.round(calories)}
                </div>
                <div className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider">Kcal</div>
                <div className="mt-2 flex flex-col items-center gap-0.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                        <div className={`w-2 h-2 rounded-full ${isProteinMet ? 'bg-emerald-500' : 'bg-orange-400'}`} />
                        <span className="text-slate-700 dark:text-slate-300">
                            {Math.round(protein)}/{proteinGoal}g
                        </span>
                    </div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                        Protein
                    </span>
                </div>
            </div>
        </div>
    );
}
