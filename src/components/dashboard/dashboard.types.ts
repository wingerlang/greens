import { DailyVitals } from '../../models/types.ts';

export type DensityMode = 'compact' | 'slim' | 'cozy';

export interface VitalCardProps {
    density: DensityMode;
    isEditing: boolean;
    tempValue: string;
    onCardClick: () => void;
    onValueChange: (value: string) => void;
    onSave: () => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
}

export interface WaterCardProps {
    density: DensityMode;
    waterGoal: number;
    currentWater: number;
    isEditing: boolean;
    tempValue: string;
    onCardClick: () => void;
    onValueChange: (value: string) => void;
    onSave: () => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
    onQuickClick: (count: number) => void;
}

export interface CaffeineCardProps {
    density: DensityMode;
    caffeineLimit: number;
    currentCaffeine: number;
    isEditing: boolean;
    tempValue: string;
    onCardClick: () => void;
    onValueChange: (value: string) => void;
    onSave: () => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
    onQuickAdd: (amount: number, type: 'coffee' | 'nocco') => void;
}

export interface AlcoholCardProps {
    density: DensityMode;
    alcoholLimit: number | undefined;
    currentAlcohol: number;
    isEditing: boolean;
    tempValue: string;
    onCardClick: () => void;
    onValueChange: (value: string) => void;
    onSave: () => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
    onQuickClick: (count: number) => void;
}

export interface SleepCardProps {
    density: DensityMode;
    currentSleep: number;
    sleepInfo: { status: string; color: string };
    isEditing: boolean;
    tempValue: string;
    onCardClick: () => void;
    onValueChange: (value: string) => void;
    onSave: () => void;
    debouncedSave: (type: string, value: number) => void;
    setVitals: React.Dispatch<React.SetStateAction<DailyVitals>>;
    setEditing: (editing: string | null) => void;
}
