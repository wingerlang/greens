/**
 * useTimer - Hook for managing cooking timers with persistence
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// ============================================
// Types
// ============================================

export interface Timer {
    id: string;
    label: string;
    durationSeconds: number;
    remainingSeconds: number;
    status: 'idle' | 'running' | 'paused' | 'finished';
    stepIndex: number;
}

interface UseTimerReturn {
    timers: Timer[];
    activeTimer: Timer | null;
    addTimer: (label: string, minutes: number, stepIndex: number) => string;
    startTimer: (id: string) => void;
    pauseTimer: (id: string) => void;
    resetTimer: (id: string) => void;
    removeTimer: (id: string) => void;
    getTimerForStep: (stepIndex: number) => Timer | undefined;
}

// ============================================
// Audio Notification
// ============================================

function playNotificationSound() {
    try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);

        // Play 3 beeps
        setTimeout(() => playBeep(audioContext), 600);
        setTimeout(() => playBeep(audioContext), 1200);
    } catch (e) {
        console.warn('Could not play notification sound:', e);
    }
}

function playBeep(audioContext: AudioContext) {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
}

// ============================================
// Hook
// ============================================

export function useTimer(): UseTimerReturn {
    const [timers, setTimers] = useState<Timer[]>([]);
    const intervalRef = useRef<number | null>(null);

    // Tick all running timers
    useEffect(() => {
        intervalRef.current = window.setInterval(() => {
            setTimers((prev: Timer[]) => {
                let hasChanges = false;

                const updated = prev.map((timer: Timer) => {
                    if (timer.status !== 'running') return timer;

                    if (timer.remainingSeconds <= 1) {
                        hasChanges = true;
                        playNotificationSound();
                        return { ...timer, remainingSeconds: 0, status: 'finished' as const };
                    }

                    hasChanges = true;
                    return { ...timer, remainingSeconds: timer.remainingSeconds - 1 };
                });

                return hasChanges ? updated : prev;
            });
        }, 1000);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, []);

    // Generate unique ID
    const generateId = () => `timer_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    // Add new timer
    const addTimer = useCallback((label: string, minutes: number, stepIndex: number): string => {
        const id = generateId();
        const durationSeconds = minutes * 60;

        setTimers((prev: Timer[]) => [...prev, {
            id,
            label,
            durationSeconds,
            remainingSeconds: durationSeconds,
            status: 'idle',
            stepIndex,
        }]);

        return id;
    }, []);

    // Start timer
    const startTimer = useCallback((id: string) => {
        setTimers((prev: Timer[]) => prev.map((timer: Timer) =>
            timer.id === id ? { ...timer, status: 'running' as const } : timer
        ));
    }, []);

    // Pause timer
    const pauseTimer = useCallback((id: string) => {
        setTimers((prev: Timer[]) => prev.map((timer: Timer) =>
            timer.id === id ? { ...timer, status: 'paused' as const } : timer
        ));
    }, []);

    // Reset timer
    const resetTimer = useCallback((id: string) => {
        setTimers((prev: Timer[]) => prev.map((timer: Timer) =>
            timer.id === id ? {
                ...timer,
                remainingSeconds: timer.durationSeconds,
                status: 'idle' as const
            } : timer
        ));
    }, []);

    // Remove timer
    const removeTimer = useCallback((id: string) => {
        setTimers((prev: Timer[]) => prev.filter((timer: Timer) => timer.id !== id));
    }, []);

    // Get timer for specific step
    const getTimerForStep = useCallback((stepIndex: number): Timer | undefined => {
        return timers.find((t: Timer) => t.stepIndex === stepIndex);
    }, [timers]);

    // Get currently active (running or paused) timer
    const activeTimer = timers.find(t => t.status === 'running' || t.status === 'paused') || null;

    return {
        timers,
        activeTimer,
        addTimer,
        startTimer,
        pauseTimer,
        resetTimer,
        removeTimer,
        getTimerForStep,
    };
}

// ============================================
// Formatting Helpers
// ============================================

export function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
