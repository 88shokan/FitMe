"use client";

import { useState } from "react";

/**
 * Plain <img> rather than next/image on purpose: garment images can come from
 * any storefront the shopper pastes, and maintaining next.config remotePatterns
 * for arbitrary domains is whack-a-mole we don't need this weekend.
 *
 * Falls back to a labelled placeholder so a missing file in public/garments/
 * doesn't render as a broken-image icon.
 */
export function GarmentImage({
  src,
  alt,
  className = "",
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 bg-bleached px-3 text-center ${className}`}
      >
        <span className="rivet" aria-hidden />
        <span className="label-type text-medium-wash">Missing image</span>
        <code className="text-[10px] text-muted break-all">{src}</code>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
