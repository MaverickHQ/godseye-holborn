export type ColumnType = 'string' | 'number' | 'boolean';

export interface TableColumn {
  name: string;
  type: ColumnType;
  nullable: boolean;
}

export interface TableSchema {
  tableName: string;
  description: string;
  partitionKeys: string[];
  columns: TableColumn[];
}

export interface TableCatalog {
  namespace: string;
  tables: {
    curated: {
      camera_snapshot: TableSchema;
      crime_observation: TableSchema;
    };
    feature: {
      feature_snapshot: TableSchema;
    };
    prediction: {
      prediction: TableSchema;
    };
    evaluation: {
      evaluation_result: TableSchema;
    };
    serving: {
      serving_incident_summary: TableSchema;
      serving_hotspot_summary: TableSchema;
    };
  };
}

function defineTable(
  tableName: string,
  description: string,
  partitionKeys: string[],
  columns: TableColumn[],
): TableSchema {
  return {
    tableName,
    description,
    partitionKeys,
    columns,
  };
}

export function buildTableCatalog(): TableCatalog {
  return {
    namespace: 'godseye_holborn',
    tables: {
      curated: {
        camera_snapshot: defineTable(
          'camera_snapshot',
          'Latest-known CCTV snapshot metadata and status in Holborn',
          ['area', 'year', 'month', 'day'],
          [
            { name: 'run_id', type: 'string', nullable: false },
            { name: 'area', type: 'string', nullable: false },
            { name: 'source_id', type: 'string', nullable: false },
            { name: 'source_name', type: 'string', nullable: false },
            { name: 'source_provider', type: 'string', nullable: false },
            { name: 'lat', type: 'number', nullable: false },
            { name: 'lng', type: 'number', nullable: false },
            { name: 'status', type: 'string', nullable: false },
            { name: 'feed_type', type: 'string', nullable: false },
            { name: 'captured_at', type: 'string', nullable: false },
            { name: 'ingested_at', type: 'string', nullable: false },
            { name: 'event_date', type: 'string', nullable: false },
            { name: 'storage_tier', type: 'string', nullable: false },
          ],
        ),
        crime_observation: defineTable(
          'crime_observation',
          'Published Police UK crime observations for Holborn',
          ['area', 'year', 'month', 'day'],
          [
            { name: 'run_id', type: 'string', nullable: false },
            { name: 'area', type: 'string', nullable: false },
            { name: 'crime_id', type: 'string', nullable: false },
            { name: 'category', type: 'string', nullable: false },
            { name: 'month', type: 'string', nullable: false },
            { name: 'lat', type: 'number', nullable: false },
            { name: 'lng', type: 'number', nullable: false },
            { name: 'street', type: 'string', nullable: false },
            { name: 'source_provider', type: 'string', nullable: false },
            { name: 'published_at', type: 'string', nullable: false },
            { name: 'ingested_at', type: 'string', nullable: false },
            { name: 'event_date', type: 'string', nullable: false },
            { name: 'storage_tier', type: 'string', nullable: false },
          ],
        ),
      },
      feature: {
        feature_snapshot: defineTable(
          'feature_snapshot',
          'Versioned feature values by cell and time bucket for model training/inference',
          ['area', 'window_start'],
          [
            { name: 'feature_snapshot_id', type: 'string', nullable: false },
            { name: 'run_id', type: 'string', nullable: false },
            { name: 'area', type: 'string', nullable: false },
            { name: 'cell_id', type: 'string', nullable: false },
            { name: 'window_start', type: 'string', nullable: false },
            { name: 'window_end', type: 'string', nullable: false },
            { name: 'feature_payload_json', type: 'string', nullable: false },
          ],
        ),
      },
      prediction: {
        prediction: defineTable(
          'prediction',
          'Forecast outputs for future risk hotspots',
          ['area', 'window_start'],
          [
            { name: 'prediction_run_id', type: 'string', nullable: false },
            { name: 'model_version', type: 'string', nullable: false },
            { name: 'feature_snapshot_id', type: 'string', nullable: false },
            { name: 'area', type: 'string', nullable: false },
            { name: 'cell_id', type: 'string', nullable: false },
            { name: 'window_start', type: 'string', nullable: false },
            { name: 'window_end', type: 'string', nullable: false },
            { name: 'predicted_count', type: 'number', nullable: false },
            { name: 'risk_score', type: 'number', nullable: false },
          ],
        ),
      },
      evaluation: {
        evaluation_result: defineTable(
          'evaluation_result',
          'Prediction-vs-actual evaluation metrics by run',
          ['area', 'evaluation_week'],
          [
            { name: 'evaluation_run_id', type: 'string', nullable: false },
            { name: 'prediction_run_id', type: 'string', nullable: false },
            { name: 'area', type: 'string', nullable: false },
            { name: 'evaluation_week', type: 'string', nullable: false },
            { name: 'mae', type: 'number', nullable: false },
            { name: 'rmse', type: 'number', nullable: false },
            { name: 'precision_at_k', type: 'number', nullable: false },
            { name: 'calibration_score', type: 'number', nullable: false },
          ],
        ),
      },
      serving: {
        serving_incident_summary: defineTable(
          'serving_incident_summary',
          'Precomputed month/category summaries for dashboard filters',
          ['area', 'month'],
          [
            { name: 'area', type: 'string', nullable: false },
            { name: 'month', type: 'string', nullable: false },
            { name: 'category', type: 'string', nullable: false },
            { name: 'incident_count', type: 'number', nullable: false },
            { name: 'last_ingested_at', type: 'string', nullable: false },
          ],
        ),
        serving_hotspot_summary: defineTable(
          'serving_hotspot_summary',
          'Precomputed hotspot ranking summaries for map and panel rendering',
          ['area', 'month'],
          [
            { name: 'area', type: 'string', nullable: false },
            { name: 'month', type: 'string', nullable: false },
            { name: 'cell_id', type: 'string', nullable: false },
            { name: 'incident_count', type: 'number', nullable: false },
            { name: 'top_category', type: 'string', nullable: false },
            { name: 'centroid_lat', type: 'number', nullable: false },
            { name: 'centroid_lng', type: 'number', nullable: false },
            { name: 'last_ingested_at', type: 'string', nullable: false },
          ],
        ),
      },
    },
  };
}

export default buildTableCatalog;
