import { create } from 'zustand';

export type AppTab = 'home' | 'shifts' | 'swaps' | 'feed' | 'team' | 'settings' | 'more';

interface UiState {
  selectedTab: AppTab;
  currentTeamId: string | null;
  swapDraftNote: string;
  isOfflineBannerDismissed: boolean;
  themeMode: 'system' | 'light' | 'dark';

  setTab: (tab: AppTab) => void;
  setCurrentTeamId: (teamId: string | null) => void;
  setSwapDraftNote: (note: string) => void;
  dismissOfflineBanner: () => void;
  setThemeMode: (mode: 'system' | 'light' | 'dark') => void;
  resetUi: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  selectedTab: 'shifts',
  currentTeamId: null,
  swapDraftNote: '',
  isOfflineBannerDismissed: false,
  themeMode: 'system',

  setTab: (tab) => set({ selectedTab: tab }),
  setCurrentTeamId: (teamId) => set({ currentTeamId: teamId }),
  setSwapDraftNote: (note) => set({ swapDraftNote: note }),
  dismissOfflineBanner: () => set({ isOfflineBannerDismissed: true }),
  setThemeMode: (mode) => set({ themeMode: mode }),
  resetUi: () =>
    set({
      selectedTab: 'shifts',
      currentTeamId: null,
      swapDraftNote: '',
      isOfflineBannerDismissed: false,
    }),
}));
