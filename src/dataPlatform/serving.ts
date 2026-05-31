export interface ServingCrimeObservation {
  id: string;
  category: string;
  month: string;
  lat: number;
  lng: number;
}

export interface BuildServingDatasetsInput {
  area: string;
  ingestedAt: string;
  crimeObservations: ServingCrimeObservation[];
  cellSizeDegrees?: number;
}

export interface ServingIncidentSummaryRow {
  area: string;
  month: string;
  category: string;
  incident_count: number;
  last_ingested_at: string;
}

export interface ServingHotspotSummaryRow {
  area: string;
  month: string;
  cell_id: string;
  incident_count: number;
  top_category: string;
  centroid_lat: number;
  centroid_lng: number;
  last_ingested_at: string;
}

export interface BuildServingDatasetsResult {
  incidentSummary: ServingIncidentSummaryRow[];
  hotspotSummary: ServingHotspotSummaryRow[];
}

export interface QueryProfileInput {
  incidentRows: number;
  hotspotRows: number;
  averageRowBytes: number;
  queriesPerDashboardLoad: number;
}

export interface QueryProfileResult {
  estimatedScanBytes: number;
  estimatedScanMegabytes: number;
  expectedP50LatencyMs: number;
  expectedP95LatencyMs: number;
  queryPattern: 'precomputed-serving-only';
}

const DEFAULT_CELL_SIZE_DEGREES = 0.0015;

function toCellId(lat: number, lng: number, cellSizeDegrees: number): string {
  const latBucket = Math.floor(lat / cellSizeDegrees);
  const lngBucket = Math.floor(lng / cellSizeDegrees);
  return `cell_${latBucket}_${lngBucket}`;
}

function roundTo(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

export function buildServingDatasets(
  input: BuildServingDatasetsInput,
): BuildServingDatasetsResult {
  const cellSize = input.cellSizeDegrees ?? DEFAULT_CELL_SIZE_DEGREES;
  const area = input.area.trim().toLowerCase();

  const incidentCounter = new Map<string, number>();
  const cellAccumulator = new Map<
    string,
    {
      month: string;
      latSum: number;
      lngSum: number;
      count: number;
      categoryCounts: Map<string, number>;
    }
  >();

  for (const crime of input.crimeObservations) {
    const incidentKey = `${crime.month}::${crime.category}`;
    incidentCounter.set(incidentKey, (incidentCounter.get(incidentKey) ?? 0) + 1);

    const cellId = toCellId(crime.lat, crime.lng, cellSize);
    const cellKey = `${crime.month}::${cellId}`;
    const current = cellAccumulator.get(cellKey) ?? {
      month: crime.month,
      latSum: 0,
      lngSum: 0,
      count: 0,
      categoryCounts: new Map<string, number>(),
    };

    current.latSum += crime.lat;
    current.lngSum += crime.lng;
    current.count += 1;
    current.categoryCounts.set(
      crime.category,
      (current.categoryCounts.get(crime.category) ?? 0) + 1,
    );
    cellAccumulator.set(cellKey, current);
  }

  const incidentSummary: ServingIncidentSummaryRow[] = Array.from(incidentCounter.entries())
    .map(([key, count]) => {
      const [month, category] = key.split('::');
      return {
        area,
        month,
        category,
        incident_count: count,
        last_ingested_at: input.ingestedAt,
      };
    })
    .sort((a, b) => {
      if (a.month !== b.month) return b.month.localeCompare(a.month);
      if (a.incident_count !== b.incident_count) return b.incident_count - a.incident_count;
      return a.category.localeCompare(b.category);
    });

  const hotspotSummary: ServingHotspotSummaryRow[] = Array.from(cellAccumulator.entries())
    .map(([key, value]) => {
      const [month, cellId] = key.split('::');
      const categoryRanking = Array.from(value.categoryCounts.entries()).sort((a, b) => {
        if (a[1] !== b[1]) return b[1] - a[1];
        return a[0].localeCompare(b[0]);
      });

      return {
        area,
        month,
        cell_id: cellId,
        incident_count: value.count,
        top_category: categoryRanking[0]?.[0] ?? 'unknown',
        centroid_lat: roundTo(value.latSum / value.count, 6),
        centroid_lng: roundTo(value.lngSum / value.count, 6),
        last_ingested_at: input.ingestedAt,
      };
    })
    .sort((a, b) => {
      if (a.month !== b.month) return b.month.localeCompare(a.month);
      if (a.incident_count !== b.incident_count) return b.incident_count - a.incident_count;
      return a.cell_id.localeCompare(b.cell_id);
    });

  return {
    incidentSummary,
    hotspotSummary,
  };
}

export function estimateServingQueryProfile(
  input: QueryProfileInput,
): QueryProfileResult {
  const estimatedScanBytes =
    (input.incidentRows + input.hotspotRows) * input.averageRowBytes;
  const estimatedScanMegabytes = roundTo(estimatedScanBytes / (1024 * 1024), 4);

  const latencyBase = 80;
  const queryFanoutPenalty = input.queriesPerDashboardLoad * 25;
  const scanPenalty = Math.ceil(estimatedScanMegabytes * 120);
  const expectedP50LatencyMs = Math.min(250, latencyBase + queryFanoutPenalty + scanPenalty);
  const expectedP95LatencyMs = Math.min(450, expectedP50LatencyMs + 160);

  return {
    estimatedScanBytes,
    estimatedScanMegabytes,
    expectedP50LatencyMs,
    expectedP95LatencyMs,
    queryPattern: 'precomputed-serving-only',
  };
}

export default {
  buildServingDatasets,
  estimateServingQueryProfile,
};
