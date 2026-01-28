import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type CitationStyle = 'inline' | 'footnote' | 'numbered';
export type CitationFormat = 'markdown' | 'html' | 'plain';

export interface CitationPreferences {
  style: CitationStyle;
  format: CitationFormat;
  showFootnotes: boolean;
  showInlineNumbers: boolean;
}

const defaultPreferences: CitationPreferences = {
  style: 'inline',
  format: 'markdown',
  showFootnotes: false,
  showInlineNumbers: true,
};

interface CitationPreferencesStore {
  preferences: CitationPreferences;
  setStyle: (style: CitationStyle) => void;
  setFormat: (format: CitationFormat) => void;
  setShowFootnotes: (show: boolean) => void;
  setShowInlineNumbers: (show: boolean) => void;
  reset: () => void;
}

export const useCitationPreferencesStore = create<CitationPreferencesStore>()(
  persist(
    (set) => ({
      preferences: defaultPreferences,
      setStyle: (style) =>
        set((state) => ({
          preferences: { ...state.preferences, style },
        })),
      setFormat: (format) =>
        set((state) => ({
          preferences: { ...state.preferences, format },
        })),
      setShowFootnotes: (show) =>
        set((state) => ({
          preferences: { ...state.preferences, showFootnotes: show },
        })),
      setShowInlineNumbers: (show) =>
        set((state) => ({
          preferences: { ...state.preferences, showInlineNumbers: show },
        })),
      reset: () =>
        set({
          preferences: defaultPreferences,
        }),
    }),
    {
      name: 'citation-preferences',
      version: 1,
    }
  )
);
