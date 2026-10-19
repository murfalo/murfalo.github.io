import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite-plus';

export default defineConfig({
	plugins: [
		sveltekit({
			adapter: adapter(),
			// Inline all CSS, so the first paint does not wait for a stylesheet; the JS loads in parallel
			inlineStyleThreshold: Infinity
		})
	],
	fmt: { useTabs: true, singleQuote: true, trailingComma: 'none', printWidth: 120 }
});
