'use client';

import { create } from 'zustand';
import type { Topic } from '../api';
import type { UnifiedFilters } from '@/components/chat/unified-filter-panel';

interface FilterState {
  unifiedFilters: UnifiedFilters;
  selectedTopic: Topic | null;

  setUnifiedFilters: (filters: UnifiedFilters | ((prev: UnifiedFilters) => UnifiedFilters)) => void;
  setSelectedTopic: (topic: Topic | null) => void;
}

const defaultFilters: UnifiedFilters = {
  topicId: null,
  topic: null,
};

export const useFilterStore = create<FilterState>((set, get) => ({
  unifiedFilters: defaultFilters,
  selectedTopic: null,

  setUnifiedFilters: (filters) => {
    set((state) => ({
      unifiedFilters: typeof filters === 'function' ? filters(state.unifiedFilters) : filters,
    }));
  },

  setSelectedTopic: (topic) => {
    set({ selectedTopic: topic });
    get().setUnifiedFilters((prev) => ({
      ...prev,
      topicId: topic?.id ?? null,
      topic: topic ?? null,
      keyword: topic ? undefined : prev.keyword,
    }));
  },
}));
