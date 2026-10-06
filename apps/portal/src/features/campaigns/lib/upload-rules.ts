/**
 * Mirrors the API's upload rules (campaigns.controller.ts + file-signature.ts)
 * so people get a clear message before a slow upload, instead of after it.
 * The API still checks every file's real bytes — these are for UX, not
 * security.
 */
const MB = 1024 * 1024;

export const COVER_MAX_BYTES = 10 * MB;
/** Every upload goes straight from the browser to storage (never through
 * the API server) in one request. R2 caps a single upload at 4.995 GiB, so
 * stay safely under it (the API enforces the same limit). */
export const DIRECT_UPLOAD_MAX_BYTES = 4.9 * 1024 * MB;
/** "Upload from device" source files (the API enforces the same limit). */
export const SOURCE_UPLOAD_MAX_BYTES = 3 * 1024 * MB;

export const COVER_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm", "video/x-m4v"];

/** Content type by file extension — browsers (notably Chrome on Windows,
 * which reads it from the registry) often give an empty type for .mov and
 * sometimes .mp4. The API still checks every file's real bytes. */
const EXTENSION_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  mp4: "video/mp4",
  m4v: "video/x-m4v",
  mov: "video/quicktime",
  qt: "video/quicktime",
  webm: "video/webm",
};

/** The file's content type, falling back to its extension when the browser
 * didn't say (or said something generic). */
export function fileContentType(file: Pick<File, "name" | "type">): string {
  const reported = (file.type || "").toLowerCase();
  if (reported && reported !== "application/octet-stream") {
    return reported === "image/jpg" || reported === "image/pjpeg" ? "image/jpeg" : reported;
  }
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  return EXTENSION_TYPES[ext] ?? reported;
}

const extensionsFor = (types: string[]) =>
  Object.entries(EXTENSION_TYPES)
    .filter(([, t]) => types.includes(t))
    .map(([ext]) => `.${ext}`);
// Types AND extensions: a picker filtered by type alone hides files the OS
// has no type for (e.g. .mov on many Windows PCs).
const accept = (types: string[]) => [...types, ...extensionsFor(types)].join(",");
export const COVER_ACCEPT = accept(COVER_TYPES);
export const IMAGE_ACCEPT = accept(IMAGE_TYPES);
export const VIDEO_ACCEPT = accept(VIDEO_TYPES);
export const MEDIA_ACCEPT = accept([...IMAGE_TYPES, ...VIDEO_TYPES]);

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
  if (!COVER_TYPES.includes(fileContentType(file))) return "Cover must be a JPEG, PNG or WebP image.";
  if (file.size > COVER_MAX_BYTES) {
    return `Cover is ${formatBytes(file.size)} — max is ${formatBytes(COVER_MAX_BYTES)}.`;
  }
  return null;
}

/** Sample content / source asset files. `kind` narrows to one media type. */
export function checkMediaFile(file: File, kind?: "image" | "video"): string | null {
  const allowed = kind === "image" ? IMAGE_TYPES : kind === "video" ? VIDEO_TYPES : [...IMAGE_TYPES, ...VIDEO_TYPES];
  if (!allowed.includes(fileContentType(file))) {
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
