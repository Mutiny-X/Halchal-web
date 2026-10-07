export type SourceAssetType = "drive" | "youtube" | "upload";

export type SourceAsset = {
  id: string;
  type: SourceAssetType;
  url: string;
  label: string;
};

export function inferSourceAssetType(url: string): SourceAssetType {
  const lower = url.trim().toLowerCase();
  if (
    lower.includes("youtube.com") ||
    lower.includes("youtu.be")
  ) {
    return "youtube";
  }
  return "drive";
}

export function createSourceAsset(
  partial?: Partial<Pick<SourceAsset, "type" | "url" | "label">>,
): SourceAsset {
  return {
    id: crypto.randomUUID(),
    type: partial?.type ?? "drive",
    url: partial?.url ?? "",
    label: partial?.label ?? "",
  };
}

export function toApiSourceAssets(assets: SourceAsset[]) {
  return assets
    .map((asset) => ({
      type: asset.type,
      url: asset.url.trim(),
      label: asset.label.trim() || undefined,
    }))
    .filter((asset) => asset.url.length > 0);
}
