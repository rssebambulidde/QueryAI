import { create } from 'zustand';

interface MobileNavState {
    isNavVisible: boolean;
    setNavVisible: (visible: boolean) => void;
}

export const useMobileNavStore = create<MobileNavState>((set) => ({
    isNavVisible: true,
    setNavVisible: (visible) => set({ isNavVisible: visible }),
}));
