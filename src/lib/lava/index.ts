// Interactive lava lamp: a Svelte attachment that runs the physics and renders it on a canvas.
// The canvas renders at CSS resolution and CSS scales it up with nearest-neighbor. The backdrop pattern is on
// whole CSS px, so only the neon rim loses detail, and a frame costs about 3.6× less GPU time than at 2×.
// Debug: ?fps shows a frame-time readout, ?scale=N sets the canvas px per CSS px (2 = full resolution on Retina).
import { createRenderer } from './gl';
import { LavaSim } from './sim';

const STEP = 1000 / 60; // physics tick in ms

export function lavaLamp(canvas: HTMLCanvasElement) {
	const first = createRenderer(canvas);
	if (!first) {
		console.warn('WebGL not available — lava lamp disabled');
		return;
	}
	let renderer = first;
	const debug = new URLSearchParams(location.search);
	const sim = new LavaSim(innerWidth, innerHeight);
	const scale = Number(debug.get('scale')) || 1;
	const resize = () => {
		renderer.resize(innerWidth, innerHeight, scale);
		sim.resize(innerWidth, innerHeight);
	};
	resize();

	const listeners = new AbortController();
	const { signal } = listeners;
	// Phones can drop the WebGL context (GPU reset, memory pressure). Ask for it back, then rebuild the renderer.
	canvas.addEventListener('webglcontextlost', (e) => e.preventDefault(), { signal });
	canvas.addEventListener(
		'webglcontextrestored',
		() => {
			renderer = createRenderer(canvas) ?? renderer;
			resize();
		},
		{ signal }
	);

	// Input: pointer events cover mouse, touch and pen
	addEventListener('resize', resize, { signal });
	addEventListener('pointermove', (e) => e.isPrimary && sim.move(e.clientX, e.clientY), { signal });
	addEventListener('pointerdown', (e) => e.isPrimary && sim.press(e.clientX, e.clientY, e.pointerType === 'touch'), {
		signal
	});
	addEventListener('pointerup', () => sim.release(), { signal });
	addEventListener('pointercancel', () => sim.release(), { signal });
	document.documentElement.addEventListener('mouseleave', () => sim.leave(), { signal });
	listenForShake(() => sim.shake(), signal);

	const hud = debug.has('fps')
		? document.body.appendChild(
				Object.assign(document.createElement('pre'), {
					style: 'position:fixed;top:8px;left:8px;margin:0;font:12px monospace;color:#c4b5fd'
				})
			)
		: null;
	let hudFrames = 0;
	let hudStart = 0;
	let hudWorst = 0;
	let count = 0;

	// Fixed 60 Hz physics (the same speed on 120 Hz displays), rendered every frame
	let last = performance.now();
	let acc = 0;
	let frame = requestAnimationFrame(function loop(now) {
		if (hud) {
			hudWorst = Math.max(hudWorst, now - last);
			if ((++hudFrames, now - hudStart > 1000)) {
				const fps = Math.round((hudFrames * 1000) / (now - hudStart));
				hud.textContent = `${fps} fps  worst ${hudWorst.toFixed(1)} ms\n${canvas.width}×${canvas.height} @ ${scale}x  ${count} blobs`;
				hudFrames = hudWorst = 0;
				hudStart = now;
			}
		}
		acc = Math.min(acc + now - last, 250);
		last = now;
		for (; acc >= STEP; acc -= STEP) sim.step();
		count = renderer.draw(sim.time, (put) => sim.emit(acc / STEP, put));
		frame = requestAnimationFrame(loop);
	});

	return () => {
		cancelAnimationFrame(frame);
		listeners.abort();
		hud?.remove();
	};
}

// Shake to scatter (mobile)
function listenForShake(onShake: () => void, signal: AbortSignal) {
	if (typeof DeviceMotionEvent === 'undefined') return;
	let lastShake = 0;
	const onMotion = (e: DeviceMotionEvent) => {
		const a = e.acceleration ?? e.accelerationIncludingGravity;
		if (!a || a.x === null) return;
		if (Math.hypot(a.x, a.y ?? 0, a.z ?? 0) > (e.acceleration ? 15 : 25) && Date.now() - lastShake > 2000) {
			lastShake = Date.now();
			onShake();
		}
	};
	// iOS 13+ needs permission from a user gesture
	const motion = DeviceMotionEvent as typeof DeviceMotionEvent & { requestPermission?: () => Promise<string> };
	if (typeof motion.requestPermission !== 'function') {
		addEventListener('devicemotion', onMotion, { signal });
		return;
	}
	const ask = () =>
		motion
			.requestPermission?.()
			.then((state) => state === 'granted' && addEventListener('devicemotion', onMotion, { signal }))
			.catch(() => {});
	addEventListener('touchstart', ask, { once: true, passive: true, signal });
}
