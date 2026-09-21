const positive = (n?: number | null): n is number =>
  n != null && Number.isFinite(n) && n > 0;

/**
 * An image block's dimensions come off the wire, so they are only as
 * trustworthy as whatever authored the post. Surfaces that scroll their content
 * cap how much of the window one image may take; full-bleed surfaces pass no
 * fraction and render at the natural ratio however tall that is.
 */
export function resolveImageMaxHeight({
  windowHeight,
  maxWindowHeightFraction,
}: {
  windowHeight: number;
  maxWindowHeightFraction?: number;
}): number | undefined {
  if (!positive(windowHeight) || !positive(maxWindowHeightFraction)) {
    return undefined;
  }
  return windowHeight * maxWindowHeightFraction;
}

/**
 * Whether this image can reach the cap at all, and so whether its column is
 * worth measuring.
 *
 * A column is never wider than the window and an image is never rendered wider
 * than its own pixels, so `min(window, pixels) / ratio` is the tallest it could
 * ever be. When even that fits, no column can make it overflow and the block
 * renders on the plain path -- no probe, no extra layout pass. Only the
 * unusually tall images the cap exists for pay for it.
 */
export function shouldMeasureColumn({
  windowWidth,
  maxHeight,
  naturalAspectRatio,
  naturalPixelWidth,
}: {
  windowWidth: number;
  maxHeight?: number;
  naturalAspectRatio: number | null;
  naturalPixelWidth?: number | null;
}): boolean {
  if (
    !positive(windowWidth) ||
    !positive(maxHeight) ||
    !positive(naturalAspectRatio)
  ) {
    return false;
  }
  const widest = positive(naturalPixelWidth)
    ? Math.min(windowWidth, naturalPixelWidth)
    : windowWidth;
  return widest / naturalAspectRatio > maxHeight;
}

/**
 * Largest box with the image's own proportions fitting every limit given.
 *
 * Both callers want this arithmetic and differ only in where the limits come
 * from: web chat passes fixed pixel caps, a scrolling native surface passes its
 * measured column and a window-derived height. `naturalPixelWidth` is the
 * latter's extra limit -- it keeps a small image from being blown across a wide
 * column, which the fixed-cap callers have never done.
 */
export function resolveConstrainedImageSize({
  maxWidth,
  maxHeight,
  naturalAspectRatio,
  naturalPixelWidth,
}: {
  maxWidth?: number | null;
  maxHeight?: number | null;
  naturalAspectRatio: number | null;
  naturalPixelWidth?: number | null;
}): { width: number; height: number } | null {
  if (
    !positive(maxWidth) ||
    !positive(maxHeight) ||
    !positive(naturalAspectRatio)
  ) {
    return null;
  }
  const limits = [maxWidth, maxHeight * naturalAspectRatio];
  if (positive(naturalPixelWidth)) {
    limits.push(naturalPixelWidth);
  }
  const width = Math.min(...limits);
  return { width, height: width / naturalAspectRatio };
}
