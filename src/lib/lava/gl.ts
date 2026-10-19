// WebGL lava renderer. The metaball field is smooth, so a first pass computes it at half resolution into a
// half-float texture. A second pass reads it once per pixel and does the neon and CRT shading at canvas
// resolution. Without half-float render targets, one pass computes the field per pixel.
import type { Put } from './sim';

const MAX_BLOBS = 64;
const FIELD_SCALE = 2; // canvas px per field texel, each axis

const VERTEX = 'attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }';

const COMMON = `
	precision highp float;
	uniform vec4 u_blobs[${MAX_BLOBS}]; // x, y, r² (canvas px), heat 0..1
	uniform int u_count;

	// Metaball field at p, and the field-weighted heat of the wax there
	vec2 fieldAt(vec2 p) {
		float field = 0.0, hsum = 0.0;
		for (int i = 0; i < ${MAX_BLOBS}; i++) {
			if (i >= u_count) break;
			vec4 b = u_blobs[i];
			vec2 d = p - b.xy;
			float w = b.z / max(dot(d, d), 1.0);
			field += w;
			hsum += w * b.w;
		}
		return vec2(min(field, 1000.0), hsum / max(field, 0.001)); // clamped to stay finite in half floats
	}
`;

const FIELD = `${COMMON}
	void main() { gl_FragColor = vec4(fieldAt(gl_FragCoord.xy * ${FIELD_SCALE}.0), 0.0, 1.0); }
`;

const shadeSource = (twoPass: boolean) => `${COMMON}
	uniform sampler2D u_field;
	uniform vec2 u_fieldRes; // field texture size in canvas px
	uniform vec2 u_res;
	uniform float u_time;
	uniform float u_scale; // canvas px per CSS px

	// Ordered 4x4 Bayer threshold in [0, 1)
	float bayer2(vec2 a) { a = floor(a); return fract(a.x * 0.5 + a.y * a.y * 0.75); }
	float bayer4(vec2 a) { return bayer2(a * 0.5) * 0.25 + bayer2(a); }

	void main() {
		vec2 uv = gl_FragCoord.xy;
		vec2 f = ${twoPass ? 'texture2D(u_field, uv / u_fieldRes).xy' : 'fieldAt(uv)'};
		float field = f.x;

		float dist = abs(field - 0.65);
		float edge = exp(-dist * 35.0);
		float glow = exp(-dist * 14.0) * 0.3;
		float interior = smoothstep(0.63, 0.67, field);
		float depth = mix(1.3, 0.8, smoothstep(0.65, 3.0, field)); // brighter rim, darker core

		// Backdrop: one fixed 2px dot weave everywhere (a constant pattern, so no banding),
		// lit by a smooth purple bloom toward the center and the lamp glow that rises from the bottom
		float th = bayer4(uv / (2.0 * u_scale));
		float weave = step(th, 0.25);
		float bloom = max(1.0 - length((uv - 0.5 * u_res) / u_res.y), 0.0);
		float heat = 1.0 - smoothstep(0.0, 1.0, uv.y / u_res.y);
		float light = 0.5 * bloom + heat * heat * heat;
		vec3 col = vec3(0.05, 0.045, 0.072) + vec3(0.05, 0.025, 0.09) * light;
		col += vec3(0.03, 0.015, 0.05) * weave * (0.5 + light);
		col = mix(col, vec3(0.12, 0.06, 0.22), interior * 0.35 * depth);
		// Fast wax runs hot: a brighter, pinker rim that cools as it settles
		float h = clamp(f.y, 0.0, 1.0) * 0.3;
		col += vec3(0.50, 0.20, 0.85) * glow * (1.0 + h);
		col += mix(vec3(0.75, 0.40, 1.0), vec3(0.95, 0.55, 0.95), h) * edge * (1.5 + 0.5 * h);
		col *= mix(1.0, 0.9 + 0.1 * sin(u_time * 2.0), edge);
		col += (th - 0.5) * 0.02; // ordered dither instead of film grain

		// CRT glass: a scanline every 4 CSS px and a vignette toward the corners
		col *= 1.0 - 0.08 * step(3.0, mod(uv.y / u_scale, 4.0));
		col *= 1.0 - 0.35 * clamp((length(uv / u_res - 0.5) * 1.4142 - 0.65) / 0.35, 0.0, 1.0);

		gl_FragColor = vec4(col, 1.0);
	}
`;

