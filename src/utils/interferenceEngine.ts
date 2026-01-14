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

    // Get sorted list of dates for consecutive day analysis
    const sortedDates = Object.keys(activitiesByDate).sort();

    // ==========================================
    // SAME-DAY ANALYSIS
    // ==========================================
    for (const [date, dailyActs] of Object.entries(activitiesByDate)) {
        if (dailyActs.length < 2) continue; // No conflicts possible with 1 activity

        // Gather signals
        const signals = dailyActs.map(act => ({
            act,
            type: classifyActivity(act),
            id: act.id,
            startTime: act.startTime, // HH:mm if available
            title: act.title || ''
        }));

        const mtorActs = signals.filter(s => s.type === 'MTOR');
        const ampkHighActs = signals.filter(s => s.type === 'AMPK_HIGH' || s.type === 'HYBRID');
        const ampkLowActs = signals.filter(s => s.type === 'AMPK_LOW');
        const allAmpkActs = [...ampkHighActs, ...ampkLowActs];

        // === Check 1: mTOR + AMPK_HIGH (High Risk Interference) ===
        if (mtorActs.length > 0 && ampkHighActs.length > 0) {
            // Check sequencing if times are available
            const strengthWithTime = mtorActs.filter(s => s.startTime);
            const cardioWithTime = ampkHighActs.filter(s => s.startTime);

            let sequenceWarning = '';
            if (strengthWithTime.length > 0 && cardioWithTime.length > 0) {
                const strengthTime = strengthWithTime[0].startTime;
                const cardioTime = cardioWithTime[0].startTime;
                if (cardioTime < strengthTime) {
                    // Cardio BEFORE strength - BAD ORDER
                    sequenceWarning = ' ⚠️ Felaktig ordning upptäckt: Kondition före Styrka minskar styrkeeffekten avsevärt.';
                }
            }

            warnings.push({
                id: `warn-${date}-interf-high`,
                date,
                type: 'INTERFERENCE_EFFECT',
                riskLevel: 'HIGH',
                message: 'Styrka + Hård kondition samma dag',
                scientificExplanation: 'Att blanda mTOR-signaler (styrka) med höga AMPK-nivåer (intervaller/tempo/långpass) kan hämma muskeltillväxten. AMPK stänger av proteinsyntesen.' + sequenceWarning,
                involvedActivityIds: [...mtorActs.map(s => s.id), ...ampkHighActs.map(s => s.id)],
                suggestion: 'Separera passen med minst 6 timmar. Styrka på morgonen, kondition på kvällen. Om du måste köra nära: Styrka FÖRST.'
            });
        }

        // === Check 2: mTOR + AMPK_LOW (Moderate Risk) ===
        if (mtorActs.length > 0 && ampkLowActs.length > 0 && ampkHighActs.length === 0) {
            warnings.push({
                id: `warn-${date}-interf-low`,
                date,
                type: 'INTERFERENCE_EFFECT',
                riskLevel: 'MODERATE',
                message: 'Styrka + Lugn löpning samma dag',
                scientificExplanation: 'Även lågintensiv kondition aktiverar AMPK i viss mån. Med kort tid mellan passen kan återhämtningen påverkas.',
                involvedActivityIds: [...mtorActs.map(s => s.id), ...ampkLowActs.map(s => s.id)],
                suggestion: 'Försök att ha minst 4-6 timmar mellan passen. Håll löpningen kort och lätt.'
            });
        }

        // === Check 3: Double Strength (CNS Warning) ===
        if (mtorActs.length >= 2) {
            // Check if same muscle groups
            const muscleGroups1 = mtorActs[0].act.muscleGroups || [];
            const muscleGroups2 = mtorActs[1].act.muscleGroups || [];
            const sameMuscles = muscleGroups1.some((m: string) => muscleGroups2.includes(m));

            warnings.push({
                id: `warn-${date}-double-str`,
                date,
                type: 'DOUBLE_STRENGTH',
                riskLevel: sameMuscles ? 'HIGH' : 'MODERATE',
                message: sameMuscles ? 'Dubbla styrkepass (samma muskler!)' : 'Dubbla styrkepass',
                scientificExplanation: sameMuscles
                    ? 'Två tunga pass på samma muskelgrupp samma dag överbelastar både CNS och musklerna. Hög skaderisk.'
                    : 'Två styrkepass samma dag kräver att du tränar helt olika muskelgrupper. CNS belastas oavsett.',
                involvedActivityIds: mtorActs.map(s => s.id),
                suggestion: sameMuscles
                    ? 'Undvik att träna samma muskelgrupp två gånger på en dag. Dela upp på överkropp/underkropp.'
                    : 'Ha minst 4 timmar mellan passen. Morgon: Överkropp, Kväll: Underkropp (eller tvärtom).'
            });
        }

        // === Check 4: Double HARD Cardio ===
        if (ampkHighActs.length >= 2) {
            warnings.push({
                id: `warn-${date}-double-cardio`,
                date,
                type: 'RECOVERY_RISK',
                riskLevel: 'HIGH',
                message: 'Dubbla hårda konditionspass',
                scientificExplanation: 'Två högintensiva konditionspass samma dag (intervaller, tempo, långpass) leder snabbt till överträning, stressfrakturer och hormonstörningar.',
                involvedActivityIds: ampkHighActs.map(s => s.id),
                suggestion: 'Kör endast ETT hårt pass per dag. Om du dubbeltränar kondition: Morgon HÅRT, Kväll LUGNT.'
            });
        }

        // === Check 5: Triple Sessions ===
        if (dailyActs.length >= 3) {
            warnings.push({
                id: `warn-${date}-triple`,
                date,
                type: 'RECOVERY_RISK',
                riskLevel: 'CRITICAL',
                message: 'Trippelpass planerat',
                scientificExplanation: 'Tre träningspass samma dag leder till konstant förhöjda kortisolnivåer, sänkt testosteron och nedsatt immunförsvar. Endast för elitidrottare under mycket specifika förhållanden.',
                involvedActivityIds: dailyActs.map(a => a.id),
                suggestion: 'Undvik trippelpass. Risken för nedbrytning är större än chansen till uppbyggnad för de flesta atleter.'
            });
        }

        // === Check 6: Hyrox + Strength ===
        const hybridActs = signals.filter(s => s.type === 'HYBRID');
        if (hybridActs.length > 0 && mtorActs.length > 0) {
            warnings.push({
                id: `warn-${date}-hybrid`,
                date,
                type: 'RECOVERY_RISK',
                riskLevel: 'HIGH',
                message: 'Hyrox + Styrka samma dag',
                scientificExplanation: 'Hyrox aktiverar extrema nivåer av både mTOR (styrkedelen) och AMPK (löpningen). Att lägga till ytterligare styrka samma dag överbelastar kroppen totalt.',
                involvedActivityIds: [...hybridActs.map(s => s.id), ...mtorActs.map(s => s.id)],
                suggestion: 'Prioritera återhämtning dagen efter Hyrox. Om du måste kombinera, håll styrkan mycket lätt.'
            });
        }
    }

    // ==========================================
    // CONSECUTIVE DAY ANALYSIS
    // ==========================================
    for (let i = 0; i < sortedDates.length - 1; i++) {
        const today = sortedDates[i];
        const tomorrow = sortedDates[i + 1];

        // Check if actually consecutive days
        const todayDate = new Date(today);
        const tomorrowDate = new Date(tomorrow);
        const dayDiff = (tomorrowDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24);
        if (dayDiff !== 1) continue; // Not consecutive

        const todayActs = activitiesByDate[today];
        const tomorrowActs = activitiesByDate[tomorrow];

        const todaySignals = todayActs.map(act => ({ type: classifyActivity(act), act, id: act.id }));
        const tomorrowSignals = tomorrowActs.map(act => ({ type: classifyActivity(act), act, id: act.id }));

        // Check: Heavy legs (evening) → Morning run next day
        const todayLegStrength = todaySignals.filter(s =>
            s.type === 'MTOR' &&
            (s.act.muscleGroups?.includes('legs') || s.act.title?.toLowerCase().includes('ben'))
        );
        const tomorrowMorningCardio = tomorrowSignals.filter(s =>
            (s.type === 'AMPK_HIGH' || s.type === 'AMPK_LOW') &&
            (!s.act.startTime || s.act.startTime < '10:00')
        );

        if (todayLegStrength.length > 0 && tomorrowMorningCardio.length > 0) {
            warnings.push({
                id: `warn-${tomorrow}-legs-run`,
                date: tomorrow,
                type: 'RECOVERY_RISK',
                riskLevel: 'HIGH',
                message: 'Benträning igår → Löpning idag',
                scientificExplanation: 'Efter tung benträning behöver musklerna sova för återhämtning. Tidig morgonlöpning dagen efter avbryter reparationsprocessen och ökar skaderisken.',
                involvedActivityIds: [...todayLegStrength.map(s => s.id), ...tomorrowMorningCardio.map(s => s.id)],
                suggestion: 'Flytta löpningen till eftermiddag/kväll, eller gör den mycket lätt (återhämtningsjogg max 30 min).'
            });
        }
    }

    return warnings;
}

