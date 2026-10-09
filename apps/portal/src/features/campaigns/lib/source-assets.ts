import { isOnDomain } from "@/lib/link-host";
export type SourceAssetType = "drive" | "youtube" | "upload";

export type SourceAsset = {
  id: string;
  type: SourceAssetType;
  url: string;
  label: string;
};

export function inferSourceAssetType(url: string): SourceAssetType {
  return isOnDomain(url, "youtube.com", "youtu.be") ? "youtube" : "drive";
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

const DRIVE_HOSTS = ["drive.google.com", "docs.google.com"];
const YOUTUBE_HOSTS = ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"];

/** Mirrors the API's asset-url-rules: a link must point where its type
 * says. Returns a message to show under the field, or null when fine. */
export function sourceLinkProblem(type: SourceAssetType, raw: string): string | null {
  const value = raw.trim();
  if (!value || type === "upload") return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "Enter the full link, starting with https://";
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return "Enter the full link, starting with https://";
  }
  const host = url.hostname.toLowerCase();
  if (type === "drive" && !DRIVE_HOSTS.includes(host)) {
    return "This must be a Google Drive link (https://drive.google.com/...)";
  }
  if (type === "youtube" && !YOUTUBE_HOSTS.includes(host)) {
    return "This must be a YouTube link (youtube.com or youtu.be)";
  }
  return null;
}
