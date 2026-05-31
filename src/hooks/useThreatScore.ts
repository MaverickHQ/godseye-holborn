import { useMemo } from 'react';
import type { Crime } from '@/types';

const HIGH_SEVERITY = new Set(['violent-crime', 'robbery', 'possession-of-weapons']);

const MED_SEVERITY = new Set([
  'burglary',
  'drugs',
  'criminal-damage-arson',
  'public-order',
  'theft-from-the-person',
]);

function timeOfDayScore(hour: number): number {
  if (hour >= 23 || hour < 4) return 20;
  if (hour >= 21 || hour < 7) return 13;
  if (hour >= 18 || hour < 9) return 6;
  return 0;
}

function trendScore(crimes: Crime[]): number {
  if (crimes.length === 0) return 0;
  const months = [...new Set(crimes.map(c => c.month))].sort();
  if (months.length < 2) return 5;
  const latest = months[months.length - 1];
  const prev = months[months.length - 2];
  const latestCount = crimes.filter(c => c.month === latest).length;
  const prevCount = crimes.filter(c => c.month === prev).length;
  if (prevCount === 0) return 5;
  if (latestCount > prevCount * 1.1) return 10;
  if (latestCount < prevCount * 0.9) return 0;
  return 5;
}

export type ThreatBand = 'green' | 'amber' | 'red';

export interface ThreatScoreResult {
  score: number;
  band: ThreatBand;
  label: string;
}

export function useThreatScore(crimes: Crime[]): ThreatScoreResult {
  return useMemo(() => {
    const hour = new Date().getHours();

    // Volume: 0–50 pts. 500 crimes → 50 pts
    const volumeScore = Math.min(50, crimes.length / 10);

    // Severity mix: 0–20 pts
    const highCount = crimes.filter(c => HIGH_SEVERITY.has(c.category)).length;
    const medCount = crimes.filter(c => MED_SEVERITY.has(c.category)).length;
    const severityRatio = (highCount * 2 + medCount * 0.8) / Math.max(1, crimes.length);
    const severityScore = Math.min(20, severityRatio * 22);

    // Time of day: 0–20 pts
    const todScore = timeOfDayScore(hour);

    // Crime trend: 0–10 pts
    const trend = trendScore(crimes);

    const raw = volumeScore + severityScore + todScore + trend;
    const score = Math.round(Math.min(100, Math.max(0, raw)));

    const band: ThreatBand = score < 36 ? 'green' : score < 67 ? 'amber' : 'red';
    const label = band === 'green' ? 'LOW' : band === 'amber' ? 'ELEVATED' : 'HIGH';

    return { score, band, label };
  }, [crimes]);
}
