// 3D Perlin noise + gradient color mix ported from ShaderGradient.
// SPDX-License-Identifier: MIT
// Copyright (c) 2022 ruucm, stone-skipper — https://github.com/ruucm/shadergradient
//
// The `cnoise(vec3)` 3D classic Perlin noise function (and its
// mod289 / permute / taylorInvSqrt / fade helpers) is copied VERBATIM from
// ShaderGradient's default-plane vertex shader, which in turn sourced it from
// https://github.com/hughsk/glsl-noise (periodic/3d.glsl, (c) Stefan Gustavson).
//
// The displacement formula and the two-stage fragment color mix are faithful
// ports of the same ShaderGradient "default plane" shaders, with all three.js
// PBR lighting #include chunks dropped — the gradient color is output directly.
// See THIRD_PARTY_NOTICES.md for full attribution.

/**
 * Vertex shader (WebGL2 / GLSL ES 3.00).
 *
 * Displaces a subdivided plane mesh along its normal using 3D Perlin noise:
 *   noisePos   = 0.43 * position * uNoiseDensity
 *   distortion = 0.75 * cnoise(noisePos + uTime * uSpeed)
 *   pos        = position + normal * distortion * uNoiseStrength
 * The displaced position `pos` is passed to the fragment shader as `vPos`.
 */
export const VERTEX_SHADER = /* glsl */ `#version 300 es
precision highp float;

in vec3 position;
in vec3 normal;

uniform mat4 uProjectionMatrix;
uniform mat4 uModelViewMatrix;
uniform float uTime;
uniform float uSpeed;
uniform float uNoiseDensity;
uniform float uNoiseStrength;

out vec3 vPos;

// 3D classic Perlin noise — verbatim from glsl-noise / ShaderGradient.
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
vec3 fade(vec3 t) { return t*t*t*(t*(t*6.0-15.0)+10.0); }

float cnoise(vec3 P)
{
  vec3 Pi0 = floor(P);
  vec3 Pi1 = Pi0 + vec3(1.0);
  Pi0 = mod289(Pi0);
  Pi1 = mod289(Pi1);
  vec3 Pf0 = fract(P);
  vec3 Pf1 = Pf0 - vec3(1.0);
  vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
  vec4 iy = vec4(Pi0.yy, Pi1.yy);
  vec4 iz0 = Pi0.zzzz;
  vec4 iz1 = Pi1.zzzz;

  vec4 ixy = permute(permute(ix) + iy);
  vec4 ixy0 = permute(ixy + iz0);
  vec4 ixy1 = permute(ixy + iz1);

  vec4 gx0 = ixy0 * (1.0 / 7.0);
  vec4 gy0 = fract(floor(gx0) * (1.0 / 7.0)) - 0.5;
  gx0 = fract(gx0);
  vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
  vec4 sz0 = step(gz0, vec4(0.0));
  gx0 -= sz0 * (step(0.0, gx0) - 0.5);
  gy0 -= sz0 * (step(0.0, gy0) - 0.5);

  vec4 gx1 = ixy1 * (1.0 / 7.0);
  vec4 gy1 = fract(floor(gx1) * (1.0 / 7.0)) - 0.5;
  gx1 = fract(gx1);
  vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
  vec4 sz1 = step(gz1, vec4(0.0));
  gx1 -= sz1 * (step(0.0, gx1) - 0.5);
  gy1 -= sz1 * (step(0.0, gy1) - 0.5);

  vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
  vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
  vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
  vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
  vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
  vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
  vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
  vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);

  vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
  g000 *= norm0.x;
  g010 *= norm0.y;
  g100 *= norm0.z;
  g110 *= norm0.w;
  vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
  g001 *= norm1.x;
  g011 *= norm1.y;
  g101 *= norm1.z;
  g111 *= norm1.w;

  float n000 = dot(g000, Pf0);
  float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
  float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
  float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
  float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
  float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
  float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
  float n111 = dot(g111, Pf1);

  vec3 fade_xyz = fade(Pf0);
  vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
  vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
  float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);
  return 2.2 * n_xyz;
}

void main() {
  float t = uTime * uSpeed;
  vec3 noisePos = 0.43 * position * uNoiseDensity;
  float distortion = 0.75 * cnoise(noisePos + t);
  vec3 pos = position + normal * distortion * uNoiseStrength;
  vPos = pos;
  gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(pos, 1.0);
}
`;

/**
 * Fragment shader (WebGL2 / GLSL ES 3.00).
 *
 * Two-stage color mix across the displaced position. Both axes use smoothstep so
 * the blend factor stays in [0,1] across the whole plane (avoids edge banding
 * from `mix()` extrapolating an unclamped factor).
 *   col = mix(mix(c1, c2, smoothstep(-3,3, vPos.x)), c3, smoothstep(-3,3, vPos.z))
 */
export const FRAGMENT_SHADER = /* glsl */ `#version 300 es
precision highp float;

in vec3 vPos;

uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform float uOpacity;

out vec4 fragColor;

void main() {
  vec3 col = mix(
    mix(uColor1, uColor2, smoothstep(-3.0, 3.0, vPos.x)),
    uColor3,
    smoothstep(-3.0, 3.0, vPos.z)
  );
  fragColor = vec4(col, uOpacity);
}
`;
