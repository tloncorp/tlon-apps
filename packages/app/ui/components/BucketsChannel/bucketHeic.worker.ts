import createLibheif from 'libheif-js/libheif-wasm/libheif-bundle.mjs';

// Preview limits, not upload limits. Decoding is isolated from the UI thread;
// the owner terminates this worker on close, timeout, or completion.
const MAX_BYTES = 64 * 1024 * 1024;
const MAX_PIXELS = 50_000_000;

async function readImage(uri: string) {
  const response = await fetch(uri, { credentials: 'omit' });
  if (!response.ok || !response.body) throw new Error('download');
  if (Number(response.headers.get('content-length')) > MAX_BYTES)
    throw new Error('size');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > MAX_BYTES) throw new Error('size');
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

async function preview(uri: string): Promise<Blob> {
  const bytes = await readImage(uri);
  const libheif = await createLibheif();
  const images = new libheif.HeifDecoder().decode(bytes);
  try {
    const image =
      images.find((candidate) => candidate.is_primary()) ?? images[0];
    if (!image) throw new Error('decode');
    const width = image.get_width();
    const height = image.get_height();
    if (width <= 0 || height <= 0 || width * height > MAX_PIXELS)
      throw new Error('size');
    const decoded = await new Promise<ImageData>((resolve, reject) => {
      image.display(new ImageData(width, height), (result) => {
        if (result) resolve(result);
        else reject(new Error('decode'));
      });
    });
    const scale = Math.min(1, 2048 / Math.max(width, height));
    const canvas = new OffscreenCanvas(
      Math.max(1, Math.round(width * scale)),
      Math.max(1, Math.round(height * scale))
    );
    const context = canvas.getContext('2d');
    if (!context) throw new Error('decode');
    const bitmap = await createImageBitmap(decoded, {
      resizeWidth: canvas.width,
      resizeHeight: canvas.height,
    });
    try {
      context.drawImage(bitmap, 0, 0);
    } finally {
      bitmap.close();
    }
    return await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
  } finally {
    for (const image of images) image.free();
  }
}

self.onmessage = async (event: MessageEvent<string>) => {
  try {
    self.postMessage({ blob: await preview(event.data) });
  } catch (error) {
    // Never echo signed URLs or decoder details into UI/telemetry.
    self.postMessage({
      error:
        error instanceof Error && error.message === 'size' ? 'size' : 'decode',
    });
  }
};
