import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

/**
 * Turn a size table copied off a product page into a structured chart.
 *
 * This exists so adding a garment isn't sixteen number inputs. Retailers format
 * these tables every way imaginable — columns as sizes, rows as sizes, ranges
 * ("38-40"), centimetres, numeric sizes, extra rows for sleeve and inseam — and
 * that messy-input-to-schema job is exactly what an LLM is good at.
 *
 * Without ANTHROPIC_API_KEY this returns 503 and the UI falls back to manual
 * entry, so the feature degrades instead of breaking.
 */
export const runtime = "nodejs";
export const maxDuration = 30;

const ChartSchema = z.object({
  rows: z
    .array(
      z.object({
        size: z.enum(["XS", "S", "M", "L", "XL", "XXL"]),
        // Nullable rather than optional: structured outputs want every key present.
        chest: z.number().nullable(),
        waist: z.number().nullable(),
        hip: z.number().nullable(),
        length: z.number().nullable(),
      })
    )
    .describe("One row per size found. Omit sizes the table doesn't list."),
  unit: z.enum(["in", "cm"]).describe("The unit the source table used."),
  confident: z
    .boolean()
    .describe("False if the text didn't clearly contain a size chart."),
});

const CM_PER_IN = 2.54;

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error: "Size-chart parsing needs ANTHROPIC_API_KEY in .env.local.",
        hint: "You can still type the measurements in by hand.",
      },
      { status: 503 }
    );
  }

  let body: { text?: string; category?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON." }, { status: 400 });
  }

  const text = (body.text ?? "").trim();
  if (text.length < 10) {
    return NextResponse.json(
      { error: "Paste the size table first." },
      { status: 400 }
    );
  }
  if (text.length > 8000) {
    return NextResponse.json(
      { error: "That's a lot of text — paste just the size table." },
      { status: 413 }
    );
  }

  try {
    const client = new Anthropic();

    const response = await client.messages.parse({
      model: "claude-opus-5",
      max_tokens: 4000,
      // In the user's path while they wait, so trade depth for latency.
      output_config: { effort: "low", format: zodOutputFormat(ChartSchema) },
      system:
        "You extract garment size charts from text copied off retail product pages. " +
        "The table may be oriented either way, use numeric sizes, give ranges, or be in " +
        "centimetres. Map numeric or worded sizes onto XS-XXL. For a range like " +
        '"38-40", take the midpoint. Report measurements in the unit the source used ' +
        "and set `unit` accordingly. Never invent measurements that are not present: " +
        "use null for anything the table doesn't give, and set confident=false if the " +
        "text isn't recognisably a size chart.",
      messages: [
        {
          role: "user",
          content: [
            body.category ? `Garment category: ${body.category}` : "",
            "Size table:",
            text,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    });

    const parsed = response.parsed_output;
    if (!parsed || !parsed.confident || parsed.rows.length === 0) {
      return NextResponse.json(
        {
          error: "That didn't look like a size chart.",
          hint: "Copy the table including its size labels, or enter the measurements by hand.",
        },
        { status: 422 }
      );
    }

    const toInches = (v: number | null) =>
      v === null ? undefined : parsed.unit === "cm" ? Number((v / CM_PER_IN).toFixed(1)) : v;

    const sizeChart = parsed.rows.map((r) => ({
      size: r.size,
      chest: toInches(r.chest),
      waist: toInches(r.waist),
      hip: toInches(r.hip),
      length: toInches(r.length),
    }));

    return NextResponse.json({ sizeChart, sourceUnit: parsed.unit });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api/parse-size-chart]", err);
    return NextResponse.json(
      {
        error: `Couldn't read that chart: ${message}`,
        hint: "You can still type the measurements in by hand.",
      },
      { status: 502 }
    );
  }
}
