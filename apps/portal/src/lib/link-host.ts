/** True when `url` is an https(s) link whose host is `domain` itself or one
 * of its subdomains. Matching the host — not looking for the text anywhere
 * in the address — is what stops "instagram.com.evil.example" or
 * "evil.example/?instagram.com" from being treated as Instagram. */
export function isOnDomain(url: string | URL, ...domains: string[]): boolean {
  let parsed: URL;
  try {
    parsed = typeof url === "string" ? new URL(url.trim()) : url;
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
  const host = parsed.hostname.toLowerCase();
  return domains.some((d) => host === d || host.endsWith(`.${d}`));
}
