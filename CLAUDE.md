# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal portfolio/landing page for murfalo.com, hosted on GitHub Pages. Pure static HTML/CSS/JS site with no build system, no dependencies, and no backend.

## Development

There are no build or lint commands. The site is a single `index.html` file with inline CSS, inline SVG icons, and inline JavaScript. To preview locally, open `index.html` in a browser.

## Testing

Run `bash tests/ci.sh` from the repo root. This runs fast, dependency-free checks (asset existence, HTML structure, webmanifest validity, fragment references, image integrity, merge conflict markers). CI runs the same script via `.github/workflows/ci.yaml`.

## Deployment

Pushing to `main` triggers the GitHub Actions workflow (`.github/workflows/deploy.yaml`) which deploys the repo root to GitHub Pages automatically.

## Architecture

- `index.html` — entire site (HTML + embedded CSS + inline SVG icons + inline JS)
- `img/` — avatar image and favicon assets
- `site.webmanifest` — PWA manifest

### Interactive Features (all inline JS in index.html)

- **WebGL lava lamp** — metaball field computed at half resolution into a half-float texture, then neon/CRT shading at full resolution (single-pass fallback); fixed 60 Hz physics with per-frame interpolation; viewport-scaled radii
- **CRT look** — in-shader scanlines, vignette and a Bayer-dithered backdrop weave
- **Typewriter** — cycles random words in the bio line
- **Pop / reassemble** — blobs scatter on first interaction, reassemble when gathered
- **Speed glow** — fast-moving blobs glow brighter/pinker
- **Touch** — cursor blob ploops in on press and out on lift
- **Shake to scatter** — DeviceMotion API on mobile
- **Debug** — `?fps` shows a frame-time readout, `?scale=N` overrides render resolution

## Styling Conventions

All CSS is embedded in `index.html` using CSS variables for theming:
- Dark theme (`--color-bg: #0e0c14`) with purple accent (`--color-primary: #8b5cf6`)
- Modern CSS: flexbox, `100dvh`, CSS animations, custom properties
- Responsive design with no media query breakpoints (fluid layout, viewport-scaled blob radii)
