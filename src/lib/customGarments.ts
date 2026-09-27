import type { Garment } from "./types";

/**
 * Garments the user adds themselves, kept in localStorage.
 *
 * No database on purpose — it matches the rest of the app's zero-persistence
 * design, and it means an added garment is private to that person's browser.
 * The tradeoff, which the UI states plainly: items don't sync between devices
 * or teammates, and clearing site data loses them.
 */

export type CustomGarment = Garment & { custom: true; addedAt: number };

const KEY = "fitme.customGarments.v1";

/** Downscaled hard: full-size product photos would exhaust the ~5MB quota. */
const MAX_DIM = 900;
const JPEG_QUALITY = 0.82;

export function loadCustomGarments(): CustomGarment[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Tolerate junk rather than throwing away the whole list.
    return parsed.filter(
      (g): g is CustomGarment =>
        !!g &&
        typeof g === "object" &&
        typeof (g as CustomGarment).id === "string" &&
        Array.isArray((g as CustomGarment).sizeChart)
    );
  } catch {
    return [];
  }
}

export type SaveResult = { ok: true } | { ok: false; error: string };

export function saveCustomGarment(garment: CustomGarment): SaveResult {
  try {
    const next = [
      garment,
      ...loadCustomGarments().filter((g) => g.id !== garment.id),
    ];
    window.localStorage.setItem(KEY, JSON.stringify(next));
    notify();
    return { ok: true };
  } catch (err) {
    const quota =
      err instanceof DOMException &&
      (err.name === "QuotaExceededError" ||
        err.name === "NS_ERROR_DOM_QUOTA_REACHED");
    return {
      ok: false,
      error: quota
        ? "Your browser's storage is full. Remove a saved garment and try again."
        : "Couldn't save to this browser. Private browsing can block storage.",
    };
  }
}

export function removeCustomGarment(id: string): void {
  try {
    const next = loadCustomGarments().filter((g) => g.id !== id);
    window.localStorage.setItem(KEY, JSON.stringify(next));
    notify();
  } catch {
    // Nothing useful to do; the caller re-reads from storage either way.
  }
}

/**
 * Shrink an uploaded image and return it as a data URL.
 * Keeps each saved garment to roughly 100-200KB instead of several megabytes.
 */
export async function fileToDownscaledDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't read that image.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}

/** Turn a stored data URL back into a File so it can ride the upload path. */
export async function dataUrlToFile(
  dataUrl: string,
  name: string
): Promise<File> {
  const blob = await (await fetch(dataUrl)).blob();
  return new File([blob], name, { type: blob.type || "image/jpeg" });
}

export function newGarmentId(): string {
  return `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// --- External store, for useSyncExternalStore ------------------------------
// React needs a *stable* snapshot reference or it re-renders forever, so the
// parsed list is cached and only invalidated on an actual write.

const EMPTY: CustomGarment[] = [];
const listeners = new Set<() => void>();
let snapshot: CustomGarment[] | null = null;

function notify() {
  snapshot = null;
  listeners.forEach((l) => l());
}

function onStorage(e: StorageEvent) {
  if (e.key === KEY || e.key === null) notify();
}

export function subscribeCustomGarments(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function getCustomGarmentsSnapshot(): CustomGarment[] {
  if (snapshot === null) snapshot = loadCustomGarments();
  return snapshot;
}

/** Server render has no localStorage; start empty and hydrate on the client. */
export function getCustomGarmentsServerSnapshot(): CustomGarment[] {
  return EMPTY;
}
