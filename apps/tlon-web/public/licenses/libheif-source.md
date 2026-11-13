# HEIC preview decoder

The web HEIC preview worker uses the unmodified embedded-WASM bundle from
`libheif-js` 1.23.5 (LGPL-3.0), including libheif 1.23.5 and libde265 1.0.15.
Their license texts are in [libheif.txt](./libheif.txt) and
[libde265.txt](./libde265.txt).

- JavaScript distribution and build scripts: https://github.com/catdad-experiments/libheif-js/tree/1.23.5
- WASM build: https://github.com/catdad-experiments/libheif-emscripten/tree/v1.23.5
- Package: https://www.npmjs.com/package/libheif-js/v/1.23.5
- Decoder source: https://github.com/strukturag/libheif/tree/v1.23.5
- HEVC decoder source: https://github.com/strukturag/libde265/tree/v1.0.15

The decoder is loaded only when a HEIC/HEIF photo is opened on web. The
original file is not modified or uploaded to a conversion service.
