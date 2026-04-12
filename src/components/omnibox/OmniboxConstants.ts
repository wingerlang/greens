import { ExerciseType, ExerciseIntensity, FoodItem, QuickMeal, MealType, BodyMeasurementType } from '../../models/types.ts';
import { Moon, Droplets, Coffee, Zap, Search } from 'lucide-react';

export const isSavedEstimate = (qm: QuickMeal) => {
    return qm.items.length === 1 && qm.items[0].type === 'estimate';
};

export const NAVIGATION_ROUTES = [
    // Core
    { path: '/', label: 'Dashboard', aliases: ['hem', 'home', 'start', 'dashboard'], icon: '🏠' },
    { path: '/matplanera', label: 'Veckoplanering (Mat)', aliases: ['matplanera', 'plan', 'vecka', 'weekly', 'food'], icon: '🍽️' },
    { path: '/planera', label: 'Träningsplanering', aliases: ['planera', 'traning', 'training', 'race', 'tavling'], icon: '📅' },
    { path: '/training', label: 'Träning', aliases: ['träning', 'training', 'gym', 'workout'], icon: '💪' },

    // Tools
    { path: '/tools', label: 'Verktyg & Kalkylatorer', aliases: ['tools', 'verktyg', 'kalkylator', 'calculators'], icon: '🛠️' },
    { path: '/tools/1rm', label: '1RM & Lastning', aliases: ['1rm', 'max', 'lastning', 'plate', 'loading', 'bänkpress', 'knäböj', 'marklyft', 'bench', 'squat', 'deadlift'], icon: '🏋️' },
    { path: '/tools/race', label: 'Race Predictor', aliases: ['race', 'predictor', 'vdot', 'riegel', 'prognos', 'tävlingstid'], icon: '🏃' },
    { path: '/tools/race-planner', label: 'Race Planner', aliases: ['raceplan', 'planner', 'lopp', 'marathon', 'halvmarathon', 'lidingö', 'vasaloppet'], icon: '📝' },
    { path: '/tools/pace', label: 'Pace Converter', aliases: ['pace', 'tempo', 'km/min', 'min/km', 'konvertera', 'hastighet'], icon: '⏱️' },
    { path: '/tools/cooper', label: 'Coopers Test', aliases: ['cooper', 'vo2max', '12min', 'konditionstest'], icon: '👟' },
    { path: '/tools/hr', label: 'Pulszoner', aliases: ['puls', 'hr', 'heartrate', 'zoner', 'zones', 'karvonen'], icon: '⏱️' },
    { path: '/tools/power', label: 'Energiberäknare', aliases: ['power', 'watt', 'cykling', 'energi', 'kaloriförbrukning'], icon: '⚡' },
    { path: '/tools/hyrox', label: 'Hyrox Predictor', aliases: ['hyrox', 'roxzone', 'wallballs', 'burpees', 'skierg', 'row'], icon: '👊' },
    { path: '/tools/health', label: 'Hälsokalkylator', aliases: ['hälsa', 'bmi', 'bmr', 'tdee', 'vikt', 'kroppsfett'], icon: '⚕️' },
    { path: '/tools/macros', label: 'Makrofördelning', aliases: ['makro', 'macros', 'protein', 'kolhydrater', 'fett', 'fördelning'], icon: '🥩' },
    { path: '/tools/standards', label: 'Styrkestandard', aliases: ['standard', 'wilks', 'ipf', 'dots', 'nivå', 'ranking', 'jämför'], icon: '📊' },
    { path: '/tools/olympic', label: 'Tyngdlyftning', aliases: ['olympic', 'ol', 'tyngdlyftning', 'ryck', 'stöt', 'snatch', 'clean', 'jerk', 'sinclair'], icon: '🏋️‍♀️' },
    { path: '/tools/replay', label: 'Replay Mode', aliases: ['replay', 'återblick', 'tidslinje', 'historik', 'animation'], icon: '⏪' },

    // Main Sections
    { path: '/logg', label: 'Loggbok', aliases: ['logg', 'log', 'dagbok', 'activities', 'aktiviteter', 'historik'], icon: '📒' },
    { path: '/styrka', label: 'Styrketräning', aliases: ['styrka', 'strength', 'lyft', 'övningar', 'exercises', 'pr', 'pb'], icon: '💪' },
    { path: '/pass', label: 'Pass / Workouts', aliases: ['pass', 'workouts', 'rutiner', 'programmering', 'builder', 'bygg'], icon: '📝' },
    { path: '/statistik', label: 'Statistik', aliases: ['statistik', 'stats', 'analys', 'data', 'charts', 'grafer'], icon: '📈' },
    { path: '/mal', label: 'Mål', aliases: ['mål', 'goals', 'targets', 'målsättning'], icon: '🎯' },
    { path: '/tävling', label: 'Tävling', aliases: ['tävling', 'competition', 'comp', 'event'], icon: '🏆' },
    { path: '/community', label: 'Community', aliases: ['community', 'vänner', 'friends', 'social', 'users', 'användare'], icon: '👥' },
    { path: '/feed', label: 'Feed', aliases: ['feed', 'flöde', 'lifestream', 'socialt', 'nyheter'], icon: '📱' },
    { path: '/matchup', label: 'Matchup', aliases: ['matchup', 'jämför', 'kamrat', 'vs', 'duell'], icon: '⚔️' },
    { path: '/exercises', label: 'Övningsbank', aliases: ['övningsbank', 'bank', 'bibliotek', 'library', 'övning'], icon: '📚' },
    { path: '/review', label: 'Årssammanfattning', aliases: ['review', 'år', 'year', 'sammanfattning', 'recap'], icon: '📅' },
    { path: '/docs', label: 'Dokumentation', aliases: ['docs', 'hjälp', 'regler', 'rules', 'manual', 'info'], icon: '📄' },

    // Nutrition
    { path: '/calories', label: 'Kalorier', aliases: ['kalorier', 'kcal', 'cal', 'calories', 'dagbok'], icon: '◎' },
    { path: '/recipes', label: 'Recept', aliases: ['recept', 'recipes', 'recipe', 'matlagning'], icon: '📖' },
    { path: '/pantry', label: 'Skafferi', aliases: ['skafferi', 'pantry', 'förråd', 'lager'], icon: '🗄️' },
    { path: '/database', label: 'Databas', aliases: ['databas', 'database', 'db', 'livsmedel', 'sök'], icon: '🔍' },

    // Health & System
    { path: '/health', label: 'Hälsa / Mått', aliases: ['hälsa', 'health', 'halsa', 'mått', 'mät', 'body', 'measurements', 'vikt', 'weight', 'sömn', 'sleep'], icon: '📏' },
    { path: '/admin', label: 'Admin', aliases: ['admin', 'administration', 'root', 'backend'], icon: '🔒' },
    { path: '/api', label: 'API', aliases: ['api', 'utvecklare', 'developer', 'endpoints', 'docs'], icon: '🤖' },
    { path: '/garmin', label: 'Garmin Sync', aliases: ['garmin', 'connect', 'sync', 'klocka', 'import'], icon: '⌚' },
    { path: '/sync', label: 'Integrationer', aliases: ['integrationer', 'strava', 'polar', 'suunto', 'coros', 'export'], icon: '🔄' },
];

