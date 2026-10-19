// Lava lamp physics. One step is one 60 Hz tick. Positions are in CSS px.

const SPEED_CLAMP = 3.5;
const SPEED_CLAMP_FLYING = 14;
const DAMPING = 0.984;

const CURSOR_R_REST = 52;
const CURSOR_R_CLICK = 90;
const CURSOR_SPRING_K = 0.12;
const CURSOR_SPRING_DAMP = 0.55;
const CURSOR_TRAIL_LAG = 0.35;

const WALL_SPRING = 0.15;
const WALL_DAMP = 0.92;

const POP_RADIUS = 250;
const POP_BONUS_COUNT = 4;
const REASSEMBLE_RADIUS = 150;
const REASSEMBLE_DELAY = 180;

const BLOB_FADE_RATE = 0.95;
const BLOB_FADE_MIN = 2;

const MOUSE_SPEED_DECAY = 0.9;
const MOUSE_PUSH_RANGE = 400;
const MOUSE_REPEL_RANGE = 900;
const MOUSE_ATTRACT_RANGE = 600;
const MOUSE_PROXIMITY_DAMP = 200;

// 3 large + 5 medium blobs. Pops add bonus blobs, which fade after reassembly.
const ORIGINAL_COUNT = 8;

interface Blob {
	x: number;
	y: number;
	px: number; // position at the previous step, for render interpolation
	py: number;
	vx: number;
	vy: number;
	r: number;
	heat: number; // 0..1, eases toward the blob speed
	freeFlying: boolean;
	phaseX: number;
	phaseY: number;
	freqX: number;
	freqY: number;
	buoyancy: number;
}

interface Point {
	x: number;
	y: number;
	px: number;
	py: number;
}

/** Receives one metaball: center and radius in CSS px, heat 0..1. */
export type Put = (x: number, y: number, r: number, heat: number) => void;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Soft gooey wall pushback: the spring force for one axis
const wallForce = (p: number, size: number, r: number) =>
	p < r ? ((r - p) / r) * WALL_SPRING : p > size - r ? ((size - r - p) / r) * WALL_SPRING : 0;

export class LavaSim {
	time = 0;
	readonly blobs: Blob[];
	private width: number;
	private height: number;
	private readonly random: () => number;
	// Blob radii scale down on small viewports (tuned for a ~900 px min dimension)
	private readonly viewScale: number;

	// Pointer input
	private pointer: { x: number; y: number } | null = null;
	private down = false;
	private touch = false;
	private lifted = false; // the touch ended: the cursor blob deflates, then goes away
	private speed = 0; // pointer speed per step, decays slowly

	// Cursor blob and its lagging trail
	private readonly cur: Point = { x: 0, y: 0, px: 0, py: 0 };
	private readonly trail: Point = { x: 0, y: 0, px: 0, py: 0 };
	private cursorLive = false;
	private radius = CURSOR_R_REST;
	private radiusPrev = CURSOR_R_REST;
	private radiusVel = 0;

	// Pop / reassemble
	private popped = false;
	private popTime = 0;
	private reassembled = false;

	constructor(width: number, height: number, random = Math.random) {
		this.width = width;
		this.height = height;
		this.random = random;
		this.viewScale = Math.min(1, Math.min(width, height) / 900);
		// Start in a ring around the center card
		this.blobs = Array.from({ length: ORIGINAL_COUNT }, (_, i) => {
			const angle = (i / ORIGINAL_COUNT) * Math.PI * 2 + (random() - 0.5) * 0.5;
			const dist = (80 + random() * 60) * this.viewScale;
			return this.makeBlob(
				i < 3 ? 90 : 49,
				i < 3 ? 128 : 83,
				width / 2 + Math.cos(angle) * dist,
				height / 2 + Math.sin(angle) * dist
			);
		});
	}

	resize(width: number, height: number) {
		this.width = width;
		this.height = height;
	}

	// --- Input ---

	press(x: number, y: number, touch: boolean) {
		this.touch = touch;
		// Touch: the cursor blob ploops into existence from nothing
		if (touch && (this.pointer === null || this.lifted)) this.radius = this.radiusPrev = this.radiusVel = 0;
		this.lifted = false;
		this.down = true;
		this.pointer = { x, y };
	}

	move(x: number, y: number) {
		this.pointer = { x, y };
	}

	release() {
		this.down = false;
		// Touch: a quick swell, then it ploops back out of existence
		if (this.touch) {
			this.lifted = true;
			this.radiusVel += 8 * this.viewScale;
		}
	}

	leave() {
		this.down = false;
		this.clearPointer();
	}

	shake() {
		for (const b of this.blobs) {
			const angle = this.random() * Math.PI * 2;
			const speed = 5 + this.random() * 3;
			b.vx = Math.cos(angle) * speed;
			b.vy = Math.sin(angle) * speed;
		}
	}

