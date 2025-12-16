/**
 * WeekHeader - Week navigation and title
 */

import React from 'react';
import { type Weekday } from '../../models/types.ts';

interface WeekHeaderProps {
    weekNumber: number;
    weekStartDate: string;
    onPrevWeek: () => void;
    onNextWeek: () => void;
    onRandomizeWeek?: () => void;
}

export function WeekHeader({
    weekNumber,
    weekStartDate,
    onPrevWeek,
    onNextWeek,
    onRandomizeWeek,
}: WeekHeaderProps) {
    return (
        <div className="weekly-header">
            <h1 className="text-3xl font-bold text-slate-100">Veckans Meny</h1>

            <div className="week-nav">
                <button
                    className="nav-btn"
                    onClick={onPrevWeek}
                    aria-label="Föregående vecka"
                >
                    ◀
                </button>

                <div className="week-display">
                    <span className="week-label">VECKA</span>
                    <span className="week-number">{weekNumber}</span>
                </div>

                <button
                    className="nav-btn"
                    onClick={onNextWeek}
                    aria-label="Nästa vecka"
                >
                    ▶
                </button>
            </div>

            <div className="header-actions">
                {onRandomizeWeek && (
                    <button
                        className="btn btn-secondary"
                        onClick={onRandomizeWeek}
                        title="Slumpa tomma platser"
                    >
                        🎲 Slumpa veckan
                    </button>
                )}
            </div>
        </div>
    );
}

export default WeekHeader;
