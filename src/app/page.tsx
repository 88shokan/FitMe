"use client";

import { useEffect, useRef, useState } from "react";
import { CATALOG } from "@/lib/catalog";
import { ASSUMPTIONS, equivalence } from "@/lib/impact";
import { GarmentImage } from "@/components/GarmentImage";
import { PhotoGuidance } from "@/components/PhotoGuidance";
import { PocketPanel } from "@/components/PocketPanel";
import type {
  Garment,
  GarmentCategory,
  SizeLabel,
  TryOnResponse,
} from "@/lib/types";

type Step = "you" | "garment" | "result";

const SIZES: SizeLabel[] = ["XS", "S", "M", "L", "XL", "XXL"];

/** A 5-20s wait with one static spinner reads as broken. Narrate it instead. */
const WAIT_MESSAGES = [
  "Reading your photo…",
  "Matching the garment to your pose…",
  "Draping the fabric…",
  "Checking the size chart…",
  "Almost there…",
];

/* Denim button recipes. `stitched` adds the inset dashed contrast thread. */
const BTN_BASE =
  "inline-flex items-center justify-center gap-2 rounded px-6 py-3 label-type transition-all disabled:opacity-40 disabled:cursor-not-allowed";
const BTN_PRIMARY = `${BTN_BASE} stitched bg-dark-indigo text-white hover:bg-classic-indigo hover:-translate-y-0.5 disabled:hover:translate-y-0 shadow-[0_2px_8px_rgba(26,42,58,0.12)]`;
const BTN_SECONDARY = `${BTN_BASE} border-2 border-classic-indigo text-classic-indigo hover:bg-bleached`;

