// GLSL ES 1.0 (WebGL 1) so it runs everywhere a <canvas> does, including
// the macOS screensaver's WKWebView and older smart-TV browsers.

export type VideoEffect = 'crt' | 'fisheye' | 'film';

export const VERTEX_SHADER = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

// Shared uniforms + helpers. vUv / texture coords have origin bottom-left
// (the texture is uploaded with UNPACK_FLIP_Y).
const COMMON = `
precision highp float;
uniform sampler2D uTex;
uniform vec2 uRes;   // canvas size, px
uniform vec2 uVid;   // video size, px
uniform float uTime; // seconds
varying vec2 vUv;

// Map a 0..1 position inside a box of aspect boxAR onto the video with
// object-fit: cover semantics.
vec2 coverUv(vec2 uv, float boxAR) {
  float vidAR = uVid.x / uVid.y;
  vec2 s = boxAR > vidAR ? vec2(1.0, vidAR / boxAR) : vec2(boxAR / vidAR, 1.0);
  return (uv - 0.5) * s + 0.5;
}

// Cheap sin-free hash — stable on mediump GPUs with small inputs.
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

bool outside(vec2 uv) {
  return uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0;
}
`;

// ── Old TV ──────────────────────────────────────────────────────────────────
// Curved glass, rounded tube corners, scanlines, aperture grille, colour
// bleed, a slow rolling brightness band, flicker and snow.
const CRT = `
vec2 curve(vec2 uv) {
  uv = uv * 2.0 - 1.0;
  vec2 off = abs(uv.yx) / vec2(6.0, 5.0);
  uv = uv + uv * off * off;
  return uv * 0.5 + 0.5;
}

void main() {
  vec2 uv = curve(vUv);
  if (outside(uv)) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }

  vec2 vuv = coverUv(uv, uRes.x / uRes.y);

  // Colour bleed: R and B land a touch off G
  float s = 0.0016;
  vec3 col;
  col.r = texture2D(uTex, vuv + vec2(s, 0.0)).r;
  col.g = texture2D(uTex, vuv).g;
  col.b = texture2D(uTex, vuv - vec2(s, 0.0)).b;

  // Phosphor glow
  vec3 glow = texture2D(uTex, vuv + vec2(0.004, 0.0)).rgb
            + texture2D(uTex, vuv - vec2(0.004, 0.0)).rgb
            + texture2D(uTex, vuv + vec2(0.0, 0.005)).rgb
            + texture2D(uTex, vuv - vec2(0.0, 0.005)).rgb;
  col += glow * 0.25 * 0.22;

  // Scanlines (~280 visible lines regardless of display resolution)
  float sl = 0.5 + 0.5 * sin(uv.y * 280.0 * 6.28318);
  col *= mix(0.68, 1.0, sl);

  // Aperture grille
  float m = mod(gl_FragCoord.x, 3.0);
  vec3 mask = m < 1.0 ? vec3(1.0, 0.86, 0.86) : m < 2.0 ? vec3(0.86, 1.0, 0.86) : vec3(0.86, 0.86, 1.0);
  col *= mask;

  // Rolling band + mains flicker
  float band = fract(uv.y * 0.6 - uTime * 0.07);
  col *= 1.0 + 0.07 * exp(-pow((band - 0.5) * 14.0, 2.0));
  col *= 0.985 + 0.015 * sin(uTime * 120.0);

  // Snow
  col += (hash(gl_FragCoord.xy + fract(uTime * 7.13) * 97.0) - 0.5) * 0.06;

  // Tube vignette + brightness make-up for the darkening above
  vec2 d = uv - 0.5;
  col *= 1.0 - dot(d, d) * 1.25;
  col *= 1.2;

  // Soft rounded tube edge
  vec2 e = smoothstep(vec2(0.0), vec2(0.012), uv) * smoothstep(vec2(0.0), vec2(0.012), 1.0 - uv);
  col *= e.x * e.y;

  gl_FragColor = vec4(col, 1.0);
}
`;

