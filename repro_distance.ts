
import { calculateDistanceProgress } from './src/utils/goalCalculations';
import { PerformanceGoal, ExerciseEntry } from './src/models/types';

const mockGoal: PerformanceGoal = {
    id: 'goal-1',
    userId: 'user-1',
    name: 'Distance Goal (All Training)',
    type: 'distance',
    period: 'weekly',
    category: 'training',
    status: 'active',
    startDate: '2026-01-01',
    targets: [
        {
            value: 50,
            unit: 'km'
            // exerciseType is undefined
        }
    ],
    createdAt: new Date().toISOString()
};

const mockActivities: ExerciseEntry[] = [
    {
        id: 'a1',
        date: '2026-01-14T10:00:00Z', // Wednesday
        type: 'running' as any,
        distance: 10,
        durationMinutes: 60,
        intensity: 'moderate',
        caloriesBurned: 500,
        createdAt: new Date().toISOString()
    },
    {
        id: 'a2',
        date: '2026-01-15T10:00:00Z', // Thursday
        type: 'cycling' as any,
        distance: 20,
        durationMinutes: 60,
        intensity: 'moderate',
        caloriesBurned: 500,
        createdAt: new Date().toISOString()
    }
];

// Reference date is Jan 17, 2026 (Saturday)
// The current week (ISO) starts on Jan 12.
const today = '2026-01-17';

console.log('--- DISTANCE GOAL TEST (exerciseType: undefined) ---');
const progress = calculateDistanceProgress(mockGoal, mockActivities);
console.log(`Progress: ${progress} km (Expected 30 km)`);

if (progress === 30) {
    console.log('SUCCESS: Progress calculated correctly for all training.');
} else {
    console.log('FAILURE: Progress mismatch!');
}

const mockGoalWithRunning: PerformanceGoal = {
    ...mockGoal,
    id: 'goal-2',
    targets: [{ ...mockGoal.targets[0], exerciseType: 'running' as any }]
};

console.log('\n--- DISTANCE GOAL TEST (exerciseType: running) ---');
const progress2 = calculateDistanceProgress(mockGoalWithRunning, mockActivities);
console.log(`Progress: ${progress2} km (Expected 10 km)`);

if (progress2 === 10) {
    console.log('SUCCESS: Progress calculated correctly for specific exercise type.');
} else {
    console.log('FAILURE: Progress mismatch!');
}
