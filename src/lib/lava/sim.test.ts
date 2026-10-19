import { expect, test } from 'vite-plus/test';
import { LavaSim } from './sim';

// Seeded Park–Miller generator, so a failure reproduces
const seeded = (seed: number) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

test('blobs stay finite and inside the walls under random input', () => {
	const random = seeded(1);
	const sim = new LavaSim(1440, 900, random);
	let [W, H] = [1440, 900];
	const bad: string[] = [];
	for (let i = 0; i < 20_000; i++) {
		const r = random();
		if (r < 0.05) sim.move(random() * W, random() * H);
		else if (r < 0.06) sim.press(random() * W, random() * H, random() < 0.5);
		else if (r < 0.07) sim.release();
		else if (r < 0.075) sim.leave();
		else if (r < 0.076) sim.shake();
		else if (r < 0.077) sim.resize((W = 320 + random() * 2000), (H = 320 + random() * 1400));
		sim.step();
		for (const b of sim.blobs) {
			const inside = b.x >= -b.r / 2 && b.x <= W + b.r / 2 && b.y >= -b.r / 2 && b.y <= H + b.r / 2;
			if (!inside) bad.push(`step ${i}: blob at ${b.x}, ${b.y} outside ${W}×${H}`);
		}
		sim.emit(random(), (x, y, rad, heat) => {
			if (![x, y, rad, heat].every(Number.isFinite)) bad.push(`step ${i}: put(${x}, ${y}, ${rad}, ${heat})`);
		});
	}
	expect(bad.slice(0, 5)).toEqual([]);
});

test('a press pops the lamp, and the bonus blobs fade once it reassembles', () => {
	const sim = new LavaSim(800, 600, seeded(2));
	expect(sim.blobs).toHaveLength(8);
	// Hold a finger on the center: it pops the lamp, then pulls the wax back together
	sim.press(400, 300, true);
	sim.step();
	expect(sim.blobs).toHaveLength(12);
	for (let i = 0; i < 3000; i++) sim.step();
	expect(sim.blobs).toHaveLength(8);
});
