<script lang="ts">
	// Types a random word, holds it, erases it, and repeats. Each word shows once per round.
	let { words }: { words: string[] } = $props();
	let text = $state('');

	const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

	$effect(() => {
		let running = true;
		(async () => {
			let queue: string[] = [];
			while (running) {
				if (!queue.length) queue = words.map((w) => [Math.random(), w] as const).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
				const word = queue.pop()!;
				for (let i = 1; i <= word.length; i++) {
					text = word.slice(0, i);
					await sleep(55);
				}
				await sleep(1500);
				for (let i = word.length - 1; i >= 0; i--) {
					text = word.slice(0, i);
					await sleep(35);
				}
				await sleep(300);
			}
		})();
		return () => (running = false);
	});
</script>

<span>{text}</span><span class="cursor"></span>

<style>
	.cursor {
		display: inline-block;
		width: 2px;
		height: 1.1em;
		background: var(--color-primary);
		margin-left: 1px;
		vertical-align: text-bottom;
		animation: blink 0.6s step-end infinite;
	}
	@keyframes blink {
		50% {
			opacity: 0;
		}
	}
</style>
