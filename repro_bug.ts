import { PerformanceGoal, ExerciseEntry } from './src/models/types.ts';
import { calculateGoalProgress, getGoalPeriodDates } from './src/utils/goalCalculations.ts';

const today = new Date().toISOString().split('T')[0];

const mockGoal: PerformanceGoal = {
    id: 'test-goal',
    userId: 'user1',
    type: 'distance',
    category: 'training',
    period: 'daily',
    startDate: today,
    targets: [{
        exerciseType: 'running',
        value: 10,
        unit: 'km'
    }],
    status: 'active'
};

const mockActivity: ExerciseEntry = {
    id: 'strava-1',
    date: `${today}T10:00:00Z`, // Timestamp from Strava
    type: 'running',
    durationMinutes: 60,
    intensity: 'moderate',
    caloriesBurned: 500,
    distance: 10,
    createdAt: new Date().toISOString()
};

// Test Daily Goal
const progress = calculateGoalProgress(mockGoal, [mockActivity], [], [], [], []);

console.log('--- Daily Goal Test ---');
console.log('Activity Date:', mockActivity.date);
console.log('Goal Period:', progress.periodStart, 'to', progress.periodEnd);
console.log('Current Progress:', progress.current, 'km');
console.log('Target:', progress.target, 'km');
console.log('Percentage:', progress.percentage, '%');

if (progress.current === 0) {
    console.log('BUG DETECTED: Progress is 0 when it should be 10!');
} else {
    console.log('SUCCESS: Progress is correct.');
}

// Test Weekly Goal
// Find a Monday and Sunday in the current week
const now = new Date();
const day = now.getDay();
const diffToMonday = day === 0 ? -6 : 1 - day;
const Monday = new Date(now);
Monday.setDate(now.getDate() + diffToMonday);
const Sunday = new Date(Monday);
Sunday.setDate(Monday.getDate() + 6);

const mondayStr = Monday.toISOString().split('T')[0];
const sundayStr = Sunday.toISOString().split('T')[0];

const mockWeeklyGoal: PerformanceGoal = {
    ...mockGoal,
    id: 'test-weekly-goal',
    period: 'weekly',
    startDate: mondayStr
};

const sundayActivity: ExerciseEntry = {
    ...mockActivity,
    id: 'strava-sunday',
    date: `${sundayStr}T10:00:00Z`,
};

const progressWeekly = calculateGoalProgress(mockWeeklyGoal, [sundayActivity], [], [], [], []);

console.log('\n--- Weekly Goal Test ---');
console.log('Week Start:', progressWeekly.periodStart);
console.log('Week End:', progressWeekly.periodEnd);
console.log('Activity Date:', sundayActivity.date);
console.log('Current Progress:', progressWeekly.current, 'km');

if (progressWeekly.current === 0) {
    console.log('BUG DETECTED: Sunday activity with timestamp is excluded from the week!');
} else {
    console.log('SUCCESS: Sunday activity included correctly.');
}
