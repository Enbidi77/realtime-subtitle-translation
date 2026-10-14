import { create } from 'zustand';

export type AppPage =
  | 'dashboard'
  | 'live-subtitles'
  | 'sessions'
  | 'history'
  | 'providers'
  | 'ocr-translate'
  | 'settings';

interface NavigationStore {
  activePage: AppPage;
  setActivePage: (page: AppPage) => void;
  isExitModalOpen: boolean;
  setIsExitModalOpen: (open: boolean) => void;
}

export const useNavigationStore = create<NavigationStore>((set) => ({
  activePage: 'dashboard',
  setActivePage: (page) => set({ activePage: page }),
  isExitModalOpen: false,
  setIsExitModalOpen: (open) => set({ isExitModalOpen: open }),
}));
