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
        className={`flex items-center justify-center bg-surface-muted text-muted text-xs text-center px-3 ${className}`}
      >
        <span>
          Add an image at
          <br />
          <code className="font-mono">{src}</code>
        </span>
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
