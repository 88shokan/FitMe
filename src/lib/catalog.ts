import type { Garment } from "./types";

/**
 * Seeded demo catalog. Deliberately hardcoded — a CMS buys us nothing in a
 * hackathon, and local images under /public make the demo work on bad venue
 * wifi, which hotlinked product photos do not.
 *
 * >>> TODO: save a product photo for each entry to public/garments/<id>.jpg <<<
 * Flat-lay or plain-background shots work far better than on-model shots.
 * Size charts below are placeholders — copy real ones off the product pages.
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
    id: "oxford-shirt",
    name: "Oxford Button-Down",
    brand: "Placeholder Co",
    priceUsd: 65,
    category: "tops",
    image: "/garments/oxford-shirt.jpg",
    fabric: "100% cotton",
    sizeChart: [
      { size: "S", chest: 38, length: 29 },
      { size: "M", chest: 42, length: 30 },
      { size: "L", chest: 46, length: 31 },
      { size: "XL", chest: 50, length: 32 },
    ],
  },
  {
    id: "crew-sweatshirt",
    name: "Fleece Crewneck",
    brand: "Placeholder Co",
    priceUsd: 54,
    category: "tops",
    image: "/garments/crew-sweatshirt.jpg",
    fabric: "80% cotton, 20% polyester",
    sizeChart: [
      { size: "S", chest: 40, length: 26 },
      { size: "M", chest: 44, length: 27 },
      { size: "L", chest: 48, length: 28 },
      { size: "XL", chest: 52, length: 29 },
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
    id: "knit-polo",
    name: "Textured Knit Polo",
    brand: "Placeholder Co",
    priceUsd: 45,
    category: "tops",
    image: "/garments/knit-polo.jpg",
    fabric: "60% cotton, 35% nylon, 5% elastane",
    sizeChart: [
      { size: "S", chest: 37, length: 27 },
      { size: "M", chest: 41, length: 28 },
      { size: "L", chest: 45, length: 29 },
      { size: "XL", chest: 49, length: 30 },
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
    id: "chino-pants",
    name: "Slim Chinos",
    brand: "Placeholder Co",
    priceUsd: 62,
    category: "bottoms",
    image: "/garments/chino-pants.jpg",
    fabric: "97% cotton, 3% elastane",
    sizeChart: [
      { size: "S", waist: 30, hip: 37 },
      { size: "M", waist: 32, hip: 39 },
      { size: "L", waist: 34, hip: 41 },
      { size: "XL", waist: 36, hip: 43 },
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
