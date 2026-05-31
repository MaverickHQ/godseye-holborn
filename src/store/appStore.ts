import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { TARGET_LOCATION } from '@/config/cameraSources';
import type { CameraSource, ViewState, AnimationState, CrimeCategory } from '@/types';

export interface Location {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  altitude: number;
}

export interface GeofenceNotification {
  id: string;
  category: CrimeCategory;
  street: string;
  month: string;
  detectedAt: number;
}

type PersistedMapTileStyle = 'dark' | 'street';

const DEFAULT_LOCATION: Location = {
  id: 'the-fable',
  name: TARGET_LOCATION.name,
  address: TARGET_LOCATION.address,
  lat: TARGET_LOCATION.lat,
  lng: TARGET_LOCATION.lng,
  altitude: TARGET_LOCATION.altitude,
};

interface AppState {
  // Legacy view state (kept for compatibility with existing tests/components)
  currentView: ViewState;
  animationState: {
    phase: 'space' | 'uk' | 'london' | 'city';
    progress: number;
    isTransitioning: boolean;
  };

  // Active UI state
  selectedCamera: CameraSource | null;
  selectedCrimeId: string | null;
  showHeatmap: boolean;

  // Persisted preferences
  mapTileStyle: PersistedMapTileStyle;
  crimeSearchRadius: number;
  cameraRefreshInterval: number;

  // Multi-location
  locations: Location[];
  activeLocationId: string;

  // Notifications (session-only)
  notifications: GeofenceNotification[];
  unreadCount: number;

  // Legacy actions
  setView: (view: ViewState) => void;
  setAnimationState: (state: AnimationState) => void;

  // Active UI actions
  setSelectedCamera: (camera: CameraSource | null) => void;
  setSelectedCrimeId: (id: string | null) => void;
  toggleHeatmap: () => void;
  setMapTileStyle: (style: PersistedMapTileStyle) => void;
  setCrimeSearchRadius: (radius: number) => void;
  setCameraRefreshInterval: (ms: number) => void;

  // Notification actions
  addNotification: (n: Omit<GeofenceNotification, 'id' | 'detectedAt'>) => void;
  clearNotifications: () => void;
  markNotificationsRead: () => void;

  // Location actions
  addLocation: (loc: Omit<Location, 'id'>) => void;
  removeLocation: (id: string) => void;
  setActiveLocation: (id: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    set => ({
      // Legacy defaults
      currentView: 'city',
      animationState: {
        phase: 'space',
        progress: 0,
        isTransitioning: true,
      },

      // Active UI defaults
      selectedCamera: null,
      selectedCrimeId: null,
      showHeatmap: false,

      // Persisted defaults
      mapTileStyle: 'dark',
      crimeSearchRadius: 1000,
      cameraRefreshInterval: 60000,

      // Multi-location
      locations: [DEFAULT_LOCATION],
      activeLocationId: DEFAULT_LOCATION.id,

      // Notifications
      notifications: [],
      unreadCount: 0,

      // Legacy actions
      setView: currentView => set({ currentView }),
      setAnimationState: animationState => set({ animationState }),

      // Active UI actions
      setSelectedCamera: selectedCamera => set({ selectedCamera }),
      setSelectedCrimeId: selectedCrimeId => set({ selectedCrimeId }),
      toggleHeatmap: () => set(state => ({ showHeatmap: !state.showHeatmap })),
      setMapTileStyle: mapTileStyle => set({ mapTileStyle }),
      setCrimeSearchRadius: crimeSearchRadius => set({ crimeSearchRadius }),
      setCameraRefreshInterval: cameraRefreshInterval => set({ cameraRefreshInterval }),

      // Notification actions
      addNotification: n =>
        set(state => {
          const notification: GeofenceNotification = {
            ...n,
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            detectedAt: Date.now(),
          };
          return {
            notifications: [notification, ...state.notifications].slice(0, 20),
            unreadCount: state.unreadCount + 1,
          };
        }),
      clearNotifications: () => set({ notifications: [], unreadCount: 0 }),
      markNotificationsRead: () => set({ unreadCount: 0 }),

      // Location actions
      addLocation: loc =>
        set(state => ({
          locations: [...state.locations, { ...loc, id: `loc-${Date.now()}` }],
        })),
      removeLocation: id =>
        set(state => {
          if (state.locations.length <= 1) return state;

          const locations = state.locations.filter(location => location.id !== id);
          const activeLocationId =
            state.activeLocationId === id ? locations[0]?.id ?? DEFAULT_LOCATION.id : state.activeLocationId;

          return { locations, activeLocationId };
        }),
      setActiveLocation: activeLocationId => set({ activeLocationId }),
    }),
    {
      name: 'godseye-prefs',
      storage: createJSONStorage(() => localStorage),
      version: 4,
      partialize: state => ({
        showHeatmap: state.showHeatmap,
        mapTileStyle: state.mapTileStyle,
        crimeSearchRadius: state.crimeSearchRadius,
        cameraRefreshInterval: state.cameraRefreshInterval,
        locations: state.locations,
        activeLocationId: state.activeLocationId,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<AppState>;
        const safeMapTileStyle: PersistedMapTileStyle = persisted.mapTileStyle === 'street' ? 'street' : 'dark';
        return {
          ...currentState,
          ...persisted,
          mapTileStyle: safeMapTileStyle,
          locations:
            Array.isArray(persisted.locations) && persisted.locations.length > 0
              ? persisted.locations
              : currentState.locations,
          activeLocationId:
            typeof persisted.activeLocationId === 'string'
              ? persisted.activeLocationId
              : currentState.activeLocationId,
        };
      },
    },
  ),
);

export function useActiveLocation(): Location {
  return useAppStore(state => {
    const match = state.locations.find(location => location.id === state.activeLocationId);
    return match ?? state.locations[0] ?? DEFAULT_LOCATION;
  });
}

export default useAppStore;
