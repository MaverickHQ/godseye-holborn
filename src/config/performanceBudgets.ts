export const PERFORMANCE_BUDGETS = {
  bundle: {
    maxMainJsBytes: 900_000,
    maxMainJsGzipBytes: 280_000,
    maxMainCssBytes: 40_000,
  },
  runtime: {
    maxLeftPanelRenderMs: 200,
    maxClusterBuildMs: 80,
    clusterFixtureCount: 1_200,
  },
} as const;

export default PERFORMANCE_BUDGETS;
