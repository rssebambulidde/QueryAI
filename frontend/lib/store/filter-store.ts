'use client';

import { create } from 'zustand';
import { topicApi, Topic } from '../api';
import type { UnifiedFilters } from '@/components/chat/unified-filter-panel';

interface FilterState {
  unifiedFilters: UnifiedFilters;
  topics: Topic[];
  selectedTopic: Topic | null;
  isLoadingTopics: boolean;

  setUnifiedFilters: (filters: UnifiedFilters | ((prev: UnifiedFilters) => UnifiedFilters)) => void;
  setSelectedTopic: (topic: Topic | null) => void;
  loadTopics: () => Promise<void>;
}

const defaultFilters: UnifiedFilters = {
  topicId: null,
  topic: null,
};

export const useFilterStore = create<FilterState>((set, get) => ({
  unifiedFilters: defaultFilters,
  topics: [],
  selectedTopic: null,
  isLoadingTopics: false,

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

  loadTopics: async () => {
    set({ isLoadingTopics: true });
    try {
      const response = await topicApi.list();
      if (response.success && response.data) {
        set({ topics: response.data });
      }
    } catch (err) {
      console.warn('Failed to load topics:', err);
    } finally {
      set({ isLoadingTopics: false });
    }
  },
}));
