import type { Garment } from "./types";

/**
 * Seeded demo catalog — deliberately small and hardcoded.
 *
 * This catalog matters more than it looks: it is the ONLY garment source with a
 * size chart, so it's the only path that produces a size recommendation.
 * Uploaded and pasted garments return `fit: null`.
 *
 * Ids are kept short and obvious because you type them into garments.txt.
 *
 * To populate the images:  npm run garments   (see scripts/fetch-garments.mjs)
 *
 * Size charts below are plausible placeholders. Copy real ones off the product
 * pages before you present, and don't claim they were scraped live.
 */
export const CATALOG: Garment[] = [
  {
    id: "hoodie",
    name: "Pullover Hoodie",
    brand: "Placeholder Co",
    priceUsd: 68,
    category: "tops",
    image: "/garments/hoodie.jpg",
    fabric: "80% cotton, 20% polyester fleece",
    sizeChart: [
      { size: "S", chest: 40, length: 26 },
      { size: "M", chest: 44, length: 27 },
      { size: "L", chest: 48, length: 28 },
      { size: "XL", chest: 52, length: 29 },
    ],
  },
  {
    id: "jacket",
    name: "Chore Jacket",
    brand: "Placeholder Co",
    priceUsd: 110,
    category: "tops",
    // Cut roomier than a shirt because it's meant to layer over one.
    image: "/garments/jacket.jpg",
    fabric: "100% cotton canvas",
    sizeChart: [
      { size: "S", chest: 41, length: 26 },
      { size: "M", chest: 45, length: 27 },
      { size: "L", chest: 49, length: 28 },
      { size: "XL", chest: 53, length: 29 },
    ],
  },
  {
    id: "denim",
    name: "Straight-Leg Jeans",
    brand: "Placeholder Co",
    priceUsd: 78,
    category: "bottoms",
    image: "/garments/denim.jpg",
    fabric: "98% cotton, 2% elastane",
    sizeChart: [
      { size: "S", waist: 30, hip: 38 },
      { size: "M", waist: 32, hip: 40 },
      { size: "L", waist: 34, hip: 42 },
      { size: "XL", waist: 36, hip: 44 },
    ],
  },
  {
    id: "shirt",
    name: "Oxford Button-Down",
    brand: "Placeholder Co",
    priceUsd: 65,
    category: "tops",
    image: "/garments/shirt.jpg",
    fabric: "100% cotton",
    sizeChart: [
      { size: "S", chest: 38, length: 29 },
      { size: "M", chest: 42, length: 30 },
      { size: "L", chest: 46, length: 31 },
      { size: "XL", chest: 50, length: 32 },
    ],
  },
];

export function findGarment(id: string): Garment | undefined {
  return CATALOG.find((g) => g.id === id);
}
