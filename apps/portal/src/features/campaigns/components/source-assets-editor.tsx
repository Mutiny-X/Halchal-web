import { useState } from "react";
import { AlertTriangle, CheckCircle2, HardDrive, Loader2, Trash2, Upload, Youtube } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createSourceAsset,
  type SourceAsset,
  type SourceAssetType,
} from "@/features/campaigns/lib/source-assets";
const typeOptions: {
  value: SourceAssetType;
  label: string;
  icon: typeof HardDrive;
}[] = [
  { value: "drive", label: "Drive link", icon: HardDrive },
  { value: "youtube", label: "YouTube link", icon: Youtube },
  { value: "upload", label: "Upload from device", icon: Upload },
];

type UrlCheckState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "ok" }
  | { status: "failed"; reason: string };

type SourceAssetsEditorProps = {
  assets: SourceAsset[];
  onChange: (assets: SourceAsset[]) => void;
  onUploadFile: (file: File) => Promise<string>;
  onCheckUrl: (url: string) => Promise<{ fetchable: boolean; reason?: string }>;
};

export function SourceAssetsEditor({ assets, onChange, onUploadFile, onCheckUrl }: SourceAssetsEditorProps) {
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [urlChecks, setUrlChecks] = useState<Record<string, UrlCheckState>>({});

  const updateAsset = (id: string, patch: Partial<SourceAsset>) => {
    onChange(
      assets.map((asset) => (asset.id === id ? { ...asset, ...patch } : asset)),
    );
  };

  const removeAsset = (id: string) => {
    onChange(assets.filter((asset) => asset.id !== id));
  };

  const addAsset = (type: SourceAssetType) => {
    onChange([...assets, createSourceAsset({ type })]);
  };

  const onSelectFile = async (asset: SourceAsset, file: File | undefined): Promise<void> => {
    if (!file) return;
    setUploadingId(asset.id);
    try {
      const url = await onUploadFile(file);
      updateAsset(asset.id, { url, label: asset.label.trim() ? asset.label : file.name });
    } finally {
      setUploadingId(null);
    }
  };

  const runUrlCheck = async (asset: SourceAsset): Promise<void> => {
    const url = asset.url.trim();
    if (!url) return;
    setUrlChecks((prev) => ({ ...prev, [asset.id]: { status: "checking" } }));
    try {
      const result = await onCheckUrl(url);
      setUrlChecks((prev) => ({
        ...prev,
        [asset.id]: result.fetchable
          ? { status: "ok" }
          : { status: "failed", reason: result.reason ?? "This link can't be downloaded automatically." },
      }));
    } catch {
      setUrlChecks((prev) => ({
        ...prev,
        [asset.id]: { status: "failed", reason: "Couldn't run the check — try again." },
      }));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {typeOptions.map((option) => (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant="outline"
            onClick={() => addAsset(option.value)}
          >
            <option.icon className="mr-1.5 h-3.5 w-3.5" />
            Add {option.label}
          </Button>
        ))}
      </div>

      {assets.length === 0 ? (
        <p className="text-xs text-muted">
          Add Google Drive/YouTube links, or upload a file from this device, as source material for creators.
        </p>
      ) : null}

      {assets.map((asset) => {
        const option = typeOptions.find((o) => o.value === asset.type);
        const Icon = option?.icon ?? HardDrive;
        const isUploading = uploadingId === asset.id;
        return (
          <div
            key={asset.id}
            className="rounded-xl border border-border bg-surface p-3"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Icon className="h-3.5 w-3.5" />
                {option?.label ?? "Link"}
              </span>
              <button
                type="button"
                className="rounded p-1 text-muted hover:bg-surface-variant hover:text-foreground"
                onClick={() => removeAsset(asset.id)}
                aria-label="Remove source asset"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2">
              {asset.type === "upload" ? (
                <div className="space-y-1">
                  <Label className="text-xs text-muted">File</Label>
                  {asset.url ? (
                    <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm">
                      <span className="truncate text-foreground">{asset.label || "Uploaded file"}</span>
                      <label className="shrink-0 cursor-pointer text-xs font-medium text-primary hover:underline">
                        Replace
                        <input
                          type="file"
                          accept="video/*,image/*"
                          className="hidden"
                          disabled={isUploading}
                          onChange={(e) => void onSelectFile(asset, e.target.files?.[0])}
                        />
                      </label>
                    </div>
                  ) : (
                    <label
                      className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-background px-3 py-4 text-sm text-muted hover:bg-surface-variant ${isUploading ? "pointer-events-none opacity-70" : ""}`}
                    >
                      {isUploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      {isUploading ? "Uploading…" : "Choose a video or image file"}
                      <input
                        type="file"
                        accept="video/*,image/*"
                        className="hidden"
                        disabled={isUploading}
                        onChange={(e) => void onSelectFile(asset, e.target.files?.[0])}
                      />
                    </label>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  <Label className="text-xs text-muted">URL</Label>
                  <div className="flex gap-2">
                    <Input
                      value={asset.url}
                      placeholder={
                        asset.type === "youtube"
                          ? "https://youtube.com/..."
                          : "https://drive.google.com/..."
                      }
                      onChange={(e) => {
                        updateAsset(asset.id, { url: e.target.value });
                        setUrlChecks((prev) => ({ ...prev, [asset.id]: { status: "idle" } }));
                      }}
                      onBlur={() => {
                        if (asset.type === "drive") void runUrlCheck(asset);
                      }}
                    />
                    {asset.type === "drive" && asset.url.trim() ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="shrink-0"
                        disabled={urlChecks[asset.id]?.status === "checking"}
                        onClick={() => void runUrlCheck(asset)}
                      >
                        {urlChecks[asset.id]?.status === "checking" ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          "Check link"
                        )}
                      </Button>
                    ) : null}
                  </div>
                  {asset.type === "drive" && urlChecks[asset.id]?.status === "ok" ? (
                    <p className="flex items-center gap-1.5 text-xs text-green-400">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      We can download this video automatically for review.
                    </p>
                  ) : null}
                  {asset.type === "drive" && urlChecks[asset.id]?.status === "failed" ? (
                    <p className="flex items-start gap-1.5 text-xs text-amber-400">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {(urlChecks[asset.id] as { reason: string }).reason}
                    </p>
                  ) : null}
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs text-muted">Label (optional)</Label>
                <Input
                  value={asset.label}
                  onChange={(e) => updateAsset(asset.id, { label: e.target.value })}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
