"use client";

import { useEffect, useRef, useState } from "react";
import { CATALOG } from "@/lib/catalog";
import { ASSUMPTIONS, equivalence } from "@/lib/impact";
import { GarmentImage } from "@/components/GarmentImage";
import { PhotoGuidance } from "@/components/PhotoGuidance";
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

  const [busy, setBusy] = useState(false);
  const [waitIndex, setWaitIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TryOnResponse | null>(null);
  const [sessionSaved, setSessionSaved] = useState(0);
  const [showAssumptions, setShowAssumptions] = useState(false);

  const fileInput = useRef<HTMLInputElement>(null);

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

  const garmentChosen = selected ?? pasted;

  async function lookupProduct() {
    if (!pastedUrl.trim()) return;
    setPasteBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/product?url=${encodeURIComponent(pastedUrl)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Lookup failed");
      setPasted({ image: data.image, title: data.title, category: "tops" });
      setSelected(null);
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
    setResult(null);
    setStep("result");

    const form = new FormData();
    form.append("photo", photo);
    form.append("heightIn", heightIn);
    form.append("weightLb", weightLb);
    form.append("usualSize", usualSize);
    form.append("fitPreference", fitPreference);
    if (selected) {
      form.append("garmentId", selected.id);
    } else if (pasted) {
      form.append("garmentUrl", pasted.image);
      form.append("garmentCategory", pasted.category);
    }

    try {
      const res = await fetch("/api/tryon", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
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
    setSelected(null);
    setPasted(null);
    setPastedUrl("");
    setStep("garment");
  }

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b border-border">
        <div className="mx-auto max-w-5xl px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-baseline gap-2.5">
            <span className="text-lg font-semibold tracking-tight">FitMe</span>
            <span className="text-xs text-muted hidden sm:inline">
              See it on you before you order
            </span>
          </div>
          {sessionSaved > 0 && (
            <div className="text-right">
              <div className="text-sm font-semibold text-accent">
                {sessionSaved.toFixed(2)} kg CO₂e
              </div>
              <div className="text-[11px] text-muted">avoided this session</div>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-5xl px-5 py-8">
        <Steps current={step} />

        {error && (
          <div className="mb-6 rounded-xl border border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/40 px-4 py-3 text-sm text-red-800 dark:text-red-200">
            {error}
          </div>
        )}

        {/* ---------------------------------------------------- Step 1: You */}
        {step === "you" && (
          <section className="grid gap-8 md:grid-cols-2">
            <div className="space-y-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight mb-1.5">
                  Start with a photo
                </h1>
                <p className="text-sm text-muted">
                  Roughly a quarter of clothes bought online get sent back, and
                  fit is the number one reason. One photo is enough to check
                  before you order.
                </p>
              </div>

              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="relative w-full aspect-[3/4] rounded-xl border-2 border-dashed border-border hover:border-accent transition-colors overflow-hidden bg-surface flex items-center justify-center"
              >
                {photoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoPreview}
                    alt="Your uploaded photo"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-sm text-muted px-6 text-center">
                    Click to upload a full-body photo
                    <br />
                    <span className="text-xs">JPG or PNG, up to 10MB</span>
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

              <div className="rounded-xl border border-border bg-surface p-4 space-y-4">
                <p className="text-sm font-medium">A few measurements</p>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Height (in)">
                    <input
                      type="number"
                      value={heightIn}
                      onChange={(e) => setHeightIn(e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    />
                  </Field>
                  <Field label="Weight (lb)">
                    <input
                      type="number"
                      value={weightLb}
                      onChange={(e) => setWeightLb(e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    />
                  </Field>
                </div>

                <Field label="Size you usually wear">
                  <div className="flex flex-wrap gap-1.5">
                    {SIZES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setUsualSize(s)}
                        className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                          usualSize === s
                            ? "border-accent bg-accent text-accent-contrast font-medium"
                            : "border-border hover:border-accent"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="How you like it to fit">
                  <div className="flex gap-1.5">
                    {(["fitted", "regular", "relaxed"] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setFitPreference(p)}
                        className={`flex-1 px-3 py-1.5 rounded-lg text-sm border capitalize transition-colors ${
                          fitPreference === p
                            ? "border-accent bg-accent text-accent-contrast font-medium"
                            : "border-border hover:border-accent"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>

              <button
                type="button"
                disabled={!photo}
                onClick={() => setStep("garment")}
                className="w-full rounded-lg bg-accent text-accent-contrast py-2.5 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
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
                <h1 className="text-2xl font-semibold tracking-tight mb-1.5">
                  Pick something to try on
                </h1>
                <p className="text-sm text-muted">
                  Choose from the catalog, or paste a product link from any
                  store.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStep("you")}
                className="text-sm text-muted hover:text-foreground underline"
              >
                Back to your photo
              </button>
            </div>

            <div className="rounded-xl border border-border bg-surface p-4">
              <label className="text-sm font-medium block mb-2">
                Paste a product URL
              </label>
              <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                <input
                  type="url"
                  value={pastedUrl}
                  placeholder="https://store.com/products/…"
                  onChange={(e) => setPastedUrl(e.target.value)}
                  className="flex-1 min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={lookupProduct}
                  disabled={pasteBusy || !pastedUrl.trim()}
                  className="rounded-lg border border-accent px-4 py-2 text-sm font-medium text-accent disabled:opacity-40"
                >
                  {pasteBusy ? "Reading…" : "Fetch"}
                </button>
              </div>
              {pasted && (
                <div className="mt-3 flex items-center gap-3 rounded-lg bg-accent-soft p-2.5">
                  <GarmentImage
                    src={pasted.image}
                    alt={pasted.title}
                    className="h-16 w-16 rounded object-cover shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {pasted.title}
                    </p>
                    <div className="flex gap-1.5 mt-1.5">
                      {(["tops", "bottoms", "one-pieces"] as const).map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() =>
                            setPasted({ ...pasted, category: c })
                          }
                          className={`px-2 py-0.5 rounded text-[11px] border ${
                            pasted.category === c
                              ? "border-accent bg-accent text-accent-contrast"
                              : "border-border"
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
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
                    }}
                    className={`text-left rounded-xl border overflow-hidden bg-surface transition-colors ${
                      active
                        ? "border-accent ring-2 ring-accent/30"
                        : "border-border hover:border-accent"
                    }`}
                  >
                    <GarmentImage
                      src={g.image}
                      alt={g.name}
                      className="aspect-[3/4] w-full object-cover"
                    />
                    <div className="p-2.5">
                      <p className="text-sm font-medium leading-tight">
                        {g.name}
                      </p>
                      <p className="text-xs text-muted mt-0.5">
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
              className="w-full rounded-lg bg-accent text-accent-contrast py-3 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
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
                <div className="relative mx-auto aspect-[3/4] w-full max-w-sm overflow-hidden rounded-xl border border-border bg-surface-muted shimmer" />
                <p className="text-center text-sm text-muted">
                  {WAIT_MESSAGES[waitIndex]}
                </p>
              </div>
            )}

            {!busy && result && (
              <>
                <div className="grid gap-5 md:grid-cols-2">
                  <figure className="space-y-2">
                    <GarmentImage
                      src={result.tryOn.imageUrl}
                      alt="You wearing the selected garment"
                      className="w-full rounded-xl border border-border object-cover"
                    />
                    <figcaption className="text-xs text-muted text-center">
                      Generated in {(result.tryOn.ms / 1000).toFixed(1)}s ·
                      AI-generated preview, not a photograph
                    </figcaption>
                  </figure>

                  <div className="space-y-4">
                    {result.fit && (
                      <div className="rounded-xl border border-border bg-surface p-5">
                        <p className="text-xs uppercase tracking-wide text-muted mb-1">
                          Recommended size
                        </p>
                        <p className="text-4xl font-semibold tracking-tight mb-3">
                          {result.fit.recommendedSize}
                        </p>

                        <div className="mb-3">
                          <div className="flex justify-between text-xs text-muted mb-1">
                            <span>Fit confidence</span>
                            <span>
                              {Math.round(result.fit.confidence * 100)}%
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-surface-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-accent"
                              style={{
                                width: `${result.fit.confidence * 100}%`,
                              }}
                            />
                          </div>
                        </div>

                        <p className="text-sm">{result.fit.rationale}</p>
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

                    <div className="rounded-xl border border-accent/40 bg-accent-soft p-5">
                      <p className="text-xs uppercase tracking-wide text-muted mb-1">
                        Estimated impact
                      </p>
                      <p className="text-2xl font-semibold tracking-tight text-accent">
                        {result.impactKgCo2e.toFixed(2)} kg CO₂e avoided
                      </p>
                      <p className="text-sm text-muted mt-1">
                        Roughly {equivalence(result.impactKgCo2e)}, from one
                        return that likely won&apos;t happen.
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowAssumptions((v) => !v)}
                        className="mt-3 text-xs underline text-muted hover:text-foreground"
                      >
                        {showAssumptions ? "Hide" : "Show"} our assumptions
                      </button>
                      {showAssumptions && (
                        <dl className="mt-3 space-y-2 text-xs">
                          {ASSUMPTIONS.map((a) => (
                            <div key={a.key}>
                              <dt className="font-medium">
                                {a.label}: {a.value} {a.unit}
                              </dt>
                              <dd className="text-muted">{a.source}</dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={startOver}
                    className="rounded-lg bg-accent text-accent-contrast px-5 py-2.5 text-sm font-medium"
                  >
                    Try another item
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep("you")}
                    className="rounded-lg border border-border px-5 py-2.5 text-sm"
                  >
                    Use a different photo
                  </button>
                </div>
              </>
            )}

            {!busy && !result && (
              <div className="text-center py-12 space-y-4">
                <p className="text-sm text-muted">
                  That try-on didn&apos;t complete.
                </p>
                <button
                  type="button"
                  onClick={() => setStep("garment")}
                  className="rounded-lg border border-border px-5 py-2.5 text-sm"
                >
                  Back to the catalog
                </button>
              </div>
            )}
          </section>
        )}
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-5xl px-5 py-4 text-xs text-muted">
          Built at Temple Owl Hacks · Sustainability track. Try-on images are
          AI-generated previews, not photographs.
        </div>
      </footer>
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
    <ol className="flex items-center gap-2 mb-8 text-xs">
      {steps.map((s, i) => (
        <li key={s.key} className="flex items-center gap-2">
          <span
            className={`flex items-center gap-1.5 ${
              i <= activeIndex ? "text-foreground" : "text-muted"
            }`}
          >
            <span
              className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-semibold ${
                i <= activeIndex
                  ? "bg-accent text-accent-contrast"
                  : "bg-surface-muted text-muted"
              }`}
            >
              {i + 1}
            </span>
            {s.label}
          </span>
          {i < steps.length - 1 && (
            <span aria-hidden className="text-border">
              ──
            </span>
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
      <span className="text-xs text-muted block mb-1.5">{label}</span>
      {children}
    </label>
  );
}
