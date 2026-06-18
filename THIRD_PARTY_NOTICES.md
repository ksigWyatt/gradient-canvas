# Third-Party Notices

This package contains GLSL ported from the following MIT-licensed projects.

## ShaderGradient

The 3D Perlin-noise vertex displacement and the two-stage gradient color mix in
`src/shaders.ts` are ported from ShaderGradient's default-plane shaders (the
three.js PBR lighting was removed; the gradient color is output directly).

> MIT License
>
> Copyright (c) 2022 ruucm, stone-skipper
>
> https://github.com/ruucm/shadergradient
>
> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation files (the "Software"), to deal
> in the Software without restriction... (full MIT text applies).

## glsl-noise (Stefan Gustavson)

ShaderGradient's `cnoise` (3D classic Perlin noise) originates from glsl-noise.

> Copyright (c) 2011 Stefan Gustavson. All rights reserved.
> Distributed under the MIT license. https://github.com/hughsk/glsl-noise
>
> Classic Perlin noise, periodic variant, by Stefan Gustavson.
