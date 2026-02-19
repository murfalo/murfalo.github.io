# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal portfolio/landing page for murfalo.com, hosted on GitHub Pages. Pure static HTML/CSS/JS site with no build system, no dependencies, and no backend.

## Development

There are no build, lint, or test commands. The site is a single `index.html` file with inline CSS, inline SVG icons, and inline JavaScript. To preview locally, open `index.html` in a browser.

## Deployment

Pushing to `main` triggers the GitHub Actions workflow (`.github/workflows/deploy.yaml`) which deploys the repo root to GitHub Pages automatically.

## Architecture

- `index.html` — entire site (HTML + embedded CSS + inline SVG icons + inline JS)
- `img/` — avatar image and favicon assets
- `site.webmanifest` — PWA manifest

### Interactive Features (all inline JS in index.html)

- **WebGL lava lamp** — metaball shader with 64 blob uniforms, DPR-aware canvas sizing, viewport-scaled radii
- **Typewriter** — cycles random words in the bio line
- **Avatar spin + vomit orbs** — hold avatar to spin and spray blobs, triggers party mode (hue rotation)
- **Pop / reassemble** — blobs scatter on first interaction, reassemble when gathered
- **Idle dance** — after inactivity, blobs form shapes (heart, M, smiley) then return home
- **Shake to scatter** — DeviceMotion API on mobile
- **Return visitor memory** — localStorage visit counter with escalating hints

## Styling Conventions

All CSS is embedded in `index.html` using CSS variables for theming:
- Dark theme (`--color-bg: #18181b`) with purple accent (`--color-primary: #8b5cf6`)
- Modern CSS: flexbox, `100dvh`, CSS animations, custom properties
- Responsive design with no media query breakpoints (fluid layout, viewport-scaled blob radii)
