import { PerformanceGoal, PeriodFocus, GoalTarget } from "../../../models/types.ts";

export interface GoalTemplate {
    type: 'weight' | 'calories' | 'measurement' | 'frequency' | 'tonnage' | 'distance' | 'activity';
    label: string;
    description: string;
    defaultKey: string;
    suggestedGoal: Omit<PerformanceGoal, 'id' | 'createdAt' | 'periodId' | 'startDate'>;
}

export const getPeriodTemplates = (focusTypes: PeriodFocus[], userStats?: { weight?: number, waist?: number }): GoalTemplate[] => {
    let templates: GoalTemplate[] = [];
    const seenKeys = new Set<string>();

    const addTemplate = (t: GoalTemplate) => {
        if (!seenKeys.has(t.defaultKey)) {
            seenKeys.add(t.defaultKey);
            templates.push(t);
        }
    };

    // Helper to generate templates based on type
    const generateTemplates = (type: PeriodFocus) => {
        switch (type) {
            case 'weight_loss':
                addTemplate({
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
                        targetWeight: userStats?.weight ? Math.round(userStats.weight * 0.95) : 75,
                        targetWeightRate: -0.5,
                        milestoneProgress: userStats?.weight // Current weight
                    }
                });
                addTemplate({
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
                        targets: [{ nutritionType: 'calories', value: 2000, unit: 'kcal' }]
                    }
                });
                addTemplate({
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
                        targets: [{ value: userStats?.waist ? Math.round(userStats.waist * 0.95) : 80, unit: 'cm' }],
                        description: 'Minska midjemåttet',
                        milestoneProgress: userStats?.waist // Start value
                    }
                });
                break;

            case 'strength':
                addTemplate({
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
                });
                addTemplate({
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
                        targets: [{ exerciseType: 'strength', value: 10, unit: 'ton' }]
                    }
                });
                break;

            case 'endurance':
                addTemplate({
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
                });
                addTemplate({
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
                });
                break;

            case 'habit':
            case 'general':
                addTemplate({
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
                        targets: [{ value: 30, unit: 'min' }]
                    }
                });
                addTemplate({
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
                        targets: [{ count: 5 }]
                    }
                });
                break;
        }
    };

    focusTypes.forEach(generateTemplates);
    return templates;
};
