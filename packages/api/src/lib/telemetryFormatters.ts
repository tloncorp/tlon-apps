export function formattedDuration(startMs: number, endMs: number) {
  const seconds = (endMs - startMs) / 1000;
  return Number(seconds.toFixed(2));
}
