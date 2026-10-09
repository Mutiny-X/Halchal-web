import { ApiError } from "@/lib/api";

/** What to tell someone whose sign-in failed. A block for too many attempts
 * gets its own clear message (with the wait time when the API gives one)
 * instead of looking like a wrong password. */
export function signInErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 429 || err.code === "RATE_LIMITED") {
      return /minute|tomorrow/i.test(err.message)
        ? err.message
        : "Too many attempts. Wait a minute, then try again.";
    }
    if (err.status === undefined) return "Couldn't reach the server. Check your connection and try again.";
    return err.message;
  }
  return "Sign-in failed";
}
