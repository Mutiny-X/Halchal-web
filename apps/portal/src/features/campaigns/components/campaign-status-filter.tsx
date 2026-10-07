import { cn } from "@/lib/utils";
import type { CampaignStatusFilter } from "@/lib/api";

const tabs: { value: CampaignStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "live", label: "Live" },
  { value: "paused", label: "Paused" },
  { value: "closed", label: "Ended" },
];

type CampaignStatusFilterProps = {
  value: CampaignStatusFilter;
  onChange: (value: CampaignStatusFilter) => void;
};

export function CampaignStatusFilterTabs({
  value,
  onChange,
}: CampaignStatusFilterProps) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-xl border border-border bg-surface p-1">
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted hover:bg-surface-variant hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
