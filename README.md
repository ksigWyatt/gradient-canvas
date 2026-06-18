# gradient-canvas

A lightweight animated **WebGL2 gradient background** for React. Renders a
subdivided plane mesh displaced by 3D Perlin noise — the flowing "organic wave"
gradient look — hand-rolled in raw WebGL2 with **no three.js, no
@react-three/fiber, and zero runtime dependencies**.

- One draw call per frame, a single fullscreen mesh
- Colors and motion fully configurable via props
- Respects `prefers-reduced-motion`, pauses off-screen and when the tab is hidden
- Renders a single static frame on mobile (battery)
- Degrades gracefully: if WebGL2 is unavailable it renders nothing, so a CSS
  background on the parent shows through
- React 18 / 19 + StrictMode safe

## Install

```bash
npm install github:ksigWyatt/gradient-canvas
```

## Usage

The canvas fills its positioned parent. Put it behind your content and give the
parent a CSS background as the always-visible fallback.

```tsx
import { GradientCanvas } from 'gradient-canvas';

export function Hero() {
  return (
    <section style={{ position: 'relative', minHeight: '100vh' }}>
      <div
        aria-hidden
        style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}
      >
        <GradientCanvas
          colors={['#D8DBE2', '#A9BCD0', '#4A8A96']}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        />
      </div>
      <div style={{ position: 'relative', zIndex: 10 }}>{/* your content */}</div>
    </section>
  );
}
```

> In Next.js App Router, import it through `next/dynamic` with `{ ssr: false }`
> since WebGL needs the DOM.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `colors` | `[string, string, string]` | — | Three hex gradient stops (required) |
| `speed` | `number` | `0.4` | Animation speed |
| `noiseDensity` | `number` | `1.5` | Wave frequency |
| `noiseStrength` | `number` | `1.6` | Displacement amplitude |
| `segments` | `number` | `128` | Plane subdivisions per side |
| `planeHalf` | `number` | `3.2` | Plane half-extent in world units |
| `opacity` | `number` | `1` | Canvas alpha (0–1) |
| `animate` | `boolean` | `true` | Animate; `false` renders one static frame |
| `respectReducedMotion` | `boolean` | `true` | Static frame under `prefers-reduced-motion` |
| `staticOnMobile` | `boolean` | `true` | Static frame on small screens |
| `mobileBreakpoint` | `number` | `768` | Max width (px) treated as mobile |
| `maxDpr` | `number` | `2` | Cap on `devicePixelRatio` |
| `className` | `string` | — | Class for the `<canvas>` |
| `style` | `CSSProperties` | — | Inline style for the `<canvas>` |

## Credits

The shader math is ported from the MIT-licensed
[ShaderGradient](https://github.com/ruucm/shadergradient) (default plane), whose
Perlin noise comes from [glsl-noise](https://github.com/hughsk/glsl-noise) by
Stefan Gustavson. See [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

## License

MIT
