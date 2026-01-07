import { useEffect } from 'react';

// Global counter to track active scroll locks across all components
let lockCount = 0;
let originalStyle = '';

export function useScrollLock(isLocked: boolean) {
    useEffect(() => {
        if (!isLocked) return;

        // If this is the first lock, store the original style
        if (lockCount === 0) {
            originalStyle = window.getComputedStyle(document.body).overflow;
            document.body.style.overflow = 'hidden';
        }

        lockCount++;

        return () => {
            lockCount--;
            // Only restore style when the last lock is released
            if (lockCount === 0) {
                document.body.style.overflow = originalStyle || '';
            }
        };
    }, [isLocked]);
}
