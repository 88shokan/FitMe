# Garment images

One image per entry in `src/lib/catalog.ts`, named by its `id`.

Don't add them by hand — list the URLs in `garments.txt` at the repo root and run:

    npm run garments

That downloads each image with its real extension and points `catalog.ts` at the
file it actually saved. Flat-lay or plain-background product shots work far
better than on-model shots.

Local files (rather than hotlinked store URLs) keep the demo working on bad wifi.
