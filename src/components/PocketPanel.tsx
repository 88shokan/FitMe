import type { ReactNode } from "react";

/**
 * A patch-pocket panel: contrast top-stitch with a copper rivet at each end.
 *
 * The rivets are real elements rather than ::before/::after, because `.pocket`
 * already claims ::before for the stitch line — stacking the two CSS classes
 * made them fight over the same pseudo-element and rendered a malformed stub.
 */
export function PocketPanel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`pocket relative rounded border-2 border-light-wash bg-white px-5 pb-5 shadow-[0_2px_8px_rgba(26,42,58,0.12)] ${className}`}
    >
      <span className="rivet absolute top-3.5 left-3.5 z-10" aria-hidden />
      <span className="rivet absolute top-3.5 right-3.5 z-10" aria-hidden />
      {children}
    </div>
  );
}
