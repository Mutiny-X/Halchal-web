import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Banknote, Download, FileSpreadsheet, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toaster";
import { formatDate } from "@/features/campaigns/lib/campaign-board-data";
import {
  adminApi,
  ApiError,
  downloadBlob,
  type AdminWithdrawal,
  type WithdrawalImportResult,
  type WithdrawalStatus,
} from "@/lib/api";
import { formatInr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";

type FilterKey = "all" | WithdrawalStatus;

const FILTERS: { value: FilterKey; label: string }[] = [
  { value: "pending", label: "Requested" },
  { value: "processing", label: "Sent to accounts" },
  { value: "completed", label: "Paid" },
  { value: "failed", label: "Failed" },
  { value: "all", label: "All" },
];

const STATUS_LABEL: Record<WithdrawalStatus, string> = {
  pending: "REQUESTED",
  processing: "SENT TO ACCOUNTS",
  completed: "PAID",
  failed: "FAILED",
};

const STATUS_STYLE: Record<WithdrawalStatus, string> = {
  pending: "bg-warning/15 text-warning",
  processing: "bg-primary/15 text-primary",
  completed: "bg-money/15 text-money",
  failed: "bg-destructive/15 text-destructive",
};

function StatusBadge({ status }: { status: WithdrawalStatus }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide",
        STATUS_STYLE[status],
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

type RowAction = { kind: "paid" | "failed"; withdrawal: AdminWithdrawal };

export function AdminPayoutsPage() {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);

  const [filter, setFilter] = useState<FilterKey>("pending");
  const [confirmExport, setConfirmExport] = useState(false);
  const [rowAction, setRowAction] = useState<RowAction | null>(null);
  const [utr, setUtr] = useState("");
  const [reason, setReason] = useState("");
  const [importResult, setImportResult] = useState<WithdrawalImportResult | null>(null);

  const list = useInfiniteQuery({
    queryKey: ["admin-withdrawals", filter],
    queryFn: ({ pageParam }) =>
      adminApi.withdrawals(getToken()!, {
        status: filter === "all" ? undefined : filter,
        cursor: pageParam,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: Boolean(getToken()),
  });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["admin-withdrawals"] });
  }

  const counts = list.data?.pages[0]?.counts;
  const pendingCount = counts?.pending.count ?? 0;
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];

  const exportMutation = useMutation({
    mutationFn: () => adminApi.exportWithdrawals(getToken()!),
    onSuccess: (blob) => {
      downloadBlob(blob, `halchal-payments-${todayStamp()}.xlsx`);
      setConfirmExport(false);
      refresh();
      toast("Payment sheet downloaded — those requests are now marked as sent to accounts");
    },
    onError: (err) => {
      setConfirmExport(false);
      toast(err instanceof ApiError ? err.message : "Couldn't build the payment sheet", "error");
      refresh();
    },
  });

  const redownloadMutation = useMutation({
    mutationFn: (batchId: string) => adminApi.downloadWithdrawalBatch(getToken()!, batchId),
    onSuccess: (blob, batchId) => {
      downloadBlob(blob, `halchal-payments-batch-${batchId.slice(-6)}.xlsx`);
      toast("Sheet downloaded");
    },
    onError: (err) => toast(err instanceof ApiError ? err.message : "Couldn't download the sheet", "error"),
  });

  const paidMutation = useMutation({
    mutationFn: (v: { id: string; utr: string }) => adminApi.markWithdrawalPaid(getToken()!, v.id, v.utr),
    onSuccess: () => {
      closeRowAction();
      refresh();
      toast("Marked as paid — the creator has been notified");
    },
    onError: (err) => toast(err instanceof ApiError ? err.message : "Couldn't mark as paid", "error"),
  });

  const failedMutation = useMutation({
    mutationFn: (v: { id: string; reason: string }) => adminApi.markWithdrawalFailed(getToken()!, v.id, v.reason),
    onSuccess: () => {
      closeRowAction();
      refresh();
      toast("Marked as failed — the amount was returned to the creator's wallet");
    },
    onError: (err) => toast(err instanceof ApiError ? err.message : "Couldn't mark as failed", "error"),
  });

  const importMutation = useMutation({
    mutationFn: (file: File) => adminApi.importWithdrawalResults(getToken()!, file),
    onSuccess: (result) => {
      setImportResult(result);
      refresh();
    },
    onError: (err) => toast(err instanceof ApiError ? err.message : "Couldn't read that file", "error"),
  });

  function closeRowAction() {
    setRowAction(null);
    setUtr("");
    setReason("");
  }

  function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again
    if (file) importMutation.mutate(file);
  }

  const busy =
    exportMutation.isPending || paidMutation.isPending || failedMutation.isPending || importMutation.isPending;

  if (list.isPending) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[84px] w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (list.isError) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 text-center">
        <p className="font-medium">Couldn't load withdrawals</p>
        <p className="mt-1 text-sm text-muted">
          {list.error instanceof ApiError ? list.error.message : "Something went wrong."}
        </p>
        <Button className="mt-4" variant="outline" onClick={() => void list.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const summary: { key: WithdrawalStatus; label: string; hint: string }[] = [
    { key: "pending", label: "Requested", hint: "Not yet on a sheet" },
    { key: "processing", label: "Sent to accounts", hint: "Waiting to be paid" },
    { key: "completed", label: "Paid", hint: "All time" },
    { key: "failed", label: "Failed", hint: "Refunded to wallet" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Payouts</h1>
          <p className="mt-1 text-sm text-muted">
            Creator withdrawal requests. Download the payment sheet for the accounts team, then record the results.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInput}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={onFilePicked}
            data-testid="import-file"
          />
          <Button variant="outline" disabled={busy} onClick={() => fileInput.current?.click()}>
            <Upload className="h-4 w-4" />
            {importMutation.isPending ? "Reading…" : "Upload returned sheet"}
          </Button>
          <Button disabled={busy || pendingCount === 0} onClick={() => setConfirmExport(true)}>
            <Download className="h-4 w-4" />
            Download payment sheet{pendingCount > 0 ? ` (${pendingCount})` : ""}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summary.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setFilter(s.key)}
            className={cn(
              "rounded-2xl border bg-surface p-4 text-left transition-colors hover:bg-surface-variant/40",
              filter === s.key ? "border-primary" : "border-border",
            )}
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">{s.label}</p>
            <p className="mt-1.5 text-2xl font-black tabular-nums">{counts?.[s.key].count ?? 0}</p>
            <p className="mt-0.5 text-xs text-muted">
              {formatInr(counts?.[s.key].netPaise ?? 0)} · {s.hint}
            </p>
          </button>
        ))}
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-muted">
        <FileSpreadsheet className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p>
          <span className="font-medium text-foreground">How it works:</span> download the sheet (new requests move to
          "Sent to accounts") → accounts pays within about 7 days → mark each row paid with its UTR, or upload the
          returned sheet to do it in bulk. A failed payment is refunded to the creator automatically. The sheet contains
          full bank details — don't email it, and delete it once the batch is paid.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
              filter === f.value
                ? "bg-primary text-primary-foreground"
                : "bg-surface-variant text-muted hover:text-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-surface py-16 text-center">
          <Banknote className="h-8 w-8 text-muted/30" />
          <p className="mt-3 font-medium">Nothing here</p>
          <p className="mt-1 text-sm text-muted">Withdrawal requests from creators will show up here.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="divide-y divide-border/60">
            {items.map((w) => {
              const open = w.status === "pending" || w.status === "processing";
              return (
                <div key={w.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4">
                  <div className="min-w-0 flex-1 basis-56">
                    <Link
                      to={`/admin/clippers/${w.creator.id}`}
                      className="truncate text-sm font-semibold text-foreground hover:underline"
                    >
                      {w.creator.name}
                    </Link>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {w.method.label ?? "—"} {w.method.accountMasked ?? ""} · requested {formatDate(w.createdAt)}
                    </p>
                    {w.status === "completed" && w.utr && (
                      <p className="mt-0.5 truncate text-xs text-muted">
                        UTR {w.utr}
                        {w.processedAt ? ` · paid ${formatDate(w.processedAt)}` : ""}
                      </p>
                    )}
                    {w.status === "failed" && w.failureReason && (
                      <p className="mt-0.5 truncate text-xs text-destructive">{w.failureReason}</p>
                    )}
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums">{formatInr(w.netPaise)}</p>
                    <p className="text-[11px] text-muted">
                      {formatInr(w.amountPaise)} − {formatInr(w.feePaise)} fee
                    </p>
                  </div>

                  <StatusBadge status={w.status} />

                  <div className="flex shrink-0 items-center gap-2">
                    {w.batchId && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={redownloadMutation.isPending}
                        onClick={() => redownloadMutation.mutate(w.batchId!)}
                        title="Download this row's batch sheet again"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Sheet
                      </Button>
                    )}
                    {open && (
                      <>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => setRowAction({ kind: "paid", withdrawal: w })}>
                          Mark paid
                        </Button>
                        <Button size="sm" variant="ghost" disabled={busy} onClick={() => setRowAction({ kind: "failed", withdrawal: w })}>
                          Mark failed
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {list.hasNextPage && (
            <div className="border-t border-border/60 p-3 text-center">
              <Button variant="ghost" size="sm" disabled={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>
                {list.isFetchingNextPage ? "Loading…" : "Load more"}
              </Button>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmExport}
        title="Download the payment sheet?"
        description={`This puts ${pendingCount} request${pendingCount === 1 ? "" : "s"} (${formatInr(counts?.pending.netPaise ?? 0)}) on a sheet for the accounts team and marks them as sent to accounts. The sheet contains full bank details.`}
        confirmLabel="Download"
        loading={exportMutation.isPending}
        onCancel={() => setConfirmExport(false)}
        onConfirm={() => exportMutation.mutate()}
      />

      <ConfirmDialog
        open={rowAction?.kind === "paid"}
        title="Mark as paid?"
        description={
          rowAction
            ? `Confirm ${formatInr(rowAction.withdrawal.netPaise)} was sent to ${rowAction.withdrawal.creator.name}. They'll be notified.`
            : ""
        }
        confirmLabel="Mark paid"
        loading={paidMutation.isPending}
        confirmDisabled={utr.trim().length < 3}
        onCancel={closeRowAction}
        onConfirm={() => rowAction && paidMutation.mutate({ id: rowAction.withdrawal.id, utr: utr.trim() })}
      >
        <Input
          autoFocus
          placeholder="UTR / bank reference"
          value={utr}
          maxLength={64}
          onChange={(e) => setUtr(e.target.value)}
          className="mt-3"
        />
      </ConfirmDialog>

      <ConfirmDialog
        open={rowAction?.kind === "failed"}
        title="Mark as failed?"
        description={
          rowAction
            ? `${formatInr(rowAction.withdrawal.amountPaise)} (including the fee) goes back to ${rowAction.withdrawal.creator.name}'s wallet, and they're told why.`
            : ""
        }
        confirmLabel="Mark failed"
        variant="destructive"
        loading={failedMutation.isPending}
        confirmDisabled={reason.trim().length < 3}
        onCancel={closeRowAction}
        onConfirm={() => rowAction && failedMutation.mutate({ id: rowAction.withdrawal.id, reason: reason.trim() })}
      >
        <Input
          autoFocus
          placeholder="Why couldn't it be paid? (e.g. account closed)"
          value={reason}
          maxLength={300}
          onChange={(e) => setReason(e.target.value)}
          className="mt-3"
        />
      </ConfirmDialog>

      <ConfirmDialog
        open={importResult !== null}
        title="Returned sheet processed"
        description={
          importResult
            ? `${importResult.summary.paid} paid · ${importResult.summary.failed} failed and refunded · ${importResult.summary.skipped} left blank · ${importResult.summary.errors} need attention`
            : ""
        }
        confirmLabel="Done"
        cancelLabel="Close"
        onCancel={() => setImportResult(null)}
        onConfirm={() => setImportResult(null)}
      >
        {importResult && importResult.summary.errors > 0 && (
          <ul className="mt-3 max-h-56 space-y-1.5 overflow-y-auto rounded-xl bg-surface-variant/50 p-3 text-xs">
            {importResult.results
              .filter((r) => r.result === "error")
              .map((r) => (
                <li key={`${r.row}-${r.withdrawalId}`}>
                  <span className="font-semibold">Row {r.row}</span> — {r.message}
                </li>
              ))}
          </ul>
        )}
      </ConfirmDialog>
    </div>
  );
}
