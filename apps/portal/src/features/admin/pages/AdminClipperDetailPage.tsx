import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Clock,
  Eye,
  EyeOff,
  ExternalLink,
  FileText,
  Globe,
  ImageIcon,
  Instagram,
  Linkedin,
  ReceiptText,
  Smartphone,
  TrendingUp,
  Twitter,
  Wallet,
  Youtube,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router-dom";

import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { DetailPageSkeleton } from "@/components/ui/page-skeletons";
import { StatusPill } from "@/components/ui/status-pill";
import { useToast } from "@/components/ui/toaster";
import { formatDate } from "@/features/campaigns/lib/campaign-board-data";
import {
  adminApi,
  type AdminCreatorCampaignEntry,
  type AdminCreatorDetail,
  type AdminCreatorPayoutMethod,
  type KycStatus,
} from "@/lib/api";
import { formatInr, formatViews } from "@/lib/format";
import { resolveMediaUrl } from "@/lib/media-url";
import { connectedSocialUrl } from "@/lib/social-profile-url";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "C";
}

const PLATFORM_ICON: Record<string, LucideIcon> = {
  instagram: Instagram,
  youtube: Youtube,
  twitter: Twitter,
  x: Twitter,
  linkedin: Linkedin,
  website: Globe,
};

function platformIcon(platform: string): LucideIcon {
  return PLATFORM_ICON[platform.toLowerCase()] ?? Globe;
}

const KYC_STYLE: Record<KycStatus, string> = {
  verified: "bg-emerald-500/15 text-emerald-400",
  pending: "bg-warning/15 text-warning",
  rejected: "bg-destructive/15 text-destructive",
  not_started: "bg-surface-variant text-muted",
};

const KYC_LABEL: Record<KycStatus, string> = {
  verified: "KYC Verified",
  pending: "KYC Pending",
  rejected: "KYC Rejected",
  not_started: "No KYC",
};

const REVIEW_LABEL: Record<KycStatus, string> = {
  verified: "Verified",
  pending: "Under review",
  rejected: "Rejected",
  not_started: "Not started",
};

const WITHDRAWAL_STATUS_STYLE: Record<string, string> = {
  completed: "bg-emerald-500/15 text-emerald-400",
  pending: "bg-warning/15 text-warning",
  processing: "bg-primary/15 text-primary",
  failed: "bg-destructive/15 text-destructive",
};

/* ── Campaign card ── */
function CampaignCard({ entry }: { entry: AdminCreatorCampaignEntry }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-variant">
            {entry.coverImageUrl ? (
              <img src={resolveMediaUrl(entry.coverImageUrl)} alt="" className="h-full w-full object-cover" />
            ) : (
              <ImageIcon className="h-4 w-4 text-muted" />
            )}
          </div>
          <p className="truncate font-semibold leading-tight">{entry.title}</p>
        </div>
        <StatusPill status={entry.status} className="shrink-0" />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border/60 pt-3 text-center">
        <div>
          <p className="text-sm font-semibold leading-none tabular-nums text-foreground">{formatViews(entry.viewCount)}</p>
          <p className="mt-1 text-[10px] text-muted">Views</p>
        </div>
        <div>
          <p className="text-sm font-bold leading-none tabular-nums text-money">{formatInr(entry.earnedPaise)}</p>
          <p className="mt-1 text-[10px] text-muted">Earned</p>
        </div>
      </div>
    </div>
  );
}

function CampaignCardGrid({ entries, emptyMessage }: { entries: AdminCreatorCampaignEntry[]; emptyMessage: string }) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted/60 italic">{emptyMessage}</p>;
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {entries.map((entry) => (
        <CampaignCard key={entry.campaignId} entry={entry} />
      ))}
    </div>
  );
}

