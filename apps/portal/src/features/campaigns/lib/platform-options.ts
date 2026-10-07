import { Instagram, Twitter, Youtube } from "lucide-react";

/** Platform choices with brand-colored badges — shared between the picker and summary views.
 * `locked` platforms show in the picker but can't be chosen yet. */
export const PLATFORM_OPTIONS = [
  {
    value: "instagram_reel",
    label: "Instagram Reel",
    icon: Instagram,
    badge: "bg-linear-to-br from-fuchsia-500 via-pink-500 to-orange-400",
  },
  {
    value: "instagram_post",
    label: "Instagram Post",
    icon: Instagram,
    badge: "bg-linear-to-br from-fuchsia-500 via-pink-500 to-orange-400",
  },
  { value: "youtube_shorts", label: "YouTube Shorts", icon: Youtube, badge: "bg-red-600", locked: true },
  { value: "twitter_tweet", label: "X (Twitter)", icon: Twitter, badge: "bg-zinc-900", locked: true },
] as const;

export function isPlatformLocked(value: string): boolean {
  return PLATFORM_OPTIONS.some((opt) => opt.value === value && "locked" in opt && opt.locked);
}

export function getPlatformOption(value: string) {
  return PLATFORM_OPTIONS.find((opt) => opt.value === value);
}
