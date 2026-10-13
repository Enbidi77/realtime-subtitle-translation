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
}

export const useNavigationStore = create<NavigationStore>((set) => ({
  activePage: 'dashboard',
  setActivePage: (page) => set({ activePage: page }),
}));
