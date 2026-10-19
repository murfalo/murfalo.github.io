# CLAUDE.md

Personal landing page for murfalo.com. SvelteKit, prerendered by the static adapter, hosted on GitHub Pages. Tools: pnpm and Vite+ (`vp`).

## Commands

- `pnpm install`, then `vp dev`
- `vp check` (format and lint), `vp run check:svelte` (types), `vp test`, `vp build`

A push to `main` runs `.github/workflows/ci.yaml`: it checks, tests, builds and deploys.

## Layout

- `src/routes/+page.svelte`: the markup and all CSS. `src/app.html`: head tags.
- `src/lib/lava/`: the lava lamp. `sim.ts` is the physics, `gl.ts` the WebGL renderer, `index.ts` the wiring.
- `src/lib/links.ts`: the profile links and icons.
- `static/`: served as is. Keep the paths; other sites link to `/img/murfalo.png`.

## Notes

- SvelteKit 3 config is in `vite.config.ts`. There is no `svelte.config.js`.
- Keep the versions in `pnpm-workspace.yaml` the same as the `vite-plus` version.
- The lamp renders at CSS resolution (`?scale=2` for full resolution, `?fps` for a readout). Do not add PixiJS: a test port was slower and added 155 KB.
