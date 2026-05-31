import { describe, expect, it } from 'vitest';
import {
  buildServingDatasets,
  estimateServingQueryProfile,
} from '@/dataPlatform/serving';

describe('phase 2.3 serving dataset optimization', () => {
  it('builds deterministic incident and hotspot serving datasets', () => {
    const serving = buildServingDatasets({
      area: 'holborn',
      ingestedAt: '2026-05-24T19:00:00.000Z',
      crimeObservations: [
        { id: '1', category: 'robbery', month: '2026-02', lat: 51.5185, lng: -0.1065 },
        { id: '2', category: 'robbery', month: '2026-02', lat: 51.5187, lng: -0.1063 },
        { id: '3', category: 'violent-crime', month: '2026-02', lat: 51.5201, lng: -0.1052 },
        { id: '4', category: 'drugs', month: '2026-01', lat: 51.5171, lng: -0.1105 },
      ],
    });

    expect(serving.incidentSummary).toHaveLength(3);
    expect(serving.incidentSummary[0]).toMatchObject({
      area: 'holborn',
      month: '2026-02',
      category: 'robbery',
      incident_count: 2,
    });

    expect(serving.hotspotSummary.length).toBeGreaterThan(0);
    expect(serving.hotspotSummary[0]).toHaveProperty('cell_id');
    expect(serving.hotspotSummary[0]).toHaveProperty('centroid_lat');
    expect(serving.hotspotSummary[0]).toHaveProperty('centroid_lng');
  });

  it('keeps serving output schema stable for frontend consumption contracts', () => {
    const serving = buildServingDatasets({
      area: 'holborn',
      ingestedAt: '2026-05-24T19:00:00.000Z',
      crimeObservations: [{ id: '1', category: 'robbery', month: '2026-02', lat: 51.5185, lng: -0.1065 }],
    });

    const incidentShapeKeys = Object.keys(serving.incidentSummary[0] ?? {}).sort();
    expect(incidentShapeKeys).toEqual(
      ['area', 'category', 'incident_count', 'last_ingested_at', 'month'].sort(),
    );

    const hotspotShapeKeys = Object.keys(serving.hotspotSummary[0] ?? {}).sort();
    expect(hotspotShapeKeys).toEqual(
      ['area', 'cell_id', 'centroid_lat', 'centroid_lng', 'incident_count', 'last_ingested_at', 'month', 'top_category'].sort(),
    );
  });

  it('profiles serving query cost and latency within expected local thresholds', () => {
    const profile = estimateServingQueryProfile({
      incidentRows: 120,
      hotspotRows: 240,
      averageRowBytes: 420,
      queriesPerDashboardLoad: 4,
    });

    expect(profile.estimatedScanBytes).toBe(151200);
    expect(profile.estimatedScanMegabytes).toBeCloseTo(0.1442, 4);
    expect(profile.expectedP50LatencyMs).toBeLessThanOrEqual(250);
    expect(profile.expectedP95LatencyMs).toBeLessThanOrEqual(450);
    expect(profile.queryPattern).toBe('precomputed-serving-only');
  });
});
