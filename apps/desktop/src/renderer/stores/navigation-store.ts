import { create } from 'zustand';
import { AppPage } from '@echo-lingo/contracts';
import React from 'react';

export type { AppPage };

export interface BreadcrumbItem {
  id: string;
  label?: string;
  labelKey?: string;
  page?: AppPage;
  onClick?: () => void;
  icon?: React.ComponentType<{ className?: string }>;
}

interface NavigationStore {
  activePage: AppPage;
  setActivePage: (page: AppPage) => void;
  breadcrumbs: BreadcrumbItem[];
  setBreadcrumbs: (crumbs: BreadcrumbItem[]) => void;
  clearBreadcrumbs: () => void;
  isExitModalOpen: boolean;
  setIsExitModalOpen: (open: boolean) => void;
}

export const useNavigationStore = create<NavigationStore>((set) => ({
  activePage: 'dashboard',
  setActivePage: (page) => set({ activePage: page, breadcrumbs: [] }),
  breadcrumbs: [],
  setBreadcrumbs: (crumbs) => set({ breadcrumbs: crumbs }),
  clearBreadcrumbs: () => set({ breadcrumbs: [] }),
  isExitModalOpen: false,
  setIsExitModalOpen: (open) => set({ isExitModalOpen: open }),
}));
