import type { InsightContentKind, InsightKeyValue, InstagramAccountInsights } from "@/lib/api";

type Post = InstagramAccountInsights["content"]["posts"][number];

const FORMAT_LABEL: Record<string, string> = {
  REEL: "Reels",
  POST: "Feed posts",
  STORY: "Stories",
  CAROUSEL_CONTAINER: "Carousel posts",
  AD: "Ads",
  IGTV: "Videos",
  LIVE: "Live",
};
const GENDER_LABEL: Record<string, string> = { M: "Male", F: "Female", U: "Unknown" };
const FOLLOW_TYPE_LABEL: Record<string, string> = { FOLLOWER: "Followers", NON_FOLLOWER: "Non-followers", UNKNOWN: "Unknown" };
const KIND_LABEL: Record<InsightContentKind, string> = {
  reel: "Reels",
  carousel: "Carousels",
  photo: "Photos",
  video: "Videos",
  story: "Stories",
};

let regionNames: Intl.DisplayNames | null = null;
function countryName(code: string): string {
  try {
    regionNames ??= new Intl.DisplayNames(["en"], { type: "region" });
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

function titleCase(key: string): string {
  return key.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatLabel(key: string): string {
  return FORMAT_LABEL[key] ?? titleCase(key);
}
export function genderLabel(key: string): string {
  return GENDER_LABEL[key] ?? key;
}
export function followTypeLabel(key: string): string {
  return FOLLOW_TYPE_LABEL[key] ?? titleCase(key);
}
export function kindLabel(kind: InsightContentKind): string {
  return KIND_LABEL[kind];
}
export { countryName };
export function contactButtonLabel(key: string): string {
  return titleCase(key);
}

/** Rows relabelled, with each row's share of the total (0–100, one decimal). */
export function withShares(
  rows: InsightKeyValue[] | null | undefined,
  label: (key: string) => string = (k) => k,
): Array<{ key: string; label: string; value: number; share: number }> {
  if (!rows?.length) return [];
  const total = rows.reduce((s, r) => s + r.value, 0);
  return rows.map((r) => ({
    key: r.key,
    label: label(r.key),
    value: r.value,
    share: total > 0 ? Math.round((r.value / total) * 1000) / 10 : 0,
  }));
}

/** Ages in their natural order (13-17 … 65+), not by size. */
export function sortAges(rows: InsightKeyValue[] | null | undefined): InsightKeyValue[] {
  const start = (k: string) => Number.parseInt(k, 10) || 999;
  return [...(rows ?? [])].sort((a, b) => start(a.key) - start(b.key));
}

export function percent(part: number | null | undefined, whole: number | null | undefined): number | null {
  if (part == null || !whole) return null;
  return Math.round((part / whole) * 10000) / 100;
}

export function compactNumber(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

/** One sentence that sums the period up, like a person would. */
export function summarySentence(r: InstagramAccountInsights): string | null {
  const { reach, accountsEngaged } = r.overview.totals;
  if (reach == null) return null;
  const parts = [`In the last ${r.period.days} days this creator's content reached ${reach.toLocaleString("en-IN")} accounts`];
  if (accountsEngaged != null) {
    parts[0] += `, and ${accountsEngaged.toLocaleString("en-IN")} of them interacted (${percent(accountsEngaged, reach) ?? 0}%)`;
  }
  const country = r.audience.followers.country?.[0];
  const age = r.audience.followers.age?.[0];
  if (country || age) {
    parts.push(
      `Most followers are${country ? ` in ${countryName(country.key)}` : ""}${country && age ? "," : ""}${age ? ` aged ${age.key}` : ""}`,
    );
  }
  return `${parts.join(". ")}.`;
}

function score(p: Post): number {
  return p.metrics.totalInteractions ?? p.metrics.reach ?? p.metrics.views ?? 0;
}

/** Strongest posts of each kind, ranked by interactions (reach, then views,
 * where Meta withholds interactions). */
export function topPostsByKind(posts: Post[], perKind = 3): Array<{ kind: InsightContentKind; posts: Post[] }> {
  const order: InsightContentKind[] = ["reel", "carousel", "photo", "video"];
  return order
    .map((kind) => ({
      kind,
      posts: posts
        .filter((p) => p.kind === kind)
        .sort((a, b) => score(b) - score(a))
        .slice(0, perKind),
    }))
    .filter((g) => g.posts.length > 0);
}

const SECTION_TITLE: Record<string, string> = {
  totals: "30-day totals",
  views_by_format: "Views by format",
  reach_by_format: "Reach by format",
  reach_by_follow_type: "Reach from followers vs non-followers",
  follows: "Follows and unfollows",
  profile_link_taps: "Profile link taps",
  follower_growth: "Follower growth",
  content: "Posts",
  post_insights: "Per-post insights",
};
export function unavailableTitle(section: string): string {
  if (SECTION_TITLE[section]) return SECTION_TITLE[section];
  const [audience, dim] = section.split("_");
  if (audience === "followers" || audience === "engaged") {
    return `${audience === "followers" ? "Follower" : "Engaged audience"} ${dim}`;
  }
  return titleCase(section);
}

export function timeAgo(iso: string, now = Date.now()): string {
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

export function watchTime(ms: number | undefined): string | null {
  if (ms == null) return null;
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}
