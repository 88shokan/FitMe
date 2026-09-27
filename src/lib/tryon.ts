import { readFile } from "node:fs/promises";
import path from "node:path";
import { fal } from "@fal-ai/client";
import type { TryOnInput, TryOnResult } from "./types";

/**
 * Virtual try-on provider adapter.
 *
 * WHY A PURPOSE-BUILT VTON MODEL, NOT A GENERAL IMAGE GENERATOR:
 * A general model (DALL-E, Midjourney, plain Stable Diffusion) *invents* a
 * garment resembling a description. Pattern, logo, cut and drape all drift.
 * FASHN takes the actual garment photo and composites it onto the actual
 * person, preserving pose and identity. If the shirt in our output isn't
 * genuinely the shirt from the product page, our fit claim is fiction.
 *
 * Everything provider-specific lives in this file so we can swap providers in
 * minutes if one disappoints us at 2am. Candidates behind the same interface:
 * Kolors Virtual Try-On, IDM-VTON, or Gemini image as a flexible fallback.
 */

// --- Provider config: the only place model ids and field names appear --------
const FAL_MODEL = "fal-ai/fashn/tryon/v1.6";

type FalMode = "performance" | "balanced" | "quality";

/**
 * The speed/quality tradeoff. Use "performance" while iterating so you aren't
 * waiting 20s per change, then switch to "quality" for the demo build.
 */
const FAL_MODE: FalMode = (["performance", "balanced", "quality"] as const).includes(
  process.env.FAL_TRYON_MODE as FalMode
)
  ? (process.env.FAL_TRYON_MODE as FalMode)
  : "balanced";
// ---------------------------------------------------------------------------

let configured = false;

function configure() {
  if (configured) return;
  const credentials = process.env.FAL_KEY;
  if (!credentials) {
    throw new Error(
      "FAL_KEY is not set. Add it to .env.local (get one at https://fal.ai/dashboard/keys). " +
        "Never expose it with a NEXT_PUBLIC_ prefix — it must stay server-side."
    );
  }
  fal.config({ credentials });
  configured = true;
}

/** Refuse anything that isn't a reasonably sized image. */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/**
 * Upload an image to fal's storage and return a public URL the model can read.
 * Saves us standing up separate blob storage for the MVP.
 */
export async function uploadImage(file: File | Blob): Promise<string> {
  configure();
  return fal.storage.upload(
    file instanceof File ? file : new File([file], "image", { type: file.type })
  );
}

/** Kept for readability at the call site; person and garment share one path. */
export const uploadPersonImage = uploadImage;

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
};

/** Uploaded catalog images, keyed by public path. Saves a re-upload per try-on. */
const localUploadCache = new Map<string, string>();

/**
 * Upload a file from /public to fal and return its hosted URL.
 *
 * Catalog images MUST go through here rather than being handed to the model as
 * a URL. Building one from the request origin yields
 * `http://localhost:3000/garments/hoodie.avif`, which fal's servers cannot
 * reach — they answer "Connection refused". That would have worked once
 * deployed and never in local dev, which is the worst way for a bug to hide.
 */
export async function uploadLocalImage(publicPath: string): Promise<string> {
  const cached = localUploadCache.get(publicPath);
  if (cached) return cached;

  configure();

  const publicDir = path.join(process.cwd(), "public");
  const abs = path.resolve(publicDir, publicPath.replace(/^\/+/, ""));
  // The path comes from our own catalog, but keep it inside /public regardless.
  if (!abs.startsWith(publicDir)) {
    throw new Error(`Refusing to read outside /public: ${publicPath}`);
  }

  const type = MIME_BY_EXT[path.extname(abs).toLowerCase()];
  if (!type) {
    throw new Error(
      `Unsupported image type for ${publicPath}. Use jpg, png, webp or avif.`
    );
  }

  let buf: Buffer;
  try {
    buf = await readFile(abs);
  } catch {
    throw new Error(
      `Catalog image missing: public${publicPath}. Add its URL to garments.txt and run \`npm run garments\`.`
    );
  }

  // Wrap in Uint8Array: a Node Buffer may be backed by a SharedArrayBuffer,
  // which isn't a valid BlobPart as far as the DOM types are concerned.
  const url = await uploadImage(
    new File([new Uint8Array(buf)], path.basename(abs), { type })
  );
  localUploadCache.set(publicPath, url);
  return url;
}

/**
 * Download a remote image and re-host it on fal.
 *
 * Why not just hand the model the original URL: many retail CDNs reject
 * unknown server-side fetchers, so a URL that loads fine in the user's browser
 * can still fail when the model tries to read it. Mirroring it means the fetch
 * happens once, from us, where we can see and report the failure.
 */
export async function mirrorRemoteImage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
      accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(
      `That image URL returned ${res.status}. The store may be blocking downloads — try saving the image and uploading it instead.`
    );
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) {
    throw new Error(
      "That URL isn't a direct image link. Right-click the product photo and choose “Copy image address”."
    );
  }

  const blob = await res.blob();
  if (blob.size === 0) throw new Error("That image came back empty.");
  if (blob.size > MAX_IMAGE_BYTES) {
    throw new Error("That image is over 10MB.");
  }

  return uploadImage(blob);
}

export async function tryOn(input: TryOnInput): Promise<TryOnResult> {
  configure();
  const startedAt = Date.now();

  const result = await fal.subscribe(FAL_MODEL, {
    input: {
      model_image: input.personUrl,
      garment_image: input.garmentUrl,
      category: input.category,
      mode: FAL_MODE,
      // Our catalog uses flat-lay product shots; "auto" copes with scraped
      // product URLs that may be on-model instead.
      garment_photo_type: "auto",
      // jpeg keeps the response light, which matters on venue wifi.
      output_format: "jpeg",
      num_samples: 1,
    },
    logs: false,
  });

  const data = result.data as {
    images?: Array<{ url?: string }>;
  };
  const imageUrl = data?.images?.[0]?.url;

  if (!imageUrl) {
    throw new Error(
      `Try-on model returned no image. Raw response: ${JSON.stringify(result.data).slice(0, 400)}`
    );
  }

  return {
    imageUrl,
    ms: Date.now() - startedAt,
    provider: FAL_MODEL,
  };
}
