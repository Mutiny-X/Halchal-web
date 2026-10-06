import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  Bookmark,
  CalendarDays,
  ExternalLink,
  Info,
  Instagram,
  LayoutGrid,
  RefreshCw,
  Share2,
  Sparkles,
  TrendingUp,
  Trophy,
  Users,
  Activity,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toaster";
import {
  compactNumber,
  contactButtonLabel,
  countryName,
  followTypeLabel,
  formatLabel,
  genderLabel,
  kindLabel,
  percent,
  sortAges,
  summarySentence,
  timeAgo,
  topPostsByKind,
  unavailableTitle,
  watchTime,
  withShares,
} from "@/features/admin/lib/instagram-insights-format";
import {
  ApiError,
  adminApi,
  type AdminCreatorInstagramConnection,
  type InsightDemographics,
  type InstagramAccountInsights,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";

const PALETTE = ["#f59e0b", "#10b981", "#ec4899", "#3b82f6", "#8b5cf6", "#14b8a6", "#ef4444"];

type View = "overview" | "audience" | "content";

/** Admin view of everything Instagram's Insights API reports for a
 * creator's connected account(s). */
export function InstagramInsightsPanel({
  creatorId,
  connections,
}: {
  creatorId: string;
  connections: AdminCreatorInstagramConnection[];
}) {
  const [connectionId, setConnectionId] = useState(connections[0]?.id ?? "");
  if (connections.length === 0) {
    return (
      <EmptyCard
        title="No Instagram account connected"
        body="Insights come straight from Meta once the creator connects their Instagram (professional) account in the app."
      />
    );
  }
  return (
    <div className="space-y-3">
      {connections.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {connections.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setConnectionId(c.id)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold",
                c.id === connectionId ? "border-primary bg-primary/10 text-primary" : "border-border text-muted hover:text-foreground",
              )}
            >
              @{c.platformHandle}
            </button>
          ))}
        </div>
      )}
      <InsightsForConnection key={connectionId} creatorId={creatorId} connectionId={connectionId} />
    </div>
  );
}

