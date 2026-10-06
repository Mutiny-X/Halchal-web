/**
 * Mirrors the API's upload rules (campaigns.controller.ts + file-signature.ts)
 * so people get a clear message before a slow upload, instead of after it.
 * The API still checks every file's real bytes — these are for UX, not
 * security.
 */
const MB = 1024 * 1024;

export const COVER_MAX_BYTES = 10 * MB;
/** Every upload goes straight from the browser to storage (never through
 * the API server); this is storage's single-upload ceiling. */
export const DIRECT_UPLOAD_MAX_BYTES = 5 * 1024 * MB;
/** "Upload from device" source files (the API enforces the same limit). */
export const SOURCE_UPLOAD_MAX_BYTES = 3 * 1024 * MB;

export const COVER_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm", "video/x-m4v"];

export const COVER_ACCEPT = COVER_TYPES.join(",");
export const IMAGE_ACCEPT = IMAGE_TYPES.join(",");
export const VIDEO_ACCEPT = VIDEO_TYPES.join(",");
export const MEDIA_ACCEPT = [...IMAGE_TYPES, ...VIDEO_TYPES].join(",");

export function formatBytes(bytes: number): string {
  const mb = bytes / MB;
  if (mb >= 1024) {
    const gb = mb / 1024;
    return `${Number.isInteger(gb) ? gb : gb.toFixed(1)}GB`;
  }
  return `${mb.toFixed(0)}MB`;
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

/** "Upload from device" source files: media types + the 3 GB limit, with a
 * message that says what to do instead. */
export function checkSourceFile(file: File): string | null {
  const typeProblem = checkMediaFile(file);
  if (typeProblem) return typeProblem;
  if (file.size > SOURCE_UPLOAD_MAX_BYTES) {
    return `This file is ${formatBytes(file.size)} — source files can be up to ${formatBytes(SOURCE_UPLOAD_MAX_BYTES)}. Compress it, or add it as a Google Drive link instead.`;
  }
  return null;
}
