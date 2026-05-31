import type { Crime } from '@/types';

export interface CrimeCluster {
  id: string;
  lat: number;
  lng: number;
  count: number;
  category: Crime['category'];
  crimes: Crime[];
}

export function buildCrimeClusters(crimes: Crime[]): CrimeCluster[] {
  const cellSize = 0.001;
  const buckets = new Map<string, Crime[]>();

  crimes.forEach(crime => {
    const latCell = Math.round(crime.location.lat / cellSize);
    const lngCell = Math.round(crime.location.lng / cellSize);
    const key = `${latCell}:${lngCell}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push(crime);
    buckets.set(key, bucket);
  });

  return Array.from(buckets.entries()).map(([key, bucket]) => {
    const center = bucket.reduce(
      (acc, crime) => {
        acc.lat += crime.location.lat;
        acc.lng += crime.location.lng;
        return acc;
      },
      { lat: 0, lng: 0 },
    );
    const avgLat = center.lat / bucket.length;
    const avgLng = center.lng / bucket.length;
    const categoryCounts = bucket.reduce<Record<string, number>>((acc, crime) => {
      acc[crime.category] = (acc[crime.category] || 0) + 1;
      return acc;
    }, {});
    const dominantCategory = (Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ||
      bucket[0]?.category ||
      'other-crime') as Crime['category'];

    return {
      id: key,
      lat: avgLat,
      lng: avgLng,
      count: bucket.length,
      category: dominantCategory,
      crimes: bucket,
    };
  });
}