// ── Fisheye ─────────────────────────────────────────────────────────────────
// A circular lens: centre magnified, edges compressed (equidistant-style
// barrel), fringing and a dark falloff at the rim, black outside.
const FISHEYE = `
const float K = 0.9;     // lens strength — higher is more barrel
const float REACH = 1.15; // how far past the frame's short side the rim sees

vec3 sampleLens(vec2 dir, float rs) {
  // q is in units of half the video's short side, so the lens takes in the
  // full width of a landscape clip; the rim slightly overshoots the short
  // side and clamps (hidden by the rim falloff).
  vec2 q = dir * rs * REACH;
  float shortSide = min(uVid.x, uVid.y);
  vec2 uv = 0.5 + q * 0.5 * vec2(shortSide / uVid.x, shortSide / uVid.y);
  return texture2D(uTex, clamp(uv, 0.0, 1.0)).rgb;
}

void main() {
  vec2 p = (vUv - 0.5) * uRes;          // px from centre
  float R = min(uRes.x, uRes.y) * 0.47; // lens radius
  float r = length(p) / R;
  if (r > 1.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }

  vec2 dir = r > 0.0 ? p / length(p) : vec2(0.0);
  float rs = tan(r * K) / tan(K);

  // Chromatic fringing grows toward the rim
  float ca = 0.018 * r * r;
  vec3 col;
  col.r = sampleLens(dir, rs * (1.0 + ca)).r;
  col.g = sampleLens(dir, rs).g;
  col.b = sampleLens(dir, rs * (1.0 - ca)).b;

  // Punchy lens contrast
  col = mix(col, smoothstep(0.0, 1.0, col), 0.35);

  // Rim falloff + anti-aliased edge
  col *= mix(1.0, 0.18, smoothstep(0.72, 1.0, r));
  col *= 1.0 - smoothstep(1.0 - 2.0 / R, 1.0, r);

  gl_FragColor = vec4(col, 1.0);
}
`;

// ── Film ────────────────────────────────────────────────────────────────────
// 2.39:1 scope bars, 24 fps grain, faded warm stock, gate weave, exposure
// flicker, the odd scratch and dust speck.
const FILM = `
const float SCOPE = 2.39;

void main() {
  float canvasAR = uRes.x / uRes.y;
  float h = min(1.0, canvasAR / SCOPE); // image height as a fraction of canvas
  float y0 = (1.0 - h) * 0.5;
  if (vUv.y < y0 || vUv.y > 1.0 - y0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }

  float t = floor(uTime * 24.0); // film frame index

  // Gate weave — the frame drifts a hair in the projector gate
  vec2 weave = vec2(
    sin(uTime * 1.3) * 0.0005 + (hash(vec2(t, 1.0)) - 0.5) * 0.0007,
    (hash(vec2(t, 2.0)) - 0.5) * 0.0010
  );
  vec2 box = vec2(vUv.x, (vUv.y - y0) / h) + weave;
  vec2 vuv = coverUv(box, canvasAR / h);
  vec3 col = outside(vuv) ? vec3(0.0) : texture2D(uTex, vuv).rgb;

  // Stock: slightly desaturated, warm mids, cool-lifted blacks, soft shoulder
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(l), col, 0.82);
  col *= vec3(1.05, 1.0, 0.9);
  col = smoothstep(-0.04, 1.08, col);
  col = col * 0.9 + vec3(0.035, 0.035, 0.05);

  // Grain — strongest in the mid-tones
  float g = hash(floor(gl_FragCoord.xy / 1.5) + t * 17.0) - 0.5;
  col += g * 0.11 * (1.0 - abs(l - 0.5) * 1.2);

  // Exposure flicker
  col *= 1.0 + (hash(vec2(t, 3.0)) - 0.5) * 0.045;

  // Occasional vertical scratch
  if (hash(vec2(t, 9.0)) > 0.9) {
    float d = abs(box.x - hash(vec2(t, 7.0)));
    col *= 1.0 - 0.3 * (1.0 - smoothstep(0.0, 0.0012, d));
  }

  // Sparse dust
  if (hash(floor(gl_FragCoord.xy / 3.0) + t * 3.1) > 0.99997) col *= 0.15;

  // Vignette inside the frame
  vec2 d = box - 0.5;
  col *= 1.0 - dot(d * vec2(0.9, 1.4), d * vec2(0.9, 1.4)) * 0.9;

  gl_FragColor = vec4(col, 1.0);
}
`;

export const FRAGMENT_SHADERS: Record<VideoEffect, string> = {
  crt: COMMON + CRT,
  fisheye: COMMON + FISHEYE,
  film: COMMON + FILM,
};
