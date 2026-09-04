import { createFileRoute } from "@tanstack/react-router";

import { UsagePage, type UsageMetric } from "../components/usage/UsagePage";

export interface UsageSearch {
  readonly metric?: "limits";
}

export const Route = createFileRoute("/usage")({
  validateSearch: (raw: Record<string, unknown>): UsageSearch =>
    raw.metric === "limits" ? { metric: "limits" } : {},
  component: UsageRoute,
});

function UsageRoute() {
  const { metric } = Route.useSearch();
  const navigate = Route.useNavigate();
  const onMetricChange = (nextMetric: UsageMetric) => {
    void navigate({
      search: nextMetric === "limits" ? { metric: "limits" } : {},
      replace: true,
    });
  };
  return metric === "limits" ? (
    <UsagePage key="limits" initialMetric="limits" onMetricChange={onMetricChange} />
  ) : (
    <UsagePage key="default" onMetricChange={onMetricChange} />
  );
}