	// --- Physics ---

	step() {
		this.time++;
		// Remember the last positions (for render interpolation) and ease each blob's heat toward its speed
		for (const b of this.blobs) {
			b.px = b.x;
			b.py = b.y;
			b.heat = b.heat * 0.94 + 0.06 * Math.min(Math.hypot(b.vx, b.vy) / 8, 1);
		}
		this.stepCursor();
		this.stepBlobs();
	}

	/** Sends each metaball to put, blended between the last two steps by alpha (0..1). */
	emit(alpha: number, put: Put) {
		if (this.cursorLive) {
			const heat = Math.min(this.speed / 60, 1);
			const r = lerp(this.radiusPrev, this.radius, alpha);
			// The cursor blob sits at the latest pointer position, so it does not lag the pointer
			const head = this.pointer ?? { x: lerp(this.cur.px, this.cur.x, alpha), y: lerp(this.cur.py, this.cur.y, alpha) };
			put(head.x, head.y, r, heat);
			// The trail deforms the cursor blob as it moves
			const t = this.trail;
			put(lerp(t.px, t.x, alpha), lerp(t.py, t.y, alpha), r * 0.55 * Math.min(this.speed / 12, 1), heat);
		}
		for (const b of this.blobs) put(lerp(b.px, b.x, alpha), lerp(b.py, b.y, alpha), b.r, b.heat);
	}

	private makeBlob(rMin: number, rMax: number, x: number, y: number): Blob {
		const rand = this.random;
		return {
			x,
			y,
			px: x,
			py: y,
			vx: 0,
			vy: 0,
			r: (rMin + rand() * (rMax - rMin)) * this.viewScale,
			heat: 0,
			freeFlying: false,
			phaseX: rand() * Math.PI * 2,
			phaseY: rand() * Math.PI * 2,
			freqX: 0.00015 + rand() * 0.00025,
			freqY: 0.00015 + rand() * 0.00025,
			buoyancy: (rand() - 0.5) * 0.002
		};
	}

	private clearPointer() {
		this.pointer = null;
		this.speed = 0;
	}

	private stepCursor() {
		// Spring-animate the cursor blob radius
		this.radiusPrev = this.radius;
		const target = this.lifted ? 0 : (this.down ? CURSOR_R_CLICK : CURSOR_R_REST) * this.viewScale;
		// Touch gets a softer spring so the blob eases in (slight overshoot) and out
		const k = this.touch ? 0.07 : CURSOR_SPRING_K;
		const damp = this.touch ? 0.72 : CURSOR_SPRING_DAMP;
		this.radiusVel = (this.radiusVel + (target - this.radius) * k) * damp;
		this.radius += this.radiusVel;

		if (this.lifted && this.radius < 1) {
			this.lifted = false;
			this.clearPointer();
		}
		const p = this.pointer;
		if (p === null) {
			this.cursorLive = false;
			return;
		}
		const { cur, trail } = this;
		if (!this.cursorLive) {
			cur.x = trail.x = p.x;
			cur.y = trail.y = p.y;
			this.cursorLive = true;
		}
		cur.px = cur.x;
		cur.py = cur.y;
		trail.px = trail.x;
		trail.py = trail.y;
		// Speed per step, so it is smooth however often the pointer reports
		this.speed = Math.max(Math.hypot(p.x - cur.x, p.y - cur.y), this.speed * MOUSE_SPEED_DECAY);
		cur.x = p.x;
		cur.y = p.y;
		trail.x += (p.x - trail.x) * CURSOR_TRAIL_LAG;
		trail.y += (p.y - trail.y) * CURSOR_TRAIL_LAG;
	}

	private pop() {
		this.popped = true;
		this.popTime = this.time;
		this.blobs.forEach((b, i) => {
			const angle = (i / this.blobs.length) * Math.PI * 2 + (this.random() - 0.5) * 1.5;
			const speed = 8 + this.random() * 4;
			b.vx = Math.cos(angle) * speed;
			b.vy = Math.sin(angle) * speed;
			b.freeFlying = true;
		});
		for (let i = 0; i < POP_BONUS_COUNT; i++) {
			const angle = (i / POP_BONUS_COUNT) * Math.PI * 2;
			const b = this.makeBlob(25, 35, this.width / 2, this.height / 2);
			b.vx = Math.cos(angle) * 6;
			b.vy = Math.sin(angle) * 6;
			this.blobs.push(b);
		}
	}

	private checkReassembled() {
		const lamp = this.blobs.slice(0, ORIGINAL_COUNT);
		const cx = lamp.reduce((s, b) => s + b.x, 0) / lamp.length;
		const cy = lamp.reduce((s, b) => s + b.y, 0) / lamp.length;
		this.reassembled = lamp.every((b) => Math.hypot(b.x - cx, b.y - cy) <= REASSEMBLE_RADIUS);
	}

