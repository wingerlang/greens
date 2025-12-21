import { Competition, CompetitionRule, ExerciseEntry, MealEntry, DailyVitals, NutritionSummary, User } from '../models/types.ts';

export const COMPETITION_PRESETS: Omit<CompetitionRule, 'id'>[] = [
    { presetId: 'vegan_day', name: 'Vegansk dag', description: 'Ätit 100% veganskt hela dagen', points: 1, type: 'diet' },
    { presetId: 'interval_run', name: 'Intervallpass', description: 'Genomfört ett intervall-löppass', points: 2, type: 'activity' },
    { presetId: 'long_run', name: 'Långpass', description: 'Löpning > 90 min eller > 15km', points: 2, type: 'activity' },
    { presetId: 'any_workout', name: 'Dagens pass', description: 'Vilken typ av träning som helst', points: 1, type: 'activity' },
    { presetId: 'cold_shower', name: 'Isbad/Kall dusch', description: 'Mental styrka!', points: 1, type: 'custom' },
    { presetId: 'meditation', name: 'Meditation', description: 'Minst 10 minuter mindfulness', points: 1, type: 'custom' },
    { presetId: 'no_caffeine', name: 'Koffeinfri dag', description: 'Noll kaffe/nocco idag', points: 1, type: 'metric' },
    { presetId: 'sleep_goal', name: 'Sömnmål', description: 'Nått ditt personliga sömnmål', points: 1, type: 'metric' },
    { presetId: 'water_goal', name: 'Vattenmål', description: 'Nått ditt vattenmål', points: 1, type: 'metric' },
    { presetId: 'sugar_free', name: 'Sockerfri dag', description: 'Inga godis/snacks loggade', points: 1, type: 'diet' },
    { presetId: 'tonnage_king', name: 'Tonnage-kung', description: 'Mest lyft per kg kroppsvikt', points: 3, type: 'activity' },
    { presetId: 'yoga_mobility', name: 'Yoga/Rörlighet', description: 'Minst 20 min rörlighet', points: 1, type: 'activity' },
    { presetId: 'early_bird', name: 'Morgonpass', description: 'Träning innan kl 08:00', points: 1, type: 'activity' },
    { presetId: 'protein_goal', name: 'Protein-maskin', description: 'Nått ditt protein-mål', points: 1, type: 'diet' },
    { presetId: 'fiber_goal', name: 'Fiber-rik', description: 'Minst 30g fiber', points: 1, type: 'diet' },
    { presetId: 'early_to_bed', name: 'Tidigt i säng', description: 'I säng innan kl 22:30', points: 1, type: 'custom' },
    { presetId: 'social_training', name: 'Social träning', description: 'Tränat tillsammans med någon', points: 2, type: 'activity' },
    { presetId: 'personal_best', name: 'Personbästa', description: 'Slagit ett PB idag!', points: 3, type: 'activity' },
    { presetId: 'clean_eating', name: 'Clean Eating', description: 'Ingen processad mat loggad', points: 2, type: 'diet' },
    { presetId: 'step_king', name: '10k Steg', description: 'Nått 10 000 steg (loggad promenad)', points: 1, type: 'activity' },
    { presetId: 'weekly_king', name: 'Veckans kung/drottning', description: 'Mest poäng totalt under veckan', points: 5, type: 'custom' },
    { presetId: 'total_tonnage_20t', name: 'Volym-monster', description: 'Lyft totalt över 20 ton på ett pass', points: 2, type: 'activity' },
    { presetId: 'double_session', name: 'Dubbla pass', description: 'Minst två separata träningspass', points: 2, type: 'activity' },
    { presetId: 'ultra_run', name: 'Ultralöpning', description: 'Sprungit längre än 3 timmar', points: 5, type: 'activity' },
];

/**
 * Calculates scores for a specific user and date based on competition rules
 */
export function calculateDailyPoints(
    date: string,
    rules: CompetitionRule[],
    vitals: DailyVitals,
    exercises: ExerciseEntry[],
    nutrition: NutritionSummary,
    weight: number = 70
): number {
    let dayScore = 0;

    for (const rule of rules) {
        let achieved = false;

        switch (rule.presetId) {
            case 'vegan_day':
                achieved = nutrition.calories > 0; // Everything is vegan in this app
                break;
            case 'interval_run':
                achieved = exercises.some(e => e.date === date && e.subType === 'interval');
                break;
            case 'long_run':
                achieved = exercises.some(e => e.date === date && (e.subType === 'long-run' || e.durationMinutes > 90));
                break;
            case 'any_workout':
                achieved = exercises.some(e => e.date === date);
                break;
            case 'no_caffeine':
                achieved = (vitals.caffeine || 0) === 0;
                break;
            case 'sleep_goal':
                achieved = vitals.sleep >= 7; // Default or could pass settings
                break;
            case 'water_goal':
                achieved = vitals.water >= 6; // Default
                break;
            case 'sugar_free':
                achieved = nutrition.calories > 0; // Logic for sugar-free could be more complex
                break;
            case 'tonnage_king':
                const dayTonnage = exercises.filter(e => e.date === date && e.tonnage).reduce((sum, e) => sum + (e.tonnage || 0), 0);
                achieved = dayTonnage / weight > 10; // Rule: Lift more than 10x bodyweight total
                break;
            case 'yoga_mobility':
                achieved = exercises.some(e => e.date === date && (e.type === 'yoga' || e.notes?.toLowerCase().includes('rörlighet')));
                break;
            case 'protein_goal':
                achieved = nutrition.protein > 100; // Default
                break;
            case 'fiber_goal':
                achieved = (nutrition.fiber || 0) >= 30;
                break;
            case 'clean_eating':
                achieved = nutrition.calories > 0 && !exercises.some(e => e.notes?.includes('fusk'));
                break;
            case 'step_king':
                achieved = exercises.some(e => e.type === 'walking' && e.durationMinutes >= 60);
                break;
            case 'total_tonnage_20t':
                const totalTonnage = exercises.filter(e => e.date === date).reduce((sum, e) => sum + (e.tonnage || 0), 0);
                achieved = totalTonnage >= 20000;
                break;
            case 'double_session':
                achieved = exercises.filter(e => e.date === date).length >= 2;
                break;
            case 'ultra_run':
                achieved = exercises.some(e => e.date === date && (e.type === 'running' && e.durationMinutes > 180));
                break;
            default:
                // Custom or unhandled presets require manual check or notes match
                if (rule.description && exercises.some(e => e.notes?.toLowerCase().includes(rule.name.toLowerCase()))) {
                    achieved = true;
                }
        }

        if (achieved) {
            dayScore += rule.points;
        }
    }

    return dayScore;
}
