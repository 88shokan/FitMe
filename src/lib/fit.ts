import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type {
  BodyProfile,
  FitRecommendation,
  Garment,
  SizeLabel,
} from "./types";

/**
 * Size recommendation.
 *
 * Deliberately two-layered:
 *   1. A deterministic rule pass that ALWAYS produces an answer with no
 *      network call. This is what guarantees the demo works on dead wifi.
 *   2. An optional Claude pass that rewrites the rationale into something a
 *      shopper would actually read, and sanity-checks the size choice.
 *
 * If layer 2 is unavailable or errors, we return layer 1. Never let the size
 * recommendation be the thing that breaks a live demo.
 *
 * We do NOT estimate body measurements from the photo. That is unreliable, and
 * chasing it would eat the whole hackathon. Self-reported usual size is a
 * stronger signal anyway.
 */

const SIZE_ORDER: SizeLabel[] = ["XS", "S", "M", "L", "XL", "XXL"];

/** "Typical" measurements we compare a garment's chart against, in inches. */
const TYPICAL_CHEST: Record<SizeLabel, number> = {
  XS: 34, S: 38, M: 42, L: 46, XL: 50, XXL: 54,
};
const TYPICAL_WAIST: Record<SizeLabel, number> = {
  XS: 28, S: 30, M: 32, L: 34, XL: 36, XXL: 38,
};

function shift(size: SizeLabel, steps: number): SizeLabel {
  const i = SIZE_ORDER.indexOf(size);
  const next = Math.min(Math.max(i + steps, 0), SIZE_ORDER.length - 1);
  return SIZE_ORDER[next];
}

/** Rough stretch factor from the fabric string: more elastane, more give. */
function stretchAllowanceIn(fabric: string): number {
  const match = /(\d+(?:\.\d+)?)\s*%\s*(elastane|spandex|lycra)/i.exec(fabric);
  const pct = match ? parseFloat(match[1]) : 0;
  if (pct >= 4) return 2.0;
  if (pct >= 2) return 1.25;
  if (pct >= 1) return 0.75;
  // Knits give a little even without elastane.
  return /knit|jersey|fleece/i.test(fabric) ? 0.5 : 0;
}

/**
 * Layer 1: deterministic. Anchors on the shopper's usual size, then adjusts for
 * how this garment's chart compares to a typical one, how stretchy it is, and
 * how they like things to fit.
 */
export function deterministicFit(
  garment: Garment,
  profile: BodyProfile
): FitRecommendation {
  const usesWaist = garment.category === "bottoms";
  const typical = usesWaist ? TYPICAL_WAIST : TYPICAL_CHEST;

  const row = garment.sizeChart.find((r) => r.size === profile.usualSize);
  const measured = usesWaist ? row?.waist : row?.chest;

  // The garment may not be offered in their usual size at all.
  if (!row || measured === undefined) {
    const nearest = garment.sizeChart[Math.floor(garment.sizeChart.length / 2)];
    return {
      recommendedSize: nearest.size,
      confidence: 0.4,
      rationale: `This piece isn't charted in your usual ${profile.usualSize}, so we've suggested the closest available size. Check the measurements before ordering.`,
      deterministic: true,
    };
  }

  const stretch = stretchAllowanceIn(garment.fabric);
  // Positive delta = this garment runs LARGER than typical for the size.
  const delta = measured + stretch - typical[profile.usualSize];

  let steps = 0;
  const reasons: string[] = [];

  if (delta <= -2) {
    steps = 1;
    reasons.push(
      `it runs about ${Math.abs(delta).toFixed(1)}" tighter than a standard ${profile.usualSize}`
    );
  } else if (delta >= 3) {
    steps = -1;
    reasons.push(
      `it runs about ${delta.toFixed(1)}" roomier than a standard ${profile.usualSize}`
    );
  } else {
    reasons.push(`it's cut close to a standard ${profile.usualSize}`);
  }

  if (profile.fitPreference === "relaxed" && steps === 0) {
    steps = 1;
    reasons.push("you prefer a relaxed fit");
  } else if (profile.fitPreference === "fitted" && steps === 1 && delta > -3) {
    steps = 0;
    reasons.push("you prefer a fitted cut, so we held your usual size");
  }

  if (stretch >= 1.25) {
    reasons.push(`the ${garment.fabric.toLowerCase()} has real give`);
  }

  const recommendedSize = shift(profile.usualSize, steps);

  // Confidence is highest when the garment sits squarely in a size band.
  const distanceFromEdge = Math.min(Math.abs(delta + 2), Math.abs(delta - 3));
  const confidence = Math.min(0.9, 0.55 + distanceFromEdge * 0.12);

  return {
    recommendedSize,
    confidence: Number(confidence.toFixed(2)),
    rationale: `We suggest ${recommendedSize} because ${reasons.join(", and ")}.`,
    alternative:
      steps !== 0
        ? `If you'd rather stay consistent, your usual ${profile.usualSize} is the next best call.`
        : `Size up to ${shift(recommendedSize, 1)} if you plan to layer underneath.`,
    deterministic: true,
  };
}

