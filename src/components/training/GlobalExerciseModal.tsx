import React, { useState, useEffect } from 'react';
import { useData } from '../../context/DataContext.tsx';
import { parseTrainingString, calculateCalories } from '../../utils/nlpParser.ts';
import { suggestActivityForWeekday } from '../../utils/analytics.ts';
import { ExerciseModal } from './ExerciseModal.tsx';
import { ExerciseType, ExerciseIntensity, ExerciseSubType } from '../../models/types.ts';

interface GlobalExerciseModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialType?: ExerciseType;
    initialInput?: string;
    initialDate?: string;
}

export function GlobalExerciseModal({ isOpen, onClose, initialType, initialInput, initialDate }: GlobalExerciseModalProps) {
    const { addExercise, userSettings, unifiedActivities, calculateExerciseCalories: contextCalc } = useData();
    const [smartInput, setSmartInput] = useState('');
    const [customDate, setCustomDate] = useState<string | null>(null);

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
            const dateStr = initialDate || new Date().toISOString().split('T')[0];
            setCustomDate(dateStr);
            
            if (initialType) {
                setExerciseForm(prev => ({ ...prev, type: initialType }));
            } else {
                // Smart Suggestion: If no explicit type provided, check user's habits for this weekday
                const suggestion = suggestActivityForWeekday(unifiedActivities as any, dateStr);
                if (suggestion) {
                    setExerciseForm(prev => ({ ...prev, type: suggestion }));
                } else {
                    setExerciseForm(prev => ({ ...prev, type: 'running' }));
                }
            }
        }
    }, [isOpen, initialType, initialInput, initialDate, unifiedActivities]);

    // Derived values for smart inputs
    const parsed = parseTrainingString(smartInput);
    const effectiveExerciseType = parsed?.type || exerciseForm.type;
    const effectiveDuration = parsed?.duration?.toString() || exerciseForm.duration;
    const effectiveIntensity = parsed?.intensity || exerciseForm.intensity;

    const handleSave = () => {
        const duration = parseInt(effectiveDuration) || 0;

        // Calculate calories
        const caloriesBurned = contextCalc(effectiveExerciseType, duration, effectiveIntensity);

        addExercise({
            date: customDate || new Date().toISOString().split('T')[0],
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
