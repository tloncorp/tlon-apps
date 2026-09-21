/**
 * An image block's dimensions come off the wire, so they are only as
 * trustworthy as whatever authored the post. Surfaces that scroll their content
 * cap how much of the window one image may occupy, so a single block cannot
 * make a row taller than the screen it has to be scrolled through. Surfaces
 * that render an image full-bleed pass no fraction and are left alone.
 */
export function resolveImageMaxHeight({
  windowHeight,
  maxWindowHeightFraction,
}: {
  windowHeight: number;
  maxWindowHeightFraction?: number;
}): number | undefined {
  if (
    maxWindowHeightFraction == null ||
    !Number.isFinite(maxWindowHeightFraction) ||
    maxWindowHeightFraction <= 0
  ) {
    return undefined;
  }
  if (!Number.isFinite(windowHeight) || windowHeight <= 0) {
    return undefined;
  }
  return windowHeight * maxWindowHeightFraction;
}

/**
 * Largest box with the image's own proportions that fits the column it is
 * rendered in and the height cap, and no wider in points than the image is in
 * pixels (inherited from how this has always bounded width -- on a 3x screen
 * that still leaves room to upscale, it just keeps a small image from being
 * blown across the column).
 *
 * Fitting rather than cropping is what keeps the cap from eating ordinary
 * content on a wide column: a portrait photo laid out across a 1000pt tablet
 * column stands 1333pt tall, so bounding its height by cropping would take a
 * third of the picture, while narrowing it to 652pt keeps all of it. It is also
 * what the web renderer has always done with its own 600x400 caps.
 */
export function resolveImageFit({
  availableWidth,
  maxHeight,
  naturalAspectRatio,
  naturalPixelWidth,
}: {
  availableWidth: number | null;
  maxHeight?: number;
  naturalAspectRatio: number | null;
  naturalPixelWidth?: number | null;
}): { width: number; height: number } | null {
  if (
    maxHeight == null ||
    !Number.isFinite(maxHeight) ||
    maxHeight <= 0 ||
    availableWidth == null ||
    !Number.isFinite(availableWidth) ||
    availableWidth <= 0 ||
    naturalAspectRatio == null ||
    !Number.isFinite(naturalAspectRatio) ||
    naturalAspectRatio <= 0
  ) {
    return null;
  }
  const widthLimits = [availableWidth, maxHeight * naturalAspectRatio];
  if (naturalPixelWidth != null && naturalPixelWidth > 0) {
    widthLimits.push(naturalPixelWidth);
  }
  const width = Math.min(...widthLimits);
  return { width, height: width / naturalAspectRatio };
}
