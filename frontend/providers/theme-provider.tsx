'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeContextValue {
    theme: Theme;
    resolvedTheme: 'light' | 'dark';
    setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
    theme: 'system',
    resolvedTheme: 'light',
    setTheme: () => { },
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<Theme>('system');
    const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

    const applyTheme = useCallback((t: Theme) => {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const isDark = t === 'dark' || (t === 'system' && prefersDark);
        document.documentElement.classList.toggle('dark', isDark);
        setResolvedTheme(isDark ? 'dark' : 'light');
    }, []);

    // Load from localStorage on mount
    useEffect(() => {
        const stored = (localStorage.getItem('theme') as Theme) || 'system';
        setThemeState(stored);
        applyTheme(stored);
    }, [applyTheme]);

    // Watch system preference changes (only relevant when theme === 'system')
    useEffect(() => {
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = () => {
            setThemeState((current) => {
                applyTheme(current);
                return current;
            });
        };
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, [applyTheme]);

    const setTheme = useCallback((t: Theme) => {
        setThemeState(t);
        localStorage.setItem('theme', t);
        applyTheme(t);
    }, [applyTheme]);

    return (
        <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    return useContext(ThemeContext);
}
