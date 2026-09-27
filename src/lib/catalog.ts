import type { Garment } from "./types";

/**
 * Seeded demo catalog — deliberately small and hardcoded.
 *
 * This catalog matters more than it looks: it is the ONLY garment source with a
 * size chart, so it's the only path that produces a size recommendation.
 * Uploaded and pasted garments return `fit: null`.
 *
 * Ids match the filenames in public/garments/ and the keys in garments.txt.
 *
 * To repopulate the images:  npm run garments
 *
 * The charts below are deliberately differentiated so the size logic gives
 * visibly different advice per garment — the oversized crewneck sizes you down,
 * the unstretchy leather jacket sizes you up. That contrast is worth showing if
 * a judge asks whether the recommendation is real or decorative.
 *
 * Measurements are plausible, not scraped. Copy the real charts off the product
 * pages before you present, and don't claim they came from the retailer.
 */
export const CATALOG: Garment[] = [
  {
    id: "crewneck",
    name: "Oversized Crewneck",
    brand: "Nike",
    priceUsd: 68,
    category: "tops",
    image: "/garments/crewneck.avif",
    // Cut deliberately large, so the chart sits well above a standard size.
    fabric: "80% cotton, 20% polyester fleece",
    sizeChart: [
      { size: "S", chest: 44, length: 26 },
      { size: "M", chest: 48, length: 27 },
      { size: "L", chest: 52, length: 28 },
      { size: "XL", chest: 56, length: 29 },
    ],
  },
  {
    id: "moto-jacket",
    name: "Leather Moto Jacket",
    brand: "Abercrombie & Fitch",
    priceUsd: 180,
    category: "tops",
    image: "/garments/moto-jacket.avif",
    // Leather has no give at all, so the fit logic gets no stretch allowance.
    fabric: "100% lamb leather",
    sizeChart: [
      { size: "S", chest: 36, length: 22 },
      { size: "M", chest: 40, length: 23 },
      { size: "L", chest: 44, length: 24 },
      { size: "XL", chest: 48, length: 25 },
    ],
  },
  {
    id: "wide-trousers",
    name: "Wide-Leg Trousers",
    brand: "Abercrombie & Fitch",
    priceUsd: 88,
    category: "bottoms",
    image: "/garments/wide-trousers.avif",
    fabric: "55% linen, 45% viscose",
    sizeChart: [
      { size: "S", waist: 29, hip: 41 },
      { size: "M", waist: 32, hip: 44 },
      { size: "L", waist: 35, hip: 47 },
      { size: "XL", waist: 38, hip: 50 },
    ],
  },
];

export function findGarment(id: string): Garment | undefined {
  return CATALOG.find((g) => g.id === id);
}
