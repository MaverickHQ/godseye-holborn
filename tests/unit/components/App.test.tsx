import { beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from '@/store/appStore';

describe('App store runtime ownership', () => {
  beforeEach(() => {
    useAppStore.setState({
      currentView: 'city',
      animationState: {
        phase: 'space',
        progress: 0,
        isTransitioning: true,
      },
      selectedCamera: null,
      selectedCrimeId: null,
      showHeatmap: false,
      mapTileStyle: 'dark',
      crimeSearchRadius: 1000,
      cameraRefreshInterval: 60_000,
      notifications: [],
      unreadCount: 0,
    });
  });

  it('keeps legacy view transition controls operational', () => {
    const { setView, setAnimationState } = useAppStore.getState();

    setAnimationState({
      phase: 'city',
      progress: 1,
      isTransitioning: false,
    });
    setView('city');

    const state = useAppStore.getState();
    expect(state.currentView).toBe('city');
    expect(state.animationState.phase).toBe('city');
    expect(state.animationState.isTransitioning).toBe(false);
  });

  it('stores selection and visualization preferences in appStore', () => {
    const { setSelectedCrimeId, toggleHeatmap, setMapTileStyle } = useAppStore.getState();

    setSelectedCrimeId('crime-42');
    toggleHeatmap();
    setMapTileStyle('street');

    const state = useAppStore.getState();
    expect(state.selectedCrimeId).toBe('crime-42');
    expect(state.showHeatmap).toBe(true);
    expect(state.mapTileStyle).toBe('street');
  });

  it('does not carry legacy runtime data collections in store state', () => {
    const state = useAppStore.getState() as unknown as Record<string, unknown>;

    expect('cameras' in state).toBe(false);
    expect('crimes' in state).toBe(false);
    expect('cameraStatuses' in state).toBe(false);
    expect('showCrimePanel' in state).toBe(false);
    expect('showCCTVGrid' in state).toBe(false);
    expect('sidebarExpanded' in state).toBe(false);
  });
});
