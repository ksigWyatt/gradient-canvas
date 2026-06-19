'use strict';

var react = require('react');
var jsxRuntime = require('react/jsx-runtime');

// src/GradientCanvas.tsx

// src/shaders.ts
var VERTEX_SHADER = (
  /* glsl */
  `#version 300 es
precision highp float;

// Fullscreen triangle \u2014 no attributes, no VAO, no MVP. Driven by gl_VertexID.
// Draw with: gl.drawArrays(gl.TRIANGLES, 0, 3)
out vec2 vUv;

void main() {
  vec2 verts[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
  vec2 p = verts[gl_VertexID];
  vUv = p * 0.5 + 0.5;          // 0..1, with overscan beyond 1 on the big triangle
  gl_Position = vec4(p, 0.0, 1.0);
}
`
);
var FRAGMENT_SHADER = (
  /* glsl */
  `#version 300 es
precision highp float;

in vec2 vUv;

uniform vec3  uColor1;
uniform vec3  uColor2;
uniform vec3  uColor3;
uniform float uTime;     // seconds
uniform float uSpeed;    // animation rate (Halo: 0.4)
uniform float uDensity;  // noise frequency (Halo: 1.3)
uniform float uStrength; // color3 "halo" contribution; remapped, NOT raw mix (Halo src: 4)
uniform float uAngle;    // diagonal axis in degrees (Halo rotationZ: 50)
uniform float uAspect;   // canvas.width / canvas.height \u2014 MUST be set each resize/frame
uniform float uGrain;    // film grain amount, ~0..0.3 (0 = off)
uniform float uOpacity;  // 0..1

out vec4 fragColor;

// ---- 3D classic Perlin noise (cnoise) \u2014 verbatim glsl-noise / ShaderGradient, MIT ----
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
vec3 fade(vec3 t) { return t*t*t*(t*(t*6.0-15.0)+10.0); }

float cnoise(vec3 P) {
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

  vec4 norm0 = taylorInvSqrt(vec4(dot(g000,g000), dot(g010,g010), dot(g100,g100), dot(g110,g110)));
  g000 *= norm0.x; g010 *= norm0.y; g100 *= norm0.z; g110 *= norm0.w;
  vec4 norm1 = taylorInvSqrt(vec4(dot(g001,g001), dot(g011,g011), dot(g101,g101), dot(g111,g111)));
  g001 *= norm1.x; g011 *= norm1.y; g101 *= norm1.z; g111 *= norm1.w;

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
  return 2.2 * n_xyz;          // ~[-2.2, 2.2]
}

// Cheap hash grain (no texture). Animated by uTime so it shimmers like film grain.
float rand(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 p = vUv - 0.5;
  p.x *= uAspect;
  float t = uTime * uSpeed;
  float a = radians(uAngle);
  vec2 dir = vec2(cos(a), sin(a));

  // Gentle low-frequency organic warp (uStrength = amount, uDensity = frequency).
  float warp = cnoise(vec3(p * uDensity, t)) * uStrength * 0.15;

  // One smooth diagonal coordinate spanning the whole frame, 0..1. The 0.95 slope
  // makes the 3 colors sweep edge-to-edge; no hard transition anywhere.
  float m = clamp(dot(p, dir) * 0.95 + 0.5 + warp, 0.0, 1.0);

  // Clean 3-stop linear blend: color1 -> color2 -> color3 (like a CSS linear-gradient).
  vec3 col = m < 0.5 ? mix(uColor1, uColor2, m * 2.0)
                     : mix(uColor2, uColor3, (m - 0.5) * 2.0);

  if (uGrain > 0.0) col += (rand(gl_FragCoord.xy + fract(uTime)) - 0.5) * uGrain;
  fragColor = vec4(clamp(col, 0.0, 1.0), uOpacity);
}
`
);
function compileShader(gl, type, src) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn("[GradientCanvas] shader compile failed:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}
function hexToRgb01(hex) {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) {
    h = h.split("").map((c) => c + c).join("");
  }
  const int = parseInt(h, 16);
  if (h.length !== 6 || Number.isNaN(int)) return [0, 0, 0];
  return [(int >> 16 & 255) / 255, (int >> 8 & 255) / 255, (int & 255) / 255];
}
function GradientCanvas({
  colors,
  speed = 0.4,
  density = 1.3,
  strength = 4,
  angle = 50,
  grain = 0,
  opacity = 1,
  animate = true,
  respectReducedMotion = true,
  staticOnMobile = true,
  mobileBreakpoint = 768,
  maxDpr = 2,
  className,
  style
}) {
  const canvasRef = react.useRef(null);
  const colorsKey = colors.join("|");
  react.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      premultipliedAlpha: false,
      powerPreference: "low-power"
    });
    if (!gl) return;
    let rafId = 0;
    let program = null;
    let vao = null;
    let disposed = false;
    let running = false;
    let startTime = 0;
    let isIntersecting = true;
    let uTimeLoc = null;
    let uAspectLoc = null;
    const prefersReducedMotion = typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isMobile = typeof window !== "undefined" && window.innerWidth <= mobileBreakpoint;
    const staticOnly = !animate || respectReducedMotion && prefersReducedMotion || staticOnMobile && isMobile;
    const c1 = hexToRgb01(colors[0]);
    const c2 = hexToRgb01(colors[1]);
    const c3 = hexToRgb01(colors[2]);
    function getDpr() {
      const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
      return Math.min(dpr, maxDpr);
    }
    function resize() {
      if (!gl || !canvas) return;
      const dpr = getDpr();
      const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    function renderFrame(elapsedSeconds) {
      if (!gl || !program || !canvas || disposed || gl.isContextLost()) return;
      resize();
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.bindVertexArray(vao);
      gl.uniform1f(uTimeLoc, elapsedSeconds);
      gl.uniform1f(uAspectLoc, canvas.height > 0 ? canvas.width / canvas.height : 1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);
    }
    function loop(now) {
      if (disposed || !running) return;
      if (!startTime) startTime = now;
      renderFrame((now - startTime) / 1e3);
      rafId = window.requestAnimationFrame(loop);
    }
    function start() {
      if (disposed || running || staticOnly) return;
      running = true;
      startTime = 0;
      rafId = window.requestAnimationFrame(loop);
    }
    function stop() {
      running = false;
      if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
    }
    function setup() {
      if (disposed || !gl || !canvas) return;
      const vert = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
      const frag = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
      if (!vert || !frag) return;
      program = gl.createProgram();
      if (!program) return;
      gl.attachShader(program, vert);
      gl.attachShader(program, frag);
      gl.linkProgram(program);
      gl.deleteShader(vert);
      gl.deleteShader(frag);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.warn("[GradientCanvas] program link failed:", gl.getProgramInfoLog(program));
        return;
      }
      vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      gl.bindVertexArray(null);
      gl.enable(gl.BLEND);
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(program);
      uTimeLoc = gl.getUniformLocation(program, "uTime");
      uAspectLoc = gl.getUniformLocation(program, "uAspect");
      gl.uniform1f(gl.getUniformLocation(program, "uSpeed"), speed);
      gl.uniform1f(gl.getUniformLocation(program, "uDensity"), density);
      gl.uniform1f(gl.getUniformLocation(program, "uStrength"), strength);
      gl.uniform1f(gl.getUniformLocation(program, "uAngle"), angle);
      gl.uniform3fv(gl.getUniformLocation(program, "uColor1"), c1);
      gl.uniform3fv(gl.getUniformLocation(program, "uColor2"), c2);
      gl.uniform3fv(gl.getUniformLocation(program, "uColor3"), c3);
      gl.uniform1f(gl.getUniformLocation(program, "uGrain"), grain);
      gl.uniform1f(gl.getUniformLocation(program, "uOpacity"), opacity);
      if (disposed) return;
      renderFrame(0);
      if (!staticOnly) start();
    }
    function onVisibilityChange() {
      if (staticOnly) return;
      if (document.hidden) stop();
      else if (isIntersecting) start();
    }
    function onResizeWindow() {
      if (staticOnly) renderFrame(0);
    }
    function onContextLost(e) {
      e.preventDefault();
      disposed = true;
      stop();
    }
    let observer = null;
    if (!staticOnly && typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            isIntersecting = entry.isIntersecting;
            if (entry.isIntersecting && !document.hidden) start();
            else stop();
          }
        },
        { threshold: 0 }
      );
      observer.observe(canvas);
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("resize", onResizeWindow);
    canvas.addEventListener("webglcontextlost", onContextLost, false);
    let idleHandle = null;
    let timeoutHandle = null;
    const ric = typeof window !== "undefined" ? window.requestIdleCallback : void 0;
    if (ric) idleHandle = ric(() => setup(), { timeout: 1500 });
    else timeoutHandle = setTimeout(() => setup(), 200);
    return () => {
      disposed = true;
      stop();
      if (idleHandle != null && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleHandle);
      }
      if (timeoutHandle != null) clearTimeout(timeoutHandle);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("resize", onResizeWindow);
      canvas.removeEventListener("webglcontextlost", onContextLost, false);
      if (observer) observer.disconnect();
      if (gl) {
        if (vao) gl.deleteVertexArray(vao);
        if (program) gl.deleteProgram(program);
      }
    };
  }, [
    colorsKey,
    speed,
    density,
    strength,
    angle,
    grain,
    opacity,
    animate,
    respectReducedMotion,
    staticOnMobile,
    mobileBreakpoint,
    maxDpr
  ]);
  return /* @__PURE__ */ jsxRuntime.jsx(
    "canvas",
    {
      ref: canvasRef,
      "aria-hidden": "true",
      className,
      style: { display: "block", ...style }
    }
  );
}

exports.FRAGMENT_SHADER = FRAGMENT_SHADER;
exports.GradientCanvas = GradientCanvas;
exports.VERTEX_SHADER = VERTEX_SHADER;
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map