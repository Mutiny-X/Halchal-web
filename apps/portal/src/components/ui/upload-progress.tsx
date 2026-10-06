import { useEffect } from "react";
import { Loader2 } from "lucide-react";

import type { UploadProgress } from "@/lib/api";
import { cn } from "@/lib/utils";

const MB = 1024 * 1024;

function size(bytes: number): string {
  if (bytes >= 1024 * MB) return `${(bytes / (1024 * MB)).toFixed(2)} GB`;
  if (bytes >= MB) return `${(bytes / MB).toFixed(bytes >= 100 * MB ? 0 : 1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function timeLeft(seconds: number | null): string | null {
  if (seconds == null) return null;
  if (seconds < 5) return "a few seconds left";
  if (seconds < 60) return `${seconds}s left`;
  const m = Math.round(seconds / 60);
  if (m < 60) return `~${m} min left`;
  return `~${Math.floor(m / 60)} h ${m % 60} min left`;
}

/** The line under the bar: "48 MB of 320 MB · 4.2 MB/s · ~1 min left". */
export function uploadDetail(p: UploadProgress): string {
  if (p.phase === "checking") return "Checking the file…";
  const parts = [`${size(p.loaded)} of ${size(p.total)}`];
  if (p.bytesPerSecond) parts.push(`${size(p.bytesPerSecond)}/s`);
  const left = timeLeft(p.secondsLeft);
  if (left && p.percent < 100) parts.push(left);
  return parts.join(" · ");
}

/** Upload status with a real percentage. `compact` fits small tiles. */
export function UploadProgressView({ progress, compact = false, className }: { progress: UploadProgress | null; compact?: boolean; className?: string }) {
  const checking = progress?.phase === "checking";
  const percent = progress?.phase === "uploading" ? progress.percent : checking ? 100 : 0;
  return (
    <div className={cn("w-full", className)} role="status" aria-live="polite">
      <div className={cn("flex items-center justify-between gap-2 font-medium text-foreground", compact ? "text-[11px]" : "text-sm")}>
        <span className="flex items-center gap-1.5">
          <Loader2 className={cn("animate-spin text-primary", compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
          {checking ? "Checking…" : "Uploading"}
        </span>
        {!checking && <span className="tabular-nums">{percent}%</span>}
      </div>
      <div className={cn("mt-1.5 overflow-hidden rounded-full bg-border/60", compact ? "h-1.5" : "h-2")}>
        <div
          className={cn("h-full rounded-full bg-primary transition-[width] duration-200", checking && "animate-pulse")}
          style={{ width: `${percent}%` }}
        />
      </div>
      {progress &&
        (compact && progress.phase === "uploading" ? (
          // Narrow tiles: sizes on one line, time left on the next (no speed).
          <div className="mt-1 text-[10px] leading-tight text-muted">
            <p className="truncate">
              {size(progress.loaded)} / {size(progress.total)}
            </p>
            {progress.percent < 100 && timeLeft(progress.secondsLeft) && <p className="truncate">{timeLeft(progress.secondsLeft)}</p>}
          </div>
        ) : (
          <p className={cn("mt-1 truncate text-muted", compact ? "text-[10px]" : "text-xs")}>{uploadDetail(progress)}</p>
        ))}
    </div>
  );
}

/** Asks before closing/reloading the tab while an upload is running — it
 * would be lost. */
export function useWarnWhileUploading(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [active]);
}
