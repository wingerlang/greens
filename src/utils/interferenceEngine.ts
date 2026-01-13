import {
    UniversalActivity,
    PlannedActivity,
    ExerciseEntry,
    ExerciseType,
    PlannedActivity as PlannedActivityType
} from '../models/types.ts';

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
    const type = (activity as any).type || (activity as any).activityType || (activity as any).performance?.activityType;
    const category = (activity as any).category || (activity as any).plan?.activityCategory; // Planned category
    const intensity = (activity as any).intensity; // 'low' | 'moderate' | 'high'
    const title = ((activity as any).title || (activity as any).name || '').toUpperCase();

    // 1. Check Hybrid Special Case
    if (type === 'HYROX' || title.includes('HYROX')) {
        return 'HYBRID';
    }

    // 2. Check Strength (mTOR)
    if (type === 'STRENGTH' || category === 'STRENGTH' || title.includes('STYRKA') || title.includes('GYM')) {
        return 'MTOR';
    }

    // 3. Check Cardio (AMPK)
    const isCardio = ['RUN', 'RUNNING', 'CYCLING', 'BIKE', 'SWIMMING', 'ROWING'].includes(type) ||
                     ['RUN', 'BIKE'].includes(category);

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

        // Check 1: mTOR + AMPK_HIGH (Interference)
        const mtorActs = signals.filter(s => s.type === 'MTOR');
        const ampkActs = signals.filter(s => s.type === 'AMPK_HIGH' || s.type === 'HYBRID');

        if (mtorActs.length > 0 && ampkActs.length > 0) {
            // We have both on same day.
            // Since we don't know time, we must warn about spacing/order.

            warnings.push({
                id: `warn-${date}-interf`,
                date,
                type: 'INTERFERENCE_EFFECT',
                riskLevel: 'HIGH',
                message: 'Styrka och Kondition samma dag',
                scientificExplanation: 'Att blanda mTOR-signaler (styrka) med höga AMPK-nivåer (kondition) kan hämma muskeltillväxten. AMPK agerar som en "strömbrytare" som stänger av proteinsyntesen.',
                involvedActivityIds: [...mtorActs.map(s => s.id), ...ampkActs.map(s => s.id)],
                suggestion: 'Separera passen med minst 6 timmar. Helst styrka på morgonen och kondition på kvällen, eller tvärtom beroende på prioritering. Om du måste köra direkt efter varandra: Styrka först.'
            });

            // Check Sequence specifically (if we had times, we would be more precise)
            // But biologically: Cardio FIRST is bad for Strength Performance. Strength FIRST is bad for Endurance adaptation (slightly) but better for Hypertrophy.
            // The prompt says: "Felaktig ordning: Kondition först -> Styrka sist."

            // Since we can't be sure of order without time, we add a specific sequencing tip to the warning above or a separate one?
            // Let's add a separate specialized warning if we suspect bad order?
            // Actually, without time, 'Interference' covers the general clash.
            // 'Bad Sequencing' is a specific sub-case.

            // Let's just output the Interference warning with the suggestion covering the order.
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
