import { env } from "./config/env";

/**
 * Fire-and-forget: push a server-side event to a connected mobile user.
 *
 * The WS server must have WS_NOTIFY_SECRET set to the same value as
 * WS_NOTIFY_SECRET in hotelmedia/.env, and WS_INTERNAL_URL pointing to the
 * ws-server (default http://localhost:3001).
 *
 * type is one of:
 *   profile_posts_changed   – refetch user's own posts/reels
 *   profile_reels_changed   – refetch user's own reels
 *   profile_reviews_changed – refetch user's own reviews
 */
export function notifyUser(userId: string, type: string): void {
  const secret = env.WS_NOTIFY_SECRET;
  const url = (env.WS_INTERNAL_URL ?? "http://localhost:3001") + "/notify";
  if (!secret) return; // not configured — silent no-op

  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-notify-secret": secret,
    },
    body: JSON.stringify({ userId, type }),
  }).catch(() => {
    // Non-fatal — WS server may not be running in dev
  });
}
