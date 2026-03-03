import { useCallback } from 'react';

type HapticPattern = 'light' | 'medium' | 'heavy' | 'success' | 'error';

const PATTERNS: Record<HapticPattern, number | number[]> = {
    light: 10,
    medium: 30,
    heavy: 60,
    success: [30, 50, 30],
    error: [60, 80, 60],
};

export function useHaptics() {
    const vibrate = useCallback((pattern: HapticPattern = 'light') => {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            try {
                navigator.vibrate(PATTERNS[pattern]);
            } catch {
                // Vibration API can throw in some restricted environments
            }
        }
    }, []);

    return { vibrate };
}
