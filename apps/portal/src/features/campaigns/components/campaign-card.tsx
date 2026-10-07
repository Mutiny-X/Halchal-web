import { useNavigate } from "react-router-dom";
import { ArrowRight, ImageIcon, MapPin, Users, Wallet, Zap } from "lucide-react";

import {
  CampaignRowActions,
  type CampaignMenuAction,
} from "@/features/campaigns/components/campaign-row-actions";
import { getPlatformOption } from "@/features/campaigns/lib/platform-options";
import { formatCpv, formatInr } from "@/lib/format";
import { resolveMediaUrl } from "@/lib/media-url";
import { cn } from "@/lib/utils";
import type { Campaign } from "@/lib/api";

const STATUS_STYLE: Record<string, { dot: string; badge: string }> = {
  live: { dot: "bg-emerald-400", badge: "bg-emerald-500/15 text-emerald-400" },
  draft: { dot: "bg-zinc-400", badge: "bg-zinc-500/15 text-zinc-400" },
  paused: { dot: "bg-orange-400", badge: "bg-orange-500/15 text-orange-400" },
  closed: { dot: "bg-red-400", badge: "bg-red-500/15 text-red-400" },
};

function locationLabel(campaign: Campaign) {
  if (campaign.locationType === "pan_india" || campaign.targetStates.length === 0) {
    return "Pan India";
  }
  const [first, second, ...rest] = campaign.targetStates;
  return rest.length > 0 ? `${first}, ${second} +${rest.length}` : [first, second].filter(Boolean).join(", ");
}

export function CampaignCard({
  campaign,
  isAdmin = false,
  basePath = "/campaigns",
  onMenuAction,
}: {
  campaign: Campaign;
  isAdmin?: boolean;
  basePath?: string;
  onMenuAction: (campaign: Campaign, action: CampaignMenuAction) => void;
}) {
  const navigate = useNavigate();
  const style = STATUS_STYLE[campaign.status] ?? STATUS_STYLE.draft;

  return (
    <div
      onClick={() => navigate(`${basePath}/${campaign.id}`)}
      className="group cursor-pointer rounded-2xl border border-border bg-surface-variant/60 p-4 shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-xl"
    >
      {/* Square thumbnail + title/brand/date column */}
      <div className="flex gap-3">
        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-surface">
          {campaign.coverImageUrl ? (
            <img
              src={resolveMediaUrl(campaign.coverImageUrl)}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <ImageIcon className="h-6 w-6 text-muted" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <span
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
                style.badge,
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
              {campaign.status}
            </span>
            <div onClick={(e) => e.stopPropagation()}>
              <CampaignRowActions campaign={campaign} onMenuAction={onMenuAction} basePath={basePath} />
            </div>
          </div>

          <p className="mt-2 line-clamp-2 font-bold leading-tight">{campaign.title}</p>
          <p className="mt-1 truncate text-sm font-medium text-primary">
            {isAdmin
              ? campaign.brandCompanyName ?? campaign.pendingInviteEmail ?? "Unassigned"
              : campaign.platforms.map((p) => getPlatformOption(p)?.label ?? p).join(", ")}
          </p>

          <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-muted">
            <MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            {locationLabel(campaign)}
          </p>
        </div>
      </div>

      {/* Stats + arrow */}
      <div className="mt-3 flex items-end justify-between gap-3 border-t border-border/60 pt-3">
        <div className="flex flex-1 items-end divide-x divide-border/60">
          <div className="flex-1 pr-3">
            <p className="flex items-center gap-1 text-[10px] text-muted">
              <Zap className="h-3 w-3" />
              Rate
            </p>
            <p className="mt-1 text-sm font-bold text-primary">{formatCpv(campaign.ratePer1kPaise)}</p>
          </div>
          <div className="flex-1 px-3">
            <p className="flex items-center gap-1 text-[10px] text-muted">
              <Wallet className="h-3 w-3" />
              Budget
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">{formatInr(campaign.budgetPaise)}</p>
          </div>
          <div className="flex-1 pl-3">
            <p className="flex items-center gap-1 text-[10px] text-muted">
              <Users className="h-3 w-3" />
              Subs
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">{campaign.submissionCount ?? 0}</p>
          </div>
        </div>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary transition group-hover:bg-primary group-hover:text-white">
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>

      {/* Pool used */}
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-[10px] text-muted">
          <span>Pool used</span>
          <span className="font-semibold text-foreground">{campaign.poolPercent}%</span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-black/20">
          <div
            className={cn("h-full rounded-full transition-all", campaign.poolPercent > 80 ? "bg-orange-400" : "bg-primary")}
            style={{ width: `${Math.min(campaign.poolPercent, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
