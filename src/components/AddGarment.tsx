"use client";

import { useRef, useState } from "react";
import { PocketPanel } from "./PocketPanel";
import {
  fileToDownscaledDataUrl,
  newGarmentId,
  saveCustomGarment,
  type CustomGarment,
} from "@/lib/customGarments";
import type { GarmentCategory, SizeChartRow, SizeLabel } from "@/lib/types";

const CATEGORIES: GarmentCategory[] = ["tops", "bottoms", "one-pieces"];

const FIELD =
  "w-full rounded border-2 border-medium-wash bg-bleached px-3 py-2 text-sm text-charcoal shadow-[inset_0_2px_4px_rgba(26,42,58,0.08)] focus:outline-none focus:border-classic-indigo focus:bg-white";

/** Blank chart for manual entry, used when parsing isn't available. */
function blankChart(): SizeChartRow[] {
  return ["S", "M", "L", "XL"].map((size) => ({ size: size as SizeLabel }));
}

export function AddGarment({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);

  const [image, setImage] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [priceUsd, setPriceUsd] = useState("");
  const [fabric, setFabric] = useState("");
  const [category, setCategory] = useState<GarmentCategory>("tops");

  const [chartText, setChartText] = useState("");
  const [chart, setChart] = useState<SizeChartRow[] | null>(null);
  const [parsing, setParsing] = useState(false);
  const [manual, setManual] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const fileInput = useRef<HTMLInputElement>(null);
  const usesWaist = category === "bottoms";

  function reset() {
    setImage(null);
    setName("");
    setPriceUsd("");
    setFabric("");
    setCategory("tops");
    setChartText("");
    setChart(null);
    setManual(false);
    setError(null);
    setHint(null);
  }

  async function pickImage(file: File) {
    setError(null);
    try {
      setImage(await fileToDownscaledDataUrl(file));
    } catch {
      setError("Couldn't read that image. Try a JPG or PNG.");
    }
  }

  async function parseChart() {
    if (!chartText.trim()) return;
    setParsing(true);
    setError(null);
    setHint(null);
    try {
      const res = await fetch("/api/parse-size-chart", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: chartText, category }),
      });
      const data = await res.json();
      if (!res.ok) {
        setHint(data.hint ?? null);
        throw new Error(data.error ?? "Couldn't read that chart");
      }
      setChart(data.sizeChart);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that chart");
      setManual(true);
      if (!chart) setChart(blankChart());
    } finally {
      setParsing(false);
    }
  }

  function updateCell(size: SizeLabel, key: keyof SizeChartRow, value: string) {
    const num = value === "" ? undefined : Number(value);
    setChart((rows) =>
      (rows ?? []).map((r) =>
        r.size === size ? { ...r, [key]: Number.isNaN(num) ? undefined : num } : r
      )
    );
  }

  function save() {
    setError(null);
    if (!image) return setError("Add a photo of the garment.");
    if (!name.trim()) return setError("Give it a name.");

    const usable = (chart ?? []).filter((r) =>
      usesWaist ? r.waist !== undefined : r.chest !== undefined
    );
    if (usable.length === 0) {
      return setError(
        `Add at least one size with a ${usesWaist ? "waist" : "chest"} measurement — that's what the size recommendation reads.`
      );
    }

    const garment: CustomGarment = {
      custom: true,
      addedAt: Date.now(),
      id: newGarmentId(),
      name: name.trim(),
      brand: "Added by you",
      priceUsd: Number(priceUsd) || 0,
      category,
      image,
      fabric: fabric.trim() || "Not specified",
      sizeChart: usable,
    };

    const result = saveCustomGarment(garment);
    if (!result.ok) return setError(result.error);

    reset();
    setOpen(false);
    onAdded();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded border-2 border-dashed border-thread-orange bg-white/60 px-5 py-4 label-type text-classic-indigo hover:bg-white transition-colors"
      >
        + Add your own garment
      </button>
    );
  }

  return (
    <PocketPanel>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="label-type text-classic-indigo">Add your own garment</p>
          <p className="text-sm text-muted mt-1">
            Saved in this browser only — it won&apos;t sync to your teammates.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="label-type text-muted hover:text-foreground shrink-0"
        >
          Cancel
        </button>
      </div>

      {error && (
        <div className="selvage mb-4 rounded bg-white pl-5 pr-3 py-2.5">
          <p className="text-sm text-charcoal">{error}</p>
          {hint && <p className="text-sm text-muted mt-1">{hint}</p>}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-[120px_1fr] mb-4">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="aspect-[3/4] rounded border-2 border-dashed border-thread-orange bg-bleached overflow-hidden flex items-center justify-center"
        >
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="label-type text-medium-wash px-2 text-center">
              Add photo
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
            if (f) pickImage(f);
          }}
        />

        <div className="space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (e.g. Ribbed Knit Top)"
            className={FIELD}
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              value={priceUsd}
              onChange={(e) => setPriceUsd(e.target.value)}
              placeholder="Price"
              inputMode="decimal"
              className={FIELD}
            />
            <input
              value={fabric}
              onChange={(e) => setFabric(e.target.value)}
              placeholder="Fabric"
              className={FIELD}
            />
          </div>
          <div className="flex gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`flex-1 px-2 py-1.5 rounded label-type border-2 transition-colors ${
                  category === c
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

      <div className="border-t-2 border-dashed border-thread-orange pt-4">
        <p className="label-type text-classic-indigo mb-1">Size chart</p>
        <p className="text-sm text-muted mb-3">
          Copy the size table off the product page and paste it here — it gets
          read into a chart. This is what earns a size recommendation.
        </p>

        <textarea
          value={chartText}
          onChange={(e) => setChartText(e.target.value)}
          rows={4}
          placeholder={"Size  Chest  Length\nS     36     27\nM     40     28\n…"}
          className={`${FIELD} font-mono text-xs`}
        />

        <div className="flex gap-2 flex-wrap mt-3">
          <button
            type="button"
            onClick={parseChart}
            disabled={parsing || !chartText.trim()}
            className="rounded border-2 border-classic-indigo px-4 py-2 label-type text-classic-indigo hover:bg-bleached disabled:opacity-40"
          >
            {parsing ? "Reading…" : "Read the chart"}
          </button>
          <button
            type="button"
            onClick={() => {
              setManual(true);
              if (!chart) setChart(blankChart());
            }}
            className="label-type text-muted underline underline-offset-4 hover:text-foreground"
          >
            Enter it by hand
          </button>
        </div>

        {chart && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="label-type text-muted">
                  <th className="text-left pb-2 pr-3">Size</th>
                  <th className="text-left pb-2 pr-3">
                    {usesWaist ? "Waist" : "Chest"} (in)
                  </th>
                  <th className="text-left pb-2">
                    {usesWaist ? "Hip" : "Length"} (in)
                  </th>
                </tr>
              </thead>
              <tbody>
                {chart.map((row) => (
                  <tr key={row.size}>
                    <td className="pr-3 py-1 heading text-raw-denim">
                      {row.size}
                    </td>
                    <td className="pr-3 py-1">
                      <input
                        value={(usesWaist ? row.waist : row.chest) ?? ""}
                        onChange={(e) =>
                          updateCell(
                            row.size,
                            usesWaist ? "waist" : "chest",
                            e.target.value
                          )
                        }
                        inputMode="decimal"
                        className={`${FIELD} py-1`}
                      />
                    </td>
                    <td className="py-1">
                      <input
                        value={(usesWaist ? row.hip : row.length) ?? ""}
                        onChange={(e) =>
                          updateCell(
                            row.size,
                            usesWaist ? "hip" : "length",
                            e.target.value
                          )
                        }
                        inputMode="decimal"
                        className={`${FIELD} py-1`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!manual && (
              <p className="text-xs text-muted mt-2">
                Read from your paste — check the numbers before saving.
              </p>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={save}
        className="mt-5 w-full stitched rounded bg-dark-indigo text-white py-3 label-type hover:bg-classic-indigo transition-colors"
      >
        Save to catalog
      </button>
    </PocketPanel>
  );
}
