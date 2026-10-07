import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useParams } from "react-router-dom";

import {
  ClipperProfileGrid,
  ClipperProfileModal,
  Leaderboard,
  MediaPreview,
  StageTag,
  StatusBoard,
  SubmissionGrid,
  useEscape,
  type ReviewSection,
} from "@/features/campaigns/components/campaign-board-widgets";
import {
  approvedEarningsPaise,
  buildClipperProfiles,
  buildCreatorPerformance,
  formatCount,
  formatDate,
} from "@/features/campaigns/lib/campaign-board-data";
import { campaignStatusLabel } from "@/features/campaigns/lib/campaign-status";
import {
  countBy,
  deliverableStage,
  isProofStatus,
  proofOutcome,
  STAGE_ORDER,
  TAG_META,
  workOutcome,
} from "@/features/campaigns/lib/clipper-stage";
import { formatPlatformLabel } from "@/features/campaigns/lib/platform-labels";
import { parseRulePoints } from "@/features/campaigns/lib/rule-points";
import { formatInr } from "@/lib/format";
import { resolveMediaUrl } from "@/lib/media-url";
import { publicApi, type PublicDeliverableListItem } from "@/lib/api";

type Tab = "overview" | "clippers" | "board" | "submissions" | "proof" | "analytics";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview",    label: "Overview" },
  { id: "clippers",    label: "Working Clippers" },
  { id: "board",       label: "Status Board" },
  { id: "submissions", label: "Work Submissions" },
  { id: "proof",       label: "Proof of Work" },
  { id: "analytics",   label: "Analytics" },
];

const STATUS_STYLE: Record<string, string> = {
  live:   "bg-emerald-500 text-white",
  draft:  "bg-zinc-600 text-white",
  paused: "bg-orange-500 text-white",
  closed: "bg-red-600 text-white",
};

