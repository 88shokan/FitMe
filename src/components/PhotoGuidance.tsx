import { PocketPanel } from "./PocketPanel";

/**
 * Photo quality is the single biggest driver of output quality. Without this
 * guidance visible at upload time, most results look broken and users blame the
 * app rather than the photo. Do not remove it to save space.
 */
const GOOD = [
  "Full body, head to feet in frame",
  "Plain wall behind you",
  "Arms relaxed at your sides",
  "Close-fitting clothes",
  "Even, bright lighting",
];

const BAD = ["Group photos", "Heavy shadows", "Baggy layers", "Crossed arms"];

export function PhotoGuidance() {
  return (
    <PocketPanel>
      <p className="label-type text-classic-indigo mb-3">For the best result</p>

      <ul className="space-y-2 mb-4">
        {GOOD.map((tip) => (
          <li key={tip} className="flex gap-2.5 text-sm text-charcoal">
            <span
              aria-hidden
              className="text-thread-orange font-bold leading-snug"
            >
              ✓
            </span>
            <span>{tip}</span>
          </li>
        ))}
      </ul>

      <div className="border-t-2 border-dashed border-thread-orange pt-3">
        <p className="text-sm text-muted">
          <span className="label-type text-selvage-red">Avoid:</span>{" "}
          {BAD.join(" · ")}
        </p>
      </div>
    </PocketPanel>
  );
}
