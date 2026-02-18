# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal portfolio/landing page for murfalo.com, hosted on GitHub Pages. Pure static HTML/CSS site with no build system, no JavaScript dependencies, and no backend.

## Development

There are no build, lint, or test commands. The site is a single `index.html` file with inline CSS and inline SVG icons. To preview locally, open `index.html` in a browser.

## Deployment

Pushing to `main` triggers the GitHub Actions workflow (`.github/workflows/deploy.yaml`) which deploys the repo root to GitHub Pages automatically.

## Architecture

- `index.html` — entire site (HTML + embedded CSS + inline SVG icons)
- `img/` — avatar image
- `Favicons/` — favicon assets in multiple sizes/formats
- `site.webmanifest` — PWA manifest

## Styling Conventions

All CSS is embedded in `index.html` using CSS variables for theming:
- Dark theme (`--color-bg: #18181b`) with purple accent (`--color-primary: #8b5cf6`)
- Modern CSS: flexbox, grid, `100dvh`, CSS animations, custom properties
- Responsive design with no media query breakpoints (fluid layout)
