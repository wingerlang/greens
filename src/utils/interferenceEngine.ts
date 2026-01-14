import {
    UniversalActivity,
    PlannedActivity,
    ExerciseEntry,
    ExerciseType,
    PlannedActivity as PlannedActivityType
} from '../models/types.ts';

// ==========================================
// Formatters
// ==========================================

/**
 * Formats a duration in minutes to a human-readable string.
 * e.g., 124.5 → "2h 4m", 45 → "45 min"
 */
export function formatDuration(minutes: number | undefined): string {
    if (!minutes || minutes <= 0) return '-';
    const rounded = Math.round(minutes);
    if (rounded < 60) return `${rounded} min`;
    const h = Math.floor(rounded / 60);
    const m = rounded % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ==========================================
// Types & Categories
// ==========================================

export type SignalCategory =
    | 'MTOR'        // Anabolic, Strength, Hypertrophy
    | 'AMPK_HIGH'   // Catabolic, High Intensity Cardio
    | 'AMPK_LOW'    // Low Intensity Cardio (Recovery)
    | 'HYBRID'      // Mixed (Hyrox), treats as High Interference
    | 'NEUTRAL'     // Rest, Stretching, etc.
    | 'UNKNOWN';

export type InterferenceRiskLevel = 'NONE' | 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export type InterferenceType =
    | 'INTERFERENCE_EFFECT' // mTOR followed by AMPK (killing gains)
    | 'BAD_SEQUENCING'      // AMPK before mTOR (poor quality)
    | 'DOUBLE_STRENGTH'     // Two strength sessions too close
    | 'RECOVERY_RISK';      // Hybrid followed by high intensity

export interface ConflictWarning {
    id: string;
    date: string;
    type: InterferenceType;
    riskLevel: InterferenceRiskLevel;
    message: string;
    scientificExplanation: string;
    involvedActivityIds: string[];
    suggestion: string;
}

// ==========================================
// Classification Logic
// ==========================================

/**
 * Classifies an activity into a biological signal category.
 */
export function classifyActivity(activity: UniversalActivity | PlannedActivity | ExerciseEntry): SignalCategory {
    // Normalization to handle different shapes (Universal vs Planned vs Entry)
    const rawType = (activity as any).type || (activity as any).activityType || (activity as any).performance?.activityType || '';
    const type = rawType.toUpperCase(); // Normalize to uppercase for comparison
    const category = ((activity as any).category || (activity as any).plan?.activityCategory || '').toUpperCase();
    const intensity = (activity as any).intensity; // 'low' | 'moderate' | 'high'
    const title = ((activity as any).title || (activity as any).name || '').toUpperCase();

    // 1. Check Hybrid Special Case (Hyrox)
    // Also consider hyroxFocus for strength-focused Hyrox
    const hyroxFocus = (activity as any).hyroxFocus;
    if (type === 'HYROX' || title.includes('HYROX')) {
        if (hyroxFocus === 'strength') return 'MTOR';
        if (hyroxFocus === 'cardio') return 'AMPK_HIGH';
        return 'HYBRID'; // Default hybrid
    }

    // 2. Check Strength (mTOR)
    if (type === 'STRENGTH' || category === 'STRENGTH' || title.includes('STYRKA') || title.includes('GYM') || title.includes('WEIGHT')) {
        return 'MTOR';
    }

    // 3. Check Cardio (AMPK)
    const cardioTypes = ['RUN', 'RUNNING', 'CYCLING', 'BIKE', 'SWIMMING', 'ROWING', 'WALKING', 'OTHER'];
    const isCardio = cardioTypes.includes(type) ||
        ['RUN', 'BIKE', 'EASY', 'LONG_RUN', 'INTERVALS', 'TEMPO', 'RECOVERY'].includes(category);

    if (isCardio) {
        // High Intensity Indicators
        if (
            intensity === 'high' || intensity === 'ultra' ||
            category === 'INTERVALS' || category === 'TEMPO' || category === 'RACE' ||
            category === 'VO2MAX' || category === 'THRESHOLD' ||
            title.includes('INTERVALL') || title.includes('TÄVLING') || title.includes('TEMPO')
        ) {
            return 'AMPK_HIGH';
        }

        // Long Duration also triggers significant AMPK even if low intensity
        // We might not have duration here easily without deep inspection, but let's assume LONG_RUN is high signal
        if (category === 'LONG_RUN' || title.includes('LÅNGPASS')) {
            return 'AMPK_HIGH';
        }

        // Low Intensity / Recovery
        if (
            intensity === 'low' ||
            category === 'EASY' || category === 'RECOVERY' ||
            type === 'WALKING' ||
            title.includes('PROMENAD') || title.includes('JOGG')
        ) {
            return 'AMPK_LOW';
        }

        // Default Cardio fallback (Moderate) -> Treat as AMPK_HIGH for safety in interference context?
        // Or create a MEDIUM? For now, let's treat generic 'RUN' without 'EASY' tag as potentially interfering.
        return 'AMPK_HIGH';
    }

    // 4. Neutral
    if (type === 'REST' || category === 'REST' || type === 'YOGA' || type === 'STRETCHING') {
        return 'NEUTRAL';
    }

    return 'UNKNOWN';
}

// ==========================================
// Helper: Time & Sort
// ==========================================

function getTimestamp(activity: any): number {
    // Try to find a real timestamp
    // 1. UniversalActivity.date (YYYY-MM-DD) + potential time fields?
    // Currently models mostly just store Date string.
    // PlannedActivities rarely have time.
    // ExerciseEntries might have createdAt or separate time field?
    // For this MVP, we rely on the Date string.
    // If exact time is missing, we treat it as "Time Unknown (00:00)" relative to sorting,
    // but the analysis logic will handle "Same Day" checks specially.

    const dateStr = activity.date || (activity.plan?.date);
    if (!dateStr) return 0;

    // If we had a startTime field, we would append it here.
    // Assuming YYYY-MM-DD for now.
    return new Date(dateStr).getTime();
}

/**
 * Sorts activities chronologically.
 * Note: If multiple activities on same day without time, order is unstable/unknown.
 */
export function sortActivities(activities: any[]) {
    return [...activities].sort((a, b) => {
        const tA = getTimestamp(a);
        const tB = getTimestamp(b);
        return tA - tB;
    });
}

// ==========================================
// Analysis Engine
// ==========================================

export function analyzeInterference(activities: any[]): ConflictWarning[] {
    const sorted = sortActivities(activities);
    const warnings: ConflictWarning[] = [];

    // Group by Date to simplify "Same Day" checks
    const activitiesByDate: Record<string, any[]> = {};
    for (const act of sorted) {
        const date = act.date || act.plan?.date;
        if (!date) continue;
        if (!activitiesByDate[date]) activitiesByDate[date] = [];
        activitiesByDate[date].push(act);
    }

    // Analyze each day
    for (const [date, dailyActs] of Object.entries(activitiesByDate)) {
        if (dailyActs.length < 2) continue; // No conflicts possible with 1 activity

        // Iterate through pairs in the list
        // Note: Without explicit times, we assume the list order *might* be arbitrary,
        // OR we check all permutations if time is unknown.
        // For Planned Activities, users usually don't set time.
        // So we should flag "Potential Risk" if the combination exists on the same day.

        // Let's gather signals first
        const signals = dailyActs.map(act => ({
            act,
            type: classifyActivity(act),
            id: act.id
        }));

        // Check 1: mTOR + AMPK (Interference)
        const mtorActs = signals.filter(s => s.type === 'MTOR');
        const ampkHighActs = signals.filter(s => s.type === 'AMPK_HIGH' || s.type === 'HYBRID');
        const ampkLowActs = signals.filter(s => s.type === 'AMPK_LOW');

        // High-intensity cardio + Strength = HIGH risk
        if (mtorActs.length > 0 && ampkHighActs.length > 0) {
            warnings.push({
                id: `warn-${date}-interf-high`,
                date,
                type: 'INTERFERENCE_EFFECT',
                riskLevel: 'HIGH',
                message: 'Styrka och Kondition samma dag',
                scientificExplanation: 'Att blanda mTOR-signaler (styrka) med höga AMPK-nivåer (kondition) kan hämma muskeltillväxten. AMPK agerar som en "strömbrytare" som stänger av proteinsyntesen.',
                involvedActivityIds: [...mtorActs.map(s => s.id), ...ampkHighActs.map(s => s.id)],
                suggestion: 'Separera passen med minst 6 timmar. Helst styrka på morgonen och kondition på kvällen, eller tvärtom beroende på prioritering. Om du måste köra direkt efter varandra: Styrka först.'
            });
        }

        // Low-intensity cardio + Strength = MODERATE risk (still affects recovery)
        if (mtorActs.length > 0 && ampkLowActs.length > 0 && ampkHighActs.length === 0) {
            warnings.push({
                id: `warn-${date}-interf-low`,
                date,
                type: 'INTERFERENCE_EFFECT',
                riskLevel: 'MODERATE',
                message: 'Styrka + Lugn löpning samma dag',
                scientificExplanation: 'Även lågintensiv kondition aktiverar AMPK i viss mån. Med kort tid mellan passen kan återhämtningen påverkas negativt.',
                involvedActivityIds: [...mtorActs.map(s => s.id), ...ampkLowActs.map(s => s.id)],
                suggestion: 'Försök att ha minst 4-6 timmar mellan passen. Om du kör cardio direkt efter styrka, håll det kort och lätt.'
            });
        }

        // Check 2: Double Strength
        if (mtorActs.length >= 2) {
            warnings.push({
                id: `warn-${date}-double-str`,
                date,
                type: 'DOUBLE_STRENGTH',
                riskLevel: 'MODERATE',
                message: 'Dubbla styrkepass',
                scientificExplanation: 'Två styrkepass samma dag kräver noggrann planering för att inte överbelasta CNS eller samma muskelgrupper.',
                involvedActivityIds: mtorActs.map(s => s.id),
                suggestion: 'Se till att det är minst 4 timmar mellan passen, eller att du tränar helt olika muskelgrupper (t.ex. Överkropp fm / Underkropp em).'
            });
        }

        // Check 3: Hybrid Analysis
        // If Hybrid + Heavy Strength
        const hybridActs = signals.filter(s => s.type === 'HYBRID');
        if (hybridActs.length > 0 && mtorActs.length > 0) {
            warnings.push({
                id: `warn-${date}-hybrid`,
                date,
                type: 'RECOVERY_RISK',
                riskLevel: 'HIGH',
                message: 'Hyrox + Tung Styrka',
                scientificExplanation: 'Hyrox är extremt energikrävande och skapar både metabol stress och muskelskada. Att kombinera detta med tung styrka samma dag ökar risken för överträning avsevärt.',
                involvedActivityIds: [...hybridActs.map(s => s.id), ...mtorActs.map(s => s.id)],
                suggestion: 'Prioritera återhämtning. Om du måste dubbla, kör styrkan långt ifrån Hyrox-passet och håll volymen låg.'
            });
        }
    }

    return warnings;
}
