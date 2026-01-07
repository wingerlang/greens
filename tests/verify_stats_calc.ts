
import { calculateGlobalStats } from '../src/api/services/statisticsService.ts';
import { StrengthWorkout } from '../src/models/strengthTypes.ts';
import { UniversalActivity } from '../src/models/types.ts';

// Mock Data
const mockWorkouts: StrengthWorkout[] = [
    {
        id: 'w1', userId: 'u1', date: '2023-01-01', name: 'Legs', totalVolume: 5000, duration: 60, totalSets: 10, totalReps: 50, uniqueExercises: 2, source: 'manual', createdAt: '', updatedAt: '', exercises: [
            { exerciseId: 'e1', exerciseName: 'Squat', sets: [{ weight: 100, reps: 5, setNumber: 1 }] }
        ]
    },
    {
        id: 'w2', userId: 'u2', date: '2023-01-02', name: 'Legs', totalVolume: 6000, duration: 70, totalSets: 10, totalReps: 50, uniqueExercises: 2, source: 'manual', createdAt: '', updatedAt: '', exercises: [
            { exerciseId: 'e1', exerciseName: 'Squat', sets: [{ weight: 120, reps: 5, setNumber: 1 }] }
        ]
    }
];

const mockActivities: UniversalActivity[] = [
    {
        id: 'a1', userId: 'u1', date: '2023-01-03', status: 'COMPLETED', createdAt: '', updatedAt: '', performance: {
            durationMinutes: 25, distanceKm: 5.0, calories: 300
        }
    },
    {
        id: 'a2', userId: 'u2', date: '2023-01-04', status: 'COMPLETED', createdAt: '', updatedAt: '', performance: {
            durationMinutes: 30, distanceKm: 5.0, calories: 350
        }
    }
];

const mockGoals: any[] = [{ userId: 'u1', status: 'completed' }];

console.log("Running Statistics Calculation Verification...");

const stats = calculateGlobalStats(mockWorkouts, mockActivities, mockGoals);

console.log("Global Stats:", JSON.stringify(stats.global, null, 2));
console.log("Averages:", JSON.stringify(stats.averages, null, 2));
console.log("Strength Stats:", JSON.stringify(stats.strength.exercises, null, 2));
console.log("Cardio Stats:", JSON.stringify(stats.cardio.distances, null, 2));

// Assertions
if (stats.global.totalUsers !== 2) throw new Error(`Incorrect total users: ${stats.global.totalUsers}`);
if (stats.global.totalDistanceKm !== 10) throw new Error("Incorrect total distance");
if (stats.global.totalTonnage !== 11000) throw new Error("Incorrect total tonnage");

// Cardio 5k check
const fiveK = stats.cardio.distances['5k'];
if (!fiveK || fiveK.count !== 2) throw new Error("Incorrect 5k count");
// u1: 25min = 1500s. u2: 30min = 1800s. Avg = 1650s.
if (fiveK.avgTimeSeconds !== 1650) throw new Error(`Incorrect 5k avg time: ${fiveK.avgTimeSeconds}`);

console.log("✅ Math Verified Successfully.");
