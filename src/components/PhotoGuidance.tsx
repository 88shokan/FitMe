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
    <div className="rounded-xl border border-border bg-surface-muted p-4 text-sm">
      <p className="font-medium mb-3">For the best result</p>
      <ul className="space-y-1.5 mb-3">
        {GOOD.map((tip) => (
          <li key={tip} className="flex gap-2 text-muted">
            <span aria-hidden className="text-accent font-semibold">
              ✓
            </span>
            <span>{tip}</span>
          </li>
        ))}
      </ul>
      <p className="text-muted">
        <span className="font-medium text-foreground">Avoid:</span>{" "}
        {BAD.join(" · ")}
      </p>
    </div>
  );
}
