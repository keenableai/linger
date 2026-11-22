import { lazy, Suspense, useMemo, useState } from "react";
import { Search01Icon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/ui/icon";
import type { TeamHubDocument } from "@/features/teamhub/teamhub-types";
import { Navigate, useParams } from "react-router";
import { requireRoomRouteParam } from "@/features/rooms/room-route-params";
import { useT } from "@/i18n/use-translation";
import {
  isWikiCollection,
  wikiCollections,
  type WikiCollection,
} from "./wiki-display-state";
import {
  editedLabel,
  entryName,
  useWikiCollectionPages,
  useWikiGraphNodes,
  WikiBack,
  WikiEntryLink,
  WikiHomePage,
} from "./wiki-home-page";
import { type WikiEntry, wikiPreviewPages } from "./wiki-preview-pages";
import { usePersonalWikiRefresh } from "./wiki-refresh";
import { wikiMessages as m } from "./wiki.messages";

const GraphPage = lazy(async () => {
  const { WikiGraphPage } = await import("@/features/memory/wiki-graph-page");
  return { default: WikiGraphPage };
});

export function WikiCollectionPage() {
  const { collection, tenantId = "" } = useParams();
  const t = useT();
  if (!collection) return <WikiHomePage />;
  // Profile is the Wiki home's default tab.
  if (collection === "profile")
    return (
      <Navigate
        replace
        to={`/t/${encodeURIComponent(tenantId)}/library/wiki`}
      />
    );
  if (collection === "graph")
    return (
      <Suspense
        fallback={
          <p role="status" className="p-4 text-sm text-app-muted">
            {t(m.loadingTimeline)}
          </p>
        }
      >
        <GraphPage />
      </Suspense>
    );
  return (
    <main className="workspace-scrollbar wiki-landing flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-app-surface">
      {isWikiCollection(collection) ? (
        <WikiCollectionContent collection={collection} />
      ) : (
        <p role="alert" className="p-4">
          {t(m.collectionUnavailable)}
        </p>
      )}
    </main>
  );
}

function WikiCollectionContent({ collection }: { collection: WikiCollection }) {
  const tenantId = requireRoomRouteParam(useParams().tenantId, "Tenant");
  const collections = useWikiCollectionPages(tenantId);
  const { hasPublishedWiki, preview } = usePersonalWikiRefresh(tenantId);
  const nodes = useWikiGraphNodes(tenantId, hasPublishedWiki);
  const previews = useMemo(() => wikiPreviewPages(preview), [preview]);
  const [query, setQuery] = useState("");
  const t = useT();
  const all = collections.entries(collection, previews);
  const words = wikiCollections[collection];
  const description = (entry: WikiEntry) =>
    (entry.preview
      ? entry.preview.description
      : nodes.get(entry.key)?.description) ?? "";
  const needle = query.trim().toLowerCase();
  const pages = needle
    ? all.filter((entry) =>
        `${entryName(entry)} ${description(entry)}`
          .toLowerCase()
          .includes(needle),
      )
    : all;
  const documentPath = (page: TeamHubDocument) =>
    `/t/${encodeURIComponent(tenantId)}/documents/${encodeURIComponent(page.id)}`;
  return (
    <div className="workspace-content mx-auto w-full px-4 py-6 md:px-8">
      <WikiBack />
      <h1 className="mb-2 text-2xl text-foreground">{t(words.label)}</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {t(words.count, { count: all.length })}
      </p>
      {/* Same search field as the Connectors catalog. */}
      <label className="relative mb-6 block">
        <Icon
          icon={Search01Icon}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
          size={14}
        />
        <input
          aria-label={t(words.search)}
          className="h-9 w-full rounded-lg border border-border bg-card pr-3 pl-9 text-sm text-foreground transition-colors duration-150 placeholder:text-app-placeholder hover:border-border-hover focus-visible:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t(words.search)}
          type="search"
          value={query}
        />
      </label>
      {collections.pending ? (
        <p role="status" className="text-sm text-muted-foreground">
          {t(m.loadingDocuments)}
        </p>
      ) : collections.error ? (
        <p role="alert" className="text-sm text-muted-foreground">
          {t(m.documentsUnavailable)}
        </p>
      ) : pages.length ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {pages.map((entry) => (
            <WikiEntryLink
              className="wiki-entity-card"
              documentPath={documentPath}
              entry={entry}
              key={entry.key}
              tenantId={tenantId}
            >
              <span className="block text-sm font-medium text-foreground">
                {entryName(entry)}
              </span>
              <span className="mt-1 block text-sm text-muted-foreground">
                {description(entry) ||
                  (entry.published ? editedLabel(entry.published, t) : "")}
              </span>
            </WikiEntryLink>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {needle
            ? t(words.noMatch, { query: query.trim() })
            : t(words.noneGenerated)}
        </p>
      )}
    </div>
  );
}