	private stepBlobs() {
		const { blobs, pointer: p, width: W, height: H } = this;
		// Pop: triggers on hover near the center or on press
		if (!this.popped && (this.down || (p !== null && Math.hypot(p.x - W / 2, p.y - H / 2) < POP_RADIUS))) this.pop();
		if (this.popped && !this.reassembled && this.time - this.popTime > REASSEMBLE_DELAY) this.checkReassembled();

		// Gradually fade the bonus blobs after reassembly
		if (this.reassembled) {
			for (let j = blobs.length - 1; j >= ORIGINAL_COUNT; j--) {
				if ((blobs[j].r *= BLOB_FADE_RATE) < BLOB_FADE_MIN) blobs.splice(j, 1);
			}
		}

		// Pointer force: push until popped and escaped, then suck (a press repels on desktop)
		const escaped = this.popped && this.time - this.popTime > 150;
		let range = MOUSE_ATTRACT_RANGE;
		let strength = -0.12 * (1 + this.speed * 0.05);
		if (!escaped) {
			range = MOUSE_PUSH_RANGE;
			strength = 0.3;
		} else if (this.down && !this.touch) {
			range = MOUSE_REPEL_RANGE;
			strength = 0.7;
		}

		for (let i = 0; i < blobs.length; i++) {
			const b = blobs[i];

			// Slow sinusoidal drift + buoyancy
			b.vx += Math.sin(this.time * b.freqX + b.phaseX) * 0.0002;
			b.vy += Math.cos(this.time * b.freqY + b.phaseY) * 0.0002 + b.buoyancy;

			// Blob-blob interactions: short-range repel, long-range attract (free-flying blobs skip this)
			if (!b.freeFlying) {
				for (let j = i + 1; j < blobs.length; j++) {
					const o = blobs[j];
					if (o.freeFlying) continue;
					const dx = o.x - b.x;
					const dy = o.y - b.y;
					const combinedR = b.r + o.r;
					const distSq = dx * dx + dy * dy;
					if (distSq > 9 * combinedR * combinedR || distSq < 1) continue;
					const dist = Math.sqrt(distSq);
					const force =
						dist < combinedR * 0.5
							? -0.003 * (1 - dist / (combinedR * 0.5))
							: (0.0012 * (dist - combinedR * 0.5)) / (combinedR * 2.5);
					const fx = (dx / dist) * force;
					const fy = (dy / dist) * force;
					b.vx += fx;
					b.vy += fy;
					o.vx -= fx;
					o.vy -= fy;
				}
			}

			if (p !== null && !this.lifted && !b.freeFlying) {
				const dx = b.x - p.x;
				const dy = b.y - p.y;
				const dist = Math.max(Math.hypot(dx, dy), 50);
				if (dist < range) {
					const taper = 1 - dist / range;
					const force = taper * taper * strength;
					b.vx += (dx / dist) * force;
					b.vy += (dy / dist) * force;
					if (strength < 0 && dist < MOUSE_PROXIMITY_DAMP) {
						const damp = 0.92 + 0.06 * (dist / MOUSE_PROXIMITY_DAMP);
						b.vx *= damp;
						b.vy *= damp;
					}
				}
			}

			const wx = wallForce(b.x, W, b.r);
			const wy = wallForce(b.y, H, b.r);
			if (wx) b.vx = (b.vx + wx) * WALL_DAMP;
			if (wy) b.vy = (b.vy + wy) * WALL_DAMP;

			b.vx *= DAMPING;
			b.vy *= DAMPING;

			// Clamp the speed (free-flying blobs get a higher clamp, so they reach the wall)
			const clamp = b.freeFlying ? SPEED_CLAMP_FLYING : SPEED_CLAMP;
			const speed = Math.hypot(b.vx, b.vy);
			if (speed > clamp) {
				b.vx *= clamp / speed;
				b.vy *= clamp / speed;
			}

			b.x += b.vx;
			b.y += b.vy;

			// Free-flying blobs become normal on wall contact or when they lose momentum
			const atWall = b.x <= b.r || b.x >= W - b.r || b.y <= b.r || b.y >= H - b.r;
			if (b.freeFlying && (Math.min(speed, clamp) < SPEED_CLAMP || atWall)) b.freeFlying = false;

			// The center can go past the edge by up to half a radius (wall smoosh)
			b.x = Math.max(-b.r * 0.5, Math.min(W + b.r * 0.5, b.x));
			b.y = Math.max(-b.r * 0.5, Math.min(H + b.r * 0.5, b.y));
		}
	}
}
