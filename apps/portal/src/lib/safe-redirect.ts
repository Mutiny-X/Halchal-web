/** Relative in-app paths only — blocks open redirects. Falls back to the
 * sign-in page, which forwards a signed-in user to their own home. */
export function safeRedirectPath(next: string | null | undefined): string {
  if (!next) return "/login";
  const decoded = decodeURIComponent(next);
  if (!decoded.startsWith("/") || decoded.startsWith("//")) {
    return "/login";
  }
  return decoded;
}
