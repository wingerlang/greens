/**
 * Adaptation Engine
 * Analyzes feedback patterns and generates training adaptation suggestions.
 */

import {
    FeedbackEntry,
    FatigueTrend,
    AdaptationSuggestion,
    PlannedActivity,
    generateId
} from '../../models/types.ts';

// Constants for fatigue calculation
const ACUTE_WINDOW_DAYS = 7;
const CHRONIC_WINDOW_DAYS = 28;
const HIGH_FATIGUE_THRESHOLD = 70;
const OVERTRAINING_TSB_THRESHOLD = -20;
const INJURY_RISK_CONSECUTIVE_HARD = 3;

/**
 * Calculate fatigue score from feedback metrics (0-100)
 */
export function calculateFatigueScore(feedback: FeedbackEntry): number {
    let score = 0;

    // RPE contributes 40% (RPE 10 = 40 points)
    score += (feedback.rpe / 10) * 40;

    // Difficulty contributes 20%
    const difficultyMap = { 'EASY': 5, 'PERFECT': 10, 'HARD': 15, 'TOO_HARD': 20 };
    score += difficultyMap[feedback.perceivedDifficulty] || 10;

    // Poor sleep increases fatigue (20%)
    if (feedback.sleepQuality) {
        score += (6 - feedback.sleepQuality) * 4; // 1=20, 5=4
    }

    // High stress increases fatigue (10%)
    if (feedback.stressLevel) {
        score += (feedback.stressLevel - 1) * 2.5; // 1=0, 5=10
    }

    // Soreness adds fatigue (10%)
    const sorenessMap = { 'none': 0, 'mild': 3, 'moderate': 7, 'severe': 10 };
    score += sorenessMap[feedback.musclesSoreness || 'none'];

    return Math.min(100, Math.max(0, score));
}

/**
 * Calculate training load from a planned activity (TSS-like metric)
 */
export function calculateActivityLoad(activity: PlannedActivity): number {
    const distance = activity.estimatedDistance || 0;
    const categoryMultiplier = {
        'LONG_RUN': 1.2,
        'INTERVALS': 1.5,
        'TEMPO': 1.3,
        'EASY': 0.8,
        'RECOVERY': 0.5,
        'REPETITION': 1.4
    };
    return distance * (categoryMultiplier[activity.category] || 1);
}

/**
 * Calculate rolling load for a date range
 */
export function calculateRollingLoad(
    activities: PlannedActivity[],
    feedbackEntries: FeedbackEntry[],
    endDate: string,
    windowDays: number
): number {
    const startTime = new Date(endDate).getTime() - (windowDays * 24 * 60 * 60 * 1000);

    return activities
        .filter(a => {
            const actTime = new Date(a.date).getTime();
            return actTime >= startTime && actTime <= new Date(endDate).getTime() && a.status === 'COMPLETED';
        })
        .reduce((sum, a) => sum + calculateActivityLoad(a), 0);
}

/**
 * Generate fatigue trend data for a date range
 */
export function generateFatigueTrends(
    activities: PlannedActivity[],
    feedbackEntries: FeedbackEntry[],
    days: number = 30
): FatigueTrend[] {
    const trends: FatigueTrend[] = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split('T')[0];

        const dayFeedback = feedbackEntries.find(f => f.date === dateStr);
        const fatigueScore = dayFeedback ? calculateFatigueScore(dayFeedback) : 0;

        const acuteLoad = calculateRollingLoad(activities, feedbackEntries, dateStr, ACUTE_WINDOW_DAYS);
        const chronicLoad = calculateRollingLoad(activities, feedbackEntries, dateStr, CHRONIC_WINDOW_DAYS);

        const tsb = chronicLoad > 0 ? chronicLoad - acuteLoad : 0;

        trends.push({
            date: dateStr,
            fatigueScore,
            acuteLoad,
            chronicLoad,
            trainingStressBalance: tsb
        });
    }

    return trends;
}

/**
 * Analyze feedback and generate adaptation suggestions
 */
