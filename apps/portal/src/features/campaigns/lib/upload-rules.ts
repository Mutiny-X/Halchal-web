/**
 * Mirrors the API's upload rules (campaigns.controller.ts + file-signature.ts)
 * so people get a clear message before a slow upload, instead of after it.
 * The API still checks every file's real bytes — these are for UX, not
 * security.
 */
const MB = 1024 * 1024;

export const COVER_MAX_BYTES = 10 * MB;
/** At or under this, files go through the API (which checks the real file
 * type and that videos play). Above it, straight to storage. */
export const BUFFERED_UPLOAD_MAX_BYTES = 100 * MB;
/** Storage's single-upload ceiling for the direct path. */
export const DIRECT_UPLOAD_MAX_BYTES = 5 * 1024 * MB;

export const COVER_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm", "video/x-m4v"];

export const COVER_ACCEPT = COVER_TYPES.join(",");
export const IMAGE_ACCEPT = IMAGE_TYPES.join(",");
export const VIDEO_ACCEPT = VIDEO_TYPES.join(",");
export const MEDIA_ACCEPT = [...IMAGE_TYPES, ...VIDEO_TYPES].join(",");

export function formatBytes(bytes: number): string {
  const mb = bytes / MB;
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)}GB` : `${mb.toFixed(0)}MB`;
}

/** Returns a user-facing error, or null if the file may be uploaded. */
export function checkCoverFile(file: File): string | null {
  if (!COVER_TYPES.includes(file.type)) return "Cover must be a JPEG, PNG or WebP image.";
  if (file.size > COVER_MAX_BYTES) {
    return `Cover is ${formatBytes(file.size)} — max is ${formatBytes(COVER_MAX_BYTES)}.`;
  }
  return null;
}

/** Sample content / source asset files. `kind` narrows to one media type. */
export function checkMediaFile(file: File, kind?: "image" | "video"): string | null {
  const allowed = kind === "image" ? IMAGE_TYPES : kind === "video" ? VIDEO_TYPES : [...IMAGE_TYPES, ...VIDEO_TYPES];
  if (!allowed.includes(file.type)) {
    return kind === "image"
      ? "Images must be JPEG, PNG, WebP or GIF."
      : kind === "video"
        ? "Videos must be MP4, MOV or WebM."
        : "Files must be JPEG, PNG, WebP, GIF, MP4, MOV or WebM.";
  }
  if (file.size > DIRECT_UPLOAD_MAX_BYTES) {
    return `File is ${formatBytes(file.size)} — max is ${formatBytes(DIRECT_UPLOAD_MAX_BYTES)}.`;
  }
  return null;
}

/** Whether a file takes the direct-to-storage path instead of the API. */
export function usesDirectUpload(file: File): boolean {
  return file.size > BUFFERED_UPLOAD_MAX_BYTES;
}