// --- Layer 2: Claude refinement ---------------------------------------------

const FitSchema = z.object({
  recommendedSize: z.enum(["XS", "S", "M", "L", "XL", "XXL"]),
  confidence: z.number().describe("0 to 1. Be honest; low is fine."),
  rationale: z
    .string()
    .describe("One or two sentences a shopper would actually read. No jargon."),
  alternative: z
    .string()
    .describe("When the other size would be the better call. Empty if none."),
});

export async function refineFitWithClaude(
  garment: Garment,
  profile: BodyProfile,
  baseline: FitRecommendation
): Promise<FitRecommendation> {
  if (!process.env.ANTHROPIC_API_KEY) return baseline;

  try {
    const client = new Anthropic();

    const response = await client.messages.parse({
      model: "claude-opus-5",
      max_tokens: 4000,
      // This sits in the demo's critical path, so trade depth for latency.
      output_config: {
        effort: "low",
        format: zodOutputFormat(FitSchema),
      },
      system:
        "You are a fit advisor for an online clothing store. You are given a garment's " +
        "real size chart, a shopper's self-reported profile, and a rule-based baseline " +
        "recommendation. Sanity-check the baseline and write the rationale a shopper " +
        "should see. Only depart from the baseline size if the chart clearly contradicts " +
        "it. Never invent measurements that are not given. Be honest about uncertainty: " +
        "a confidence of 0.6 is a fine answer.",
      messages: [
        {
          role: "user",
          content: [
            `Garment: ${garment.name} (${garment.category})`,
            `Fabric: ${garment.fabric}`,
            `Size chart (inches): ${JSON.stringify(garment.sizeChart)}`,
            "",
            `Shopper: ${profile.heightIn}in tall, ${profile.weightLb}lb,`,
            `usually wears ${profile.usualSize}, prefers a ${profile.fitPreference} fit.`,
            "",
            `Rule-based baseline: ${baseline.recommendedSize} at ${baseline.confidence} confidence.`,
            `Baseline reasoning: ${baseline.rationale}`,
          ].join("\n"),
        },
      ],
    });

    const parsed = response.parsed_output;
    if (!parsed) return baseline;

    return {
      recommendedSize: parsed.recommendedSize,
      confidence: Math.min(Math.max(parsed.confidence, 0), 1),
      rationale: parsed.rationale,
      alternative: parsed.alternative || undefined,
      deterministic: false,
    };
  } catch (err) {
    // Never fail the request over the nice-to-have layer.
    console.error("[fit] Claude refinement failed, using deterministic:", err);
    return baseline;
  }
}

export async function recommendFit(
  garment: Garment,
  profile: BodyProfile
): Promise<FitRecommendation> {
  const baseline = deterministicFit(garment, profile);
  return refineFitWithClaude(garment, profile, baseline);
}
