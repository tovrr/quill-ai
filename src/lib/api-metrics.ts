import type { BuilderArtifactType } from "@/lib/builder-artifacts";
import type { BuilderTarget } from "@/lib/builder-artifacts";

type RouteMetric = {
  total: number;
  statuses: Record<string, number>;
  errors: Record<string, number>;
};

type BuilderMetric = {
  prompts: number;
  artifacts: number;
  parseFailures: number;
  mismatches: number;
  byType: Record<BuilderArtifactType, number>;
  byRequestedTarget: Record<BuilderTarget, number>;
};

type MetricsStore = {
  startedAt: string;
  totals: {
    requests: number;
    status2xx: number;
    status4xx: number;
    status5xx: number;
  };
  routes: Record<string, RouteMetric>;
  builder: BuilderMetric;
};

const globalStore = globalThis as typeof globalThis & {
  __quillApiMetrics__?: MetricsStore;
};

function createStore(): MetricsStore {
  return {
    startedAt: new Date().toISOString(),
    totals: {
      requests: 0,
      status2xx: 0,
      status4xx: 0,
      status5xx: 0,
    },
    routes: {},
    builder: {
      prompts: 0,
      artifacts: 0,
      parseFailures: 0,
      mismatches: 0,
      byType: {
        page: 0,
        document: 0,
        "react-app": 0,
        "nextjs-bundle": 0,
      },
      byRequestedTarget: {
        auto: 0,
        page: 0,
        "react-app": 0,
        "nextjs-bundle": 0,
      },
    },
  };
}

function createBuilderMetric(): BuilderMetric {
  return {
    prompts: 0,
    artifacts: 0,
    parseFailures: 0,
    mismatches: 0,
    byType: {
      page: 0,
      document: 0,
      "react-app": 0,
      "nextjs-bundle": 0,
    },
    byRequestedTarget: {
      auto: 0,
      page: 0,
      "react-app": 0,
      "nextjs-bundle": 0,
    },
  };
}

function ensureMetricsStore(store: Partial<MetricsStore> | undefined): MetricsStore {
  const base = createStore();
  const builder = store?.builder;

  return {
    startedAt: typeof store?.startedAt === "string" ? store.startedAt : base.startedAt,
    totals: {
      requests: typeof store?.totals?.requests === "number" ? store.totals.requests : base.totals.requests,
      status2xx: typeof store?.totals?.status2xx === "number" ? store.totals.status2xx : base.totals.status2xx,
      status4xx: typeof store?.totals?.status4xx === "number" ? store.totals.status4xx : base.totals.status4xx,
      status5xx: typeof store?.totals?.status5xx === "number" ? store.totals.status5xx : base.totals.status5xx,
    },
    routes: store?.routes ?? base.routes,
    builder: {
      prompts: typeof builder?.prompts === "number" ? builder.prompts : 0,
      artifacts: typeof builder?.artifacts === "number" ? builder.artifacts : 0,
      parseFailures: typeof builder?.parseFailures === "number" ? builder.parseFailures : 0,
      mismatches: typeof builder?.mismatches === "number" ? builder.mismatches : 0,
      byType: {
        ...createBuilderMetric().byType,
        ...(builder?.byType ?? {}),
      },
      byRequestedTarget: {
        ...createBuilderMetric().byRequestedTarget,
        ...(builder?.byRequestedTarget ?? {}),
      },
    },
  };
}

const store = ensureMetricsStore(globalStore.__quillApiMetrics__);
globalStore.__quillApiMetrics__ = store;

function getRouteMetric(route: string): RouteMetric {
  const existing = store.routes[route];
  if (existing) return existing;

  const created: RouteMetric = {
    total: 0,
    statuses: {},
    errors: {},
  };
  store.routes[route] = created;
  return created;
}

export function recordApiMetric(input: {
  route: string;
  status: number;
  error?: string;
}): void {
  store.totals.requests += 1;

  if (input.status >= 500) {
    store.totals.status5xx += 1;
  } else if (input.status >= 400) {
    store.totals.status4xx += 1;
  } else {
    store.totals.status2xx += 1;
  }

  const routeMetric = getRouteMetric(input.route);
  routeMetric.total += 1;

  const statusKey = String(input.status);
  routeMetric.statuses[statusKey] = (routeMetric.statuses[statusKey] ?? 0) + 1;

  if (input.error) {
    routeMetric.errors[input.error] = (routeMetric.errors[input.error] ?? 0) + 1;
  }
}

export function recordBuilderMetric(input: {
  parseSuccess: boolean;
  artifactType?: BuilderArtifactType;
  requestedTarget?: BuilderTarget;
}): void {
  store.builder.prompts += 1;
  const target = input.requestedTarget ?? "auto";
  store.builder.byRequestedTarget[target] += 1;

  if (!input.parseSuccess) {
    store.builder.parseFailures += 1;
    return;
  }

  store.builder.artifacts += 1;
  if (input.artifactType) {
    store.builder.byType[input.artifactType] += 1;
    if (target !== "auto" && input.artifactType !== target) {
      store.builder.mismatches += 1;
    }
  }
}

export function getApiMetricsSnapshot() {
  return {
    startedAt: store.startedAt,
    totals: { ...store.totals },
    routes: JSON.parse(JSON.stringify(store.routes)) as Record<string, RouteMetric>,
    builder: JSON.parse(JSON.stringify(store.builder)) as BuilderMetric,
  };
}
