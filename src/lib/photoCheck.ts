import type { GarmentCategory } from "./types";

/**
 * Is this photo likely to work for the garment the shopper picked?
 *
 * Why this exists: the try-on model does NOT reject a cropped photo. Feed it a
 * waist-up shot and ask for trousers and it returns HTTP 200 with an image
 * about ten seconds later — the result is just wrong. A silent bad result is
 * far worse than an error, especially on stage, so we catch it before spending
 * the round trip.
 *
 * The check is aspect ratio, which is crude but honest about being crude. Real
 * numbers from our own test photo:
 *
 *   full body, head to feet   896x1280  ratio 0.70
 *   same photo cropped waist-up 896x704 ratio 1.27
 *
 * Portrait full-body shots land around 0.56-0.75 (9:16 to 3:4). Selfies and
 * headshots are square or wider. Anything above ~0.8 almost certainly has no
 * legs in frame.
 *
 * A proper version would run pose detection and check for visible ankles. That
 * is the right upgrade if this ever leaves the hackathon.
 */

/** Above this, the photo is very unlikely to be head-to-toe. */
const CROPPED_RATIO = 0.8;
/** Between this and CROPPED_RATIO, it's borderline — mention it, don't block. */
const BORDERLINE_RATIO = 0.75;

export type PhotoVerdict = {
  ratio: number;
  /** "ok" | "borderline" | "cropped" — how full-body the photo looks. */
  framing: "ok" | "borderline" | "cropped";
  /** Set when this photo is a poor match for the chosen garment. */
  warning: string | null;
};

export function checkPhoto(
  width: number,
  height: number,
  category: GarmentCategory | null
): PhotoVerdict {
  const ratio = width / height;

  const framing: PhotoVerdict["framing"] =
    ratio > CROPPED_RATIO
      ? "cropped"
      : ratio > BORDERLINE_RATIO
        ? "borderline"
        : "ok";

  // Tops only need the upper body, so a tighter crop is genuinely fine.
  const needsLegs = category === "bottoms" || category === "one-pieces";

  let warning: string | null = null;
  if (needsLegs && framing === "cropped") {
    warning =
      "This photo looks cropped above the legs. Trousers and full-length pieces need a head-to-toe shot — the model will still return an image, but it won't be usable.";
  } else if (needsLegs && framing === "borderline") {
    warning =
      "Make sure your legs and feet are in frame — this photo looks tight for a full-length garment.";
  } else if (!needsLegs && framing === "cropped") {
    warning =
      "This photo looks cropped. Tops usually still work, but a full-body shot gives a better result.";
  }

  return { ratio: Number(ratio.toFixed(2)), framing, warning };
}

/** Read an image file's dimensions without rendering it to the page. */
export async function readImageSize(
  file: File
): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return size;
}
