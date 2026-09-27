import type { Garment } from "./types";

/**
 * Seeded demo catalog — deliberately small and hardcoded.
 *
 * These four cover all three garment categories (tops / bottoms / one-pieces),
 * which is what exercises the category handling in the try-on model.
 *
 * This catalog matters more than it looks: it is the ONLY garment source with a
 * size chart, so it's the only path that produces a size recommendation.
 * Uploaded and pasted garments return `fit: null`.
 *
 * To populate the images:  npm run garments   (see scripts/fetch-garments.mjs)
 *
 * Size charts below are plausible placeholders. Copy real ones off the product
 * pages before you present, and don't claim they were scraped live.
 */
export const CATALOG: Garment[] = [
  {
    id: "heavyweight-tee",
    name: "Heavyweight Cotton Tee",
    brand: "Placeholder Co",
    priceUsd: 28,
    category: "tops",
    image: "/garments/heavyweight-tee.jpg",
    fabric: "100% cotton",
    sizeChart: [
      { size: "S", chest: 36, length: 27 },
      { size: "M", chest: 40, length: 28 },
      { size: "L", chest: 44, length: 29 },
      { size: "XL", chest: 48, length: 30 },
    ],
  },
  {
    id: "denim-jacket",
    name: "Classic Denim Jacket",
    brand: "Placeholder Co",
    priceUsd: 89,
    category: "tops",
    image: "/garments/denim-jacket.jpg",
    fabric: "99% cotton, 1% elastane",
    sizeChart: [
      { size: "S", chest: 38, length: 25 },
      { size: "M", chest: 42, length: 26 },
      { size: "L", chest: 46, length: 27 },
      { size: "XL", chest: 50, length: 28 },
    ],
  },
  {
    id: "straight-jeans",
    name: "Straight-Leg Jeans",
    brand: "Placeholder Co",
    priceUsd: 78,
    category: "bottoms",
    image: "/garments/straight-jeans.jpg",
    fabric: "98% cotton, 2% elastane",
    sizeChart: [
      { size: "S", waist: 30, hip: 38 },
      { size: "M", waist: 32, hip: 40 },
      { size: "L", waist: 34, hip: 42 },
      { size: "XL", waist: 36, hip: 44 },
    ],
  },
  {
    id: "shirt-dress",
    name: "Midi Shirt Dress",
    brand: "Placeholder Co",
    priceUsd: 95,
    category: "one-pieces",
    image: "/garments/shirt-dress.jpg",
    fabric: "70% viscose, 30% linen",
    sizeChart: [
      { size: "S", chest: 35, waist: 29, hip: 38, length: 45 },
      { size: "M", chest: 37, waist: 31, hip: 40, length: 46 },
      { size: "L", chest: 39, waist: 33, hip: 42, length: 47 },
      { size: "XL", chest: 41, waist: 35, hip: 44, length: 48 },
    ],
  },
];

export function findGarment(id: string): Garment | undefined {
  return CATALOG.find((g) => g.id === id);
}