function InsightsForConnection({ creatorId, connectionId }: { creatorId: string; connectionId: string }) {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>("overview");
  const queryKey = ["admin-creator-ig-insights", creatorId, connectionId];

  const query = useQuery({
    queryKey,
    queryFn: () => adminApi.creatorInstagramInsights(getToken()!, creatorId, connectionId),
    enabled: Boolean(getToken()),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const sync = useMutation({
    mutationFn: () => adminApi.creatorInstagramInsights(getToken()!, creatorId, connectionId, true),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, data);
      toast(data.cached ? "Already up to date (synced in the last few minutes)." : "Synced with Instagram.", "success");
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Couldn't sync with Instagram.", "error"),
  });

  if (query.isPending) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-6 text-sm text-muted">
        <RefreshCw className="h-4 w-4 animate-spin" />
        Fetching insights from Instagram… this can take a few seconds the first time.
      </div>
    );
  }
  if (query.isError || !query.data) {
    return (
      <EmptyCard
        title="Couldn't load Instagram insights"
        body={query.error instanceof ApiError ? query.error.message : "Please try again."}
        action={
          <Button size="sm" variant="outline" onClick={() => void query.refetch()}>
            Try again
          </Button>
        }
      />
    );
  }

  const { report, connected } = query.data;
  const unavailable = report.unavailable;
  const needsReconnect = unavailable.some((u) => u.reason === "permission");

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-amber-400 via-pink-500 to-purple-600 text-white">
            <Instagram className="h-5 w-5" />
          </span>
          <div>
            <p className="flex items-center gap-1.5 text-lg font-bold text-foreground">
              Instagram insights <BadgeCheck className="h-4 w-4 text-money" />
            </p>
            <p className="text-xs text-muted">
              Official data from Meta · @{report.profile.username} · synced {timeAgo(report.syncedAt)}
              {!connected && " · creator has since disconnected"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-variant px-3 py-1 text-xs text-muted">
            <CalendarDays className="h-3.5 w-3.5" />
            <span className="font-semibold text-foreground">Last {report.period.days} days</span>
            {shortDate(report.period.since)} – {shortDate(report.period.until)}
          </span>
          {unavailable.length > 0 && (
            <span
              className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-600"
              title={unavailable.map((u) => `${unavailableTitle(u.section)}: ${u.message}`).join("\n")}
            >
              Some insights unavailable
            </span>
          )}
          {connected && (
            <Button size="sm" variant="outline" disabled={sync.isPending} onClick={() => sync.mutate()}>
              <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", sync.isPending && "animate-spin")} />
              {sync.isPending ? "Syncing…" : "Sync now"}
            </Button>
          )}
        </div>
      </div>

      {needsReconnect && (
        <Notice tone="warning">
          This creator's Instagram connection was made without insights access, so Meta won't share reach, views or
          audience data. Ask them to reconnect Instagram in the app; everything here fills in on the next sync.
        </Notice>
      )}

      {/* Profile strip */}
      <div className="mt-5 grid grid-cols-3 gap-3 sm:max-w-md">
        <MiniStat label="Followers" value={compactNumber(report.profile.followerCount)} />
        <MiniStat label="Following" value={compactNumber(report.profile.followsCount)} />
        <MiniStat label="Posts" value={compactNumber(report.profile.mediaCount)} />
      </div>

      {/* View switch */}
      <div className="mt-5 inline-flex max-w-full overflow-x-auto rounded-xl border border-border bg-surface-variant p-1">
        {(
          [
            ["overview", "Overview", LayoutGrid],
            ["audience", "Audience", Users],
            ["content", "Content", Sparkles],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition sm:px-4",
              view === id ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {view === "overview" && <OverviewView report={report} />}
        {view === "audience" && <AudienceView report={report} />}
        {view === "content" && <ContentView report={report} />}
      </div>

      {unavailable.length > 0 && (
        <details className="mt-6 rounded-xl bg-surface-variant px-4 py-3 text-xs text-muted">
          <summary className="cursor-pointer font-semibold text-foreground">
            What Instagram didn't share ({unavailable.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {unavailable.map((u) => (
              <li key={u.section}>
                <span className="font-medium text-foreground">{unavailableTitle(u.section)}:</span> {u.message}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/* ── Overview ── */

function OverviewView({ report }: { report: InstagramAccountInsights }) {
  const t = report.overview.totals;
  const summary = summarySentence(report);
  const growth = report.overview.followerGrowth;
  const interactions = [
    { label: "Likes", value: t.likes },
    { label: "Replies", value: t.replies },
    { label: "Comments", value: t.comments },
    { label: "Shares", value: t.shares },
    { label: "Saves", value: t.saves },
  ].filter((r): r is { label: string; value: number } => r.value != null);
  const maxInteraction = Math.max(1, ...interactions.map((r) => r.value));

  return (
    <div className="space-y-5">
      {summary && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-foreground">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          {summary}
        </div>
      )}

      <SectionTitle>{report.period.days}-day highlights</SectionTitle>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Highlight
          icon={<TrendingUp className="h-4 w-4" />}
          label="Follower growth"
          value={growth ? `${growth.net >= 0 ? "+" : ""}${growth.net.toLocaleString("en-IN")}` : "—"}
          hint={growth ? "Net new followers" : "Meta shares this for accounts with 100+ followers"}
        />
        <Highlight
          icon={<Activity className="h-4 w-4" />}
          label="Engagement by reach"
          value={pct(percent(t.totalInteractions, t.reach))}
          hint="Interactions per account reached"
        />
        <Highlight icon={<Bookmark className="h-4 w-4" />} label="Save rate" value={pct(percent(t.saves, t.reach))} hint="Saves per account reached" />
        <Highlight icon={<Share2 className="h-4 w-4" />} label="Share rate" value={pct(percent(t.shares, t.reach))} hint="Shares per account reached" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="From seen to engaged">
          <Funnel
            rows={[
              { label: "Views", hint: "Times content was shown, repeats included", value: t.views },
              { label: "Reach", hint: "Different accounts that saw it", value: t.reach },
              { label: "Accounts engaged", hint: "Different accounts that interacted", value: t.accountsEngaged },
            ]}
            notes={[
              t.views != null && t.reach ? `Each account saw it about ${(t.views / t.reach).toFixed(1)} times` : null,
              percent(t.accountsEngaged, t.reach) != null ? `${percent(t.accountsEngaged, t.reach)}% of reached accounts interacted` : null,
            ]}
          />
        </Panel>
        <Panel title="What people did">
          {t.totalInteractions != null && (
            <p className="mb-3">
              <span className="text-3xl font-black text-foreground">{t.totalInteractions.toLocaleString("en-IN")}</span>{" "}
              <span className="text-sm text-muted">total interactions</span>
            </p>
          )}
          {interactions.length === 0 ? (
            <Muted>Not shared by Instagram.</Muted>
          ) : (
            <div className="space-y-2">
              {interactions.map((r) => (
                <BarRow key={r.label} label={r.label} value={r.value.toLocaleString("en-IN")} fraction={r.value / maxInteraction} />
              ))}
            </div>
          )}
        </Panel>
      </div>

      <SectionTitle>Breakdowns</SectionTitle>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Views by format">
          <Donut rows={withShares(report.overview.viewsByFormat, formatLabel)} />
        </Panel>
        <Panel title="Reach by format">
          <Donut rows={withShares(report.overview.reachByFormat, formatLabel)} />
        </Panel>
        <Panel title="Who they reached">
          <SplitBar rows={withShares(report.overview.reachByFollowType, followTypeLabel)} />
        </Panel>
        <Panel title="Follow movement">
          {t.follows == null ? (
            <Muted>Not shared by Instagram.</Muted>
          ) : (
            <SplitBar
              rows={withShares([
                { key: "follows", value: t.follows },
                { key: "unfollows", value: t.unfollows ?? 0 },
              ], (k) => (k === "follows" ? "New follows" : "Unfollows"))}
            />
          )}
        </Panel>
        {(t.profileLinksTaps != null || report.overview.profileLinkTaps?.length) && (
          <Panel title="Profile link taps">
            <p className="mb-2 text-2xl font-black">{(t.profileLinksTaps ?? 0).toLocaleString("en-IN")}</p>
            <div className="space-y-2">
              {withShares(report.overview.profileLinkTaps, contactButtonLabel).map((r) => (
                <BarRow key={r.key} label={r.label} value={r.value.toLocaleString("en-IN")} fraction={r.share / 100} />
              ))}
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}

/* ── Audience ── */

function AudienceView({ report }: { report: InstagramAccountInsights }) {
  const [who, setWho] = useState<"followers" | "engaged">("followers");
  const demo: InsightDemographics = report.audience[who];
  const withheld = (["age", "gender", "country", "city"] as const).some((d) => !demo[d]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionTitle>Audience composition</SectionTitle>
        {withheld && (
          <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-600">
            Some breakdowns withheld
          </span>
        )}
      </div>
      <Notice>
        Meta hides some breakdowns until an account is large enough to keep individuals anonymous. "Engaged audience"
        is the people who interacted with the creator's content this month.
      </Notice>
      <div className="inline-flex rounded-xl border border-border bg-surface-variant p-1">
        {(["followers", "engaged"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setWho(k)}
            className={cn(
              "rounded-lg px-4 py-1.5 text-sm font-medium",
              who === k ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground",
            )}
          >
            {k === "followers" ? "Followers" : "Engaged audience"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Age">
          <AgeBars rows={withShares(sortAges(demo.age))} />
        </Panel>
        <Panel title="Gender">
          <Donut rows={withShares(demo.gender, genderLabel)} />
        </Panel>
        <Panel title="Top countries">
          <RankBars rows={withShares(demo.country, countryName).slice(0, 8)} />
        </Panel>
        <Panel title="Top cities">
          <RankBars rows={withShares(demo.city).slice(0, 8)} />
        </Panel>
      </div>
    </div>
  );
}

/* ── Content ── */

function ContentView({ report }: { report: InstagramAccountInsights }) {
  const groups = useMemo(() => topPostsByKind(report.content.posts), [report.content.posts]);
  const mix = withShares(
    report.content.mix.map((m) => ({ key: m.kind, value: m.count })),
    (k) => kindLabel(k as Parameters<typeof kindLabel>[0]),
  );
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">
        The creator's strongest recent posts (from their latest {report.content.posts.length}), ranked by interactions, or
        by reach and views where Meta withholds interactions.
      </p>
      {groups.length === 0 ? (
        <Muted>No posts to show.</Muted>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <div key={g.kind}>
              <div className="mb-3 flex items-center justify-between">
                <p className="font-semibold text-foreground">Top {kindLabel(g.kind).toLowerCase()}</p>
                <span className="rounded-full border border-border px-2.5 py-0.5 text-[11px] text-muted">Top {g.posts.length}</span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {g.posts.map((p, i) => (
                  <PostCard key={p.id} post={p} rank={i + 1} kindName={kindLabel(g.kind).replace(/s$/, "")} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <Panel title="What they post">
        <Donut rows={mix} valueSuffix={(r) => `${r.value}`} />
        <p className="mt-3 text-xs text-muted">From their latest {report.content.analysedPosts} posts and stories.</p>
      </Panel>
    </div>
  );
}

function PostCard({
  post,
  rank,
  kindName,
}: {
  post: InstagramAccountInsights["content"]["posts"][number];
  rank: number;
  kindName: string;
}) {
  const m = post.metrics;
  const cells: Array<[string, number | undefined]> = [
    ["Views", m.views],
    ["Reach", m.reach],
    ["Likes", m.likes],
    ["Comments", m.comments],
    ["Shares", m.shares],
    ["Saves", m.saves],
  ];
  const watch = watchTime(m.avgWatchTimeMs);
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface-variant">
      <div className="relative aspect-[4/3] bg-surface">
        {post.thumbnailUrl ? (
          <img src={post.thumbnailUrl} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted">No preview</div>
        )}
        <span
          className={cn(
            "absolute left-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold",
            rank === 1 ? "bg-amber-400 text-black" : "bg-black/60 text-white",
          )}
        >
          {rank === 1 && <Trophy className="h-3 w-3" />}#{rank} {kindName}
        </span>
        {post.permalink && (
          <a
            href={post.permalink}
            target="_blank"
            rel="noreferrer"
            className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-black hover:bg-white"
            aria-label="Open on Instagram"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
        {post.engagementByReach != null && (
          <span className="absolute bottom-2 left-2 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-semibold text-white">
            {post.engagementByReach}% eng.
          </span>
        )}
      </div>
      <div className="space-y-2 p-3">
        <p className="text-[11px] text-muted">
          {post.timestamp ? `Posted ${shortDate(post.timestamp, true)}` : "Date unknown"}
          {post.childCount ? ` · ${post.childCount} items` : ""}
          {watch ? ` · ${watch} avg watch` : ""}
        </p>
        {post.caption && <p className="line-clamp-2 text-xs text-foreground">{post.caption}</p>}
        <div className="grid grid-cols-3 gap-x-1 gap-y-2 rounded-xl bg-surface p-2 text-center">
          {cells.map(([label, v]) => (
            <div key={label}>
              <p className="truncate text-[10px] text-muted">{label}</p>
              <p className="text-sm font-bold text-foreground">{v == null ? "—" : compactNumber(v)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Building blocks ── */

type ShareRow = { key: string; label: string; value: number; share: number };

function Donut({ rows, valueSuffix }: { rows: ShareRow[]; valueSuffix?: (r: ShareRow) => string }) {
  if (rows.length === 0) return <Muted>Not shared by Instagram.</Muted>;
  const r = 40;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <div className="relative h-36 w-36 shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth="14" className="text-border" />
          {rows.map((row, i) => {
            const len = (row.share / 100) * c;
            const el = (
              <circle
                key={row.key}
                cx="50"
                cy="50"
                r={r}
                fill="none"
                stroke={PALETTE[i % PALETTE.length]}
                strokeWidth="14"
                strokeDasharray={`${Math.max(0, len - 0.8)} ${c}`}
                strokeDashoffset={-offset}
              >
                <title>{`${row.label}: ${row.value.toLocaleString("en-IN")} (${row.share}%)`}</title>
              </circle>
            );
            offset += len;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-black text-foreground">{Math.round(rows[0].share)}%</span>
          <span className="text-[10px] text-muted">largest share</span>
        </div>
      </div>
      <ul className="w-full space-y-2 text-sm">
        {rows.map((row, i) => (
          <li key={row.key} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
            <span className="flex-1 truncate text-foreground">{row.label}</span>
            {valueSuffix && <span className="text-xs text-muted">{valueSuffix(row)}</span>}
            <span className="w-14 text-right font-semibold tabular-nums">{row.share}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AgeBars({ rows }: { rows: ShareRow[] }) {
  if (rows.length === 0) return <Muted>Not shared by Instagram.</Muted>;
  const max = Math.max(...rows.map((r) => r.share), 1);
  return (
    <div className="flex h-44 items-end gap-2 border-b border-border pb-1">
      {rows.map((r) => (
        <div key={r.key} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${r.value.toLocaleString("en-IN")} people`}>
          <span className={cn("text-[11px] tabular-nums", r.share === max ? "font-bold text-foreground" : "text-muted")}>{r.share}%</span>
          <div
            className={cn("w-full max-w-10 rounded-t-md", r.share === max ? "bg-primary" : "bg-primary/35")}
            style={{ height: `${Math.max(3, (r.share / max) * 110)}px` }}
          />
          <span className="text-[11px] text-muted">{r.label}</span>
        </div>
      ))}
    </div>
  );
}

function RankBars({ rows }: { rows: ShareRow[] }) {
  if (rows.length === 0) return <Muted>Not shared by Instagram.</Muted>;
  const max = rows[0].share || 1;
  return (
    <div className="space-y-2.5">
      {rows.map((r, i) => (
        <div key={r.key} className="grid grid-cols-[minmax(0,10rem)_1fr_3.5rem] items-center gap-3 text-sm">
          <span className={cn("truncate", i === 0 ? "font-semibold text-foreground" : "text-muted")} title={r.label}>
            {r.label}
          </span>
          <div className="h-3 rounded-full bg-border/50">
            <div className={cn("h-3 rounded-full", i === 0 ? "bg-primary" : "bg-primary/40")} style={{ width: `${(r.share / max) * 100}%` }} />
          </div>
          <span className="text-right font-semibold tabular-nums">{r.share}%</span>
        </div>
      ))}
    </div>
  );
}

function BarRow({ label, value, fraction }: { label: string; value: string; fraction: number }) {
  return (
    <div className="grid grid-cols-[6rem_1fr_3.5rem] items-center gap-3 text-sm">
      <span className="text-muted">{label}</span>
      <div className="h-3 rounded-full bg-border/50">
        <div className="h-3 rounded-full bg-primary" style={{ width: `${Math.max(1.5, fraction * 100)}%` }} />
      </div>
      <span className="text-right font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function SplitBar({ rows }: { rows: ShareRow[] }) {
  if (rows.length === 0 || rows.every((r) => r.value === 0)) return <Muted>Not shared by Instagram.</Muted>;
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full">
        {rows.map((r, i) => (
          <div key={r.key} style={{ width: `${r.share}%`, background: PALETTE[(i + 3) % PALETTE.length] }} />
        ))}
      </div>
      <ul className="mt-3 space-y-1.5 text-sm">
        {rows.map((r, i) => (
          <li key={r.key} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: PALETTE[(i + 3) % PALETTE.length] }} />
            <span className="flex-1 text-foreground">{r.label}</span>
            <span className="font-semibold tabular-nums">{r.value.toLocaleString("en-IN")}</span>
            <span className="w-14 text-right text-muted tabular-nums">{r.share}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Funnel({
  rows,
  notes,
}: {
  rows: Array<{ label: string; hint: string; value: number | null }>;
  notes: Array<string | null>;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value ?? 0));
  return (
    <div className="space-y-1">
      {rows.map((r, i) => (
        <div key={r.label}>
          <div className="grid grid-cols-[1fr_4rem] items-center gap-x-3 gap-y-1.5 py-1.5 sm:grid-cols-[minmax(0,11rem)_1fr_4rem]">
            <div className="col-span-2 sm:col-span-1">
              <p className="text-sm font-medium text-foreground">{r.label}</p>
              <p className="text-[11px] text-muted">{r.hint}</p>
            </div>
            <div className="h-6 rounded-lg bg-border/40 sm:h-7">
              <div
                className={cn("h-6 rounded-lg sm:h-7", i === 0 ? "bg-primary/45" : i === 1 ? "bg-primary/65" : "bg-primary")}
                style={{ width: `${r.value == null ? 0 : Math.max(2, (r.value / max) * 100)}%` }}
              />
            </div>
            <span className="text-right text-lg font-black tabular-nums">{compactNumber(r.value)}</span>
          </div>
          {notes[i] && <p className="ml-1 border-l border-border pl-3 text-xs text-muted">{notes[i]}</p>}
        </div>
      ))}
    </div>
  );
}

function Highlight({ icon, label, value, hint }: { icon: ReactNode; label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl bg-surface-variant p-4">
      <p className="flex items-center gap-1.5 text-xs text-muted">
        {icon}
        {label}
      </p>
      <p className="mt-2 text-2xl font-black text-foreground">{value}</p>
      <p className="mt-1 text-[11px] text-muted">{hint}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-variant px-3 py-2 text-center">
      <p className="text-lg font-black text-foreground">{value}</p>
      <p className="text-[10px] text-muted">{label}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface-variant/60 p-5">
      <p className="mb-4 font-semibold text-foreground">{title}</p>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <p className="text-base font-bold text-foreground">{children}</p>;
}

function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warning" }) {
  return (
    <div
      className={cn(
        "mt-4 flex items-start gap-2 rounded-xl px-4 py-2.5 text-xs",
        tone === "warning" ? "border border-amber-500/40 bg-amber-500/10 text-foreground" : "bg-surface-variant text-muted",
      )}
    >
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted">{children}</p>;
}

function EmptyCard({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-2xl border border-border bg-surface p-6">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-variant text-muted">
        <Instagram className="h-5 w-5" />
      </span>
      <div>
        <p className="font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-sm text-muted">{body}</p>
      </div>
      {action}
    </div>
  );
}

function pct(v: number | null): string {
  return v == null ? "—" : `${v.toFixed(2)}%`;
}

function shortDate(iso: string, withYear = false): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}) });
}
