import { createContext, useContext } from 'react';
import {
    type FoodItem,
    type Recipe,
    type MealEntry,
    type WeeklyPlan,
    type User,
    type PlannedMeal,
    type MealType,
    type FoodItemFormData,
    type RecipeFormData,
    type MealEntryFormData,
    type NutritionSummary,
    type RecipeWithNutrition,
    type AppSettings,
    type DailyVitals,
    type ExerciseEntry,
    type WeightEntry,
    type ExerciseType,
    type ExerciseIntensity,
    type Competition,
    type TrainingCycle,
    type PerformanceGoal,
    type TrainingPeriod,
    type CoachConfig,
    type CoachGoal,
    type PlannedActivity,
    type StravaActivity,
    type SleepSession,
    type IntakeLog,
    type UniversalActivity,
    type InjuryLog,
    type RecoveryMetric,
    type StrengthWorkout,
    type BodyMeasurementEntry,
    type QuickMeal,
    type MealItem,
    type DatabaseAction,
    type RaceDefinition,
    type RaceIgnoreRule,
    type ExerciseDefinition,
    type PermissionConfig,
    type Tour,
    type TourFormData,
    type PurchaseLog
} from '../models/types.ts';

export interface DataContextType {
    // State
    foodItems: FoodItem[];
    recipes: Recipe[];
    mealEntries: MealEntry[];
    weeklyPlans: WeeklyPlan[];
    pantryItems: string[];
    pantryQuantities: Record<string, { quantity: number; unit: string }>;
    userSettings: AppSettings;
    users: User[];
    currentUser: User | null;

    // Global UI State
    selectedDate: string;
    setSelectedDate: (date: string) => void;

    // User CRUD
    setCurrentUser: (user: User | null) => void;
    updateCurrentUser: (updates: Partial<User>) => void;
    addUser: (user: User) => void;
    toggleIncompleteDay: (date: string) => void;
    toggleCompleteDay: (date: string) => void;

    // Pantry CRUD
    togglePantryItem: (item: string) => void;
    setPantryItems: (items: string[]) => void;
    setPantryQuantity: (itemName: string, quantity: number, unit: string) => void;
    getPantryQuantity: (itemName: string) => { quantity: number; unit: string } | undefined;

    // FoodItem CRUD
    addFoodItem: (data: FoodItemFormData) => FoodItem;
    updateFoodItem: (id: string, data: Partial<FoodItemFormData>) => void;
    deleteFoodItem: (id: string) => void;
    getFoodItem: (id: string) => FoodItem | undefined;

    // Recipe CRUD
    addRecipe: (data: RecipeFormData) => Recipe;
    updateRecipe: (id: string, data: Partial<RecipeFormData>) => void;
    deleteRecipe: (id: string) => void;
    getRecipe: (id: string) => Recipe | undefined;
    getRecipeWithNutrition: (id: string) => RecipeWithNutrition | undefined;

    // MealEntry CRUD
    addMealEntry: (data: MealEntryFormData) => MealEntry;
    updateMealEntry: (id: string, data: Partial<MealEntryFormData>) => void;
    deleteMealEntry: (id: string) => void;
    getMealEntriesForDate: (date: string) => MealEntry[];

    // WeeklyPlan CRUD
    getWeeklyPlan: (weekStartDate: string) => WeeklyPlan | undefined;
    saveWeeklyPlan: (weekStartDate: string, meals: WeeklyPlan['meals']) => void;
    getPlannedMealsForDate: (date: string) => { mealType: MealType; meal: PlannedMeal }[];

    // Computed
    calculateRecipeNutrition: (recipe: Recipe) => NutritionSummary;
    calculateDailyNutrition: (date: string) => NutritionSummary;
    calculateBMR: () => number;
    calculateExerciseCalories: (type: ExerciseType, duration: number, intensity: ExerciseIntensity, notes?: string, averageWatts?: number, avgHr?: number, distance?: number) => number;

    // Vitals CRUD
    dailyVitals: Record<string, DailyVitals>;
    updateVitals: (date: string, updates: Partial<DailyVitals>) => void;
    getVitalsForDate: (date: string) => DailyVitals;

    // Exercise CRUD
    exerciseEntries: ExerciseEntry[];
    addExercise: (data: Omit<ExerciseEntry, 'id' | 'createdAt'>) => ExerciseEntry;
    updateExercise: (id: string, updates: Partial<ExerciseEntry>) => void;
    deleteExercise: (id: string) => void;
    getExercisesForDate: (date: string) => ExerciseEntry[];

    // Weight CRUD
    weightEntries: WeightEntry[];
    addWeightEntry: (weight: number, date?: string, waist?: number | null, chest?: number | null, hips?: number | null, thigh?: number | null) => WeightEntry;
    bulkAddWeightEntries: (entries: Partial<WeightEntry>[]) => void;
    updateWeightEntry: (id: string, weight?: number, date?: string, updates?: Partial<WeightEntry>) => void;
    deleteWeightEntry: (id: string) => void;
    getLatestWeight: () => number;
    getLatestWaist: () => number | undefined;

    // Competition CRUD
    competitions: Competition[];
    addCompetition: (data: Omit<Competition, 'id' | 'createdAt'>) => Competition;
    updateCompetition: (id: string, updates: Partial<Competition>) => void;
    deleteCompetition: (id: string) => void;
    calculateParticipantPoints: (compId: string, userId: string, date: string) => number;

