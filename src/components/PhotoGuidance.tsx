import { PocketPanel } from "./PocketPanel";

/**
 * Photo quality is the single biggest driver of output quality. Without this
 * guidance visible at upload time, most results look broken and users blame the
 * app rather than the photo. Do not remove it to save space.
 */
const GOOD = [
  "Head to feet in frame — legs included",
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

      <div className="border-t-2 border-dashed border-thread-orange pt-3 space-y-2">
        <p className="text-sm text-muted">
          <span className="label-type text-selvage-red">Avoid:</span>{" "}
          {BAD.join(" · ")}
        </p>
        <p className="text-sm text-muted">
          <span className="label-type text-classic-indigo">Trying trousers?</span>{" "}
          A waist-up photo can&apos;t work — the model has no legs to dress, and
          it returns a bad image rather than an error.
        </p>
      </div>
    </PocketPanel>
  );
}
