'use client';

import { create } from 'zustand';
import type { UnifiedFilters } from '@/components/chat/unified-filter-panel';

interface FilterState {
  unifiedFilters: UnifiedFilters;

  setUnifiedFilters: (filters: UnifiedFilters | ((prev: UnifiedFilters) => UnifiedFilters)) => void;
}

const defaultFilters: UnifiedFilters = {};

export const useFilterStore = create<FilterState>((set) => ({
  unifiedFilters: defaultFilters,

  setUnifiedFilters: (filters) => {
    set((state) => ({
      unifiedFilters: typeof filters === 'function' ? filters(state.unifiedFilters) : filters,
    }));
  },
}));
