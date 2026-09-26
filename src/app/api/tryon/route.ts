import { NextResponse } from "next/server";
import { z } from "zod";
import { findGarment } from "@/lib/catalog";
import { recommendFit } from "@/lib/fit";
import { avoidedKgCo2e } from "@/lib/impact";
import { tryOn, uploadPersonImage } from "@/lib/tryon";
import type { GarmentCategory, TryOnResponse } from "@/lib/types";

/**
 * Generation takes 5-20s, well past the default serverless timeout. Without
 * this the request dies before the model answers.
 */
export const maxDuration = 60;
/** fal storage upload and the Anthropic SDK both need the Node runtime. */
export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const BodySchema = z.object({
  garmentId: z.string().min(1).optional(),
  /** Set instead of garmentId when the shopper pasted a product URL. */
  garmentUrl: z.string().url().optional(),
  garmentCategory: z.enum(["tops", "bottoms", "one-pieces"]).optional(),
  heightIn: z.coerce.number().min(36).max(96),
  weightLb: z.coerce.number().min(50).max(600),
  usualSize: z.enum(["XS", "S", "M", "L", "XL", "XXL"]),
  fitPreference: z.enum(["fitted", "regular", "relaxed"]),
});

/**
 * Crude per-instance rate limit. Not robust across serverless instances, but
 * enough to stop one person hammering the endpoint and burning our fal credits
 * mid-judging. Swap for Upstash Redis if this ever leaves the hackathon.
 */
const hits = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 8;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_PER_WINDOW;
}

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many try-ons in a row. Give it a minute." },
      { status: 429 }
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart form data." },
      { status: 400 }
    );
  }

  const photo = form.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    return NextResponse.json(
      { error: "Please include a photo of yourself." },
      { status: 400 }
    );
  }
  if (photo.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "That photo is over 10MB. Try a smaller one." },
      { status: 413 }
    );
  }
  if (!photo.type.startsWith("image/")) {
    return NextResponse.json(
      { error: "That file isn't an image." },
      { status: 415 }
    );
  }

  const parsed = BodySchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Check your measurements.", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const input = parsed.data;

  // Resolve the garment: either one of ours, or a scraped product URL.
  let garmentUrl: string;
  let category: GarmentCategory;
  const garment = input.garmentId ? findGarment(input.garmentId) : undefined;

  if (garment) {
    category = garment.category;
    garmentUrl = garment.image.startsWith("http")
      ? garment.image
      : new URL(garment.image, request.url).toString();
  } else if (input.garmentUrl) {
    category = input.garmentCategory ?? "tops";
    garmentUrl = input.garmentUrl;
  } else {
    return NextResponse.json(
      { error: "Pick a garment or paste a product URL." },
      { status: 400 }
    );
  }

  try {
    // PRIVACY NOTE: we never write this photo to our own database or disk. It
    // goes straight to fal's storage so the model can read it, and we keep only
    // the resulting URL in the response. Be precise when you pitch this: the
    // upload does live on fal's CDN, so do NOT claim "deleted immediately"
    // unless you add an explicit delete call here.
    const personUrl = await uploadPersonImage(photo);

    const result = await tryOn({ personUrl, garmentUrl, category });

    // Only our own catalog has a real size chart to reason over.
    const fit = garment
      ? await recommendFit(garment, {
          heightIn: input.heightIn,
          weightLb: input.weightLb,
          usualSize: input.usualSize,
          fitPreference: input.fitPreference,
        })
      : null;

    const payload: TryOnResponse = {
      tryOn: result,
      fit,
      impactKgCo2e: avoidedKgCo2e(fit?.confidence ?? 0.5),
    };
    return NextResponse.json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api/tryon]", err);
    return NextResponse.json(
      { error: `Try-on failed: ${message}` },
      { status: 502 }
    );
  }
}
