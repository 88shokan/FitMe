import { NextResponse } from "next/server";
import { z } from "zod";
import { findGarment } from "@/lib/catalog";
import { recommendFit } from "@/lib/fit";
import { avoidedKgCo2e } from "@/lib/impact";
import { assertPublicHttpUrl, UnsafeUrlError } from "@/lib/net";
import {
  mirrorRemoteImage,
  tryOn,
  uploadImage,
  uploadLocalImage,
} from "@/lib/tryon";
import type { Garment, GarmentCategory, TryOnResponse } from "@/lib/types";

/**
 * Generation takes 5-20s, well past the default serverless timeout. Without
 * this the request dies before the model answers.
 */
export const maxDuration = 60;
/** fal storage upload and the Anthropic SDK both need the Node runtime. */
export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * A user-added garment. The client holds these in localStorage, so it sends the
 * spec along with the image — that's what lets a custom garment earn a real size
 * recommendation instead of `fit: null`.
 */
const GarmentSpecSchema = z.object({
  name: z.string().min(1).max(120),
  fabric: z.string().max(200).default(""),
  category: z.enum(["tops", "bottoms", "one-pieces"]),
  sizeChart: z
    .array(
      z.object({
        size: z.enum(["XS", "S", "M", "L", "XL", "XXL"]),
        chest: z.number().positive().max(120).optional(),
        waist: z.number().positive().max(120).optional(),
        hip: z.number().positive().max(120).optional(),
        length: z.number().positive().max(120).optional(),
      })
    )
    .min(1)
    .max(10),
});

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

  /**
   * Three ways to supply a garment, in order of reliability:
   *   1. an uploaded image      — always works, the demo-safe path
   *   2. a URL we resolve       — works on Shopify stores, blocked on many big brands
   *   3. one of our catalog items
   */
  const garmentPhoto = form.get("garmentPhoto");
  const garment = input.garmentId ? findGarment(input.garmentId) : undefined;
  let category: GarmentCategory;

  // Optional spec for a user-added garment, so it can earn a size recommendation.
  let specGarment: Garment | undefined;
  const rawSpec = form.get("garmentSpec");
  if (typeof rawSpec === "string" && rawSpec.trim()) {
    let candidate: unknown;
    try {
      candidate = JSON.parse(rawSpec);
    } catch {
      return NextResponse.json(
        { error: "Couldn't read that garment's details." },
        { status: 400 }
      );
    }
    const spec = GarmentSpecSchema.safeParse(candidate);
    if (!spec.success) {
      return NextResponse.json(
        { error: "That garment's size chart isn't valid.", issues: spec.error.issues },
        { status: 400 }
      );
    }
    specGarment = {
      id: "custom",
      brand: "Added by you",
      priceUsd: 0,
      image: "",
      ...spec.data,
    };
  }

  if (garmentPhoto instanceof File && garmentPhoto.size > 0) {
    if (garmentPhoto.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "That garment image is over 10MB." },
        { status: 413 }
      );
    }
    if (!garmentPhoto.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "That garment file isn't an image." },
        { status: 415 }
      );
    }
    category = input.garmentCategory ?? "tops";
  } else if (garment) {
    category = garment.category;
  } else if (input.garmentUrl) {
    category = input.garmentCategory ?? "tops";
  } else {
    return NextResponse.json(
      { error: "Pick a garment, upload an image, or paste a product URL." },
      { status: 400 }
    );
  }

  try {
    let garmentUrl: string;
    if (garmentPhoto instanceof File && garmentPhoto.size > 0) {
      garmentUrl = await uploadImage(garmentPhoto);
    } else if (garment) {
      // Read it off disk and upload. Never hand the model a URL pointing back
      // at us — in local dev that's localhost, which fal cannot reach.
      garmentUrl = garment.image.startsWith("http")
        ? garment.image
        : await uploadLocalImage(garment.image);
    } else {
      // Re-check the URL here: it arrives straight from the client, so it has
      // not necessarily been through /api/product's guard.
      const safe = assertPublicHttpUrl(input.garmentUrl!);
      // Mirror it through us so a CDN that blocks the model's fetcher fails
      // here, where we can return a useful message, instead of silently.
      garmentUrl = await mirrorRemoteImage(safe.toString());
    }

    // PRIVACY NOTE: we never write this photo to our own database or disk. It
    // goes straight to fal's storage so the model can read it, and we keep only
    // the resulting URL in the response. Be precise when you pitch this: the
    // upload does live on fal's CDN, so do NOT claim "deleted immediately"
    // unless you add an explicit delete call here.
    const personUrl = await uploadImage(photo);

    const result = await tryOn({ personUrl, garmentUrl, category });

    // A size recommendation needs a size chart — from our catalog, or sent
    // along with a user-added garment.
    const fitSource = garment ?? specGarment;
    const fit = fitSource
      ? await recommendFit(fitSource, {
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
    if (err instanceof UnsafeUrlError) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json(
      { error: `Try-on failed: ${message}` },
      { status: 502 }
    );
  }
}
