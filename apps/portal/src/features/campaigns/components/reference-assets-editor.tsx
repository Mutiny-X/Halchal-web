import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Image, Loader2, PlayCircle, Trash2, Upload, Video, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  createReferenceAsset,
  type ReferenceAsset,
  type ReferenceAssetType,
} from "@/features/campaigns/lib/reference-assets";
import { resolveMediaUrl } from "@/lib/media-url";
import { cn } from "@/lib/utils";

const typeOptions: {
  value: ReferenceAssetType;
  label: string;
  icon: typeof Image;
}[] = [
  { value: "image", label: "Image (Post format)", icon: Image },
  { value: "video", label: "Video (Reel format)", icon: Video },
];

type ReferenceAssetsEditorProps = {
  assets: ReferenceAsset[];
  onChange: (assets: ReferenceAsset[]) => void;
  onUploadFile: (file: File, type: "image" | "video") => Promise<string>;
};

export function ReferenceAssetsEditor({
  assets,
  onChange,
  onUploadFile,
}: ReferenceAssetsEditorProps) {
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [previewAsset, setPreviewAsset] = useState<ReferenceAsset | null>(null);

  const updateAsset = (id: string, patch: Partial<ReferenceAsset>) => {
    onChange(
      assets.map((asset) => (asset.id === id ? { ...asset, ...patch } : asset)),
    );
  };

  const removeAsset = (id: string) => {
    onChange(assets.filter((asset) => asset.id !== id));
  };

  const addAsset = (type: ReferenceAssetType) => {
    onChange([...assets, createReferenceAsset({ type })]);
  };

  const onSelectFile = async (
    asset: ReferenceAsset,
    file: File | undefined,
  ): Promise<void> => {
    if (!file) return;
    setUploadingId(asset.id);
    try {
      const uploadedUrl = await onUploadFile(file, asset.type);
      updateAsset(asset.id, {
        url: uploadedUrl,
        label: asset.label.trim() ? asset.label : file.name,
      });
    } finally {
      setUploadingId(null);
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
        <div className="rounded-xl border border-dashed border-border bg-surface-variant/30 px-4 py-6 text-center text-sm text-muted">
          Upload sample images (post format) or videos (reel format) for creators.
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {assets.map((asset) => {
            const option = typeOptions.find((o) => o.value === asset.type);
            const isUploading = uploadingId === asset.id;
            return (
              <li
                key={asset.id}
                className="group relative overflow-hidden rounded-xl border border-border bg-surface"
              >
                <div className="relative aspect-square w-full bg-surface-variant/40">
                  {asset.url ? (
                    <button
                      type="button"
                      onClick={() => setPreviewAsset(asset)}
                      className="block h-full w-full"
                      aria-label="Open preview"
                    >
                      {asset.type === "image" ? (
                        <img
                          src={resolveMediaUrl(asset.url)}
                          alt={asset.label || "Sample preview"}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <video
                          src={resolveMediaUrl(asset.url)}
                          muted
                          preload="metadata"
                          className="h-full w-full object-cover"
                        />
                      )}
                      {asset.type === "video" ? (
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/10">
                          <PlayCircle className="h-9 w-9 text-white drop-shadow" />
                        </div>
                      ) : null}
                    </button>
                  ) : (
                    <label
                      className={cn(
                        "flex h-full w-full cursor-pointer flex-col items-center justify-center gap-1.5 text-muted hover:bg-surface-variant",
                        isUploading && "pointer-events-none opacity-70",
                      )}
                    >
                      {isUploading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Upload className="h-5 w-5" />
                      )}
                      <span className="px-2 text-center text-[11px]">
                        {isUploading ? "Uploading..." : "Choose file"}
                      </span>
                      <input
                        type="file"
                        accept={asset.type === "image" ? "image/*" : "video/*"}
                        className="hidden"
                        disabled={isUploading}
                        onChange={(e) =>
                          void onSelectFile(asset, e.target.files?.[0])
                        }
                      />
                    </label>
                  )}

                  {asset.url ? (
                    <label
                      className="absolute left-1.5 top-1.5 cursor-pointer rounded-full bg-black/55 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      aria-label="Replace file"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      <input
                        type="file"
                        accept={asset.type === "image" ? "image/*" : "video/*"}
                        className="hidden"
                        disabled={isUploading}
                        onChange={(e) =>
                          void onSelectFile(asset, e.target.files?.[0])
                        }
                      />
                    </label>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => removeAsset(asset.id)}
                    className="absolute right-1.5 top-1.5 rounded-full bg-black/55 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label="Remove asset"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="space-y-1 p-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                    {option?.label ?? asset.type}
                  </span>
                  <Input
                    value={asset.label}
                    placeholder="Label (optional)"
                    className="h-7 text-xs"
                    onChange={(e) =>
                      updateAsset(asset.id, { label: e.target.value })
                    }
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {previewAsset ? (
        <MediaPreviewLightbox
          asset={previewAsset}
          onClose={() => setPreviewAsset(null)}
        />
      ) : null}
    </div>
  );
}

export function MediaPreviewLightbox({
  asset,
  onClose,
}: {
  asset: ReferenceAsset;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (!asset.url) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/80"
        aria-label="Close preview"
        onClick={onClose}
      />
      <div className="relative max-h-[85vh] max-w-3xl">
        {asset.type === "image" ? (
          <img
            src={resolveMediaUrl(asset.url)}
            alt={asset.label || "Sample preview"}
            className="max-h-[85vh] max-w-full rounded-lg object-contain"
          />
        ) : (
          <video
            src={resolveMediaUrl(asset.url)}
            controls
            autoPlay
            className="max-h-[85vh] max-w-full rounded-lg object-contain"
          />
        )}
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-3 -right-3 rounded-full bg-black/70 p-1.5 text-white hover:bg-black"
          aria-label="Close preview"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>,
    document.body,
  );
}
