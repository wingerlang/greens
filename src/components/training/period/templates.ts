import { PerformanceGoal, PeriodFocus, GoalTarget } from "../../../models/types.ts";

export interface GoalTemplate {
    type: 'weight' | 'calories' | 'measurement' | 'frequency' | 'tonnage' | 'distance' | 'activity';
    label: string;
    description: string;
    defaultKey: string;
    suggestedGoal: Omit<PerformanceGoal, 'id' | 'createdAt' | 'periodId' | 'startDate'>;
}

export const getPeriodTemplates = (focusType: PeriodFocus): GoalTemplate[] => {
    switch (focusType) {
        case 'weight_loss':
            return [
                {
                    type: 'weight',
                    label: 'Målvikt',
                    description: 'Sätt ett mål för din kroppsvikt.',
                    defaultKey: 'target_weight',
                    suggestedGoal: {
                        name: 'Målvikt',
                        type: 'weight',
                        period: 'once',
                        category: 'body',
                        status: 'active',
                        targets: [],
                        targetWeight: 75, // Default placeholder
                        targetWeightRate: -0.5
                    }
                },
                {
                    type: 'calories',
                    label: 'Kalorimål',
                    description: 'Håll ett dagligt kaloriunderskott.',
                    defaultKey: 'daily_limit',
                    suggestedGoal: {
                        name: 'Kaloribudget',
                        type: 'nutrition',
                        period: 'daily',
                        category: 'nutrition',
                        status: 'active',
                        targets: [{ nutritionType: 'calories', value: 2000 }]
                    }
                },
                {
                    type: 'measurement',
                    label: 'Midjemått',
                    description: 'Följ ditt midjemått över tid.',
                    defaultKey: 'waist_measurement',
                    suggestedGoal: {
                        name: 'Midjemått',
                        type: 'measurement',
                        period: 'weekly',
                        category: 'body',
                        status: 'active',
                        targets: [{ value: 80, unit: 'cm' }], // Placeholder
                        description: 'Minska midjemåttet'
                    }
                }
            ];

        case 'strength':
            return [
                {
                    type: 'frequency',
                    label: 'Träningsfrekvens',
                    description: 'Antal styrkepass per vecka.',
                    defaultKey: 'strength_freq',
                    suggestedGoal: {
                        name: 'Styrkepass',
                        type: 'frequency',
                        period: 'weekly',
                        category: 'training',
                        status: 'active',
                        targets: [{ exerciseType: 'strength', count: 3 }]
                    }
                },
                {
                    type: 'tonnage',
                    label: 'Veckovolym (Tonnage)',
                    description: 'Total lyft volym per vecka.',
                    defaultKey: 'total_tonnage',
                    suggestedGoal: {
                        name: 'Veckovolym',
                        type: 'tonnage',
                        period: 'weekly',
                        category: 'training',
                        status: 'active',
                        targets: [{ exerciseType: 'strength', value: 10000, unit: 'kg' }]
                    }
                }
            ];

        case 'endurance':
            return [
                {
                    type: 'distance',
                    label: 'Veckodistans',
                    description: 'Total sträcka (löpning/cykling) per vecka.',
                    defaultKey: 'weekly_distance',
                    suggestedGoal: {
                        name: 'Veckodistans',
                        type: 'distance',
                        period: 'weekly',
                        category: 'training',
                        status: 'active',
                        targets: [{ exerciseType: 'running', value: 20, unit: 'km' }]
                    }
                },
                {
                    type: 'activity',
                    label: 'Löppass',
                    description: 'Antal löppass per vecka.',
                    defaultKey: 'run_freq',
                    suggestedGoal: {
                        name: 'Löppass',
                        type: 'frequency',
                        period: 'weekly',
                        category: 'training',
                        status: 'active',
                        targets: [{ exerciseType: 'running', count: 3 }]
                    }
                }
            ];

        case 'habit':
        case 'general':
            return [
                {
                    type: 'activity',
                    label: 'Aktivitet',
                    description: 'Rör på dig 30 minuter om dagen.',
                    defaultKey: 'general_activity',
                    suggestedGoal: {
                        name: 'Daglig Aktivitet',
                        type: 'frequency',
                        period: 'daily',
                        category: 'lifestyle',
                        status: 'active',
                        targets: [{ value: 30, unit: 'min' }] // Loose interpretation
                    }
                },
                {
                    type: 'calories',
                    label: 'Hälsosamma Val',
                    description: 'Följ din kostplan 80% av tiden.',
                    defaultKey: 'consistency',
                    suggestedGoal: {
                        name: 'Kosthållning',
                        type: 'streak',
                        period: 'weekly',
                        category: 'nutrition',
                        status: 'active',
                        targets: [{ count: 5 }] // 5 days a week
                    }
                }
            ];

        default:
            return [];
    }
};
