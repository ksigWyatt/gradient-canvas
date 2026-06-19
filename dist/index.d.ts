import * as react from 'react';
import { CSSProperties } from 'react';

interface GradientCanvasProps {
    /**
     * 2–6 gradient stop colors as hex strings, e.g. ['#ff5005', '#dbba95', '#d0bce1'].
     * Stops are blended left-to-right like a CSS linear-gradient. Fewer than 2 or more
     * than 6 stops are clamped. Example with 4 stops:
     *   ['#0f0c29', '#302b63', '#24243e', '#7b4397']
     */
    colors: string[];
    /** Animation speed. Default 0.4. */
    speed?: number;
    /** Perlin noise density (wave frequency). Default 1.3. */
    density?: number;
    /** Color3 "halo" contribution strength; 4 = full range (Halo reference). Default 4. */
    strength?: number;
    /** Diagonal axis angle in degrees. Default 50 (lower-left to upper-right, matching Halo). */
    angle?: number;
    /** Film grain amount, 0..~0.3. Default 0 (off). */
    grain?: number;
    /** Canvas alpha for the gradient, 0..1. Default 1. */
    opacity?: number;
    /** Animate continuously. When false, renders a single static frame. Default true. */
    animate?: boolean;
    /** Render a single static frame when the user prefers reduced motion. Default true. */
    respectReducedMotion?: boolean;
    /** Render a single static frame on small screens (saves battery). Default true. */
    staticOnMobile?: boolean;
    /** Max viewport width (px) treated as mobile. Default 768. */
    mobileBreakpoint?: number;
    /** Cap on devicePixelRatio. Default 2. */
    maxDpr?: number;
    className?: string;
    style?: CSSProperties;
}
declare function GradientCanvas({ colors, speed, density, strength, angle, grain, opacity, animate, respectReducedMotion, staticOnMobile, mobileBreakpoint, maxDpr, className, style, }: GradientCanvasProps): react.JSX.Element;

