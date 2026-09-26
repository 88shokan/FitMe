/**
 * Shared types. Agreed on early so UI and API work can proceed in parallel —
 * if you change anything here, tell the rest of the team.
 */

/** Which part of the body a garment covers. VTON models need this hint. */
export type GarmentCategory = "tops" | "bottoms" | "one-pieces";

export type SizeLabel = "XS" | "S" | "M" | "L" | "XL" | "XXL";

/** One row of a garment's size chart, in inches. */
export type SizeChartRow = {
  size: SizeLabel;
  chest?: number;
  waist?: number;
  hip?: number;
  length?: number;
};

export type Garment = {
  id: string;
  name: string;
  brand: string;
  priceUsd: number;
  category: GarmentCategory;
  /** Path under /public, or an absolute URL for scraped products. */
  image: string;
  /** e.g. "95% cotton, 5% elastane" — drives stretch estimation. */
  fabric: string;
  sizeChart: SizeChartRow[];
};

/** What the user tells us about their body. No photo measurement — too unreliable. */
export type BodyProfile = {
  heightIn: number;
  weightLb: number;
  usualSize: SizeLabel;
  fitPreference: "fitted" | "regular" | "relaxed";
};

export type FitRecommendation = {
  recommendedSize: SizeLabel;
  /** 0..1 — drives the confidence meter in the UI. */
  confidence: number;
  rationale: string;
  alternative?: string;
  /** True when we fell back to the deterministic path (no LLM). */
  deterministic: boolean;
};

export type TryOnInput = {
  personUrl: string;
  garmentUrl: string;
  category: GarmentCategory;
};

export type TryOnResult = {
  imageUrl: string;
  ms: number;
  provider: string;
};

/** Full payload returned to the client after a generation. */
export type TryOnResponse = {
  tryOn: TryOnResult;
  fit: FitRecommendation | null;
  impactKgCo2e: number;
};
