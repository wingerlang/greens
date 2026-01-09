// Date Utilities
// ============================================

import { Weekday, WEEKDAYS } from '../models/common.ts';

/**
 * Get ISO date string (YYYY-MM-DD) in local time
 */
export const getISODate = (date: Date = new Date()): string => {
    const d = new Date(date);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
};

/**
 * Get the Monday of the week for a given date
 */
export const getWeekStartDate = (date: Date = new Date()): string => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
    d.setDate(diff);
    return getISODate(d);
};

/**
 * Get weekday key from ISO date string or Date object
 */
export function getWeekdayFromDate(date: string | Date): Weekday | null {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return null;

    // getDay() returns 0-6 where 0 is Sunday
    const jsDay = d.getDay();
    // Convert to Monday-first index: 0=Mon, 1=Tue, ..., 6=Sun
    const weekdayIndex = jsDay === 0 ? 6 : jsDay - 1;
    return WEEKDAYS[weekdayIndex];
}

/**
 * Format date as "16 juli 2025 (3 dagar sedan)"
 */
export function formatDateFull(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    const datePart = date.toLocaleDateString('sv-SE', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    let agoPart = '';
    if (diffDays === 0) agoPart = 'idag';
    else if (diffDays === 1) agoPart = 'igår';
    else if (diffDays < 7) agoPart = `${diffDays} dagar sedan`;
    else if (diffDays < 30) agoPart = `${Math.floor(diffDays / 7)} veckor sedan`;
    else if (diffDays < 365) agoPart = `${Math.floor(diffDays / 30)} mån sedan`;
    else {
        const years = Math.floor(diffDays / 365);
        const months = Math.floor((diffDays % 365) / 30);
        agoPart = months > 0 ? `${years} år ${months} mån sedan` : `${years} år sedan`;
    }

    return `${datePart} (${agoPart})`;
}

/**
 * Format as compact "3d sedan", "2v sedan", "2 år 4 mån sedan"
 */
export function formatDaysAgoCompact(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'idag';
    if (diffDays === 1) return 'igår';
    if (diffDays < 7) return `${diffDays}d sedan`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}v sedan`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} mån sedan`;

    const years = Math.floor(diffDays / 365);
    const months = Math.floor((diffDays % 365) / 30);
    return months > 0 ? `${years} år ${months} mån sedan` : `${years} år sedan`;
}

/**
 * Format as relative date: "Idag", "Igår", "5 dagar sedan", or "15 dec"
 */
export function formatDateRelative(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Idag';
    if (diffDays === 1) return 'Igår';
    if (diffDays < 7) return `${diffDays} dagar sedan`;
    return date.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' });
}

/**
 * Get relative time string in Swedish (e.g., "Idag", "2 dagar sedan", "2 månader sedan")
 * More descriptive than formatDateRelative which falls back to date string.
 */
export function getRelativeTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Idag';
    if (diffDays === 1) return 'Igår';
    if (diffDays < 7) return `${diffDays} dagar sedan`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} veckor sedan`;
    return `${Math.floor(diffDays / 30)} månader sedan`;
}

/**
 * Format a date string to Swedish short format (e.g., "15 dec 2024")
 * Alias for specific formatting needs.
 */
export function formatSwedishDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Short relative format for compact UIs: "Idag", "Igår", "3d sedan", "2v sedan"
 * Alias for formatDaysAgoCompact but ensuring very short output.
 */
export function formatDateShort(dateStr: string): string {
    return formatDaysAgoCompact(dateStr);
}
