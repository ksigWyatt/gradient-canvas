'use client';

/**
 * GradientCanvas
 * --------------
 * A lightweight animated WebGL2 gradient background for React. Renders a
 * subdivided plane mesh displaced by 3D Perlin noise (the "organic wave" look),
 * hand-rolled in raw WebGL2 — no three.js, no @react-three/fiber, no runtime
 * dependencies. Colors and motion are fully configurable via props.
 *
 * The canvas is decorative by default (aria-hidden). If WebGL2 is unavailable
 * the component renders nothing, so a CSS background on the parent shows through.
 */

import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { VERTEX_SHADER, FRAGMENT_SHADER } from './shaders';

export interface GradientCanvasProps {
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

// ---------------------------------------------------------------------------
// Tiny column-major mat4 helpers (no gl-matrix dependency).
// ---------------------------------------------------------------------------
type Mat4 = Float32Array;

function mat4Identity(): Mat4 {
  const m = new Float32Array(16);
  m[0] = 1;
  m[5] = 1;
  m[10] = 1;
  m[15] = 1;
  return m;
}

function mat4Perspective(fovy: number, aspect: number, near: number, far: number): Mat4 {
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

function mat4LookAt(
  eye: [number, number, number],
  center: [number, number, number],
  up: [number, number, number]
): Mat4 {
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
  m[3] = 0;
  m[4] = xy;
  m[5] = yy;
  m[6] = zy;
  m[7] = 0;
  m[8] = xz;
  m[9] = yz;
  m[10] = zz;
  m[11] = 0;
  m[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
  m[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
  m[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
  m[15] = 1;
  return m;
}

function mat4Multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] =
        a[0 * 4 + r] * b[c * 4 + 0] +
        a[1 * 4 + r] * b[c * 4 + 1] +
        a[2 * 4 + r] * b[c * 4 + 2] +
        a[3 * 4 + r] * b[c * 4 + 3];
    }
  }
  return out;
}

function mat4RotateX(m: Mat4, angle: number): Mat4 {
  const s = Math.sin(angle);
  const c = Math.cos(angle);
  const r = mat4Identity();
  r[5] = c;
  r[6] = s;
  r[9] = -s;
  r[10] = c;
  return mat4Multiply(m, r);
}

// Plane geometry — grid of segments x segments quads in XZ, normals = (0,1,0).
function buildPlaneGeometry(segments: number, half: number) {
  const verts = segments + 1;
  const positions = new Float32Array(verts * verts * 3);
  const normals = new Float32Array(verts * verts * 3);
  const step = (half * 2) / segments;

  let p = 0;
  for (let zi = 0; zi < verts; zi++) {
    for (let xi = 0; xi < verts; xi++) {
      positions[p] = -half + xi * step;
      positions[p + 1] = 0;
      positions[p + 2] = -half + zi * step;
      normals[p] = 0;
      normals[p + 1] = 1;
      normals[p + 2] = 0;
      p += 3;
    }
  }

  // 32-bit indices so high subdivision counts (>255 segments) stay safe.
  const quads = segments * segments;
  const indices = new Uint32Array(quads * 6);
  let i = 0;
  for (let zi = 0; zi < segments; zi++) {
    for (let xi = 0; xi < segments; xi++) {
      const a = zi * verts + xi;
      const b = a + 1;
      const c = a + verts;
      const d = c + 1;
      indices[i++] = a;
      indices[i++] = c;
      indices[i++] = b;
      indices[i++] = b;
      indices[i++] = c;
      indices[i++] = d;
    }
  }

  return { positions, normals, indices };
}

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    // eslint-disable-next-line no-console
    console.warn('[GradientCanvas] shader compile failed:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function hexToRgb01(hex: string): [number, number, number] {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const int = parseInt(h, 16);
  if (h.length !== 6 || Number.isNaN(int)) return [0, 0, 0];
  return [((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255];
}

export function GradientCanvas({
  colors,
  speed = 0.4,
  noiseDensity = 1.5,
  noiseStrength = 1.6,
  segments = 128,
  planeHalf = 3.2,
  opacity = 1,
  animate = true,
  respectReducedMotion = true,
  staticOnMobile = true,
  mobileBreakpoint = 768,
  maxDpr = 2,
  className,
  style,
}: GradientCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const colorsKey = colors.join('|');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Bail cleanly if WebGL2 is unavailable -> parent CSS background shows through.
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
      powerPreference: 'low-power',
    });
    if (!gl) return;

    let rafId = 0;
    let program: WebGLProgram | null = null;
    let vao: WebGLVertexArrayObject | null = null;
    let posBuf: WebGLBuffer | null = null;
    let normBuf: WebGLBuffer | null = null;
    let idxBuf: WebGLBuffer | null = null;
    let indexCount = 0;
    let disposed = false;
    let running = false;
    let startTime = 0;
    let isIntersecting = true;

    let uTimeLoc: WebGLUniformLocation | null = null;
    let uProjLoc: WebGLUniformLocation | null = null;
    let uMvLoc: WebGLUniformLocation | null = null;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= mobileBreakpoint;
    const staticOnly =
      !animate || (respectReducedMotion && prefersReducedMotion) || (staticOnMobile && isMobile);

    const c1 = hexToRgb01(colors[0]);
    const c2 = hexToRgb01(colors[1]);
    const c3 = hexToRgb01(colors[2]);

    function getDpr(): number {
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      return Math.min(dpr, maxDpr);
    }

    function resize(): void {
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

    function buildProjection(): Mat4 {
      const aspect = canvas && canvas.height > 0 ? canvas.width / canvas.height : 1;
      return mat4Perspective((50 * Math.PI) / 180, aspect, 0.1, 100);
    }

    function buildModelView(): Mat4 {
      const view = mat4LookAt([0, 1.7, 4.2], [0, 0, 0], [0, 1, 0]);
      const model = mat4RotateX(mat4Identity(), -Math.PI / 4);
      return mat4Multiply(view, model);
    }

    function renderFrame(elapsedSeconds: number) {
      if (!gl || !program || disposed || gl.isContextLost()) return;
      resize();
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      gl.useProgram(program);
      gl.bindVertexArray(vao);
      gl.uniformMatrix4fv(uProjLoc, false, buildProjection());
      gl.uniformMatrix4fv(uMvLoc, false, buildModelView());
      gl.uniform1f(uTimeLoc, elapsedSeconds);
      gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_INT, 0);
      gl.bindVertexArray(null);
    }

    function loop(now: number) {
      if (disposed || !running) return;
      if (!startTime) startTime = now;
      renderFrame((now - startTime) / 1000);
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
        // eslint-disable-next-line no-console
        console.warn('[GradientCanvas] program link failed:', gl.getProgramInfoLog(program));
        return;
      }

      const { positions, normals, indices } = buildPlaneGeometry(segments, planeHalf);
      indexCount = indices.length;

      vao = gl.createVertexArray();
      gl.bindVertexArray(vao);

      const posLoc = gl.getAttribLocation(program, 'position');
      const normLoc = gl.getAttribLocation(program, 'normal');

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
      uTimeLoc = gl.getUniformLocation(program, 'uTime');
      uProjLoc = gl.getUniformLocation(program, 'uProjectionMatrix');
      uMvLoc = gl.getUniformLocation(program, 'uModelViewMatrix');
      gl.uniform1f(gl.getUniformLocation(program, 'uSpeed'), speed);
      gl.uniform1f(gl.getUniformLocation(program, 'uNoiseDensity'), noiseDensity);
      gl.uniform1f(gl.getUniformLocation(program, 'uNoiseStrength'), noiseStrength);
      gl.uniform3fv(gl.getUniformLocation(program, 'uColor1'), c1);
      gl.uniform3fv(gl.getUniformLocation(program, 'uColor2'), c2);
      gl.uniform3fv(gl.getUniformLocation(program, 'uColor3'), c3);
      gl.uniform1f(gl.getUniformLocation(program, 'uOpacity'), opacity);

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

    // Real GPU context loss (driver reset): stop and mark disposed so the loop
    // is never restarted onto a lost context by the observer/visibility handlers.
    function onContextLost(e: Event) {
      e.preventDefault();
      disposed = true;
      stop();
    }

    let observer: IntersectionObserver | null = null;
    if (!staticOnly && typeof IntersectionObserver !== 'undefined') {
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

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('resize', onResizeWindow);
    canvas.addEventListener('webglcontextlost', onContextLost, false);

    // Defer compile/first run until after first paint so it never blocks LCP/INP.
    let idleHandle: number | null = null;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    const ric: typeof window.requestIdleCallback | undefined =
      typeof window !== 'undefined' ? window.requestIdleCallback : undefined;
    if (ric) idleHandle = ric(() => setup(), { timeout: 1500 });
    else timeoutHandle = setTimeout(() => setup(), 200);

    return () => {
      disposed = true;
      stop();
      if (idleHandle != null && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleHandle);
      }
      if (timeoutHandle != null) clearTimeout(timeoutHandle);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('resize', onResizeWindow);
      canvas.removeEventListener('webglcontextlost', onContextLost, false);
      if (observer) observer.disconnect();
      if (gl) {
        if (posBuf) gl.deleteBuffer(posBuf);
        if (normBuf) gl.deleteBuffer(normBuf);
        if (idxBuf) gl.deleteBuffer(idxBuf);
        if (vao) gl.deleteVertexArray(vao);
        if (program) gl.deleteProgram(program);
      }
      // NOTE: we deliberately do NOT call WEBGL_lose_context here. React 19
      // StrictMode mounts -> cleans up -> remounts on the SAME canvas, and a
      // canvas can only ever return its original context; losing it would leave
      // the remount with a dead context. The context is released by GC when the
      // canvas is detached on a genuine unmount.
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    colorsKey,
    speed,
    noiseDensity,
    noiseStrength,
    segments,
    planeHalf,
    opacity,
    animate,
    respectReducedMotion,
    staticOnMobile,
    mobileBreakpoint,
    maxDpr,
  ]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className}
      style={{ display: 'block', ...style }}
    />
  );
}
