'use client';

/**
 * GradientCanvas
 * --------------
 * A lightweight animated WebGL2 gradient background for React. Renders a
 * fullscreen-quad fragment shader evaluating ShaderGradient's color formula in
 * screen space (no mesh, no camera) — no three.js, zero runtime dependencies.
 * Colors, animation, and noise parameters are configurable via props; defaults
 * reproduce the ShaderGradient Halo preset.
 *
 * The canvas is decorative (aria-hidden). If WebGL2 is unavailable it renders
 * nothing, so a CSS background on the parent shows through.
 */

import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { VERTEX_SHADER, FRAGMENT_SHADER } from './shaders';

export interface GradientCanvasProps {
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
  style,
}: GradientCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const colorsKey = colors.join('|');

  // Clamp to [2, 6] stops and build a flat Float32Array for the uniform array.
  const count = Math.max(2, Math.min(6, colors.length));
  const flatColors = new Float32Array(6 * 3); // always 6 slots; extras are [0,0,0]
  for (let idx = 0; idx < count; idx++) {
    const [r, g, b] = hexToRgb01(colors[idx]);
    flatColors[idx * 3 + 0] = r;
    flatColors[idx * 3 + 1] = g;
    flatColors[idx * 3 + 2] = b;
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: false,
      premultipliedAlpha: false,
      powerPreference: 'low-power',
    });
    if (!gl) return;

    let rafId = 0;
    let program: WebGLProgram | null = null;
    let vao: WebGLVertexArrayObject | null = null;
    let disposed = false;
    let running = false;
    let startTime = 0;
    let isIntersecting = true;

    let uTimeLoc: WebGLUniformLocation | null = null;
    let uAspectLoc: WebGLUniformLocation | null = null;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= mobileBreakpoint;
    const staticOnly =
      !animate || (respectReducedMotion && prefersReducedMotion) || (staticOnMobile && isMobile);

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

    function renderFrame(elapsedSeconds: number) {
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

      // Empty VAO — WebGL2 requires a bound VAO to draw; no attributes needed for
      // the fullscreen-quad path (position comes from gl_VertexID in the shader).
      vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      gl.bindVertexArray(null);

      // Enable alpha blending so opacity < 1 composites over the CSS background.
      gl.enable(gl.BLEND);
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      gl.useProgram(program);

      // Cache per-frame uniform locations.
      uTimeLoc = gl.getUniformLocation(program, 'uTime');
      uAspectLoc = gl.getUniformLocation(program, 'uAspect');

      // Set-once uniforms.
      gl.uniform1f(gl.getUniformLocation(program, 'uSpeed'), speed);
      gl.uniform1f(gl.getUniformLocation(program, 'uDensity'), density);
      gl.uniform1f(gl.getUniformLocation(program, 'uStrength'), strength);
      gl.uniform1f(gl.getUniformLocation(program, 'uAngle'), angle);
      gl.uniform3fv(gl.getUniformLocation(program, 'uColors'), flatColors);
      gl.uniform1i(gl.getUniformLocation(program, 'uColorCount'), count);
      gl.uniform1f(gl.getUniformLocation(program, 'uGrain'), grain);
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
        if (vao) gl.deleteVertexArray(vao);
        if (program) gl.deleteProgram(program);
      }
      // NOTE: deliberately NOT calling WEBGL_lose_context — React 19 StrictMode
      // remounts on the SAME canvas element; losing the context would leave the
      // remount with a permanently dead context. The browser releases the context
      // via GC when the canvas is detached on final unmount.
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
