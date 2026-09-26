import { NextResponse } from "next/server";

/**
 * Pull the main product image out of any store's product page via Open Graph
 * tags. This is the feature that turns the demo from "cool tech" into "this is
 * a product" — you can paste a real Uniqlo/Zara URL on stage and try it on.
 */
export const runtime = "nodejs";
export const maxDuration = 20;

function absolutize(src: string, base: string): string | null {
  try {
    return new URL(src, base).toString();
  } catch {
    return null;
  }
}

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

  let parsedTarget: URL;
  try {
    parsedTarget = new URL(target);
  } catch {
    return NextResponse.json({ error: "That isn't a valid URL." }, { status: 400 });
  }
  // Only fetch public web pages — don't let this be used to probe localhost or
  // a cloud metadata endpoint.
  if (!["http:", "https:"].includes(parsedTarget.protocol)) {
    return NextResponse.json({ error: "Only http(s) URLs." }, { status: 400 });
  }
  if (/^(localhost$|127\.|10\.|192\.168\.|169\.254\.|\[?::1\]?$)/i.test(parsedTarget.hostname)) {
    return NextResponse.json({ error: "That host isn't allowed." }, { status: 400 });
  }

  try {
    const res = await fetch(parsedTarget, {
      headers: {
        // Plenty of storefronts serve a bare page to unknown agents.
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
        accept: "text/html",
      },
      signal: AbortSignal.timeout(12_000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Store returned ${res.status}.` },
        { status: 502 }
      );
    }

    const html = (await res.text()).slice(0, 400_000);

    const rawImage = firstMatch(html, [
      /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    ]);
    const rawTitle = firstMatch(html, [
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
      /<title[^>]*>([^<]+)<\/title>/i,
    ]);

    if (!rawImage) {
      return NextResponse.json(
        { error: "Couldn't find a product image on that page." },
        { status: 422 }
      );
    }

    const image = absolutize(rawImage, parsedTarget.toString());
    if (!image) {
      return NextResponse.json(
        { error: "Found an image reference we couldn't resolve." },
        { status: 422 }
      );
    }

    return NextResponse.json({
      image,
      title: rawTitle?.trim().slice(0, 120) ?? "Pasted product",
      source: parsedTarget.hostname,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Couldn't read that page: ${message}` },
      { status: 502 }
    );
  }
}
