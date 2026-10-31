import { describe, it, expect, beforeEach } from 'vitest';
import { useNavigationStore } from '../navigation-store.js';

describe('NavigationStore', () => {
  beforeEach(() => {
    useNavigationStore.setState({
      activePage: 'dashboard',
      breadcrumbs: [],
      isExitModalOpen: false,
    });
  });

  it('initializes with default state', () => {
    const state = useNavigationStore.getState();
    expect(state.activePage).toBe('dashboard');
    expect(state.breadcrumbs).toEqual([]);
    expect(state.isExitModalOpen).toBe(false);
  });

  it('updates active page and clears breadcrumbs', () => {
    useNavigationStore.getState().setBreadcrumbs([
      { id: 'sub-1', label: 'Detail' },
    ]);
    expect(useNavigationStore.getState().breadcrumbs.length).toBe(1);

    useNavigationStore.getState().setActivePage('settings');
    expect(useNavigationStore.getState().activePage).toBe('settings');
    expect(useNavigationStore.getState().breadcrumbs).toEqual([]);
  });

  it('sets and clears dynamic breadcrumbs', () => {
    const testCrumbs = [
      { id: 'c1', label: 'Sessions' },
      { id: 'c2', label: 'Session Detail 123' },
    ];

    useNavigationStore.getState().setBreadcrumbs(testCrumbs);
    expect(useNavigationStore.getState().breadcrumbs).toEqual(testCrumbs);

    useNavigationStore.getState().clearBreadcrumbs();
    expect(useNavigationStore.getState().breadcrumbs).toEqual([]);
  });

  it('toggles exit modal state', () => {
    expect(useNavigationStore.getState().isExitModalOpen).toBe(false);
    useNavigationStore.getState().setIsExitModalOpen(true);
    expect(useNavigationStore.getState().isExitModalOpen).toBe(true);
    useNavigationStore.getState().setIsExitModalOpen(false);
    expect(useNavigationStore.getState().isExitModalOpen).toBe(false);
  });
});

