import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAppStore } from '@/store/appStore';
import type { CameraSource, CrimeCategory } from '@/types';

describe('useAppStore', () => {
  beforeEach(() => {
    useAppStore.setState({
      currentView: 'city',
      animationState: { phase: 'space', progress: 0, isTransitioning: true },
      selectedCamera: null,
      selectedCrimeId: null,
      showHeatmap: false,
      mapTileStyle: 'dark',
      crimeSearchRadius: 1000,
      cameraRefreshInterval: 60_000,
      locations: [
        {
          id: 'the-fable',
          name: 'Holborn',
          address: '52 Holborn Viaduct, London EC1A 2BN',
          lat: 51.5185,
          lng: -0.1065,
          altitude: 100,
        },
      ],
      activeLocationId: 'the-fable',
      notifications: [],
      unreadCount: 0,
    });
  });

  it('sets view and animation state', () => {
    const { result } = renderHook(() => useAppStore());

    act(() => {
      result.current.setView('city');
      result.current.setAnimationState({ phase: 'city', progress: 1, isTransitioning: false });
    });

    expect(result.current.currentView).toBe('city');
    expect(result.current.animationState).toEqual({ phase: 'city', progress: 1, isTransitioning: false });
  });

  it('updates selected camera and selected crime id', () => {
    const { result } = renderHook(() => useAppStore());
    const camera: CameraSource = {
      id: 'cam-1',
      name: 'Camera 1',
      type: 'traffic',
      coordinates: { lat: 51.5, lng: -0.1 },
      provider: 'tfl',
      streamUrl: 'https://example.com/cam-1.jpg',
      status: 'active',
      lastVerified: '2026-05-31T10:00:00.000Z',
      feedType: 'snapshot',
    };

    act(() => {
      result.current.setSelectedCamera(camera);
      result.current.setSelectedCrimeId('crime-1');
    });

    expect(result.current.selectedCamera?.id).toBe('cam-1');
    expect(result.current.selectedCrimeId).toBe('crime-1');

    act(() => {
      result.current.setSelectedCamera(null);
      result.current.setSelectedCrimeId(null);
    });

    expect(result.current.selectedCamera).toBeNull();
    expect(result.current.selectedCrimeId).toBeNull();
  });

  it('toggles heatmap and updates runtime preferences', () => {
    const { result } = renderHook(() => useAppStore());

    expect(result.current.showHeatmap).toBe(false);

    act(() => {
      result.current.toggleHeatmap();
      result.current.setMapTileStyle('street');
      result.current.setCrimeSearchRadius(1200);
      result.current.setCameraRefreshInterval(90_000);
    });

    expect(result.current.showHeatmap).toBe(true);
    expect(result.current.mapTileStyle).toBe('street');
    expect(result.current.crimeSearchRadius).toBe(1200);
    expect(result.current.cameraRefreshInterval).toBe(90_000);
  });

  it('supports notification lifecycle and unread tracking', () => {
    const { result } = renderHook(() => useAppStore());

    act(() => {
      result.current.addNotification({
        category: 'violent-crime' as CrimeCategory,
        street: '2 incidents near target',
        month: '2026-02',
      });
    });

    expect(result.current.notifications.length).toBe(1);
    expect(result.current.unreadCount).toBe(1);

    act(() => {
      result.current.markNotificationsRead();
    });

    expect(result.current.unreadCount).toBe(0);

    act(() => {
      result.current.clearNotifications();
    });

    expect(result.current.notifications).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
  });

  it('supports location add/remove/active selection with fallback protections', () => {
    const { result } = renderHook(() => useAppStore());

    act(() => {
      result.current.addLocation({
        name: 'Backup Site',
        address: '1 Example Street, London',
        lat: 51.52,
        lng: -0.1,
        altitude: 90,
      });
    });

    const addedLocation = result.current.locations.find(location => location.name === 'Backup Site');
    expect(addedLocation).toBeDefined();

    act(() => {
      result.current.setActiveLocation(addedLocation!.id);
    });

    expect(result.current.activeLocationId).toBe(addedLocation!.id);

    act(() => {
      result.current.removeLocation(addedLocation!.id);
    });

    expect(result.current.locations.some(location => location.id === addedLocation!.id)).toBe(false);
    expect(result.current.locations.length).toBe(1);
    expect(result.current.activeLocationId).toBe('the-fable');
  });
});
