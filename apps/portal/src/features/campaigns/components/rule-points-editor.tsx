import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  createRulePoint,
  parseRulePoints,
  serializeRulePoints,
  type RulePoint,
} from "@/features/campaigns/lib/rule-points";
import { cn } from "@/lib/utils";

type RulePointsEditorProps = {
  value: string;
  onChange: (value: string) => void;
  variant: "do" | "avoid" | "hook" | "focus";
  title: string;
  description: string;
  addLabel: string;
  placeholder: string;
  emptyHint: string;
};

/** A small dot color to tell "do" and "avoid" apart at a glance — everything else stays neutral. */
const dotColor = {
  do: "bg-money",
  avoid: "bg-destructive",
  hook: "bg-primary",
  focus: "bg-primary",
} as const;

export function RulePointsEditor({
  value,
  onChange,
  variant,
  title,
  description,
  addLabel,
  placeholder,
  emptyHint,
}: RulePointsEditorProps) {
  const [points, setPoints] = useState<RulePoint[]>(() => parseRulePoints(value));
  const lastEmitted = useRef(value);

  useEffect(() => {
    if (value !== lastEmitted.current) {
      setPoints(parseRulePoints(value));
      lastEmitted.current = value;
    }
  }, [value]);

  const commitPoints = (next: RulePoint[]) => {
    setPoints(next);
    const serialized = serializeRulePoints(next);
    lastEmitted.current = serialized;
    onChange(serialized);
  };

  const updatePoint = (id: string, text: string) => {
    commitPoints(points.map((point) => (point.id === id ? { ...point, text } : point)));
  };

  const removePoint = (id: string) => {
    commitPoints(points.filter((point) => point.id !== id));
  };

  const addPoint = () => {
    commitPoints([...points, createRulePoint()]);
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotColor[variant])} />
        <p className="text-sm font-medium text-foreground">{title}</p>
      </div>
      <p className="mt-0.5 text-xs text-muted">{description}</p>

      <div className="mt-3 space-y-2">
        {points.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-3 py-3 text-center text-xs text-muted">
            {emptyHint}
          </p>
        ) : (
          <ol className="space-y-2">
            {points.map((point, index) => (
              <li key={point.id} className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-variant text-[10px] font-medium text-muted">
                  {index + 1}
                </span>
                <input
                  type="text"
                  value={point.text}
                  placeholder={placeholder}
                  onChange={(e) => updatePoint(point.id, e.target.value)}
                  className="h-9 flex-1 rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted/70 outline-none transition focus:border-foreground/30 focus:ring-2 focus:ring-primary/15"
                />
                <button
                  type="button"
                  onClick={() => removePoint(point.id)}
                  className="shrink-0 rounded-md p-1.5 text-muted hover:bg-surface-variant hover:text-destructive"
                  aria-label={`Remove point ${index + 1}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ol>
        )}

        <Button type="button" variant="outline" size="sm" onClick={addPoint} className="border-dashed">
          <Plus className="h-3.5 w-3.5" />
          {addLabel}
        </Button>
      </div>
    </div>
  );
}