/* ── KYC review ── */
function KycReviewCard({ creator }: { creator: AdminCreatorDetail }) {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const review = useMutation({
    mutationFn: (body: { action: "approve" | "reject"; reason?: string }) =>
      adminApi.reviewKyc(getToken()!, creator.id, body.action, body.reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-creator", creator.id] });
      setShowRejectForm(false);
      setRejectReason("");
      toast(review.variables?.action === "reject" ? "KYC rejected" : "KYC approved");
    },
    onError: () => toast("Failed to update KYC", "error"),
  });

  if (creator.kycStatus === "not_started") return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <p className="text-sm font-semibold text-foreground">KYC Verification</p>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${KYC_STYLE[creator.kycStatus]}`}>
          {KYC_LABEL[creator.kycStatus]}
        </span>
      </div>

      <div className="space-y-4 px-5 py-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
          {creator.kycDocumentType && (
            <span>
              Document: <span className="font-medium capitalize text-foreground">{creator.kycDocumentType}</span>
            </span>
          )}
          {creator.kycSubmittedAt && <span>Submitted {formatDate(creator.kycSubmittedAt)}</span>}
        </div>

        {creator.kycDocumentUrl ? (
          <a
            href={resolveMediaUrl(creator.kycDocumentUrl)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <FileText className="h-4 w-4" />
            View submitted document
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : (
          <p className="text-sm text-muted/60 italic">No document on file</p>
        )}

        {creator.kycStatus === "rejected" && creator.kycRejectionReason && (
          <div className="rounded-xl bg-surface-variant/50 p-4">
            <p className="text-sm font-semibold">Rejection reason</p>
            <p className="mt-1.5 text-sm text-muted">{creator.kycRejectionReason}</p>
          </div>
        )}

        {creator.kycStatus === "pending" &&
          (showRejectForm ? (
            <div className="space-y-3">
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                placeholder="Rejection reason (required)"
                className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowRejectForm(false)} disabled={review.isPending}>
                  Back
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  disabled={review.isPending || !rejectReason.trim()}
                  onClick={() => review.mutate({ action: "reject", reason: rejectReason })}
                >
                  {review.isPending ? "Rejecting…" : "Confirm Reject"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => review.mutate({ action: "approve" })} disabled={review.isPending}>
                {review.isPending ? "Accepting…" : "Accept KYC"}
              </Button>
              <Button variant="destructive" className="flex-1" onClick={() => setShowRejectForm(true)} disabled={review.isPending}>
                Reject KYC
              </Button>
            </div>
          ))}
      </div>
    </div>
  );
}

/* ── Signup verification (Instagram manually reviewed) ── */
function OnboardingVerificationCard({ creator }: { creator: AdminCreatorDetail }) {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const review = useMutation({
    mutationFn: (body: { action: "approve" | "reject"; reason?: string }) =>
      adminApi.reviewInstagramOnboarding(getToken()!, creator.id, body.action, body.reason),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["admin-creator", creator.id] });
      setShowRejectForm(false);
      setRejectReason("");
      toast(variables.action === "reject" ? "Instagram rejected" : "Instagram approved");
    },
    onError: () => toast("Failed to update Instagram review", "error"),
  });

  const hasAnyData =
    creator.requiresOnboardingGate ||
    creator.instagramReview.status !== "not_started" ||
    creator.instagramConnections.length > 0;

  if (!hasAnyData) return null;

  const needsAction =
    creator.instagramConnections.length > 0 &&
    (creator.instagramReview.status === "not_started" || creator.instagramReview.status === "pending");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {needsAction && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />}
          <p className="text-sm font-semibold text-foreground">Signup Verification</p>
        </div>
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted">
          Instagram reviewed manually
        </span>
      </div>

      {/* One self-contained card — banner, status, connected account, and the review action all together */}
      <div className="w-full max-w-xs overflow-hidden rounded-2xl border border-border bg-surface-variant/60 shadow-lg shadow-black/10">
        <div className="relative h-16 w-full bg-linear-to-br from-pink-500/25 to-transparent">
          <div className="absolute -bottom-6 left-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-pink-500/15 text-pink-400 ring-4 ring-surface-variant">
              <Instagram className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="space-y-3 p-4 pt-8">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-foreground">Instagram</p>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${KYC_STYLE[creator.instagramReview.status]}`}>
              {REVIEW_LABEL[creator.instagramReview.status]}
            </span>
          </div>

          {creator.instagramConnections.map((c) => (
            <a
              key={c.id}
              href={`https://instagram.com/${c.platformHandle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-surface p-2.5 transition-colors hover:border-primary/30"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-variant text-muted">
                {c.profilePictureUrl ? (
                  <img src={c.profilePictureUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Instagram className="h-4 w-4" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">@{c.platformHandle}</p>
                <p className="truncate text-[11px] text-muted">
                  {formatViews(c.followerCount)} followers · {c.engagementRate.toFixed(1)}% eng.
                </p>
              </div>
              {!c.isConnected ? (
                <span className="shrink-0 rounded-full bg-destructive/15 px-2 py-0.5 text-[9px] font-bold text-destructive">
                  Disconnected
                </span>
              ) : (
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted" />
              )}
            </a>
          ))}

          {creator.instagramReview.status === "rejected" && creator.instagramReview.rejectionReason && (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3">
              <p className="text-xs font-semibold text-foreground">Rejection reason</p>
              <p className="mt-1 text-xs text-muted">{creator.instagramReview.rejectionReason}</p>
            </div>
          )}

          {needsAction &&
            (showRejectForm ? (
              <div className="space-y-2">
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  placeholder="Rejection reason (required)"
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <Button
                  variant="destructive"
                  className="w-full"
                  disabled={review.isPending || !rejectReason.trim()}
                  onClick={() => review.mutate({ action: "reject", reason: rejectReason })}
                >
                  {review.isPending ? "Rejecting…" : "Confirm Reject"}
                </Button>
                <Button variant="outline" className="w-full" onClick={() => setShowRejectForm(false)} disabled={review.isPending}>
                  Back
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Button className="w-full" onClick={() => review.mutate({ action: "approve" })} disabled={review.isPending}>
                  {review.isPending ? "Approving…" : "Approve Instagram"}
                </Button>
                <Button variant="destructive" className="w-full" onClick={() => setShowRejectForm(true)} disabled={review.isPending}>
                  Reject Instagram
                </Button>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

/* ── Payout method row (with admin reveal-account-number action) ── */
function PayoutMethodRow({ method }: { method: AdminCreatorPayoutMethod }) {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const [revealed, setRevealed] = useState<string | null>(null);

  const reveal = useMutation({
    mutationFn: () => adminApi.revealPayoutMethodAccountNumber(getToken()!, method.id),
    onSuccess: (data) => setRevealed(data.accountNumber),
    onError: () => toast("Failed to reveal account number", "error"),
  });

  const isBank = method.type.toLowerCase() !== "upi";
  const fields = [
    { label: "Holder", value: method.accountHolderName },
    ...(isBank && method.bankName ? [{ label: "Bank", value: method.bankName }] : []),
    ...(isBank && method.ifscCode ? [{ label: "IFSC", value: method.ifscCode }] : []),
    ...(isBank && method.panNumber ? [{ label: "PAN", value: method.panNumber }] : []),
  ];

  return (
    <div className="px-5 py-3.5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-variant text-muted">
          {isBank ? <Building2 className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold">{method.label}</p>
            {method.isDefault && (
              <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                Default
              </span>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5">
              {isBank ? "Account" : "UPI ID"}:{" "}
              <span className="font-medium text-foreground">{revealed ?? method.accountMasked}</span>
              <button
                type="button"
                onClick={() => (revealed ? setRevealed(null) : reveal.mutate())}
                disabled={reveal.isPending}
                title={revealed ? "Hide number" : "Reveal number"}
                className="text-muted transition hover:text-foreground disabled:opacity-50"
              >
                {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </span>
            {fields.map((f) => (
              <span key={f.label}>
                {f.label}: <span className="font-medium text-foreground">{f.value}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminClipperDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { getToken } = useAuth();
  const [tab, setTab] = useState<"campaigns" | "wallet" | "about">("campaigns");

  const { data: creator, isPending } = useQuery({
    queryKey: ["admin-creator", id],
    queryFn: () => adminApi.creator(getToken()!, id!),
    enabled: Boolean(getToken() && id),
  });

  if (isPending) return <DetailPageSkeleton />;
  if (!creator) return null;

  const name = creator.displayName ?? creator.username ?? "Creator";
  const socialEntries = creator.socialLinks
    ? Object.entries(creator.socialLinks).filter(([, url]) => url?.trim())
    : [];

  return (
    <div className="space-y-6">
      <BackButton to="/admin/clippers" label="All Clippers" />

      {/* Hero */}
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="h-24 w-full bg-linear-to-r from-primary/20 via-primary/10 to-transparent" />

        <div className="px-6 pb-6">
          <div className="-mt-10 mb-4 flex items-end justify-between">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl bg-primary/15 text-2xl font-black text-primary ring-4 ring-surface">
              {creator.avatarUrl ? (
                <img src={creator.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                initials(name)
              )}
            </div>

            <div className="flex items-end gap-3 pb-1">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-center">
                <p className="text-lg font-black text-emerald-400">{formatInr(creator.wallet.lifetimePaise)}</p>
                <p className="text-[10px] text-muted">Lifetime earned</p>
              </div>
              <div className="rounded-xl border border-border bg-surface-variant px-4 py-2 text-center">
                <p className="text-lg font-black text-primary">{formatInr(creator.wallet.availablePaise)}</p>
                <p className="text-[10px] text-muted">Available</p>
              </div>
              <div className="rounded-xl border border-border bg-surface-variant px-4 py-2 text-center">
                <p className="text-lg font-black">{creator.runningCampaigns.length + creator.pastCampaigns.length}</p>
                <p className="text-[10px] text-muted">Campaigns</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold">{name}</h1>
            {creator.verifiedCreatorId && (
              <span className="rounded-full bg-surface-variant px-2 py-0.5 text-[10px] font-bold text-muted">
                #{creator.verifiedCreatorId}
              </span>
            )}
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${KYC_STYLE[creator.kycStatus]}`}>
              {KYC_LABEL[creator.kycStatus]}
            </span>
            {!creator.isActive && (
              <span className="rounded-full bg-muted/20 px-2 py-0.5 text-[10px] font-bold text-muted">Inactive</span>
            )}
          </div>
          {creator.username && <p className="text-sm text-muted">@{creator.username}</p>}

          <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted">
            <span>{creator.email ?? "—"}</span>
            <span>{creator.phone ?? "—"}</span>
            <span>Joined {formatDate(creator.createdAt)}</span>
          </div>
        </div>
      </div>

      <KycReviewCard creator={creator} />
      <OnboardingVerificationCard creator={creator} />

      {/* Tabs */}
      <div className="flex border-b border-border">
        {(["campaigns", "wallet", "about"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`relative px-5 py-3 text-sm font-medium capitalize transition-colors ${
              tab === t ? "text-foreground" : "text-muted hover:text-foreground"
            }`}
          >
            {t === "wallet" ? "Wallet & Payouts" : t}
            {tab === t && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary" />}
          </button>
        ))}
      </div>

      {/* Campaigns tab */}
      {tab === "campaigns" && (
        <div className="space-y-5">
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Running Campaigns</p>
            <CampaignCardGrid entries={creator.runningCampaigns} emptyMessage="No running campaigns." />
          </div>
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Past Campaigns</p>
            <CampaignCardGrid entries={creator.pastCampaigns} emptyMessage="No past campaigns." />
          </div>
        </div>
      )}

      {/* Wallet & Payouts tab */}
      {tab === "wallet" && (
        <div className="space-y-4">
          {/* Balance overview — available balance leads, pending/lifetime support it */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="relative overflow-hidden rounded-2xl border border-primary/25 bg-linear-to-br from-primary/15 via-primary/5 to-transparent p-5 sm:col-span-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
                <Wallet className="h-3.5 w-3.5" />
                Available Balance
              </div>
              <p className="mt-2 text-3xl font-black tabular-nums text-foreground">{formatInr(creator.wallet.availablePaise)}</p>
              <p className="mt-1 text-xs text-muted">Ready to withdraw</p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-1">
              <div className="rounded-2xl border border-border bg-surface p-4">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted">
                  <Clock className="h-3.5 w-3.5" />
                  Pending
                </div>
                <p className="mt-1.5 text-lg font-bold tabular-nums text-warning">{formatInr(creator.wallet.pendingPaise)}</p>
              </div>
              <div className="rounded-2xl border border-border bg-surface p-4">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Lifetime
                </div>
                <p className="mt-1.5 text-lg font-bold tabular-nums text-emerald-400">{formatInr(creator.wallet.lifetimePaise)}</p>
              </div>
            </div>
          </div>

          {/* Payout methods */}
          <div className="overflow-hidden rounded-2xl border border-border bg-surface">
            <div className="border-b border-border px-5 py-3.5">
              <p className="text-sm font-semibold text-foreground">Payout Methods</p>
            </div>
            {creator.payoutMethods.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-5 py-10 text-center">
                <Building2 className="h-8 w-8 text-muted/30" />
                <p className="text-sm text-muted">No payout methods added yet</p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {creator.payoutMethods.map((m) => (
                  <PayoutMethodRow key={m.id} method={m} />
                ))}
              </div>
            )}
          </div>

          {/* Withdrawal history */}
          <div className="overflow-hidden rounded-2xl border border-border bg-surface">
            <div className="flex items-center gap-1.5 border-b border-border px-5 py-3.5">
              <ReceiptText className="h-4 w-4 text-muted" />
              <p className="text-sm font-semibold text-foreground">Withdrawal History</p>
            </div>
            {creator.withdrawals.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-5 py-10 text-center">
                <ReceiptText className="h-8 w-8 text-muted/30" />
                <p className="text-sm text-muted">No withdrawals yet</p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {creator.withdrawals.map((w) => (
                  <div key={w.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold tabular-nums text-foreground">{formatInr(w.netPaise)}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {formatInr(w.amountPaise)} gross · {formatInr(w.feePaise)} fee · {formatDate(w.createdAt)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                          WITHDRAWAL_STATUS_STYLE[w.status] ?? "bg-surface-variant text-muted",
                        )}
                      >
                        {w.status}
                      </span>
                      {w.processedAt && (
                        <p className="mt-1 text-[11px] text-muted">Processed {formatDate(w.processedAt)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* About tab */}
      {tab === "about" && (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-border bg-surface">
            <div className="border-b border-border px-5 py-3.5">
              <p className="text-sm font-semibold text-foreground">Contact</p>
            </div>
            <div className="divide-y divide-border/50">
              {[
                { label: "Email", value: creator.email ?? "—" },
                { label: "Phone", value: creator.phone ?? "—" },
                { label: "Joined", value: formatDate(creator.createdAt) },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between px-5 py-3.5">
                  <span className="text-sm text-muted">{label}</span>
                  <span className="text-sm font-semibold">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {creator.bio && (
            <div className="overflow-hidden rounded-2xl border border-border bg-surface">
              <div className="border-b border-border px-5 py-3.5">
                <p className="text-sm font-semibold text-foreground">Bio</p>
              </div>
              <p className="px-5 py-4 text-sm text-foreground">{creator.bio}</p>
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-border bg-surface">
            <div className="border-b border-border px-5 py-3.5">
              <p className="text-sm font-semibold text-foreground">Linked Accounts</p>
            </div>
            {creator.linkedProfiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-5 py-10 text-center">
                <Globe className="h-8 w-8 text-muted/30" />
                <p className="text-sm text-muted">No linked platform accounts</p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {creator.linkedProfiles.map((p) => {
                  const Icon = platformIcon(p.platform);
                  const profileUrl = connectedSocialUrl(p.platform, p.socialLinks);
                  const rowClassName = cn(
                    "flex items-center gap-3 px-5 py-3.5",
                    profileUrl && "transition-colors hover:bg-surface-variant/40",
                  );
                  const content = (
                    <>
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-variant text-muted">
                        {p.avatarUrl ? (
                          <img src={p.avatarUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <Icon className="h-4 w-4" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold capitalize">{p.platform}</p>
                        <p className="truncate text-xs text-muted">
                          @{p.handle}
                          {p.label ? ` · ${p.label}` : ""}
                        </p>
                      </div>
                      {p.isDefault && (
                        <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">Default</span>
                      )}
                      {profileUrl && <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted" />}
                    </>
                  );
                  return profileUrl ? (
                    <a key={p.id} href={profileUrl} target="_blank" rel="noopener noreferrer" className={rowClassName}>
                      {content}
                    </a>
                  ) : (
                    <div key={p.id} className={rowClassName}>
                      {content}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-surface">
            <div className="border-b border-border px-5 py-3.5">
              <p className="text-sm font-semibold text-foreground">Social Accounts</p>
            </div>
            {socialEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-5 py-10 text-center">
                <Globe className="h-8 w-8 text-muted/30" />
                <p className="text-sm text-muted">No social accounts added</p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {socialEntries.map(([platform, url]) => {
                  const Icon = platformIcon(platform);
                  return (
                    <a
                      key={platform}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface-variant/40"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium capitalize">{platform}</span>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted" />
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
