import { NextResponse } from "next/server";
import {
  assertPublicHttpUrl,
  BROWSER_HEADERS,
  detectBotWall,
  UnsafeUrlError,
} from "@/lib/net";

/**
 * Resolve a pasted link into a garment image.
 *
 * Accepts either a product page (we read its og:image) or a direct image URL.
 *
 * Reality check: large retailers — Lululemon, Nike, Zara, Uniqlo, H&M — sit
 * behind Akamai/Cloudflare bot protection that fingerprints TLS and demands
 * JS-challenge cookies. A server-side fetch cannot pass, no matter the headers.
 * Shopify-backed stores generally work fine. So when we hit a wall we say so
 * plainly and point the user at the upload path, rather than returning a bare
 * status code that reads like our own bug.
 */
export const runtime = "nodejs";
export const maxDuration = 20;

function firstMatch(html: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = re.exec(html);
    if (m?.[1]) return m[1];
  }
  return null;
}

export async function GET(request: Request) {
  const target = new URL(request.url).searchParams.get("url");
  if (!target) {
    return NextResponse.json({ error: "Missing ?url=" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = assertPublicHttpUrl(target);
  } catch (err) {
    const message =
      err instanceof UnsafeUrlError ? err.message : "That isn't a valid URL.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const res = await fetch(parsed, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(12_000),
    });

    const contentType = res.headers.get("content-type") ?? "";

    // Someone pasted a direct image link — the reliable path on blocked stores.
    if (res.ok && contentType.startsWith("image/")) {
      return NextResponse.json({
        image: parsed.toString(),
        title: decodeURIComponent(parsed.pathname.split("/").pop() ?? "Pasted image"),
        source: parsed.hostname,
        direct: true,
      });
    }

    const body = await res.text();

    if (!res.ok) {
      const wall = detectBotWall(res.status, res.headers, body.slice(0, 4000));
      if (wall) {
        return NextResponse.json(
          {
            error: `${parsed.hostname} blocks automated requests (${wall}). This isn't something we can work around.`,
            hint: "Right-click the product photo, choose “Copy image address”, and paste that instead — or use “Upload garment image”.",
            blocked: true,
          },
          { status: 422 }
        );
      }
      return NextResponse.json(
        { error: `${parsed.hostname} returned ${res.status}.` },
        { status: 502 }
      );
    }

    const html = body.slice(0, 400_000);

    const rawImage = firstMatch(html, [
      /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    ]);

    if (!rawImage) {
      return NextResponse.json(
        {
          error: `No product image found on that ${parsed.hostname} page.`,
          hint: "The page may build its images with JavaScript. Right-click the photo, choose “Copy image address”, and paste that instead.",
        },
        { status: 422 }
      );
    }

    let image: string;
    try {
      image = new URL(rawImage, parsed.toString()).toString();
    } catch {
      return NextResponse.json(
        { error: "Found an image reference we couldn't resolve." },
        { status: 422 }
      );
    }

    const rawTitle = firstMatch(html, [
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
      /<title[^>]*>([^<]+)<\/title>/i,
    ]);

    return NextResponse.json({
      image,
      title: rawTitle?.trim().slice(0, 120) ?? "Pasted product",
      source: parsed.hostname,
      direct: false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      {
        error: `Couldn't reach ${parsed.hostname}: ${message}`,
        hint: "Try “Upload garment image” instead.",
      },
      { status: 502 }
    );
  }
}
