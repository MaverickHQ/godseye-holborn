import { useEffect, useRef } from 'react';
import { useAppStore } from '@/store/appStore';
import { TARGET_LOCATION } from '@/config/cameraSources';
import type { Crime, CrimeCategory } from '@/types';

const PROXIMITY_M = 150;

function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = (lat2 - lat1) * 111000;
  const dLng = (lng2 - lng1) * 111000 * Math.cos((lat1 * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

export function useIntelligenceAlerts(crimes: Crime[], isLoading: boolean) {
  const firedRef = useRef(false);
  const addNotification = useAppStore(s => s.addNotification);

  useEffect(() => {
    if (isLoading || crimes.length === 0 || firedRef.current) return;
    firedRef.current = true;

    const counts: Partial<Record<CrimeCategory, number>> = {};
    for (const c of crimes) {
      counts[c.category] = (counts[c.category] || 0) + 1;
    }
    const [topCat, topCount] = Object.entries(counts).sort(
      ([, a], [, b]) => (b as number) - (a as number),
    )[0] as [CrimeCategory, number];

    const months = [...new Set(crimes.map(c => c.month))].sort();
    const latestMonth = months[months.length - 1];

    addNotification({
      category: topCat,
      street: `${topCount} incidents — dominant category in area`,
      month: latestMonth,
    });

    const nearby = crimes.filter(
      c =>
        distanceM(TARGET_LOCATION.lat, TARGET_LOCATION.lng, c.location.lat, c.location.lng) <=
        PROXIMITY_M,
    );
    if (nearby.length > 0) {
      const nearbyCounts: Partial<Record<CrimeCategory, number>> = {};
      for (const c of nearby) {
        nearbyCounts[c.category] = (nearbyCounts[c.category] || 0) + 1;
      }
      const [nearbyCat] = Object.entries(nearbyCounts).sort(
        ([, a], [, b]) => (b as number) - (a as number),
      )[0] as [CrimeCategory, number];

      addNotification({
        category: nearbyCat,
        street: `${nearby.length} incident${nearby.length !== 1 ? 's' : ''} within 150m of target`,
        month: latestMonth,
      });
    }
  }, [isLoading, crimes, addNotification]);
}
