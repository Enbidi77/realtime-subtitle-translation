import { create } from 'zustand';
import { AppPage } from '@echo-lingo/contracts';

export type { AppPage };

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