/** Vertex shader (WebGL2 / GLSL ES 3.00) — a single fullscreen triangle. */
declare const VERTEX_SHADER = "#version 300 es\nprecision highp float;\n\n// Fullscreen triangle \u2014 no attributes, no VAO, no MVP. Driven by gl_VertexID.\n// Draw with: gl.drawArrays(gl.TRIANGLES, 0, 3)\nout vec2 vUv;\n\nvoid main() {\n  vec2 verts[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));\n  vec2 p = verts[gl_VertexID];\n  vUv = p * 0.5 + 0.5;          // 0..1, with overscan beyond 1 on the big triangle\n  gl_Position = vec4(p, 0.0, 1.0);\n}\n";
/** Fragment shader (WebGL2 / GLSL ES 3.00). */
declare const FRAGMENT_SHADER = "#version 300 es\nprecision highp float;\n\nin vec2 vUv;\n\nuniform vec3  uColors[6];\nuniform int   uColorCount;\nuniform float uTime;     // seconds\nuniform float uSpeed;    // animation rate (Halo: 0.4)\nuniform float uDensity;  // noise frequency (Halo: 1.3)\nuniform float uStrength; // color3 \"halo\" contribution; remapped, NOT raw mix (Halo src: 4)\nuniform float uAngle;    // diagonal axis in degrees (Halo rotationZ: 50)\nuniform float uAspect;   // canvas.width / canvas.height \u2014 MUST be set each resize/frame\nuniform float uGrain;    // film grain amount, ~0..0.3 (0 = off)\nuniform float uOpacity;  // 0..1\n\nout vec4 fragColor;\n\n// ---- 3D classic Perlin noise (cnoise) \u2014 verbatim glsl-noise / ShaderGradient, MIT ----\nvec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }\nvec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }\nvec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }\nvec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }\nvec3 fade(vec3 t) { return t*t*t*(t*(t*6.0-15.0)+10.0); }\n\nfloat cnoise(vec3 P) {\n  vec3 Pi0 = floor(P);\n  vec3 Pi1 = Pi0 + vec3(1.0);\n  Pi0 = mod289(Pi0);\n  Pi1 = mod289(Pi1);\n  vec3 Pf0 = fract(P);\n  vec3 Pf1 = Pf0 - vec3(1.0);\n  vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);\n  vec4 iy = vec4(Pi0.yy, Pi1.yy);\n  vec4 iz0 = Pi0.zzzz;\n  vec4 iz1 = Pi1.zzzz;\n\n  vec4 ixy = permute(permute(ix) + iy);\n  vec4 ixy0 = permute(ixy + iz0);\n  vec4 ixy1 = permute(ixy + iz1);\n\n  vec4 gx0 = ixy0 * (1.0 / 7.0);\n  vec4 gy0 = fract(floor(gx0) * (1.0 / 7.0)) - 0.5;\n  gx0 = fract(gx0);\n  vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);\n  vec4 sz0 = step(gz0, vec4(0.0));\n  gx0 -= sz0 * (step(0.0, gx0) - 0.5);\n  gy0 -= sz0 * (step(0.0, gy0) - 0.5);\n\n  vec4 gx1 = ixy1 * (1.0 / 7.0);\n  vec4 gy1 = fract(floor(gx1) * (1.0 / 7.0)) - 0.5;\n  gx1 = fract(gx1);\n  vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);\n  vec4 sz1 = step(gz1, vec4(0.0));\n  gx1 -= sz1 * (step(0.0, gx1) - 0.5);\n  gy1 -= sz1 * (step(0.0, gy1) - 0.5);\n\n  vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);\n  vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);\n  vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);\n  vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);\n  vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);\n  vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);\n  vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);\n  vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);\n\n  vec4 norm0 = taylorInvSqrt(vec4(dot(g000,g000), dot(g010,g010), dot(g100,g100), dot(g110,g110)));\n  g000 *= norm0.x; g010 *= norm0.y; g100 *= norm0.z; g110 *= norm0.w;\n  vec4 norm1 = taylorInvSqrt(vec4(dot(g001,g001), dot(g011,g011), dot(g101,g101), dot(g111,g111)));\n  g001 *= norm1.x; g011 *= norm1.y; g101 *= norm1.z; g111 *= norm1.w;\n\n  float n000 = dot(g000, Pf0);\n  float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));\n  float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));\n  float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));\n  float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));\n  float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));\n  float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));\n  float n111 = dot(g111, Pf1);\n\n  vec3 fade_xyz = fade(Pf0);\n  vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);\n  vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);\n  float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);\n  return 2.2 * n_xyz;          // ~[-2.2, 2.2]\n}\n\n// Sine-free per-pixel + per-frame hash (Dave Hoskins, MIT).\n// Avoids the diagonal aliasing / scan-line artefact of sin-based hashes.\nfloat hash13(vec3 p3) {\n  p3 = fract(p3 * 0.1031);\n  p3 += dot(p3, p3.zyx + 31.32);\n  return fract((p3.x + p3.y) * p3.z);\n}\n\nvoid main() {\n  vec2 p = vUv - 0.5;\n  p.x *= uAspect;\n  float t = uTime * uSpeed;\n  float a = radians(uAngle);\n  vec2 dir = vec2(cos(a), sin(a));\n\n  // Two-octave warp: coarse low-frequency base + finer faster layer for living movement.\n  float warp = cnoise(vec3(p * uDensity, t)) * uStrength * 0.15\n             + cnoise(vec3(p * uDensity * 2.3 + 4.0, t * 1.3)) * uStrength * 0.07;\n\n  // One smooth diagonal coordinate spanning the whole frame, 0..1. The 0.95 slope\n  // makes the 3 colors sweep edge-to-edge; no hard transition anywhere.\n  float m = clamp(dot(p, dir) * 0.95 + 0.5 + warp, 0.0, 1.0);\n\n  // N-stop linear blend (2..6 stops, like a CSS linear-gradient).\n  // Dynamic array indexing is valid in GLSL ES 3.00 with uniform-array indices.\n  int n = max(uColorCount, 2);\n  float seg = m * float(n - 1);\n  int i = clamp(int(floor(seg)), 0, n - 2);\n  float f = seg - float(i);\n  vec3 col = mix(uColors[i], uColors[i + 1], f);\n\n  if (uGrain > 0.0) {\n    float g = hash13(vec3(gl_FragCoord.xy, floor(uTime * 60.0)));\n    col += (g - 0.5) * uGrain;\n  }\n  fragColor = vec4(clamp(col, 0.0, 1.0), uOpacity);\n}\n";

export { FRAGMENT_SHADER, GradientCanvas, type GradientCanvasProps, VERTEX_SHADER };
