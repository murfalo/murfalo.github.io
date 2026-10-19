<script lang="ts">
	import { lavaLamp } from '../lib/lava';
	import { media, socials } from '../lib/links';
	import Typewriter from '../lib/Typewriter.svelte';

	const words = [
		'Debbie Marks impression',
		'domain expansion',
		'search history',
		'equivalent exchange',
		'Terraria mods',
		'spaghetti code',
		'Boston accent',
		'final form',
		'stone world',
		'lore',
		'Gear 5',
		'Hunter license',
		'isekai arc',
		'evolutionary couplings',
		'MSAs',
		'crystal structures',
		'commits',
		'unread papers',
		'snobby reviews',
		'cool stuff',
		'socials',
		'sludge',
		'AI slop',
		'drip'
	];

	const navs = [
		{ label: 'Social links', links: socials },
		{ label: 'Media links', links: media }
	];

	// Link hover hint at the bottom of the screen. A hint that is still showing fades out before the next one fades in.
	const HINT_FADE_MS = 250;
	let hint = $state('');
	let hintVisible = $state(false);
	let hintEl: HTMLElement;
	let hintTimer: ReturnType<typeof setTimeout>;
	function showHint(text: string) {
		clearTimeout(hintTimer);
		const showing = parseFloat(getComputedStyle(hintEl).opacity) > 0.01;
		hintVisible = false;
		hintTimer = setTimeout(
			() => {
				hint = text;
				hintVisible = true;
			},
			showing ? HINT_FADE_MS : 0
		);
	}
	function hideHint() {
		clearTimeout(hintTimer);
		hintVisible = false;
	}
</script>

<canvas class="lava" {@attach lavaLamp}></canvas>

<main>
	<img
		class="avatar"
		src="/img/murfalo.png"
		alt="murfalo — dog in purple hoodie and sunglasses"
		width="160"
		height="160"
		draggable="false"
	/>
	<h1>murfalo</h1>
	<p class="bio">check out my <Typewriter {words} /></p>

	{#each navs as nav (nav.label)}
		<nav aria-label={nav.label}>
			{#each nav.links as link (link.label)}
				<a
					href={link.href}
					rel={link.me ? 'me' : undefined}
					aria-label={link.label}
					onmouseenter={() => showHint(link.hint)}
					onfocus={() => showHint(link.hint)}
					onmouseleave={hideHint}
					onblur={hideHint}
					{@attach link.attach}
				>
					<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">{@html link.icon}</svg>
				</a>
			{/each}
		</nav>
	{/each}
</main>

<p class="hint" class:visible={hintVisible} bind:this={hintEl}>{hint}</p>

<style>
	:global {
		*,
		*::before,
		*::after {
			margin: 0;
			padding: 0;
			box-sizing: border-box;
		}

		:root {
			--color-bg: #0e0c14;
			--color-text: #e4e4e7;
			--color-muted: #a1a1aa;
			--color-primary: hsl(258deg 90% 66%);
			--color-primary-glow: hsl(258deg 90% 66% / 0.4);
			--color-neon: hsl(275deg 100% 70% / 0.8);
			--color-neon-deep: hsl(268deg 68% 53%);
			--color-pink: hsl(325deg 85% 72%);
			--color-indigo: hsl(235deg 85% 72%);
		}

		::selection {
			background: var(--color-primary-glow);
			color: var(--color-text);
		}

		body {
			font-family: system-ui, sans-serif;
			background: var(--color-bg);
			color: var(--color-text);
			min-height: 100dvh;
			display: flex;
			align-items: center;
			justify-content: center;
			overflow: hidden;
			user-select: none;
			touch-action: none;
		}
	}

	.lava {
		position: fixed;
		inset: 0;
		width: 100%;
		height: 100%;
		cursor: grab;
		/* The canvas renders at CSS resolution; scale it up without blur, so the backdrop weave stays crisp */
		image-rendering: pixelated;
	}
	.lava:active {
		cursor: grabbing;
	}

	main {
		text-align: center;
		padding: 2rem;
		animation: fadeIn 0.6s ease-out;
		position: relative;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(12px);
		}
	}

	.avatar {
		width: 160px;
		height: 160px;
		border-radius: 50%;
		box-shadow:
			0 0 0 4px var(--color-bg),
			0 0 0 8px var(--color-primary-glow),
			0 0 24px var(--color-primary-glow);
		transition: box-shadow 0.3s ease;
	}
	.avatar:hover {
		box-shadow:
			0 0 0 4px var(--color-bg),
			0 0 0 8px var(--color-primary),
			0 0 40px var(--color-primary-glow),
			0 0 80px var(--color-primary-glow);
	}

	h1 {
		margin-top: 1.25rem;
		font-size: 2.5rem;
		letter-spacing: -0.02em;
		text-shadow:
			-1px 0 var(--color-pink),
			1px 0 var(--color-indigo),
			0 0 18px var(--color-primary-glow);
	}

	.bio {
		margin-top: 0.4rem;
		font-size: 1.1rem;
		color: var(--color-muted);
	}

	nav {
		margin-top: 1.75rem;
		display: flex;
		gap: 1.25rem;
		justify-content: center;
		flex-wrap: wrap;
	}
	nav + nav {
		margin-top: 1rem;
	}

	nav a {
		display: inline-flex;
		color: var(--color-muted);
		transition:
			color 0.2s ease,
			transform 0.2s ease;
	}
	nav a:hover,
	nav a:focus-visible {
		color: var(--color-primary);
		transform: translateY(-2px);
	}
	nav a:focus-visible {
		outline: none;
	}

	nav svg {
		width: 26px;
		height: 26px;
		fill: currentColor;
	}

	.hint {
		font-style: italic;
		font-size: 1.14rem;
		position: fixed;
		bottom: 1.25rem;
		inset-inline: 0;
		text-align: center;
		color: #f0e6ff;
		text-shadow:
			0 0 20px var(--color-neon),
			0 0 40px var(--color-neon-deep),
			0 0 80px var(--color-primary-glow);
		pointer-events: none;
		opacity: 0;
		transition: opacity 0.25s ease;
		will-change: opacity;
	}
	.hint.visible {
		opacity: 0.85;
	}
</style>