function program(gl: WebGLRenderingContext, fragment: string) {
	const prog = gl.createProgram();
	for (const [type, source] of [
		[gl.VERTEX_SHADER, VERTEX],
		[gl.FRAGMENT_SHADER, fragment]
	] as const) {
		const shader = gl.createShader(type)!;
		gl.shaderSource(shader, source);
		gl.compileShader(shader);
		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(shader));
		gl.attachShader(prog, shader);
	}
	gl.bindAttribLocation(prog, 0, 'p');
	gl.linkProgram(prog);
	if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) console.error(gl.getProgramInfoLog(prog));
	const uniform = (name: string) => gl.getUniformLocation(prog, name);
	return {
		prog,
		blobs: uniform('u_blobs'),
		count: uniform('u_count'),
		fieldRes: uniform('u_fieldRes'),
		res: uniform('u_res'),
		time: uniform('u_time'),
		scale: uniform('u_scale')
	};
}

// A linear-filtered half-float render target for the field, bound to texture unit 0 for good; null if the GPU has none
function halfFloatTarget(gl: WebGLRenderingContext) {
	const ext = gl.getExtension('OES_texture_half_float');
	if (!ext || !gl.getExtension('OES_texture_half_float_linear')) return null;
	gl.getExtension('EXT_color_buffer_half_float');
	const texture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, texture);
	for (const k of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, k, gl.LINEAR);
	for (const k of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, k, gl.CLAMP_TO_EDGE);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, ext.HALF_FLOAT_OES, null);
	const fbo = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
	const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	return complete ? { fbo, type: ext.HALF_FLOAT_OES } : null;
}

export interface Renderer {
	/** Sets the canvas size to the CSS size times scale (canvas px per CSS px). */
	resize(width: number, height: number, scale: number): void;
	/** Draws one frame; fill sends each metaball to put. Returns the metaball count. */
	draw(time: number, fill: (put: Put) => void): number;
}

export function createRenderer(canvas: HTMLCanvasElement): Renderer | null {
	const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, desynchronized: true });
	if (!gl) return null;

	const target = halfFloatTarget(gl);
	const shade = program(gl, shadeSource(target !== null));
	const fieldPass = target && program(gl, FIELD);

	// Fullscreen quad
	gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
	gl.enableVertexAttribArray(0);
	gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

	const blobData = new Float32Array(MAX_BLOBS * 4);
	let count = 0;
	let scale = 1;
	let cssHeight = 0;
	let fieldW = 0;
	let fieldH = 0;

	// Packs one metaball into the uniform array, in canvas px with y up
	const put: Put = (x, y, r, heat) => {
		if (r <= 0 || count >= MAX_BLOBS) return;
		const k = count++ * 4;
		blobData[k] = x * scale;
		blobData[k + 1] = (cssHeight - y) * scale;
		blobData[k + 2] = r * r * scale * scale;
		blobData[k + 3] = heat;
	};

	return {
		resize(width, height, ratio) {
			scale = ratio;
			cssHeight = height;
			canvas.width = width * scale;
			canvas.height = height * scale;
			gl.useProgram(shade.prog);
			gl.uniform2f(shade.res, canvas.width, canvas.height);
			gl.uniform1f(shade.scale, scale);
			if (target) {
				fieldW = Math.ceil(canvas.width / FIELD_SCALE);
				fieldH = Math.ceil(canvas.height / FIELD_SCALE);
				gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, fieldW, fieldH, 0, gl.RGBA, target.type, null);
				gl.uniform2f(shade.fieldRes, fieldW * FIELD_SCALE, fieldH * FIELD_SCALE);
			}
		},

		draw(time, fill) {
			count = 0;
			fill(put);
			const blobPass = fieldPass || shade;
			gl.useProgram(blobPass.prog);
			gl.uniform1i(blobPass.count, count);
			gl.uniform4fv(blobPass.blobs, blobData);
			if (target && fieldPass) {
				gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
				gl.viewport(0, 0, fieldW, fieldH);
				gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
				gl.bindFramebuffer(gl.FRAMEBUFFER, null);
				gl.useProgram(shade.prog);
			}
			gl.viewport(0, 0, canvas.width, canvas.height);
			gl.uniform1f(shade.time, time * 0.01);
			gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
			return count;
		}
	};
}