export function generateAdaptationSuggestions(
    activities: PlannedActivity[],
    feedbackEntries: FeedbackEntry[],
    upcomingActivities: PlannedActivity[]
): AdaptationSuggestion[] {
    const suggestions: AdaptationSuggestion[] = [];
    const now = new Date();
    const recentFeedback = feedbackEntries
        .filter(f => new Date(f.date).getTime() > now.getTime() - 14 * 24 * 60 * 60 * 1000)
        .sort((a, b) => b.date.localeCompare(a.date));

    if (recentFeedback.length === 0) return suggestions;

    // Check for consecutive hard sessions
    const consecutiveHard = recentFeedback
        .slice(0, INJURY_RISK_CONSECUTIVE_HARD)
        .filter(f => f.perceivedDifficulty === 'HARD' || f.perceivedDifficulty === 'TOO_HARD');

    if (consecutiveHard.length >= INJURY_RISK_CONSECUTIVE_HARD) {
        suggestions.push({
            id: generateId(),
            type: 'injury_risk',
            severity: 'warning',
            message: `Du har rapporterat ${consecutiveHard.length} tunga pass i rad. Överväg att lägga in extra vila.`,
            suggestedAction: 'Byt nästa kvalitetspass mot ett lugnt distanspass.',
            affectedDates: upcomingActivities.slice(0, 2).map(a => a.date),
            createdAt: now.toISOString()
        });
    }

    // Check for high fatigue trend
    const avgFatigue = recentFeedback.reduce((sum, f) => sum + calculateFatigueScore(f), 0) / recentFeedback.length;
    if (avgFatigue > HIGH_FATIGUE_THRESHOLD) {
        suggestions.push({
            id: generateId(),
            type: 'reduce_volume',
            severity: 'critical',
            message: `Din genomsnittliga trötthet (${Math.round(avgFatigue)}%) är hög. Risk för överträning.`,
            suggestedAction: 'Minska veckovolymen med 20-30% nästa vecka.',
            createdAt: now.toISOString()
        });
    }

    // Check for injuries
    const recentInjuries = recentFeedback.filter(f => f.injuryFlag);
    if (recentInjuries.length > 0) {
        const locations = [...new Set(recentInjuries.map(f => f.injuryLocation).filter(Boolean))];
        suggestions.push({
            id: generateId(),
            type: 'injury_risk',
            severity: 'critical',
            message: `Du har rapporterat skada/smärta (${locations.join(', ') || 'ospecificerad'}). Prioritera återhämtning.`,
            suggestedAction: 'Överväg att vila helt eller byt till cross-training utan belastning.',
            createdAt: now.toISOString()
        });
    }

    // Check for poor sleep pattern
    const poorSleepCount = recentFeedback.filter(f => f.sleepQuality && f.sleepQuality <= 2).length;
    if (poorSleepCount >= 3) {
        suggestions.push({
            id: generateId(),
            type: 'add_recovery',
            severity: 'warning',
            message: `Du har rapporterat dålig sömn ${poorSleepCount} gånger senaste veckan. Sömn är kritisk för återhämtning.`,
            suggestedAction: 'Prioritera 7-9 timmars sömn och undvik hårda pass vid sömnbrist.',
            createdAt: now.toISOString()
        });
    }

    // Check for TSB (Training Stress Balance)
    const trends = generateFatigueTrends(activities, feedbackEntries, 7);
    const latestTSB = trends[trends.length - 1]?.trainingStressBalance || 0;
    if (latestTSB < OVERTRAINING_TSB_THRESHOLD) {
        suggestions.push({
            id: generateId(),
            type: 'overtraining_risk',
            severity: 'critical',
            message: `Din träningsbalans (TSB: ${Math.round(latestTSB)}) indikerar stor belastning. Återhämtningsvecka rekommenderas.`,
            suggestedAction: 'Planera en lättare vecka med 50% volym.',
            affectedDates: upcomingActivities.map(a => a.date),
            createdAt: now.toISOString()
        });
    }

    return suggestions;
}

/**
 * Calculate recommended volume adjustment based on fatigue
 */
export function calculateVolumeAdjustment(fatigueTrends: FatigueTrend[]): number {
    if (fatigueTrends.length < 7) return 1.0;

    const recentTrends = fatigueTrends.slice(-7);
    const avgTSB = recentTrends.reduce((sum, t) => sum + t.trainingStressBalance, 0) / recentTrends.length;

    if (avgTSB < -15) return 0.7;  // 30% reduction
    if (avgTSB < -10) return 0.85; // 15% reduction
    if (avgTSB < -5) return 0.95;  // 5% reduction
    if (avgTSB > 10) return 1.1;   // 10% increase (fresh, can push)
    return 1.0;
}