    // Training Cycle CRUD
    trainingCycles: TrainingCycle[];
    addTrainingCycle: (data: Omit<TrainingCycle, 'id'>) => TrainingCycle;
    updateTrainingCycle: (id: string, updates: Partial<TrainingCycle>) => void;
    deleteTrainingCycle: (id: string) => void;

    // Strength Sessions CRUD
    strengthSessions: StrengthWorkout[];
    addStrengthSession: (session: Omit<StrengthWorkout, 'id'>) => StrengthWorkout;
    updateStrengthSession: (id: string, updates: Partial<StrengthWorkout>) => void;
    deleteStrengthSession: (id: string) => void;

    // Performance Goals CRUD
    performanceGoals: PerformanceGoal[];
    addGoal: (data: Omit<PerformanceGoal, 'id' | 'createdAt'>) => PerformanceGoal;
    updateGoal: (id: string, updates: Partial<PerformanceGoal>) => void;
    deleteGoal: (id: string) => void;
    getGoalsForCycle: (cycleId: string) => PerformanceGoal[];

    // Training Periods CRUD
    trainingPeriods: TrainingPeriod[];
    addTrainingPeriod: (data: Omit<TrainingPeriod, 'id' | 'createdAt' | 'updatedAt'>) => TrainingPeriod;
    updateTrainingPeriod: (id: string, updates: Partial<TrainingPeriod>) => void;
    deleteTrainingPeriod: (id: string) => void;

    // Smart Coach CRUD
    coachConfig: CoachConfig | undefined;
    plannedActivities: PlannedActivity[];
    updateCoachConfig: (updates: Partial<CoachConfig>) => void;
    generateCoachPlan: (stravaHistory: StravaActivity[], configOverride?: CoachConfig) => void;
    deletePlannedActivity: (id: string) => void;
    updatePlannedActivity: (id: string, updates: Partial<PlannedActivity>) => void;
    savePlannedActivities: (activities: PlannedActivity[]) => void;
    completePlannedActivity: (activityId: string, actualDist?: number, actualTime?: number, feedback?: PlannedActivity['feedback']) => void;
    addCoachGoal: (goalData: Omit<CoachGoal, 'id' | 'createdAt' | 'isActive'>) => void;
    activateCoachGoal: (goalId: string) => void;
    deleteCoachGoal: (goalId: string) => void;
    reorderActivity: (id: string, direction: 'up' | 'down') => void;

    // Data Integration
    sleepSessions: SleepSession[];
    intakeLogs: IntakeLog[];
    universalActivities: UniversalActivity[];
    addSleepSession: (session: SleepSession) => void;

    injuryLogs: InjuryLog[];
    recoveryMetrics: RecoveryMetric[];
    addInjuryLog: (log: Omit<InjuryLog, 'id' | 'createdAt' | 'updatedAt'>) => InjuryLog;
    updateInjuryLog: (id: string, updates: Partial<InjuryLog>) => void;
    deleteInjuryLog: (id: string) => void;
    addRecoveryMetric: (metric: Omit<RecoveryMetric, 'id'>) => RecoveryMetric;

    // Body Measurements
    bodyMeasurements: BodyMeasurementEntry[];
    addBodyMeasurement: (entry: Omit<BodyMeasurementEntry, 'id' | 'createdAt'>) => void;
    updateBodyMeasurement: (id: string, updates: Partial<BodyMeasurementEntry>) => void;
    deleteBodyMeasurement: (id: string) => void;

    // Quick Meals & Aliases
    quickMeals: QuickMeal[];
    addQuickMeal: (name: string, items: MealItem[]) => QuickMeal;
    updateQuickMeal: (id: string, updates: Partial<Omit<QuickMeal, 'id' | 'userId' | 'createdAt'>>) => void;
    deleteQuickMeal: (id: string) => void;
    foodAliases: Record<string, string>;
    updateFoodAlias: (foodId: string, alias: string) => void;

    unifiedActivities: (ExerciseEntry & { source: string; _mergeData?: any })[];
    calculateStreak: (referenceDate?: string) => number;
    calculateTrainingStreak: (referenceDate?: string, type?: string) => number;
    calculateWeeklyTrainingStreak: (referenceDate?: string) => number;
    calculateCalorieGoalStreak: (referenceDate?: string) => number;

    // Race Definitions
    raceDefinitions: RaceDefinition[];
    addRaceDefinition: (def: Omit<RaceDefinition, 'id'>) => RaceDefinition;
    updateRaceDefinition: (id: string, updates: Partial<RaceDefinition>) => void;
    deleteRaceDefinition: (id: string) => void;

    raceIgnoreRules: RaceIgnoreRule[];
    addRaceIgnoreRule: (rule: Omit<RaceIgnoreRule, 'id'>) => RaceIgnoreRule;
    deleteRaceIgnoreRule: (id: string) => void;

    // System
    refreshData: () => Promise<void>;
    isLoading: boolean;
    databaseActions: DatabaseAction[];
    exercises: ExerciseDefinition[];
    permissionConfig: PermissionConfig;

    // Tours
    tours: Tour[];
    addTour: (data: TourFormData) => Tour;
    updateTour: (id: string, updates: Partial<Tour>) => void;
    deleteTour: (id: string) => void;

    // Purchase Logs
    purchaseLogs: PurchaseLog[];
    addPurchaseLog: (data: Omit<PurchaseLog, 'id' | 'userId'>) => PurchaseLog;
}

export const DataContext = createContext<DataContextType | null>(null);

export function useData(): DataContextType {
    const context = useContext(DataContext);
    if (!context) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
}
