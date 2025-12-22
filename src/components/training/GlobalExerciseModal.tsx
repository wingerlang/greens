import React, { useState, useEffect } from 'react';
import { useData } from '../../context/DataContext.tsx';
import { parseTrainingString, calculateCalories } from '../../utils/nlpParser.ts';
import { ExerciseModal } from './ExerciseModal.tsx';
import { ExerciseType, ExerciseIntensity, ExerciseSubType } from '../../models/types.ts';

interface GlobalExerciseModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialType?: ExerciseType;
    initialInput?: string;
}

export function GlobalExerciseModal({ isOpen, onClose, initialType, initialInput }: GlobalExerciseModalProps) {
    const { addExercise, userSettings } = useData();
    const [smartInput, setSmartInput] = useState('');

    // Form State
    const [exerciseForm, setExerciseForm] = useState<{
        type: ExerciseType;
        duration: string;
        intensity: ExerciseIntensity;
        notes: string;
        subType?: ExerciseSubType;
        tonnage?: string;
        distance?: string;
    }>({
        type: 'running',
        duration: '30',
        intensity: 'moderate',
        notes: '',
        subType: 'default'
    });

    // Reset when opening
    useEffect(() => {
        if (isOpen) {
            setSmartInput(initialInput || '');
            if (initialType) {
                setExerciseForm(prev => ({ ...prev, type: initialType }));
            }
        }
    }, [isOpen, initialType, initialInput]);

    // Derived values for smart inputs
    const parsed = parseTrainingString(smartInput);
    const effectiveExerciseType = parsed?.type || exerciseForm.type;
    const effectiveDuration = parsed?.duration?.toString() || exerciseForm.duration;
    const effectiveIntensity = parsed?.intensity || exerciseForm.intensity;

    // Helper to calculate calories
    const getCalories = (type: ExerciseType, duration: number, intensity: ExerciseIntensity) => {
        // Simple weight fallback if no userSettings
        const weight = 80; // This should ideally come from useData but sticking to local calc for now or import helper
        // Actually, let's use the exported helper from nlpParser if available or duplicate simple logic
        // TrainingPage uses useData().calculateExerciseCalories. 
        // We should expose that from useData is better.
        return calculateCalories(type, duration, intensity, weight);
    };

    // We need access to the real calculator from context better
    // But `useData` context exposes `calculateExerciseCalories`? 
    // Let's check DataContext. Yes it does.
    const { calculateExerciseCalories: contextCalc } = useData();


    const handleSave = () => {
        const duration = parseInt(effectiveDuration) || 0;

        // Calculate calories
        const caloriesBurned = contextCalc
            ? contextCalc(effectiveExerciseType, duration, effectiveIntensity)
            : getCalories(effectiveExerciseType, duration, effectiveIntensity);

        addExercise({
            date: new Date().toISOString().split('T')[0], // Today
            type: effectiveExerciseType,
            durationMinutes: duration,
            intensity: effectiveIntensity,
            caloriesBurned,
            notes: exerciseForm.notes,
            subType: exerciseForm.subType,
            tonnage: exerciseForm.tonnage ? parseFloat(exerciseForm.tonnage) : undefined,
            distance: exerciseForm.distance ? parseFloat(exerciseForm.distance) : undefined
        });

        // Reset and close
        setSmartInput('');
        setExerciseForm({
            type: 'running',
            duration: '30',
            intensity: 'moderate',
            notes: '',
            subType: 'default',
            tonnage: '',
            distance: ''
        });
        onClose();
    };

    return (
        <ExerciseModal
            isOpen={isOpen}
            onClose={onClose}
            onSave={handleSave}
            smartInput={smartInput}
            setSmartInput={setSmartInput}
            effectiveExerciseType={effectiveExerciseType}
            effectiveDuration={effectiveDuration}
            effectiveIntensity={effectiveIntensity}
            exerciseForm={exerciseForm}
            setExerciseForm={setExerciseForm}
            calculateCalories={(t, d, i) => contextCalc(t, d, i)}
        />
    );
}