function ReadOnlySubmissionModal({
  deliverable,
  section,
  onClose,
}: {
  deliverable: PublicDeliverableListItem;
  section: ReviewSection;
  onClose: () => void;
}) {
  useEscape(onClose);
  const url = section === "submissions" ? deliverable.draftDriveUrl : deliverable.livePostUrl;
  const tag = section === "submissions" ? workOutcome(deliverable) : proofOutcome(deliverable);
  // The reason belongs to whichever step was rejected last.
  const rejectionHere =
    (section === "submissions" && deliverable.status === "draft_rejected") ||
    (section === "proof" && deliverable.status === "proof_rejected")
      ? deliverable.rejectionReason
      : null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <h2 className="truncate text-lg font-bold">
              {deliverable.creatorName} · {section === "submissions" ? "Work" : "Proof of work"}
            </h2>
            {tag && <StageTag tag={tag} />}
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-surface-variant hover:text-foreground">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>{formatPlatformLabel(deliverable.platform)}</span>
            {section === "submissions" && (
              <span>{deliverable.draftSubmittedAt ? `Submitted ${formatDate(deliverable.draftSubmittedAt)}` : "Not submitted yet"}</span>
            )}
          </div>

          {url ? (
            <MediaPreview label={section === "submissions" ? "Submitted work" : "Live post"} url={url} />
          ) : (
            <div className="flex items-center justify-center rounded-xl border border-dashed border-border py-10 text-sm text-muted">
              Nothing submitted yet
            </div>
          )}

          {rejectionHere && (
            <div className="rounded-xl bg-surface-variant/50 p-4">
              <p className="text-sm font-semibold">Why it was rejected</p>
              <p className="mt-1.5 text-sm text-muted">{rejectionHere}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function PublicCampaignPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>("overview");
  const [selectedClipperId, setSelectedClipperId] = useState<string | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<{ item: PublicDeliverableListItem; section: ReviewSection } | null>(null);

  const { data: campaign, isPending, isError } = useQuery({
    queryKey: ["public-campaign", id],
    queryFn: () => publicApi.campaign(id!),
    enabled: Boolean(id),
    retry: false,
  });
  const { data: deliverables = [] } = useQuery({
    queryKey: ["public-campaign-deliverables", id],
    queryFn: () => publicApi.deliverables(id!),
    enabled: Boolean(id) && Boolean(campaign),
  });

  if (isPending) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="h-64 animate-pulse rounded-2xl bg-surface-variant" />
      </div>
    );
  }

  if (isError || !campaign) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-lg font-semibold">This campaign link isn't available.</p>
        <p className="mt-2 text-sm text-muted">It may have been unpublished or the link is incorrect.</p>
      </div>
    );
  }

  const statusStyle = STATUS_STYLE[campaign.status] ?? STATUS_STYLE.closed;
  const doPoints = parseRulePoints(campaign.doRules ?? "");
  const avoidPoints = parseRulePoints(campaign.avoidRules ?? "");

  const clippers = buildClipperProfiles(deliverables);
  const selectedClipper = clippers.find((c) => c.participationId === selectedClipperId) ?? null;
  const stageCounts = countBy(deliverables, (d) => deliverableStage(d));
  const totalClippers = clippers.length;
  const openSubmission = (deliverableId: string, section: ReviewSection) => {
    const item = deliverables.find((d) => d.id === deliverableId);
    if (item) setSelectedSubmission({ item, section });
  };

  const creatorPerformance = buildCreatorPerformance(deliverables);
  const totalViews = deliverables.reduce((sum, d) => sum + d.viewCount, 0);
  const totalLikes = deliverables.reduce((sum, d) => sum + d.likeCount, 0);
  const totalComments = deliverables.reduce((sum, d) => sum + d.commentCount, 0);
  const totalShares = deliverables.reduce((sum, d) => sum + d.shareCount, 0);
  const totalEarningsPaise = deliverables.reduce((sum, d) => sum + approvedEarningsPaise(d), 0);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl space-y-5 px-4 py-10">
        <div className="flex items-center gap-2 text-sm text-muted">
          {campaign.brandLogoUrl ? (
            <img src={resolveMediaUrl(campaign.brandLogoUrl)} alt={campaign.brandCompanyName ?? ""} className="h-6 w-6 rounded-full object-cover" />
          ) : null}
          <span>{campaign.brandCompanyName ?? "Brand campaign"}</span>
          <span className="text-muted/50">•</span>
          <span>Read-only view</span>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          {campaign.coverImageUrl && (
            <div className="aspect-video w-full overflow-hidden bg-surface-variant">
              <img src={resolveMediaUrl(campaign.coverImageUrl)} alt={campaign.title} className="h-full w-full object-cover" />
            </div>
          )}
          <div className="p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusStyle}`}>
                {campaignStatusLabel(campaign.status)}
              </span>
              {campaign.platforms.map((p) => (
                <span key={p} className="rounded-full bg-surface-variant px-2 py-0.5 text-[10px] text-muted">
                  {formatPlatformLabel(p)}
                </span>
              ))}
            </div>
            <h1 className="mt-3 text-2xl font-black leading-tight">{campaign.title}</h1>
            {campaign.briefHook && <p className="mt-1 text-sm font-medium text-primary">{campaign.briefHook}</p>}

            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-4 text-sm">
              <div>
                <p className="text-xs text-muted">Category</p>
                <p className="font-semibold">{campaign.category || "Not set"}</p>
              </div>
              {campaign.startDate && (
                <div>
                  <p className="text-xs text-muted">Start date</p>
                  <p className="font-semibold">{formatDate(campaign.startDate)}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted">Clippers</p>
                <p className="font-semibold">{totalClippers}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex overflow-x-auto border-b border-border">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative flex shrink-0 items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === t.id ? "text-foreground" : "text-muted hover:text-foreground"
              }`}
            >
              {t.label}
              {tab === t.id && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary" />}
            </button>
          ))}
        </div>

        {/* Overview */}
        {tab === "overview" && (
          <div className="mx-auto max-w-2xl space-y-5">
            <div className="rounded-2xl border border-border bg-surface p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Brief</p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{campaign.brief}</p>
              {campaign.productUrl && (
                <a href={campaign.productUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
                  Product page →
                </a>
              )}
            </div>

            {(doPoints.length > 0 || avoidPoints.length > 0) && (
              <div className="grid gap-4 sm:grid-cols-2">
                {doPoints.length > 0 && (
                  <div className="rounded-2xl border border-border bg-surface p-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Do</p>
                    <ul className="mt-2 space-y-1.5 text-sm">
                      {doPoints.map((point) => (
                        <li key={point.id} className="flex gap-2">
                          <span className="text-emerald-400">•</span>
                          <span>{point.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {avoidPoints.length > 0 && (
                  <div className="rounded-2xl border border-border bg-surface p-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-red-400">Avoid</p>
                    <ul className="mt-2 space-y-1.5 text-sm">
                      {avoidPoints.map((point) => (
                        <li key={point.id} className="flex gap-2">
                          <span className="text-red-400">•</span>
                          <span>{point.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {campaign.sourceAssets && campaign.sourceAssets.length > 0 && (
              <div className="rounded-2xl border border-border bg-surface p-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">Source Assets</p>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {campaign.sourceAssets.map((asset, i) => (
                    <li key={i}>
                      <span className="font-medium capitalize">{asset.type}</span>
                      {asset.label ? ` — ${asset.label}` : ""}:{" "}
                      <a href={asset.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        {asset.url}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {campaign.referenceAssets && campaign.referenceAssets.length > 0 && (
              <div className="rounded-2xl border border-border bg-surface p-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">Sample Content</p>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {campaign.referenceAssets.map((asset, i) => (
                    <a
                      key={i}
                      href={resolveMediaUrl(asset.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="overflow-hidden rounded-xl border border-border bg-surface-variant"
                    >
                      {asset.type === "image" ? (
                        <img src={resolveMediaUrl(asset.url)} alt={asset.label ?? "Reference"} className="h-24 w-full object-cover" />
                      ) : (
                        <video src={resolveMediaUrl(asset.url)} className="h-24 w-full object-cover" muted />
                      )}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Working Clippers */}
        {tab === "clippers" && <ClipperProfileGrid items={clippers} onSelect={(c) => setSelectedClipperId(c.participationId)} />}

        {/* Status Board */}
        {tab === "board" && (
          <StatusBoard
            deliverables={deliverables}
            onOpen={(d) => openSubmission(d.id, isProofStatus(d.status) ? "proof" : "submissions")}
          />
        )}

        {/* Work Submissions */}
        {tab === "submissions" && (
          <SubmissionGrid
            items={deliverables}
            section="submissions"
            onSelect={(deliverableId) => openSubmission(deliverableId, "submissions")}
            emptyMessage="No work submitted yet."
          />
        )}

        {/* Proof of Work */}
        {tab === "proof" && (
          <SubmissionGrid
            items={deliverables}
            section="proof"
            onSelect={(deliverableId) => openSubmission(deliverableId, "proof")}
            emptyMessage="No proof of work submitted yet."
          />
        )}

        {/* Analytics */}
        {tab === "analytics" && (
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Campaign Performance</p>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
                {[
                  { label: "Total Views",    value: formatCount(totalViews) },
                  { label: "Total Likes",    value: formatCount(totalLikes) },
                  { label: "Total Comments", value: formatCount(totalComments) },
                  { label: "Total Shares",   value: formatCount(totalShares) },
                  { label: "Earned (approved proof)", value: formatInr(totalEarningsPaise) },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-2xl border border-border bg-surface p-5 text-center">
                    <p className="text-2xl font-black">{value}</p>
                    <p className="mt-1 text-xs text-muted">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Top Performers</p>
              <Leaderboard items={creatorPerformance} />
            </div>

            <div className="rounded-2xl border border-border bg-surface p-5">
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted">Pipeline</p>
              <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
                {[
                  { label: "Clippers", value: totalClippers },
                  { label: "Work in review", value: stageCounts.work_review ?? 0 },
                  { label: "Proof in review", value: stageCounts.proof_review ?? 0 },
                  { label: "Proof approved", value: stageCounts.proof_approved ?? 0 },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl border border-border bg-surface-variant/30 p-4 text-center">
                    <p className="text-xl font-black">{value}</p>
                    <p className="mt-1 text-xs text-muted">{label}</p>
                  </div>
                ))}
              </div>
              {STAGE_ORDER.filter((st) => st !== "awaiting_payment" && st !== "paid").map((stage) => (
                <div key={stage} className="flex items-center justify-between border-b border-border/40 py-2.5 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${TAG_META[stage].dot}`} />
                    <span className="text-sm">{TAG_META[stage].label}</span>
                  </div>
                  <span className="text-sm font-semibold">{stageCounts[stage] ?? 0}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {selectedClipper && !selectedSubmission && (
        <ClipperProfileModal
          clipper={selectedClipper}
          onClose={() => setSelectedClipperId(null)}
          onOpen={openSubmission}
        />
      )}

      {selectedSubmission && (
        <ReadOnlySubmissionModal
          deliverable={selectedSubmission.item}
          section={selectedSubmission.section}
          onClose={() => setSelectedSubmission(null)}
        />
      )}
    </div>
  );
}
