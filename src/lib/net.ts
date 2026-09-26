/** Shared network guards for the two routes that fetch user-supplied URLs. */

const PRIVATE_HOST =
  /^(localhost$|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$|.*\.local$)/i;

export class UnsafeUrlError extends Error {}

/**
 * Only allow public http(s) URLs. Without this, a pasted URL could be used to
 * probe our own localhost or a cloud metadata endpoint.
 */
export function assertPublicHttpUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("That isn't a valid URL.");
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new UnsafeUrlError("Only http(s) URLs are supported.");
  }
  if (PRIVATE_HOST.test(url.hostname)) {
    throw new UnsafeUrlError("That host isn't allowed.");
  }
  return url;
}

/** Headers that make us look like a browser. Enough for ordinary storefronts. */
export const BROWSER_HEADERS: Record<string, string> = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
  "upgrade-insecure-requests": "1",
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "none",
};

/**
 * Recognise an enterprise bot-blocker so we can tell the user the truth instead
 * of surfacing a bare status code that reads like our own bug.
 *
 * These systems (Akamai, Cloudflare, PerimeterX, DataDome) fingerprint TLS and
 * require JS-challenge cookies. No amount of header spoofing gets a plain
 * server-side fetch through, so the honest move is to stop trying and route the
 * user to the upload path instead.
 */
export function detectBotWall(
  status: number,
  headers: Headers,
  body: string
): string | null {
  const server = (headers.get("server") ?? "").toLowerCase();
  const blocked = status === 403 || status === 400 || status === 401 || status === 429;
  if (!blocked) return null;

  if (server.includes("akamai") || /errors\.edgesuite\.net/i.test(body)) {
    return "Akamai";
  }
  if (server.includes("cloudflare") || /cf-mitigated|attention required/i.test(body)) {
    return "Cloudflare";
  }
  if (headers.get("x-datadome") || /datadome/i.test(body)) return "DataDome";
  if (/perimeterx|px-captcha|_px2/i.test(body)) return "PerimeterX";
  if (/access denied|bot detection|are you a robot/i.test(body)) return "bot protection";

  return blocked ? "bot protection" : null;
}
