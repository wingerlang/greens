// Common Types & Utilities
// ============================================

/** Generate a unique ID */
export const generateId = (): string => {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

/** Unit of measurement for food items and recipe ingredients */
export type Unit = 'g' | 'ml' | 'pcs' | 'kg' | 'l' | 'cup';

/** Unit display labels */
export const UNIT_LABELS: Record<Unit, string> = {
    g: 'gram',
    ml: 'milliliter',
    pcs: 'styck',
    kg: 'kilogram',
    l: 'liter',
    cup: 'kopp'
};

/** Meal type for calorie tracking entries */
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'beverage';

/** Meal type display labels (Swedish) */
export const MEAL_TYPE_LABELS: Record<MealType, string> = {
    breakfast: 'Frukost',
    lunch: 'Lunch',
    dinner: 'Middag',
    snack: 'Mellanmål',
    beverage: 'Dryck'
};

/** Meal type colors for UI */
export const MEAL_TYPE_COLORS: Record<MealType, string> = {
    breakfast: 'text-amber-400 bg-amber-500/10',
    lunch: 'text-sky-400 bg-sky-500/10',
    dinner: 'text-emerald-400 bg-emerald-500/10',
    snack: 'text-violet-400 bg-violet-500/10',
    beverage: 'text-cyan-400 bg-cyan-500/10',
};

/** Theme type */
export type Theme = 'light' | 'dark';

/** Seasonality for ingredients */
export type Season = 'winter' | 'spring' | 'summer' | 'autumn';

/** Price category for budgeting */
export type PriceCategory = 'budget' | 'medium' | 'premium';

/** Day of the week */
export type Weekday = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

/** Weekday display labels (Swedish) */
export const WEEKDAY_LABELS: Record<Weekday, string> = {
    monday: 'Måndag',
    tuesday: 'Tisdag',
    wednesday: 'Onsdag',
    thursday: 'Torsdag',
    friday: 'Fredag',
    saturday: 'Lördag',
    sunday: 'Söndag'
};

/** Ordered weekdays array */
export const WEEKDAYS: Weekday[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