export const EXERCISE_TYPES: { type: ExerciseType; icon: string; label: string }[] = [
    { type: 'running', icon: '🏃', label: 'Löpning' },
    { type: 'cycling', icon: '🚴', label: 'Cykling' },
    { type: 'strength', icon: '🏋️', label: 'Styrka' },
    { type: 'walking', icon: '🚶', label: 'Promenad' },
    { type: 'swimming', icon: '🏊', label: 'Simning' },
    { type: 'yoga', icon: '🧘', label: 'Yoga' },
    { type: 'climbing', icon: '🧗‍♂️', label: 'Klättring' },
    { type: 'football', icon: '⚽', label: 'Fotboll' },
    { type: 'other', icon: '✨', label: 'Annat' },
];

export const INTENSITIES: { value: ExerciseIntensity; label: string }[] = [
    { value: 'low', label: 'Låg' },
    { value: 'moderate', label: 'Medel' },
    { value: 'high', label: 'Hög' },
    { value: 'ultra', label: 'Max' },
];

export const VITALS_INFO: Record<string, { icon: any; label: string; unit: string; bg: string; text: string }> = {
    sleep: { icon: Moon, label: 'Sömn', unit: 'timmar', bg: 'bg-indigo-500/20', text: 'text-indigo-400' },
    water: { icon: Droplets, label: 'Vatten', unit: 'glas', bg: 'bg-cyan-500/20', text: 'text-cyan-400' },
    coffee: { icon: Coffee, label: 'Kaffe', unit: 'st', bg: 'bg-amber-500/20', text: 'text-amber-400' },
    nocco: { icon: Zap, label: 'Nocco', unit: 'st', bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
    energy: { icon: Zap, label: 'Energidryck', unit: 'st', bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
    steps: { icon: Search, label: 'Steg', unit: 'steg', bg: 'bg-green-500/20', text: 'text-green-400' },
};

export const ACTION_COMMANDS = [
    { id: 'post', label: 'Skriv Inlägg', command: '!post', icon: '✏️', description: 'Skapa ett nytt inlägg i flödet' },
    { id: 'estimate', label: 'Estimera Måltid', command: '!estimate', icon: '🤷', description: 'Snabbregistrera en estimering (t.ex. utelunch)' },
    { id: 'backup', label: 'Backup System', command: '!backup', icon: '💾', description: 'Exportera databas till JSON' },
    { id: 'recalc', label: 'Recalculate Calories', command: '!recalc', icon: '🔄', description: 'Beräkna om alla dagstotaler' },
    { id: 'debug', label: 'Toggle Debug Mode', command: '!debug', icon: '🐞', description: 'Visa/Dölj system-debug' },
    { id: 'clear', label: 'Clear Cache', command: '!clear', icon: '🧹', description: 'Rensa lokala webbläsar-cache' },
    { id: 'add-food', label: 'Lägg till Råvara', command: '! lägg till råvara', icon: '➕', description: 'Öppna formulär för ny mat' },
];

export const MEASUREMENT_INFO: Record<BodyMeasurementType, { label: string; icon: string }> = {
    waist: { label: 'Midja', icon: '📏' },
    hips: { label: 'Höft', icon: '🍑' },
    chest: { label: 'Bröst', icon: '👕' },
    arm_left: { label: 'V. Överarm', icon: '💪' },
    arm_right: { label: 'H. Överarm', icon: '💪' },
    thigh_left: { label: 'V. Lår', icon: '🦵' },
    thigh_right: { label: 'H. Lår', icon: '🦵' },
    calf_left: { label: 'V. Vad', icon: '🦵' },
    calf_right: { label: 'H. Vad', icon: '🦵' },
    neck: { label: 'Nacke', icon: '🧣' },
    shoulders: { label: 'Axlar', icon: '👔' },
    forearm_left: { label: 'V. Underarm', icon: '💪' },
    forearm_right: { label: 'H. Underarm', icon: '💪' },
};

export const getCategoryEmoji = (category?: string): string => {
    switch (category) {
        case 'protein': return '🌱';
        case 'vegetables': return '🥦';
        case 'fruits': return '🍎';
        case 'dairy-alt': return '🥛';
        case 'grains': return '🌾';
        case 'fats': return '🥑';
        case 'legumes': return '🫘';
        case 'nuts-seeds': return '🥜';
        case 'beverages': return '🍵';
        case 'spices': return '🌿';
        case 'condiments': return '🫙';
        case 'sauces': return '🥫';
        case 'sweeteners': return '🍯';
        case 'baking': return '🥧';
        default: return '🍽️';
    }
};

export const DEFAULT_YIELD_FACTORS: Record<string, number> = {
    'ris': 2.5,
    'pasta': 2.2,
    'quinoa': 3.0,
    'bulgur': 2.5,
    'couscous': 2.0,
    'havregryn': 3.0,
    'linser': 2.0,
    'bönpasta': 2.0,
};

export const canLogAsCooked = (item: FoodItem): { canCook: boolean; effectiveYieldFactor: number } => {
    if (item.isCooked) {
        return { canCook: false, effectiveYieldFactor: 1 };
    }

    if (item.yieldFactor && item.yieldFactor > 1) {
        return { canCook: true, effectiveYieldFactor: item.yieldFactor };
    }

    const lowerName = item.name.toLowerCase();
    for (const [key, value] of Object.entries(DEFAULT_YIELD_FACTORS)) {
        if (lowerName.includes(key)) {
            if (lowerName.includes('kokt') || lowerName.includes('tillagad') || lowerName.includes('stekt')) {
                return { canCook: false, effectiveYieldFactor: 1 };
            }
            return { canCook: true, effectiveYieldFactor: value };
        }
    }

    return { canCook: false, effectiveYieldFactor: 1 };
};

export const getSavedMealTypePreference = (): MealType | null => {
    try {
        const saved = localStorage.getItem('last_meal_type_preference');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Date.now() - parsed.timestamp < 2 * 60 * 60 * 1000) {
                return parsed.mealType;
            }
        }
    } catch {}
    return null;
};

export const saveMealTypePreference = (mealType: MealType) => {
    localStorage.setItem('last_meal_type_preference', JSON.stringify({
        mealType,
        timestamp: Date.now()
    }));
};
