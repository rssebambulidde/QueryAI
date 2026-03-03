'use client';

import React from 'react';
import { useTheme } from '@/providers/theme-provider';
import { Sun, Moon, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AppearanceSettingsPage() {
    const { theme, setTheme } = useTheme();

    return (
        <div className="space-y-8 animate-in fade-in max-w-2xl">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-50 mb-1">
                    Appearance
                </h1>
                <p className="text-gray-500 dark:text-gray-400">
                    Customize how QueryAI looks on your device.
                </p>
            </div>

            <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-900 border-b border-gray-100 pb-2">
                    Theme Preference
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Light Theme Option */}
                    <button
                        onClick={() => setTheme('light')}
                        className={cn(
                            "flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all text-left",
                            theme === 'light'
                                ? "border-orange-500 bg-orange-50/50"
                                : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                        )}
                        aria-label="Light Theme"
                    >
                        <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 mb-1">
                            <Sun className="w-6 h-6" />
                        </div>
                        <div className="text-center">
                            <div className="font-semibold text-gray-900">Light</div>
                            <div className="text-xs text-gray-500 mt-0.5">Always light mode</div>
                        </div>
                    </button>

                    {/* Dark Theme Option */}
                    <button
                        onClick={() => setTheme('dark')}
                        className={cn(
                            "flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all text-left",
                            theme === 'dark'
                                ? "border-orange-500 bg-slate-800"
                                : "border-gray-200 bg-slate-900 hover:border-slate-700"
                        )}
                        aria-label="Dark Theme"
                    >
                        <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 mb-1">
                            <Moon className="w-6 h-6" />
                        </div>
                        <div className="text-center">
                            <div className="font-semibold text-gray-50">Dark</div>
                            <div className="text-xs text-slate-400 mt-0.5">Always dark mode</div>
                        </div>
                    </button>

                    {/* System Theme Option */}
                    <button
                        onClick={() => setTheme('system')}
                        className={cn(
                            "flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all text-left",
                            theme === 'system'
                                ? "border-orange-500 bg-orange-50/50 dark:bg-slate-800"
                                : "border-gray-200 bg-gray-50 dark:bg-slate-900 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700"
                        )}
                        aria-label="System Theme"
                    >
                        <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-slate-800 border border-transparent dark:border-slate-700 flex items-center justify-center text-gray-700 dark:text-slate-300 mb-1">
                            <Monitor className="w-6 h-6" />
                        </div>
                        <div className="text-center">
                            <div className="font-semibold text-gray-900 dark:text-gray-50">System</div>
                            <div className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Follows device settings</div>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
}
