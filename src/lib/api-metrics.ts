type RouteMetric = {
  total: number;
  statuses: Record<string, number>;
  errors: Record<string, number>;
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
  };
}

const store = globalStore.__quillApiMetrics__ ?? createStore();
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

export function getApiMetricsSnapshot() {
  return {
    startedAt: store.startedAt,
    totals: { ...store.totals },
    routes: JSON.parse(JSON.stringify(store.routes)) as Record<string, RouteMetric>,
  };
}
