import { useRef, useEffect } from 'react';
import { jsx } from 'react/jsx-runtime';

// src/GradientCanvas.tsx

// src/shaders.ts
var VERTEX_SHADER = (
  /* glsl */
  `#version 300 es
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

// 3D classic Perlin noise \u2014 verbatim from glsl-noise / ShaderGradient.
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
`
);
var FRAGMENT_SHADER = (
  /* glsl */
  `#version 300 es
precision highp float;

in vec3 vPos;

uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform float uOpacity;
uniform float uGrain;
uniform float uTime;

out vec4 fragColor;

float rand(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec3 col = mix(
    mix(uColor1, uColor2, smoothstep(-3.0, 3.0, vPos.x)),
    uColor3,
    vPos.z
  );
  if (uGrain > 0.0) {
    float g = rand(gl_FragCoord.xy + fract(uTime)) - 0.5;
    col += g * uGrain;
  }
  fragColor = vec4(col, uOpacity);
}
`
);
var PLANE_W = 10;
var PLANE_H = 10;
var W_SEG = 1;
var H_SEG = 192;
var deg2rad = (d) => d * Math.PI / 180;
function mat4Identity() {
  const m = new Float32Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
}
function mat4Perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);
  const m = new Float32Array(16);
  m[0] = f / aspect;
  m[5] = f;
  m[10] = (far + near) * nf;
  m[11] = -1;
  m[14] = 2 * far * near * nf;
  return m;
}
function mat4LookAt(eye, center, up) {
  let zx = eye[0] - center[0];
  let zy = eye[1] - center[1];
  let zz = eye[2] - center[2];
  const zlen = Math.hypot(zx, zy, zz) || 1;
  zx /= zlen;
  zy /= zlen;
  zz /= zlen;
  let xx = up[1] * zz - up[2] * zy;
  let xy = up[2] * zx - up[0] * zz;
  let xz = up[0] * zy - up[1] * zx;
  const xlen = Math.hypot(xx, xy, xz) || 1;
  xx /= xlen;
  xy /= xlen;
  xz /= xlen;
  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;
  const m = new Float32Array(16);
  m[0] = xx;
  m[1] = yx;
  m[2] = zx;
  m[4] = xy;
  m[5] = yy;
  m[6] = zy;
  m[8] = xz;
  m[9] = yz;
  m[10] = zz;
  m[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
  m[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
  m[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
  m[15] = 1;
  return m;
}
function mat4Multiply(a, b) {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] = a[0 * 4 + r] * b[c * 4 + 0] + a[1 * 4 + r] * b[c * 4 + 1] + a[2 * 4 + r] * b[c * 4 + 2] + a[3 * 4 + r] * b[c * 4 + 3];
    }
  }
  return out;
}
function mat4FromEulerXYZ(x, y, z) {
  const c1 = Math.cos(x);
  const s1 = Math.sin(x);
  const c2 = Math.cos(y);
  const s2 = Math.sin(y);
  const c3 = Math.cos(z);
  const s3 = Math.sin(z);
  const m = new Float32Array(16);
  m[0] = c2 * c3;
  m[1] = c1 * s3 + s1 * s2 * c3;
  m[2] = s1 * s3 - c1 * s2 * c3;
  m[4] = -c2 * s3;
  m[5] = c1 * c3 - s1 * s2 * s3;
  m[6] = s1 * c3 + c1 * s2 * s3;
  m[8] = s2;
  m[9] = -s1 * c2;
  m[10] = c1 * c2;
  m[15] = 1;
  return m;
}
function mat4Translate(x, y, z) {
  const m = mat4Identity();
  m[12] = x;
  m[13] = y;
  m[14] = z;
  return m;
}
function sphericalToCartesian(radius, polarDeg, azimuthDeg) {
  const phi = deg2rad(polarDeg);
  const theta = deg2rad(azimuthDeg);
  const sinPhi = Math.sin(phi);
  return [radius * sinPhi * Math.sin(theta), radius * Math.cos(phi), radius * sinPhi * Math.cos(theta)];
}
function buildPlaneGeometry() {
  const cols = W_SEG + 1;
  const rows = H_SEG + 1;
  const positions = new Float32Array(cols * rows * 3);
  const normals = new Float32Array(cols * rows * 3);
  let p = 0;
  for (let r = 0; r < rows; r++) {
    const y = (r / (rows - 1) - 0.5) * PLANE_H;
    for (let c = 0; c < cols; c++) {
      const x = (c / (cols - 1) - 0.5) * PLANE_W;
      positions[p] = x;
      positions[p + 1] = y;
      positions[p + 2] = 0;
      normals[p] = 0;
      normals[p + 1] = 0;
      normals[p + 2] = 1;
      p += 3;
    }
  }
  const indices = new Uint32Array(W_SEG * H_SEG * 6);
  let i = 0;
  for (let r = 0; r < H_SEG; r++) {
    for (let c = 0; c < W_SEG; c++) {
      const a = r * cols + c;
      const b = a + 1;
      const d = a + cols;
      const e = d + 1;
      indices[i++] = a;
      indices[i++] = d;
      indices[i++] = b;
      indices[i++] = b;
      indices[i++] = d;
      indices[i++] = e;
    }
  }
  return { positions, normals, indices };
}
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
  grain = 0,
  rotationX = 0,
  rotationY = 10,
  rotationZ = 50,
  positionX = -1.4,
  positionY = 0,
  positionZ = 0,
  azimuth = 180,
  polar = 90,
  distance = 3.6,
  zoom = 1,
  fov = 45,
  opacity = 1,
  animate = true,
  respectReducedMotion = true,
  staticOnMobile = true,
  mobileBreakpoint = 768,
  maxDpr = 2,
  className,
  style
}) {
  const canvasRef = useRef(null);
  const colorsKey = colors.join("|");
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
      powerPreference: "low-power"
    });
    if (!gl) return;
    let rafId = 0;
    let program = null;
    let vao = null;
    let posBuf = null;
    let normBuf = null;
    let idxBuf = null;
    let indexCount = 0;
    let disposed = false;
    let running = false;
    let startTime = 0;
    let isIntersecting = true;
    let uTimeLoc = null;
    let uProjLoc = null;
    let uMvLoc = null;
    const prefersReducedMotion = typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isMobile = typeof window !== "undefined" && window.innerWidth <= mobileBreakpoint;
    const staticOnly = !animate || respectReducedMotion && prefersReducedMotion || staticOnMobile && isMobile;
    const c1 = hexToRgb01(colors[0]);
    const c2 = hexToRgb01(colors[1]);
    const c3 = hexToRgb01(colors[2]);
    const model = mat4Multiply(
      mat4Translate(positionX, positionY, positionZ),
      mat4FromEulerXYZ(deg2rad(rotationX), deg2rad(rotationY), deg2rad(rotationZ))
    );
    const view = mat4LookAt(sphericalToCartesian(distance, polar, azimuth), [0, 0, 0], [0, 1, 0]);
    const modelView = mat4Multiply(view, model);
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
    function buildProjection() {
      const aspect = canvas && canvas.height > 0 ? canvas.width / canvas.height : 1;
      const proj = mat4Perspective(deg2rad(fov), aspect, 0.1, 100);
      if (zoom !== 1) {
        proj[0] *= zoom;
        proj[5] *= zoom;
      }
      return proj;
    }
    function renderFrame(elapsedSeconds) {
      if (!gl || !program || disposed || gl.isContextLost()) return;
      resize();
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      gl.useProgram(program);
      gl.bindVertexArray(vao);
      gl.uniformMatrix4fv(uProjLoc, false, buildProjection());
      gl.uniformMatrix4fv(uMvLoc, false, modelView);
      gl.uniform1f(uTimeLoc, elapsedSeconds);
      gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_INT, 0);
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
      const { positions, normals, indices } = buildPlaneGeometry();
      indexCount = indices.length;
      vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      const posLoc = gl.getAttribLocation(program, "position");
      const normLoc = gl.getAttribLocation(program, "normal");
      posBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
      gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);
      normBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, normBuf);
      gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(normLoc);
      gl.vertexAttribPointer(normLoc, 3, gl.FLOAT, false, 0, 0);
      idxBuf = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
      gl.bindVertexArray(null);
      gl.useProgram(program);
      uTimeLoc = gl.getUniformLocation(program, "uTime");
      uProjLoc = gl.getUniformLocation(program, "uProjectionMatrix");
      uMvLoc = gl.getUniformLocation(program, "uModelViewMatrix");
      gl.uniform1f(gl.getUniformLocation(program, "uSpeed"), speed);
      gl.uniform1f(gl.getUniformLocation(program, "uNoiseDensity"), density);
      gl.uniform1f(gl.getUniformLocation(program, "uNoiseStrength"), strength);
      gl.uniform3fv(gl.getUniformLocation(program, "uColor1"), c1);
      gl.uniform3fv(gl.getUniformLocation(program, "uColor2"), c2);
      gl.uniform3fv(gl.getUniformLocation(program, "uColor3"), c3);
      gl.uniform1f(gl.getUniformLocation(program, "uOpacity"), opacity);
      gl.uniform1f(gl.getUniformLocation(program, "uGrain"), grain);
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
        if (posBuf) gl.deleteBuffer(posBuf);
        if (normBuf) gl.deleteBuffer(normBuf);
        if (idxBuf) gl.deleteBuffer(idxBuf);
        if (vao) gl.deleteVertexArray(vao);
        if (program) gl.deleteProgram(program);
      }
    };
  }, [
    colorsKey,
    speed,
    density,
    strength,
    grain,
    rotationX,
    rotationY,
    rotationZ,
    positionX,
    positionY,
    positionZ,
    azimuth,
    polar,
    distance,
    zoom,
    fov,
    opacity,
    animate,
    respectReducedMotion,
    staticOnMobile,
    mobileBreakpoint,
    maxDpr
  ]);
  return /* @__PURE__ */ jsx(
    "canvas",
    {
      ref: canvasRef,
      "aria-hidden": "true",
      className,
      style: { display: "block", ...style }
    }
  );
}

export { FRAGMENT_SHADER, GradientCanvas, VERTEX_SHADER };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map