import { RaceProfile, RunnerProfile, IntakeEvent, PacingStrategy } from '../utils/racePlannerCalculators.ts';

export interface RacePlan {
    id: string;
    userId: string;
    name: string;
    createdAt: string;
    updatedAt: string;

    // Config
    raceProfile: RaceProfile;
    runnerProfile: RunnerProfile;
    environment: {
        temperatureC: number;
        humidityPercent: number;
        sunsetTime?: string;
    };

    // Strategy
    pacingStrategy: PacingStrategy;

    // Logistics
    intakeEvents: IntakeEvent[];
    dropbagKms: number[];
}
