import { Link } from "react-router-dom";
import {
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Square,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { isCampaignReadyToPublish } from "@/features/campaigns/lib/campaign-payload";
import { getWizardEditPath } from "@/features/campaigns/lib/wizard-paths";
import { cn } from "@/lib/utils";
import type { Campaign } from "@/lib/api";

export type CampaignMenuAction =
  | {
      kind: "status";
      status: "live" | "paused" | "closed";
      label: string;
      title: string;
      description: string;
      confirmLabel: string;
      variant?: "default" | "destructive";
      disabled?: boolean;
      disabledReason?: string;
    }
  | {
      kind: "delete";
      label: string;
      title: string;
      description: string;
      confirmLabel: string;
      variant: "destructive";
    };

const MENU_WIDTH = 176;
const MENU_GAP = 6;

export function getCampaignMenuActions(campaign: Campaign): CampaignMenuAction[] {
  const canDelete =
    (campaign.status === "draft" || campaign.status === "closed") &&
    (campaign.submissionCount ?? 0) === 0;

  switch (campaign.status) {
    case "draft": {
      const ready = isCampaignReadyToPublish(campaign);
      return [
        {
          kind: "status",
          status: "live",
          label: "Set live",
          title: "Set live",
          description: "Publish this campaign so creators can discover and submit content.",
          confirmLabel: "Set live",
          disabled: !ready,
          disabledReason: ready
            ? undefined
            : "Finish setting up this campaign (brief, sample content, budget) before publishing.",
        },
        {
          kind: "status",
          status: "closed",
          label: "Mark as ended",
          title: "End",
          description: "Mark this draft as ended without publishing it live.",
          confirmLabel: "End",
          variant: "destructive",
        },
        ...(canDelete
          ? [
              {
                kind: "delete" as const,
                label: "Delete",
                title: "Delete",
                description:
                  "Permanently remove this campaign. This cannot be undone.",
                confirmLabel: "Delete",
                variant: "destructive" as const,
              },
            ]
          : []),
      ];
    }
    case "live":
      return [
        {
          kind: "status",
          status: "paused",
          label: "Pause campaign",
          title: "Pause",
          description:
            "Creators will no longer see this campaign until you resume it.",
          confirmLabel: "Pause",
        },
        {
          kind: "status",
          status: "closed",
          label: "End campaign",
          title: "End",
          description: "Mark this campaign as ended. It will no longer accept submissions.",
          confirmLabel: "End",
          variant: "destructive",
        },
      ];
    case "paused":
      return [
        {
          kind: "status",
          status: "live",
          label: "Resume campaign",
          title: "Resume",
          description: "Make this campaign live for creators again.",
          confirmLabel: "Resume",
        },
        {
          kind: "status",
          status: "closed",
          label: "End campaign",
          title: "End",
          description: "Mark this campaign as ended. It will no longer accept submissions.",
          confirmLabel: "End",
          variant: "destructive",
        },
      ];
    case "closed":
      return canDelete
        ? [
            {
              kind: "delete",
              label: "Delete",
              title: "Delete",
              description:
                "Permanently remove this campaign. This cannot be undone.",
              confirmLabel: "Delete",
              variant: "destructive",
            },
          ]
        : [];
    default:
      return [];
  }
}

type MenuPosition = {
  top: number;
  left: number;
};

type CampaignRowActionsProps = {
  campaign: Campaign;
  onMenuAction: (campaign: Campaign, action: CampaignMenuAction) => void;
  basePath?: string;
};

export function CampaignRowActions({
  campaign,
  onMenuAction,
  basePath = "/campaigns",
}: CampaignRowActionsProps) {
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition>({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuActions = getCampaignMenuActions(campaign);

  const updatePosition = useCallback(() => {
    const trigger = buttonRef.current;
    const menu = menuRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const menuHeight = menu?.offsetHeight ?? 160;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < menuHeight + MENU_GAP && rect.top > menuHeight + MENU_GAP;

    const top = openUp
      ? rect.top - menuHeight - MENU_GAP
      : rect.bottom + MENU_GAP;

    let left = rect.right - MENU_WIDTH;
    left = Math.max(8, Math.min(left, window.innerWidth - MENU_WIDTH - 8));

    setPosition({ top, left });
  }, []);

  useEffect(() => {
    if (!open) return;

    updatePosition();

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    const onScrollOrResize = () => updatePosition();

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);

    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => updatePosition());
    }
  }, [open, updatePosition, menuActions.length, campaign.status]);

  const menu = open ? (
    <div
      ref={menuRef}
      id={menuId}
      role="menu"
      className="fixed z-50 min-w-[11rem] rounded-xl border border-border bg-surface py-1 shadow-lg"
      style={{
        top: position.top,
        left: position.left,
        width: MENU_WIDTH,
      }}
    >
      {campaign.status === "draft" ? (
        <Link
          to={getWizardEditPath(campaign.id, basePath.startsWith("/admin"))}
          role="menuitem"
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-variant"
          onClick={() => setOpen(false)}
        >
          <Pencil className="h-4 w-4 text-muted" />
          Continue editing
        </Link>
      ) : null}
      {campaign.status === "draft" && menuActions.length > 0 ? (
        <div className="my-1 border-t border-border" />
      ) : null}
      {menuActions.map((action) => (
        <button
          key={action.kind === "delete" ? "delete" : action.status}
          type="button"
          role="menuitem"
          disabled={action.kind === "status" && action.disabled}
          title={action.kind === "status" ? action.disabledReason : undefined}
          className={cn(
            "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-variant",
            action.variant === "destructive" && "text-destructive",
            action.kind === "status" &&
              action.disabled &&
              "cursor-not-allowed text-muted opacity-50 hover:bg-transparent",
          )}
          onClick={() => {
            if (action.kind === "status" && action.disabled) return;
            setOpen(false);
            onMenuAction(campaign, action);
          }}
        >
          {action.kind === "delete" ? (
            <Trash2 className="h-4 w-4" />
          ) : action.status === "live" ? (
            <Play className="h-4 w-4" />
          ) : action.status === "paused" ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Square className="h-4 w-4" />
          )}
          {action.label}
        </button>
      ))}
    </div>
  ) : null;

  return (
    <>
      <div className="flex justify-end" data-actions-cell>
        <button
          ref={buttonRef}
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-variant hover:text-foreground"
          aria-label={`Actions for ${campaign.title}`}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          onClick={(event) => {
            event.stopPropagation();
            setOpen((value) => !value);
          }}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>
      {menu ? createPortal(menu, document.body) : null}
    </>
  );
}
