export interface PrefixGrowthBudget {
  prefix: string;
  objectCount: number;
  warningThreshold: number;
  errorThreshold: number;
}

export interface GrowthStatus {
  prefix: string;
  status: 'ok' | 'warning' | 'error';
  objectCount: number;
}

const PARTITION_PATTERN = /area=[a-z0-9-]+\/year=\d{4}\/month=\d{2}\/day=\d{2}\//i;

export function evaluatePrefixGrowth(input: PrefixGrowthBudget): GrowthStatus {
  if (input.objectCount >= input.errorThreshold) {
    return { prefix: input.prefix, status: 'error', objectCount: input.objectCount };
  }
  if (input.objectCount >= input.warningThreshold) {
    return { prefix: input.prefix, status: 'warning', objectCount: input.objectCount };
  }
  return { prefix: input.prefix, status: 'ok', objectCount: input.objectCount };
}

export function estimateAthenaScanBytes(params: {
  rows: number;
  averageRowBytes: number;
  queries: number;
}): number {
  return params.rows * params.averageRowBytes * params.queries;
}

export function validatePartitionPath(partitionPath: string): boolean {
  return PARTITION_PATTERN.test(partitionPath);
}

export function isServingWindowWithinRetention(monthCount: number, maxMonths: number = 3): boolean {
  return monthCount <= maxMonths;
}
