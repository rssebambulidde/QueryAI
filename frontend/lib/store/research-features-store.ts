import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ResearchFeatures {
  masterEnabled: boolean;
  queryRewriting: boolean;
  reranking: boolean;
  qualityScoring: boolean;
  diversityFiltering: boolean;
  deduplication: boolean;
}

const defaultFeatures: ResearchFeatures = {
  masterEnabled: true,
  queryRewriting: true,
  reranking: true,
  qualityScoring: true,
  diversityFiltering: true,
  deduplication: true,
};

interface ResearchFeaturesStore {
  features: ResearchFeatures;
  setMasterEnabled: (enabled: boolean) => void;
  setFeature: (key: keyof Omit<ResearchFeatures, 'masterEnabled'>, enabled: boolean) => void;
  resetDefaults: () => void;
}

export const useResearchFeaturesStore = create<ResearchFeaturesStore>()(
  persist(
    (set) => ({
      features: defaultFeatures,
      setMasterEnabled: (enabled) =>
        set((state) => ({
          features: { ...state.features, masterEnabled: enabled },
        })),
      setFeature: (key, enabled) =>
        set((state) => ({
          features: { ...state.features, [key]: enabled },
        })),
      resetDefaults: () =>
        set({ features: defaultFeatures }),
    }),
    {
      name: 'research-features',
      version: 1,
    }
  )
);
