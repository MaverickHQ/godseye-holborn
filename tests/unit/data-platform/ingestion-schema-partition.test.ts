import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { buildTableCatalog } from '@/dataPlatform/catalog';
import { runIngestionPipeline } from '@/dataPlatform/ingestion';

function cleanupDir(target: string) {
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
  }
}

describe('phase 2.1 ingestion schema and partition contracts', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const dir of tempRoots) {
      cleanupDir(dir);
    }
    tempRoots.length = 0;
  });

  it('defines required namespaces and tables for curated, feature, prediction, evaluation, and serving datasets', () => {
    const catalog = buildTableCatalog();

    expect(catalog.namespace).toBe('godseye_holborn');
    expect(catalog.tables.curated.camera_snapshot).toBeDefined();
    expect(catalog.tables.curated.crime_observation).toBeDefined();
    expect(catalog.tables.feature.feature_snapshot).toBeDefined();
    expect(catalog.tables.prediction.prediction).toBeDefined();
    expect(catalog.tables.evaluation.evaluation_result).toBeDefined();
    expect(catalog.tables.serving.serving_incident_summary).toBeDefined();
    expect(catalog.tables.serving.serving_hotspot_summary).toBeDefined();
  });

  it('writes immutable raw snapshots and curated partition outputs with schema-aligned records', async () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'godseye-phase21-'));
    tempRoots.push(outDir);

    const runId = 'run-20260524T190000Z';
    const observedAt = new Date('2026-05-24T19:00:00.000Z');

    const pipelineResult = await runIngestionPipeline({
      runId,
      observedAt,
      outDir,
      targetArea: 'holborn',
      cameraSnapshots: [
        {
          id: 'cam-01',
          name: 'Farringdon Rd/Cowcross St',
          lat: 51.52,
          lng: -0.1059,
          status: 'active',
          feedType: 'snapshot',
          source: 'tfl-jamcam',
          capturedAt: observedAt.toISOString(),
        },
      ],
      crimeObservations: [
        {
          id: 'crime-01',
          category: 'violent-crime',
          month: '2026-02',
          lat: 51.5185,
          lng: -0.1065,
          street: 'Hatton Garden',
          source: 'police-uk',
          publishedAt: '2026-03-15T00:00:00.000Z',
        },
      ],
    });

    expect(pipelineResult.rawSnapshotPaths).toHaveLength(2);
    expect(pipelineResult.curatedOutputPaths).toHaveLength(2);
    expect(pipelineResult.partitionKeys.camera_snapshot).toMatchObject({
      area: 'holborn',
      year: '2026',
      month: '05',
      day: '24',
    });
    expect(pipelineResult.partitionKeys.crime_observation).toMatchObject({
      area: 'holborn',
      year: '2026',
      month: '05',
      day: '24',
    });

    for (const filePath of pipelineResult.rawSnapshotPaths) {
      expect(fs.existsSync(filePath)).toBe(true);
    }

    for (const filePath of pipelineResult.curatedOutputPaths) {
      expect(fs.existsSync(filePath)).toBe(true);
      const lines = fs
        .readFileSync(filePath, 'utf8')
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);
      expect(lines.length).toBeGreaterThan(0);
      const first = JSON.parse(lines[0]) as Record<string, unknown>;
      expect(first.run_id).toBe(runId);
      expect(first.area).toBe('holborn');
      expect(first.ingested_at).toBe(observedAt.toISOString());
      expect(first.event_date).toBe('2026-05-24');
    }
  });

  it('rejects reuse of an existing immutable run ID', async () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'godseye-phase21-'));
    tempRoots.push(outDir);

    const runId = 'run-immutable-check';
    const observedAt = new Date('2026-05-24T19:00:00.000Z');

    await runIngestionPipeline({
      runId,
      observedAt,
      outDir,
      targetArea: 'holborn',
      cameraSnapshots: [],
      crimeObservations: [],
    });

    await expect(
      runIngestionPipeline({
        runId,
        observedAt,
        outDir,
        targetArea: 'holborn',
        cameraSnapshots: [],
        crimeObservations: [],
      }),
    ).rejects.toThrow(/immutable run id/i);
  });
});