export default function Home() {
  const [step, setStep] = useState<Step>("you");

  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [heightIn, setHeightIn] = useState("70");
  const [weightLb, setWeightLb] = useState("165");
  const [usualSize, setUsualSize] = useState<SizeLabel>("M");
  const [fitPreference, setFitPreference] = useState<
    "fitted" | "regular" | "relaxed"
  >("regular");

  const [selected, setSelected] = useState<Garment | null>(null);
  const [pastedUrl, setPastedUrl] = useState("");
  const [pasted, setPasted] = useState<{
    image: string;
    title: string;
    category: GarmentCategory;
  } | null>(null);
  const [pasteBusy, setPasteBusy] = useState(false);

  /** Uploaded garment image — the path that works on every store. */
  const [garmentFile, setGarmentFile] = useState<File | null>(null);
  const [garmentPreview, setGarmentPreview] = useState<string | null>(null);
  const [garmentCategory, setGarmentCategory] =
    useState<GarmentCategory>("tops");

  const [busy, setBusy] = useState(false);
  const [waitIndex, setWaitIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [errorHint, setErrorHint] = useState<string | null>(null);
  const [result, setResult] = useState<TryOnResponse | null>(null);
  const [sessionSaved, setSessionSaved] = useState(0);
  const [showAssumptions, setShowAssumptions] = useState(false);

  const fileInput = useRef<HTMLInputElement>(null);
  const garmentInput = useRef<HTMLInputElement>(null);

  // Cycle the wait copy while a generation is in flight.
  useEffect(() => {
    if (!busy) return;
    const id = setInterval(
      () => setWaitIndex((i) => (i + 1) % WAIT_MESSAGES.length),
      2600
    );
    return () => clearInterval(id);
  }, [busy]);

  /** Revoke the previous blob URL as we swap in a new one, so we don't leak. */
  function choosePhoto(file: File) {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  /** Choosing any one garment source clears the other two. */
  function chooseGarmentFile(file: File) {
    if (garmentPreview) URL.revokeObjectURL(garmentPreview);
    setGarmentFile(file);
    setGarmentPreview(URL.createObjectURL(file));
    setSelected(null);
    setPasted(null);
    setError(null);
    setErrorHint(null);
  }

  const garmentChosen = selected ?? pasted ?? garmentFile;

  async function lookupProduct() {
    if (!pastedUrl.trim()) return;
    setPasteBusy(true);
    setError(null);
    setErrorHint(null);
    try {
      const res = await fetch(`/api/product?url=${encodeURIComponent(pastedUrl)}`);
      const data = await res.json();
      if (!res.ok) {
        setErrorHint(data.hint ?? null);
        throw new Error(data.error ?? "Lookup failed");
      }
      setPasted({ image: data.image, title: data.title, category: "tops" });
      setSelected(null);
      setGarmentFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setPasteBusy(false);
    }
  }

  async function generate() {
    if (!photo || !garmentChosen) return;
    setBusy(true);
    setError(null);
    setErrorHint(null);
    setResult(null);
    setStep("result");

    const form = new FormData();
    form.append("photo", photo);
    form.append("heightIn", heightIn);
    form.append("weightLb", weightLb);
    form.append("usualSize", usualSize);
    form.append("fitPreference", fitPreference);
    if (garmentFile) {
      form.append("garmentPhoto", garmentFile);
      form.append("garmentCategory", garmentCategory);
    } else if (selected) {
      form.append("garmentId", selected.id);
    } else if (pasted) {
      form.append("garmentUrl", pasted.image);
      form.append("garmentCategory", pasted.category);
    }

    try {
      const res = await fetch("/api/tryon", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setErrorHint(data.hint ?? null);
        throw new Error(data.error ?? "Generation failed");
      }
      setResult(data as TryOnResponse);
      setSessionSaved((s) => s + (data.impactKgCo2e ?? 0));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setBusy(false);
    }
  }

  function startOver() {
    setResult(null);
    setError(null);
    setErrorHint(null);
    setSelected(null);
    setPasted(null);
    setPastedUrl("");
    if (garmentPreview) URL.revokeObjectURL(garmentPreview);
    setGarmentFile(null);
    setGarmentPreview(null);
    setStep("garment");
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* ============================================ HEADER — denim panel */}
      <header className="fabric-dark bg-gradient-to-b from-dark-indigo to-raw-denim text-white">
        <div className="relative z-10 mx-auto max-w-5xl px-5 py-6 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <span className="rivet rivet-lg" aria-hidden />
            <div>
              <h1 className="display text-3xl sm:text-4xl text-white">FitMe</h1>
              <p className="label-type text-light-wash mt-0.5">
                See it on you before you order
              </p>
            </div>
          </div>

          {sessionSaved > 0 && (
            <div className="leather rounded px-5 py-2.5 text-center">
              <div className="relative z-10">
                <div className="display text-xl text-cream leading-none">
                  {sessionSaved.toFixed(2)} kg
                </div>
                <div className="label-type text-leather-light mt-1">
                  CO₂e avoided
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="stitch-line mx-5 opacity-70" />
      </header>

      <main className="flex-1 mx-auto w-full max-w-5xl px-5 py-8">
        <Steps current={step} />

        {error && (
          <div className="selvage mb-6 rounded bg-white pl-6 pr-4 py-3.5 shadow-[0_2px_8px_rgba(26,42,58,0.12)]">
            <p className="label-type text-selvage-red mb-1">Something snagged</p>
            <p className="text-sm text-charcoal">{error}</p>
            {errorHint && (
              <p className="text-sm text-muted mt-2 border-t-2 border-dashed border-thread-orange pt-2">
                {errorHint}
              </p>
            )}
          </div>
        )}

        {/* ---------------------------------------------------- Step 1: You */}
        {step === "you" && (
          <section className="grid gap-8 md:grid-cols-2">
            <div className="space-y-5">
              <div>
                <h2 className="display text-3xl text-raw-denim mb-2">
                  Start with a photo
                </h2>
                <p className="text-charcoal">
                  Roughly a quarter of clothes bought online get sent back, and
                  fit is the number one reason. One photo is enough to check
                  before you order.
                </p>
              </div>

              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="relative w-full aspect-[3/4] rounded border-2 border-dashed border-thread-orange bg-white hover:bg-bleached transition-colors overflow-hidden flex items-center justify-center shadow-[0_2px_8px_rgba(26,42,58,0.12)]"
              >
                {photoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoPreview}
                    alt="Your uploaded photo"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="px-6 text-center">
                    <span className="label-type block text-classic-indigo mb-1">
                      Click to upload
                    </span>
                    <span className="text-sm text-muted">
                      Full-body photo · JPG or PNG · up to 10MB
                    </span>
                  </span>
                )}
              </button>

              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) choosePhoto(f);
                }}
              />

              <p className="text-xs text-muted">
                Your photo is sent to the try-on model and is never saved to our
                database.
              </p>
            </div>

            <div className="space-y-5">
              <PhotoGuidance />

              <PocketPanel>
                <p className="label-type text-classic-indigo mb-4">
                  A few measurements
                </p>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <Field label="Height (in)">
                    <input
                      type="number"
                      value={heightIn}
                      onChange={(e) => setHeightIn(e.target.value)}
                      className="w-full rounded border-2 border-medium-wash bg-bleached px-3 py-2 text-sm text-charcoal shadow-[inset_0_2px_4px_rgba(26,42,58,0.08)] focus:outline-none focus:border-classic-indigo focus:bg-white"
                    />
                  </Field>
                  <Field label="Weight (lb)">
                    <input
                      type="number"
                      value={weightLb}
                      onChange={(e) => setWeightLb(e.target.value)}
                      className="w-full rounded border-2 border-medium-wash bg-bleached px-3 py-2 text-sm text-charcoal shadow-[inset_0_2px_4px_rgba(26,42,58,0.08)] focus:outline-none focus:border-classic-indigo focus:bg-white"
                    />
                  </Field>
                </div>

                <div className="mb-4">
                  <Field label="Size you usually wear">
                    <div className="flex flex-wrap gap-1.5">
                      {SIZES.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setUsualSize(s)}
                          className={`px-3 py-1.5 rounded label-type border-2 transition-colors ${
                            usualSize === s
                              ? "border-dark-indigo bg-dark-indigo text-white"
                              : "border-light-wash text-classic-indigo hover:border-classic-indigo"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </Field>
                </div>

                <Field label="How you like it to fit">
                  <div className="flex gap-1.5">
                    {(["fitted", "regular", "relaxed"] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setFitPreference(p)}
                        className={`flex-1 px-3 py-1.5 rounded label-type border-2 transition-colors ${
                          fitPreference === p
                            ? "border-dark-indigo bg-dark-indigo text-white"
                            : "border-light-wash text-classic-indigo hover:border-classic-indigo"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </Field>
              </PocketPanel>

              <button
                type="button"
                disabled={!photo}
                onClick={() => setStep("garment")}
                className={`${BTN_PRIMARY} w-full`}
              >
                {photo ? "Choose something to try on" : "Upload a photo first"}
              </button>
            </div>
          </section>
        )}

        {/* ------------------------------------------------ Step 2: Garment */}
        {step === "garment" && (
          <section className="space-y-6">
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <div>
                <h2 className="display text-3xl text-raw-denim mb-2">
                  Pick something to try on
                </h2>
                <p className="text-charcoal">
                  Choose from the rack, or paste a product link from any store.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStep("you")}
                className="label-type text-classic-indigo underline underline-offset-4 hover:text-dark-indigo"
              >
                ← Back to your photo
              </button>
            </div>

            <PocketPanel>
              <p className="label-type text-classic-indigo mb-3">
                Upload a garment image
              </p>
              <p className="text-sm text-muted mb-3">
                Works with every store. Save the product photo, or right-click
                it and &ldquo;Copy image address&rdquo; to paste below.
              </p>

              <div className="flex items-center gap-4 flex-wrap">
                <button
                  type="button"
                  onClick={() => garmentInput.current?.click()}
                  className={BTN_SECONDARY}
                >
                  Choose image…
                </button>

                {garmentPreview && (
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={garmentPreview}
                      alt="Garment to try on"
                      className="h-16 w-16 rounded object-cover border-2 border-thread-orange"
                    />
                    <div className="flex gap-1.5">
                      {(["tops", "bottoms", "one-pieces"] as const).map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setGarmentCategory(c)}
                          className={`px-2 py-0.5 rounded text-[11px] label-type border-2 ${
                            garmentCategory === c
                              ? "border-dark-indigo bg-dark-indigo text-white"
                              : "border-light-wash text-classic-indigo"
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <input
                ref={garmentInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) chooseGarmentFile(f);
                }}
              />

              <div className="border-t-2 border-dashed border-thread-orange my-4" />

              <label className="label-type text-classic-indigo block mb-3">
                …or paste a product URL
              </label>
              <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                <input
                  type="url"
                  value={pastedUrl}
                  placeholder="https://store.com/products/…"
                  onChange={(e) => setPastedUrl(e.target.value)}
                  className="flex-1 min-w-0 rounded border-2 border-medium-wash bg-bleached px-3 py-2 text-sm text-charcoal shadow-[inset_0_2px_4px_rgba(26,42,58,0.08)] focus:outline-none focus:border-classic-indigo focus:bg-white"
                />
                <button
                  type="button"
                  onClick={lookupProduct}
                  disabled={pasteBusy || !pastedUrl.trim()}
                  className={`${BTN_SECONDARY} py-2`}
                >
                  {pasteBusy ? "Reading…" : "Fetch"}
                </button>
              </div>

              {pasted && (
                <div className="mt-4 flex items-center gap-3 rounded bg-bleached border-2 border-light-wash p-3">
                  <GarmentImage
                    src={pasted.image}
                    alt={pasted.title}
                    className="h-16 w-16 rounded object-cover shrink-0 border border-light-wash"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="heading text-sm text-raw-denim truncate">
                      {pasted.title}
                    </p>
                    <div className="flex gap-1.5 mt-2">
                      {(["tops", "bottoms", "one-pieces"] as const).map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setPasted({ ...pasted, category: c })}
                          className={`px-2 py-0.5 rounded text-[11px] label-type border-2 ${
                            pasted.category === c
                              ? "border-dark-indigo bg-dark-indigo text-white"
                              : "border-light-wash text-classic-indigo"
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </PocketPanel>

            <StitchDivider />

            <div>
              <div className="flex items-baseline gap-3 flex-wrap mb-1">
                <h3 className="display text-2xl text-raw-denim">
                  From the rack
                </h3>
                <span className="badge-copper label-type rounded px-2.5 py-1 text-raw-denim">
                  Size chart included
                </span>
              </div>
              <p className="text-sm text-charcoal mb-4 max-w-2xl">
                These pieces ship with full size charts, so picking one gets you
                a <strong>recommended size and fit confidence</strong> alongside
                your try-on. Uploaded or pasted garments only get the image.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {CATALOG.map((g) => {
                const active = selected?.id === g.id;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => {
                      setSelected(g);
                      setPasted(null);
                      if (garmentPreview) URL.revokeObjectURL(garmentPreview);
                      setGarmentFile(null);
                      setGarmentPreview(null);
                    }}
                    className={`text-left rounded overflow-hidden bg-white border-2 transition-all hover:-translate-y-1 shadow-[0_2px_8px_rgba(26,42,58,0.12)] ${
                      active
                        ? "border-thread-orange ring-2 ring-thread-orange/30"
                        : "border-light-wash hover:border-classic-indigo"
                    }`}
                  >
                    <GarmentImage
                      src={g.image}
                      alt={g.name}
                      className="aspect-[3/4] w-full object-cover"
                    />
                    <div className="p-3 border-t-2 border-dashed border-thread-orange">
                      <p className="heading text-sm text-raw-denim leading-tight">
                        {g.name}
                      </p>
                      <p className="label-type text-muted mt-1">
                        ${g.priceUsd} · {g.category}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              disabled={!garmentChosen}
              onClick={generate}
              className={`${BTN_PRIMARY} w-full py-4`}
            >
              {garmentChosen ? "Try it on" : "Select a garment"}
            </button>
          </section>
        )}

        {/* ------------------------------------------------- Step 3: Result */}
        {step === "result" && (
          <section className="space-y-6">
            {busy && (
              <div className="space-y-4">
                <div className="relative mx-auto aspect-[3/4] w-full max-w-sm overflow-hidden rounded border-2 border-dashed border-thread-orange bg-bleached shimmer" />
                <p className="label-type text-center text-classic-indigo">
                  {WAIT_MESSAGES[waitIndex]}
                </p>
              </div>
            )}

            {!busy && result && (
              <>
                <div className="grid gap-5 md:grid-cols-2">
                  <figure className="space-y-2">
                    <div className="riveted relative rounded border-2 border-light-wash bg-white p-3 shadow-[0_4px_16px_rgba(26,42,58,0.18)]">
                      <GarmentImage
                        src={result.tryOn.imageUrl}
                        alt="You wearing the selected garment"
                        className="w-full rounded object-cover"
                      />
                    </div>
                    <figcaption className="text-xs text-muted text-center">
                      Generated in {(result.tryOn.ms / 1000).toFixed(1)}s ·
                      AI-generated preview, not a photograph
                    </figcaption>
                  </figure>

                  <div className="space-y-4">
                    {result.fit && (
                      <div className="selvage relative rounded bg-white pl-7 pr-5 py-5 shadow-[0_2px_8px_rgba(26,42,58,0.12)]">
                        <p className="label-type text-thread-orange mb-1">
                          Recommended size
                        </p>
                        <p className="display text-6xl text-raw-denim mb-4">
                          {result.fit.recommendedSize}
                        </p>

                        <div className="mb-4">
                          <div className="flex justify-between label-type text-muted mb-1.5">
                            <span>Fit confidence</span>
                            <span className="text-classic-indigo">
                              {Math.round(result.fit.confidence * 100)}%
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-bleached overflow-hidden border border-light-wash">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-classic-indigo to-medium-wash"
                              style={{
                                width: `${result.fit.confidence * 100}%`,
                              }}
                            />
                          </div>
                        </div>

                        <p className="text-sm text-charcoal">
                          {result.fit.rationale}
                        </p>
                        {result.fit.alternative && (
                          <p className="text-sm text-muted mt-2">
                            {result.fit.alternative}
                          </p>
                        )}
                        {result.fit.deterministic && (
                          <p className="text-[11px] text-muted mt-3">
                            Rule-based estimate (Claude refinement unavailable).
                          </p>
                        )}
                      </div>
                    )}

                    <div className="leather rounded px-6 py-5">
                      <div className="relative z-10">
                        <p className="label-type text-leather-light mb-1">
                          Estimated impact
                        </p>
                        <p className="display text-3xl text-cream">
                          {result.impactKgCo2e.toFixed(2)} kg CO₂e avoided
                        </p>
                        <p className="text-sm text-cream/85 mt-2">
                          Roughly {equivalence(result.impactKgCo2e)}, from one
                          return that likely won&apos;t happen.
                        </p>
                        <button
                          type="button"
                          onClick={() => setShowAssumptions((v) => !v)}
                          className="mt-3 label-type text-leather-light underline underline-offset-4 hover:text-cream"
                        >
                          {showAssumptions ? "Hide" : "Show"} our assumptions
                        </button>
                        {showAssumptions && (
                          <dl className="mt-4 space-y-2.5 text-xs border-t border-leather-light/40 pt-4">
                            {ASSUMPTIONS.map((a) => (
                              <div key={a.key}>
                                <dt className="heading text-cream">
                                  {a.label}: {a.value} {a.unit}
                                </dt>
                                <dd className="text-cream/70">{a.source}</dd>
                              </div>
                            ))}
                          </dl>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <StitchDivider />

                <div className="flex gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={startOver}
                    className={BTN_PRIMARY}
                  >
                    Try another item
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep("you")}
                    className={BTN_SECONDARY}
                  >
                    Use a different photo
                  </button>
                </div>
              </>
            )}

            {!busy && !result && (
              <div className="text-center py-12 space-y-4">
                <p className="text-charcoal">
                  That try-on didn&apos;t complete.
                </p>
                <button
                  type="button"
                  onClick={() => setStep("garment")}
                  className={BTN_SECONDARY}
                >
                  Back to the rack
                </button>
              </div>
            )}
          </section>
        )}
      </main>

      {/* ============================================ FOOTER — raw denim */}
      <footer className="fabric-dark bg-raw-denim text-stonewash mt-8">
        <div className="stitch-line mx-5 mt-5 opacity-70" />
        <div className="relative z-10 mx-auto max-w-5xl px-5 py-7 text-center">
          <div className="flex justify-center gap-4 mb-4" aria-hidden>
            {Array.from({ length: 5 }).map((_, i) => (
              <span key={i} className="rivet" />
            ))}
          </div>
          <p className="label-type text-medium-wash">
            FitMe Demo for OwlHacks 2026!
          </p>
          <p className="text-xs text-light-wash/70 mt-2">
            Try-on images are AI-generated previews, not photographs.
          </p>
        </div>
      </footer>
    </div>
  );
}

/** Dashed thread run with a copper rivet at the centre. */
function StitchDivider() {
  return (
    <div className="flex items-center justify-center gap-4 py-2" aria-hidden>
      <div className="stitch-line-gold flex-1 max-w-[200px]" />
      <span className="rivet" />
      <div className="stitch-line-gold flex-1 max-w-[200px]" />
    </div>
  );
}

function Steps({ current }: { current: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "you", label: "Your photo" },
    { key: "garment", label: "The garment" },
    { key: "result", label: "Your fit" },
  ];
  const activeIndex = steps.findIndex((s) => s.key === current);

  return (
    <ol className="flex items-center gap-3 mb-8 flex-wrap">
      {steps.map((s, i) => (
        <li key={s.key} className="flex items-center gap-3">
          <span className="flex items-center gap-2">
            <span
              className={`grid h-8 w-8 place-items-center rounded-full display text-sm shadow-[0_2px_8px_rgba(26,42,58,0.12)] ${
                i <= activeIndex
                  ? "bg-classic-indigo text-white"
                  : "bg-white text-light-wash border-2 border-light-wash"
              }`}
            >
              {i + 1}
            </span>
            <span
              className={`label-type ${
                i <= activeIndex ? "text-raw-denim" : "text-muted"
              }`}
            >
              {s.label}
            </span>
          </span>
          {i < steps.length - 1 && (
            <span aria-hidden className="stitch-line w-8 opacity-60" />
          )}
        </li>
      ))}
    </ol>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="label-type text-muted block mb-1.5">{label}</span>
      {children}
    </label>
  );
}
