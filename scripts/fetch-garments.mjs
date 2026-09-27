#!/usr/bin/env node
/**
 * Download catalog garment images into public/garments/.
 *
 *   1. Put image URLs in garments.txt (one `id=url` per line)
 *   2. npm run garments
 *
 * Saves each file with its REAL extension and rewrites the matching `image:`
 * field in src/lib/catalog.ts to match. That matters: if we saved a .webp as
 * .jpg, Next would serve it as image/jpeg with webp bytes, and the try-on
 * model can reject the mismatch.
 *
 * Get a URL by right-clicking a product photo and choosing "Copy image
 * address". Flat-lay or plain-background shots work far better than on-model
 * shots. Large retailers block page scraping but generally serve their image
 * CDNs fine, so this works even where pasting the product URL does not.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const listPath = path.join(root, "garments.txt");
const outDir = path.join(root, "public", "garments");
const catalogPath = path.join(root, "src", "lib", "catalog.ts");

const EXT_BY_TYPE = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/avif": ".avif",
  "image/gif": ".gif",
};

const HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
  accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
};

const MAX_BYTES = 10 * 1024 * 1024;

function parseList(text) {
  const entries = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;
    const at = line.indexOf("=");
    if (at === -1) {
      console.warn(`  line ${i + 1}: skipped, expected "id=url" — got "${line}"`);
      return;
    }
    const id = line.slice(0, at).trim();
    const url = line.slice(at + 1).trim();
    if (!id || !url) {
      console.warn(`  line ${i + 1}: skipped, blank id or url`);
      return;
    }
    entries.push({ id, url });
  });
  return entries;
}

async function download({ id, url }) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { id, ok: false, reason: "not a valid URL" };
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return { id, ok: false, reason: "only http(s) URLs" };
  }

  let res;
  try {
    res = await fetch(parsed, {
      headers: HEADERS,
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    return { id, ok: false, reason: `fetch failed — ${err.message}` };
  }

  if (!res.ok) {
    const hint =
      res.status === 403 || res.status === 400
        ? " (CDN blocked us — try saving the image by hand instead)"
        : "";
    return { id, ok: false, reason: `HTTP ${res.status}${hint}` };
  }

  const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
  const ext = EXT_BY_TYPE[type];
  if (!ext) {
    return {
      id,
      ok: false,
      reason: `not an image (content-type: ${type || "unknown"}) — is this a product PAGE rather than the image itself?`,
    };
  }

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0) return { id, ok: false, reason: "empty response" };
  if (buf.length > MAX_BYTES) {
    return { id, ok: false, reason: `too large (${(buf.length / 1e6).toFixed(1)}MB)` };
  }

  const file = `${id}${ext}`;
  await writeFile(path.join(outDir, file), buf);
  return { id, ok: true, file, bytes: buf.length, publicPath: `/garments/${file}` };
}

/** Point each catalog entry at the file we actually saved. */
async function syncCatalog(results) {
  let source = await readFile(catalogPath, "utf8");
  let changed = 0;

  for (const r of results) {
    if (!r.ok) continue;
    // Match the image: line inside the block whose id is this garment.
    const re = new RegExp(
      `(id:\\s*"${r.id}"[\\s\\S]*?image:\\s*")[^"]*(")`,
      "m"
    );
    if (!re.test(source)) {
      console.warn(`  note: no catalog entry found for "${r.id}"`);
      continue;
    }
    const next = source.replace(re, `$1${r.publicPath}$2`);
    if (next !== source) changed++;
    source = next;
  }

  if (changed > 0) {
    await writeFile(catalogPath, source, "utf8");
  }
  return changed;
}

async function main() {
  if (!existsSync(listPath)) {
    console.error(
      `No garments.txt found.\n\nCreate one at ${listPath} with lines like:\n\n  heavyweight-tee=https://cdn.example.com/tee.jpg\n`
    );
    process.exit(1);
  }

  await mkdir(outDir, { recursive: true });

  const entries = parseList(await readFile(listPath, "utf8"));
  if (entries.length === 0) {
    console.error("garments.txt has no usable `id=url` lines.");
    process.exit(1);
  }

  console.log(`Downloading ${entries.length} garment image(s)…\n`);
  const results = await Promise.all(entries.map(download));

  for (const r of results) {
    if (r.ok) {
      console.log(`  OK    ${r.id} → ${r.file} (${(r.bytes / 1024).toFixed(0)} KB)`);
    } else {
      console.log(`  FAIL  ${r.id} — ${r.reason}`);
    }
  }

  const changed = await syncCatalog(results);
  const ok = results.filter((r) => r.ok).length;

  console.log(
    `\n${ok}/${results.length} saved to public/garments/` +
      (changed ? `, ${changed} catalog path(s) updated.` : ".")
  );

  if (ok < results.length) {
    console.log(
      "\nFor the ones that failed: open the product page, right-click the photo,\n" +
        '"Copy image address", and make sure the URL ends in an image file.'
    );
  }
  process.exit(ok === results.length ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
