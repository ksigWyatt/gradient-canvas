import * as react from 'react';
import { CSSProperties } from 'react';

interface GradientCanvasProps {
    /** Three gradient stop colors as hex strings, e.g. ['#D8DBE2', '#A9BCD0', '#4A8A96']. */
    colors: [string, string, string];
    /** Animation speed. Default 0.4. */
    speed?: number;
    /** Perlin noise density (wave frequency). Default 1.5. */
    noiseDensity?: number;
    /** Displacement amplitude. Default 1.6. */
    noiseStrength?: number;
    /** Plane subdivisions per side (higher = smoother, more vertices). Default 128. */
    segments?: number;
    /** Half-extent of the plane in world units. Default 3.2. */
    planeHalf?: number;
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
declare function GradientCanvas({ colors, speed, noiseDensity, noiseStrength, segments, planeHalf, opacity, animate, respectReducedMotion, staticOnMobile, mobileBreakpoint, maxDpr, className, style, }: GradientCanvasProps): react.JSX.Element;

/**
 * Vertex shader (WebGL2 / GLSL ES 3.00).
 *
 * Displaces a subdivided plane mesh along its normal using 3D Perlin noise:
 *   noisePos   = 0.43 * position * uNoiseDensity
 *   distortion = 0.75 * cnoise(noisePos + uTime * uSpeed)
 *   pos        = position + normal * distortion * uNoiseStrength
 * The displaced position `pos` is passed to the fragment shader as `vPos`.
 */
declare const VERTEX_SHADER = "#version 300 es\nprecision highp float;\n\nin vec3 position;\nin vec3 normal;\n\nuniform mat4 uProjectionMatrix;\nuniform mat4 uModelViewMatrix;\nuniform float uTime;\nuniform float uSpeed;\nuniform float uNoiseDensity;\nuniform float uNoiseStrength;\n\nout vec3 vPos;\n\n// 3D classic Perlin noise \u2014 verbatim from glsl-noise / ShaderGradient.\nvec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }\nvec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }\nvec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }\nvec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }\nvec3 fade(vec3 t) { return t*t*t*(t*(t*6.0-15.0)+10.0); }\n\nfloat cnoise(vec3 P)\n{\n  vec3 Pi0 = floor(P);\n  vec3 Pi1 = Pi0 + vec3(1.0);\n  Pi0 = mod289(Pi0);\n  Pi1 = mod289(Pi1);\n  vec3 Pf0 = fract(P);\n  vec3 Pf1 = Pf0 - vec3(1.0);\n  vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);\n  vec4 iy = vec4(Pi0.yy, Pi1.yy);\n  vec4 iz0 = Pi0.zzzz;\n  vec4 iz1 = Pi1.zzzz;\n\n  vec4 ixy = permute(permute(ix) + iy);\n  vec4 ixy0 = permute(ixy + iz0);\n  vec4 ixy1 = permute(ixy + iz1);\n\n  vec4 gx0 = ixy0 * (1.0 / 7.0);\n  vec4 gy0 = fract(floor(gx0) * (1.0 / 7.0)) - 0.5;\n  gx0 = fract(gx0);\n  vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);\n  vec4 sz0 = step(gz0, vec4(0.0));\n  gx0 -= sz0 * (step(0.0, gx0) - 0.5);\n  gy0 -= sz0 * (step(0.0, gy0) - 0.5);\n\n  vec4 gx1 = ixy1 * (1.0 / 7.0);\n  vec4 gy1 = fract(floor(gx1) * (1.0 / 7.0)) - 0.5;\n  gx1 = fract(gx1);\n  vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);\n  vec4 sz1 = step(gz1, vec4(0.0));\n  gx1 -= sz1 * (step(0.0, gx1) - 0.5);\n  gy1 -= sz1 * (step(0.0, gy1) - 0.5);\n\n  vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);\n  vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);\n  vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);\n  vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);\n  vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);\n  vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);\n  vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);\n  vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);\n\n  vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));\n  g000 *= norm0.x;\n  g010 *= norm0.y;\n  g100 *= norm0.z;\n  g110 *= norm0.w;\n  vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));\n  g001 *= norm1.x;\n  g011 *= norm1.y;\n  g101 *= norm1.z;\n  g111 *= norm1.w;\n\n  float n000 = dot(g000, Pf0);\n  float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));\n  float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));\n  float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));\n  float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));\n  float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));\n  float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));\n  float n111 = dot(g111, Pf1);\n\n  vec3 fade_xyz = fade(Pf0);\n  vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);\n  vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);\n  float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);\n  return 2.2 * n_xyz;\n}\n\nvoid main() {\n  float t = uTime * uSpeed;\n  vec3 noisePos = 0.43 * position * uNoiseDensity;\n  float distortion = 0.75 * cnoise(noisePos + t);\n  vec3 pos = position + normal * distortion * uNoiseStrength;\n  vPos = pos;\n  gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(pos, 1.0);\n}\n";
/**
 * Fragment shader (WebGL2 / GLSL ES 3.00).
 *
 * Two-stage color mix across the displaced position. Both axes use smoothstep so
 * the blend factor stays in [0,1] across the whole plane (avoids edge banding
 * from `mix()` extrapolating an unclamped factor).
 *   col = mix(mix(c1, c2, smoothstep(-3,3, vPos.x)), c3, smoothstep(-3,3, vPos.z))
 */
declare const FRAGMENT_SHADER = "#version 300 es\nprecision highp float;\n\nin vec3 vPos;\n\nuniform vec3 uColor1;\nuniform vec3 uColor2;\nuniform vec3 uColor3;\nuniform float uOpacity;\n\nout vec4 fragColor;\n\nvoid main() {\n  vec3 col = mix(\n    mix(uColor1, uColor2, smoothstep(-3.0, 3.0, vPos.x)),\n    uColor3,\n    smoothstep(-3.0, 3.0, vPos.z)\n  );\n  fragColor = vec4(col, uOpacity);\n}\n";

export { FRAGMENT_SHADER, GradientCanvas, type GradientCanvasProps, VERTEX_SHADER };
