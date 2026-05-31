import fs from 'node:fs';
import path from 'node:path';
import { buildTableCatalog, type TableSchema } from './catalog';

export interface CameraSnapshotInput {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status: string;
  feedType: string;
  source: string;
  capturedAt: string;
}

export interface CrimeObservationInput {
  id: string;
  category: string;
  month: string;
  lat: number;
  lng: number;
  street: string;
  source: string;
  publishedAt: string;
}

export interface IngestionPipelineInput {
  runId: string;
  observedAt: Date;
  outDir: string;
  targetArea: string;
  cameraSnapshots: CameraSnapshotInput[];
  crimeObservations: CrimeObservationInput[];
}

export interface PartitionKey {
  area: string;
  year: string;
  month: string;
  day: string;
}

export interface IngestionPipelineResult {
  runId: string;
  ingestedAt: string;
  rawSnapshotPaths: string[];
  curatedOutputPaths: string[];
  partitionKeys: {
    camera_snapshot: PartitionKey;
    crime_observation: PartitionKey;
  };
}

function ensureDir(target: string) {
  fs.mkdirSync(target, { recursive: true });
}

function sanitizeArea(area: string): string {
  return area
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function formatPartitionKey(observedAt: Date, area: string): PartitionKey {
  const yyyy = String(observedAt.getUTCFullYear());
  const mm = String(observedAt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(observedAt.getUTCDate()).padStart(2, '0');
  return {
    area: sanitizeArea(area),
    year: yyyy,
    month: mm,
    day: dd,
  };
}

function typeMatches(expected: string, value: unknown): boolean {
  if (expected === 'string') return typeof value === 'string';
  if (expected === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (expected === 'boolean') return typeof value === 'boolean';
  return false;
}

function validateRecord(schema: TableSchema, record: Record<string, unknown>) {
  for (const column of schema.columns) {
    const value = record[column.name];
    if (value === undefined || value === null) {
      if (!column.nullable) {
        throw new Error(
          `Schema validation failed for ${schema.tableName}: missing ${column.name}`,
        );
      }
      continue;
    }

    if (!typeMatches(column.type, value)) {
      throw new Error(
        `Schema validation failed for ${schema.tableName}: ${column.name} expected ${column.type}`,
      );
    }
  }
}

function writeJson(filePath: string, payload: unknown) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function writeJsonLines(filePath: string, records: Record<string, unknown>[]) {
  ensureDir(path.dirname(filePath));
  const lines = records.map(record => JSON.stringify(record)).join('\n');
  fs.writeFileSync(filePath, `${lines}\n`, 'utf8');
}

function buildCuratedDir(baseDir: string, tableName: string, partitionKey: PartitionKey): string {
  return path.join(
    baseDir,
    'curated',
    tableName,
    `area=${partitionKey.area}`,
    `year=${partitionKey.year}`,
    `month=${partitionKey.month}`,
    `day=${partitionKey.day}`,
  );
}

export async function runIngestionPipeline(
  input: IngestionPipelineInput,
): Promise<IngestionPipelineResult> {
  const { runId, observedAt, outDir, targetArea, cameraSnapshots, crimeObservations } = input;
  const runDir = path.join(outDir, 'runs', runId);
  if (fs.existsSync(runDir)) {
    throw new Error(`Immutable run ID violation: ${runId} already exists`);
  }
  ensureDir(runDir);

  const ingestedAt = observedAt.toISOString();
  const eventDate = ingestedAt.slice(0, 10);
  const partitionKey = formatPartitionKey(observedAt, targetArea);
  const catalog = buildTableCatalog();

  const rawCameraSnapshotPath = path.join(outDir, 'raw', 'tfl-jamcam', `${runId}.json`);
  const rawCrimeSnapshotPath = path.join(outDir, 'raw', 'police-uk', `${runId}.json`);

  writeJson(rawCameraSnapshotPath, {
    run_id: runId,
    source: 'tfl-jamcam',
    ingested_at: ingestedAt,
    target_area: partitionKey.area,
    items: cameraSnapshots,
  });
  writeJson(rawCrimeSnapshotPath, {
    run_id: runId,
    source: 'police-uk',
    ingested_at: ingestedAt,
    target_area: partitionKey.area,
    items: crimeObservations,
  });

  const curatedCameraRecords = cameraSnapshots.map<Record<string, unknown>>(item => ({
    run_id: runId,
    area: partitionKey.area,
    source_id: item.id,
    source_name: item.name,
    source_provider: item.source,
    lat: item.lat,
    lng: item.lng,
    status: item.status,
    feed_type: item.feedType,
    captured_at: item.capturedAt,
    ingested_at: ingestedAt,
    event_date: eventDate,
    storage_tier: 'hot',
  }));

  const curatedCrimeRecords = crimeObservations.map<Record<string, unknown>>(item => ({
    run_id: runId,
    area: partitionKey.area,
    crime_id: item.id,
    category: item.category,
    month: item.month,
    lat: item.lat,
    lng: item.lng,
    street: item.street,
    source_provider: item.source,
    published_at: item.publishedAt,
    ingested_at: ingestedAt,
    event_date: eventDate,
    storage_tier: 'hot',
  }));

  for (const record of curatedCameraRecords) {
    validateRecord(catalog.tables.curated.camera_snapshot, record);
  }

  for (const record of curatedCrimeRecords) {
    validateRecord(catalog.tables.curated.crime_observation, record);
  }

  const curatedCameraPath = path.join(
    buildCuratedDir(outDir, 'camera_snapshot', partitionKey),
    `run=${runId}.jsonl`,
  );
  const curatedCrimePath = path.join(
    buildCuratedDir(outDir, 'crime_observation', partitionKey),
    `run=${runId}.jsonl`,
  );

  writeJsonLines(curatedCameraPath, curatedCameraRecords);
  writeJsonLines(curatedCrimePath, curatedCrimeRecords);

  return {
    runId,
    ingestedAt,
    rawSnapshotPaths: [rawCameraSnapshotPath, rawCrimeSnapshotPath],
    curatedOutputPaths: [curatedCameraPath, curatedCrimePath],
    partitionKeys: {
      camera_snapshot: partitionKey,
      crime_observation: partitionKey,
    },
  };
}

export default runIngestionPipeline;
