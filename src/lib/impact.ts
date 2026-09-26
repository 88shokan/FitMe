/**
 * Avoided-return impact model.
 *
 * Every number here is an ASSUMPTION, not a fact. They are collected in one
 * place, each with a CITE marker, because the UI surfaces them to the user and
 * judges will (rightly) ask where they came from.
 *
 * >>> BEFORE YOU PRESENT: replace every CITE placeholder with a real source. <<<
 * Presenting these as measured values would be dishonest, and "here are our
 * four assumptions and where they came from" scores better than a magic number.
 */

export type ImpactAssumption = {
  key: string;
  label: string;
  value: number;
  unit: string;
  /** Where this number came from. Fill in before demoing. */
  source: string;
};

export const ASSUMPTIONS: ImpactAssumption[] = [
  {
    key: "returnRateApparel",
    label: "Online apparel return rate",
    value: 0.25,
    unit: "fraction of orders",
    source: "CITE — industry reports put online apparel returns around 20-30%",
  },
  {
    key: "fitShareOfReturns",
    label: "Returns caused by fit/size",
    value: 0.7,
    unit: "fraction of returns",
    source: "CITE — fit is consistently the top stated reason for apparel returns",
  },
  {
    key: "kgCo2ePerReturnTrip",
    label: "Emissions per return trip",
    value: 1.1,
    unit: "kg CO2e",
    source: "CITE — return leg + restock/reship + extra packaging, domestic parcel",
  },
  {
    key: "pDisposal",
    label: "Returned items never resold",
    value: 0.1,
    unit: "fraction of returns",
    source: "CITE — share of returns landfilled or incinerated rather than resold",
  },
  {
    key: "kgCo2ePerGarmentDisposed",
    label: "Embodied emissions of a wasted garment",
    value: 6.0,
    unit: "kg CO2e",
    source: "CITE — embodied footprint of an average cotton garment",
  },
];

function assume(key: string): number {
  const found = ASSUMPTIONS.find((a) => a.key === key);
  if (!found) throw new Error(`Unknown impact assumption: ${key}`);
  return found.value;
}

/**
 * Expected kg CO2e avoided by one confident try-on.
 *
 * Reasoning: a try-on only helps if the order would otherwise have been
 * returned for fit reasons, so we scale by both the base return rate and
 * fit's share of it. Higher fit confidence means more of that risk is
 * actually removed, so a low-confidence result claims proportionally less.
 */
export function avoidedKgCo2e(fitConfidence: number): number {
  const confidence = Math.min(Math.max(fitConfidence, 0), 1);

  const probabilityOfFitReturn =
    assume("returnRateApparel") * assume("fitShareOfReturns");

  const costOfOneReturn =
    assume("kgCo2ePerReturnTrip") +
    assume("pDisposal") * assume("kgCo2ePerGarmentDisposed");

  return probabilityOfFitReturn * costOfOneReturn * confidence;
}

/** Human-readable equivalence, so the number means something on stage. */
export function equivalence(kgCo2e: number): string {
  const milesDriven = kgCo2e / 0.4; // CITE — ~0.4 kg CO2e per mile, average car
  if (milesDriven < 1) return "less than a mile of driving";
  return `about ${milesDriven.toFixed(1)} miles of driving`;
}
