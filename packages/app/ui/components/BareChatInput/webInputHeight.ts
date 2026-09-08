/** Measure without temporarily collapsing the live composer and list extent. */
export function measureWebInputHeight(
  input: HTMLTextAreaElement,
  frame: HTMLElement,
  minimumHeight: number
): number | null {
  if (
    !input.isConnected ||
    !frame.isConnected ||
    !frame.contains(input) ||
    !Number.isFinite(minimumHeight) ||
    minimumHeight < 0
  )
    return null;
  const view = frame.ownerDocument.defaultView;
  if (!view) return null;
  // Computed height and min-height use the same box-sizing coordinate. Unlike
  // a bounding rect, this excludes ancestor transforms and does not round the
  // frame's fractional padding/border contribution to an integer.
  const frameHeight = Number.parseFloat(view.getComputedStyle(frame).height);
  if (!Number.isFinite(frameHeight) || frameHeight < 0) return null;
  const inputStyle = view.getComputedStyle(input);
  const contentBox = inputStyle.boxSizing !== 'border-box';
  const padding =
    (Number.parseFloat(inputStyle.paddingTop) || 0) +
    (Number.parseFloat(inputStyle.paddingBottom) || 0);
  const oldMin = frame.style.getPropertyValue('min-height');
  const oldMinPriority = frame.style.getPropertyPriority('min-height');
  const oldHeight = input.style.getPropertyValue('height');
  const oldHeightPriority = input.style.getPropertyPriority('height');
  let committed = false;
  try {
    frame.style.setProperty('min-height', `${frameHeight}px`, 'important');
    input.style.setProperty('height', '0px', oldHeightPriority);
    const naturalHeight = contentBox
      ? input.scrollHeight - padding
      : input.offsetHeight - input.clientHeight + input.scrollHeight;
    if (!Number.isFinite(naturalHeight)) return null;
    const height = Math.max(minimumHeight, naturalHeight);
    input.style.setProperty('height', `${height}px`, oldHeightPriority);
    committed = true;
    return height;
  } finally {
    if (!committed) {
      if (oldHeight)
        input.style.setProperty('height', oldHeight, oldHeightPriority);
      else input.style.removeProperty('height');
    }
    if (oldMin) frame.style.setProperty('min-height', oldMin, oldMinPriority);
    else frame.style.removeProperty('min-height');
  }
}

/** A cancelled or replaced draft must not resize a later mounted input. */
export function scheduleWebInputHeight(
  input: HTMLTextAreaElement,
  frame: HTMLElement,
  minimumHeight: number,
  isCurrent: () => boolean,
  onMeasured: (height: number) => void
): () => void {
  const view = input.ownerDocument.defaultView;
  if (!view) return () => {};
  let active = true;
  const id = view.requestAnimationFrame(() => {
    if (!active) return;
    active = false;
    if (!isCurrent()) return;
    const height = measureWebInputHeight(input, frame, minimumHeight);
    if (height !== null) onMeasured(height);
  });
  return () => {
    active = false;
    view.cancelAnimationFrame(id);
  };
}
