// TikTok integration helpers (server-only).
// Uses the official TikTok for Developers API:
//   - OAuth (client_key / client_secret) to mint app + user access tokens
//   - Research / Display APIs to fetch public metrics for a video URL
//
// IMPORTANT: TikTok's official API does NOT sell followers/likes/views.
// Those deliveries must come from an upstream SMM provider (see providers.server.ts).
// This module is used to:
//   1. Validate that a TikTok link is real before charging an order.
//   2. Capture a baseline "start_count" (likes / views / follower count) so we
//      can measure progress and mark orders complete.
//   3. Power future creator-tools (login with TikTok, post analytics, etc).

const TT_OAUTH = "https://open.tiktokapis.com/v2/oauth/token/";
const TT_VIDEO_QUERY = "https://open.tiktokapis.com/v2/video/query/";
const TT_USER_INFO = "https://open.tiktokapis.com/v2/user/info/";

function creds() {
  const client_key = process.env.TIKTOK_CLIENT_KEY;
  const client_secret = process.env.TIKTOK_CLIENT_SECRET;
  if (!client_key || !client_secret) {
    throw new Error("TikTok not configured: TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET missing");
  }
  return { client_key, client_secret };
}

let cachedAppToken: { token: string; expiresAt: number } | null = null;

/** Mint (and cache) an app-level client_credentials access token. */
export async function getAppAccessToken(): Promise<string> {
  if (cachedAppToken && cachedAppToken.expiresAt > Date.now() + 60_000) {
    return cachedAppToken.token;
  }
  const { client_key, client_secret } = creds();
  const res = await fetch(TT_OAUTH, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_key, client_secret, grant_type: "client_credentials" }),
  });
  const body = await res.json().catch(() => ({} as any));
  if (!res.ok || !body?.access_token) {
    throw new Error(`tiktok oauth failed: ${body?.error ?? res.statusText}`);
  }
  cachedAppToken = {
    token: body.access_token as string,
    expiresAt: Date.now() + Number(body.expires_in ?? 7200) * 1000,
  };
  return cachedAppToken.token;
}

/** Build the OAuth login URL for "Login with TikTok". */
export function buildLoginUrl(redirectUri: string, state: string, scopes = "user.info.basic,video.list") {
  const { client_key } = creds();
  const u = new URL("https://www.tiktok.com/v2/auth/authorize/");
  u.searchParams.set("client_key", client_key);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", scopes);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("state", state);
  return u.toString();
}

/** Exchange an authorization code for a user access token. */
export async function exchangeCode(code: string, redirectUri: string) {
  const { client_key, client_secret } = creds();
  const res = await fetch(TT_OAUTH, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key, client_secret, code, grant_type: "authorization_code", redirect_uri: redirectUri,
    }),
  });
  const body = await res.json().catch(() => ({} as any));
  if (!res.ok || !body?.access_token) throw new Error(`tiktok code exchange failed: ${body?.error_description ?? res.statusText}`);
  return body as {
    access_token: string; refresh_token: string; expires_in: number;
    open_id: string; scope: string; token_type: string;
  };
}

/** Parse a TikTok video URL and extract the numeric video id. */
export function extractVideoId(link: string): string | null {
  // Supported shapes:
  //   https://www.tiktok.com/@user/video/7298765432109876543
  //   https://vm.tiktok.com/XXXX  (short — caller should resolve first)
  const m = link.match(/\/video\/(\d{6,})/);
  return m?.[1] ?? null;
}

/** Fetch public metrics for a TikTok video using the app token. */
export async function getVideoMetrics(videoId: string) {
  const token = await getAppAccessToken();
  const res = await fetch(`${TT_VIDEO_QUERY}?fields=id,like_count,view_count,comment_count,share_count`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ filters: { video_ids: [videoId] } }),
  });
  const body = await res.json().catch(() => ({} as any));
  if (!res.ok) throw new Error(`tiktok video query failed: ${body?.error?.message ?? res.statusText}`);
  const v = body?.data?.videos?.[0];
  if (!v) return null;
  return {
    id: String(v.id),
    likes: Number(v.like_count ?? 0),
    views: Number(v.view_count ?? 0),
    comments: Number(v.comment_count ?? 0),
    shares: Number(v.share_count ?? 0),
  };
}

/** Fetch authenticated user info using a *user* access token (not the app token). */
export async function getUserInfo(userAccessToken: string) {
  const res = await fetch(`${TT_USER_INFO}?fields=open_id,union_id,avatar_url,display_name,follower_count,following_count,likes_count,video_count`, {
    headers: { Authorization: `Bearer ${userAccessToken}` },
  });
  const body = await res.json().catch(() => ({} as any));
  if (!res.ok) throw new Error(`tiktok user info failed: ${body?.error?.message ?? res.statusText}`);
  return body?.data?.user ?? null;
}