// The prerender step fails on broken links in the page, but it does not read the web manifest
import { readFileSync } from 'node:fs';
import { expect, test } from 'vite-plus/test';

const manifest = JSON.parse(readFileSync('static/site.webmanifest', 'utf8'));

test('web manifest has the required fields', () => {
	for (const field of ['name', 'icons', 'theme_color', 'background_color', 'display']) {
		expect(manifest).toHaveProperty(field);
	}
});

test.each(manifest.icons as { src: string; sizes: string; type: string }[])('icon $src is a PNG of $sizes', (icon) => {
	expect(icon.type).toBe('image/png');
	const png = readFileSync(`static${icon.src}`);
	expect(png.subarray(1, 4).toString()).toBe('PNG');
	// The IHDR chunk holds the width and height at bytes 16..24
	expect(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`).toBe(icon.sizes);
});
