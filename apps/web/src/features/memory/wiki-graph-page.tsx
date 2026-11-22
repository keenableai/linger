import { useQuery } from "@tanstack/react-query";
import {
  HierarchySquare01Icon,
  Loading03Icon,
  RefreshIcon,
} from "@hugeicons/core-free-icons";
import { Icon } from "@/components/ui/icon";
import { lazy, Suspense, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router";

import { Button } from "@/components/ui/button";
import { requireRoomRouteParam } from "@/features/rooms/room-route-params";
import { TeamHubError } from "@/features/teamhub/teamhub-error";
import { useTeamHubRuntime } from "@/features/teamhub/teamhub-runtime";
import { commonMessages } from "@/i18n/common.messages";
import type { Translate } from "@/i18n/language";
import { useT } from "@/i18n/use-translation";

import {
  filterWikiGraph,
  useWikiDisplayState,
} from "@/features/wiki/wiki-display-state";
import { usePersonalWikiRefresh } from "@/features/wiki/wiki-refresh";
import { WikiRefreshBanner } from "@/features/wiki/wiki-refresh-status";
import { useAnotherMeActorId } from "@/features/wiki/wiki-working-card";
import { nodeMoments, parseEmbeddedWikiGraph } from "./wiki-graph-model";
import { WikiBack } from "@/features/wiki/wiki-home-page";
import { wikiMessages } from "@/features/wiki/wiki.messages";
import { WikiKnowledgeGraph } from "./wiki-knowledge-graph";
import { usePeriodReports } from "./wiki-period-reports";
import { wikiTimelineMessages as m } from "./wiki-timeline.messages";

const DailyPanel = lazy(async () => {
  const { WikiGraphDailyPanel } = await import("./wiki-graph-daily-panel");
  return { default: WikiGraphDailyPanel };
});

const ReportCards = lazy(async () => {
  const { WikiGraphReportCards } = await import("./wiki-graph-report-cards");
  return { default: WikiGraphReportCards };
});

// TeamHub names this state with a code, so it can be worded in the language
// on screen; any other error keeps the words it arrived with.
function graphErrorText(error: Error, t: Translate) {
  if (error instanceof TeamHubError && error.code === "GRAPH_UNAVAILABLE") {
    return t(m.graphUnavailable);
  }
  return error.message || t(m.unavailable);
}

export function WikiGraphPage() {
  const t = useT();
  const { client } = useTeamHubRuntime();
  const tenantId = requireRoomRouteParam(useParams().tenantId, "Tenant");
  const [searchParams] = useSearchParams();
  const initialDay = searchParams.get("day");
  const reports = usePeriodReports(tenantId, "daily");
  const anotherMe = useAnotherMeActorId(tenantId);
  const [selectedReport, setSelectedReport] = useState<
    | {
        kind: "daily" | "weekly";
        day: string;
      }
    | undefined
  >(() =>
    initialDay && /^\d{4}-\d{2}-\d{2}$/.test(initialDay)
      ? { kind: "daily", day: initialDay }
      : undefined,
  );
  const refresh = usePersonalWikiRefresh(tenantId);
  const graph = useQuery({
    enabled: refresh.hasPublishedWiki,
    queryFn: () => client.getPersonalKnowledgeGraphVisualization(tenantId),
    queryKey: ["teamhub", tenantId, "personal-wiki", "graph"],
  });
  const display = useWikiDisplayState(tenantId);
  const parsedGraph = useMemo(
    () => (graph.data ? parseEmbeddedWikiGraph(graph.data) : undefined),
    [graph.data],
  );
  const filteredGraph = useMemo(
    () =>
      parsedGraph ? filterWikiGraph(parsedGraph, display.decisions) : undefined,
    [parsedGraph, display.decisions],
  );
  const timelineMoments = useMemo(
    () => (filteredGraph ? nodeMoments(filteredGraph) : undefined),
    [filteredGraph],
  );
  const graphBusy = refresh.refreshing || graph.isFetching;
  const statusFailed = Boolean(refresh.statusError && !graph.data);
  const timelineError =
    (statusFailed ? refresh.statusError : null) ?? graph.error;

  return (
    <main className="wiki-graph-page flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-app-surface">
      <header className="wiki-graph-page-header px-4 pt-4 pb-6">
        <WikiBack />
        <h1 className="mb-2 text-2xl text-foreground">{t(m.dailyReport)}</h1>
        <p className="text-sm text-muted-foreground">
          {reports.isPending
            ? t(wikiMessages.loadingReports)
            : t(m.reportCount, { count: reports.data?.length ?? 0 })}
        </p>
      </header>

      <div className="px-3 md:px-4">
        <WikiRefreshBanner {...refresh} agentActorId={anotherMe} />
      </div>

      <section className="min-h-0 flex-1 overflow-hidden p-3 md:p-4">
        {refresh.statusPending ||
        (refresh.hasPublishedWiki && graph.isPending) ||
        (refresh.initializing && !graph.data) ||
        (graphBusy && !graph.data && !timelineError) ? (
          <div
            aria-busy="true"
            className="flex h-full min-h-[480px] items-center justify-center gap-2 text-sm text-app-muted"
          >
            <Icon icon={Loading03Icon} className="animate-spin" size={16} />
            <span
              className={refresh.initializing ? "town-shimmer-text" : undefined}
            >
              {refresh.initializing
                ? t(m.generating)
                : t(wikiMessages.loadingTimeline)}
            </span>
          </div>
        ) : timelineError ? (
          <div
            aria-label={graphErrorText(timelineError, t)}
            className="flex h-full min-h-[480px] flex-col items-center justify-center text-center"
            role="alert"
          >
            <Icon
              icon={HierarchySquare01Icon}
              className="mb-3 text-app-muted"
              size={24}
            />
            <p className="text-sm text-app-danger">
              {graphErrorText(timelineError, t)}
            </p>
            <Button
              className="mt-3"
              disabled={
                statusFailed ? refresh.statusFetching : graph.isFetching
              }
              onClick={() => {
                if (statusFailed) {
                  void refresh.refetchStatus();
                  return;
                }
                void graph.refetch();
              }}
              size="compact"
              tone="secondary"
            >
              <Icon icon={RefreshIcon} size={14} />{" "}
              {t(statusFailed ? commonMessages.retry : m.retryGraph)}
            </Button>
          </div>
        ) : !refresh.hasPublishedWiki && !graph.data ? (
          <div className="flex h-full min-h-[480px] flex-col items-center justify-center text-center">
            <Icon
              icon={HierarchySquare01Icon}
              className="mb-3 text-app-muted"
              size={24}
            />
            <p className="text-sm text-app-muted">{t(m.emptyTimeline)}</p>
          </div>
        ) : filteredGraph ? (
          <WikiKnowledgeGraph
            graph={filteredGraph}
            timelineMoments={timelineMoments}
            key={`${tenantId}:${graph.dataUpdatedAt}`}
            onReadingModeChange={() => setSelectedReport(undefined)}
            renderTimeline={(pages, granularity, navigation) => (
              <Suspense
                fallback={
                  <p role="status" className="p-6 text-sm text-app-muted">
                    {t(wikiMessages.loadingTimeline)}
                  </p>
                }
              >
                <ReportCards
                  tenantId={tenantId}
                  pages={pages}
                  moments={timelineMoments!}
                  granularity={granularity}
                  focus={navigation.focus}
                  onPeriodChange={navigation.onPeriodChange}
                  onSelectReport={(kind, day) =>
                    setSelectedReport({ kind, day })
                  }
                />
              </Suspense>
            )}
            dailyPanel={
              selectedReport ? (
                <Suspense
                  fallback={
                    <div role="status" className="wiki-graph-daily-panel p-4">
                      {t(
                        selectedReport.kind === "daily"
                          ? m.loadingDaily
                          : m.loadingWeekly,
                      )}
                    </div>
                  }
                >
                  <DailyPanel
                    key={tenantId}
                    day={selectedReport.day}
                    kind={selectedReport.kind}
                    tenantId={tenantId}
                    onClose={() => setSelectedReport(undefined)}
                  />
                </Suspense>
              ) : null
            }
          />
        ) : Object.values(display.decisions).includes("delete") ? (
          <p role="alert" className="p-4 text-sm text-app-muted">
            {t(m.hiddenPreferences)}
          </p>
        ) : (
          <iframe
            className="block h-full min-h-[480px] w-full border border-app-border bg-app-surface"
            key={tenantId}
            sandbox="allow-scripts"
            srcDoc={graph.data}
            title={t(m.graphFrame)}
          />
        )}
      </section>
    </main>
  );
}
