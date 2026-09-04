import { createFileRoute } from "@tanstack/react-router";

import { UsagePage } from "../components/usage/UsagePage";

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
  return metric === "limits" ? (
    <UsagePage key="limits" initialMetric="limits" />
  ) : (
    <UsagePage key="default" />
  );
}
