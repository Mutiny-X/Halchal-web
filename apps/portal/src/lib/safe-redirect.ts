/** Relative in-app paths only — blocks open redirects. Falls back to the
 * sign-in page, which forwards a signed-in user to their own home.
 *
 * "Starts with one slash" is not enough: browsers read a backslash as a
 * slash, and ignore tabs and newlines inside an address, so "/\evil.com"
 * and "/<tab>/evil.com" both leave the site. Anything with a backslash or a
 * control character is refused, and a path must not resolve to another
 * origin. */
export function safeRedirectPath(next: string | null | undefined): string {
  const fallback = "/login";
  if (!next) return fallback;

  let decoded: string;
  try {
    decoded = decodeURIComponent(next);
  } catch {
    // A malformed %-sequence — never something this app produced.
    return fallback;
  }

  // eslint-disable-next-line no-control-regex
  if (/[\\\u0000-\u001f\u007f]/.test(decoded) || /[\\\u0000-\u001f\u007f]/.test(next)) return fallback;
  if (!decoded.startsWith("/") || decoded.startsWith("//")) return fallback;

  try {
    const base = "https://portal.invalid";
    if (new URL(decoded, base).origin !== base) return fallback;
  } catch {
    return fallback;
  }
  return decoded;
}
