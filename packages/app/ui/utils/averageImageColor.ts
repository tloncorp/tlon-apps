// Only native chat bubbles are tinted by avatar color, so web never loads one.
export async function loadAverageImageColor(
  _url: string
): Promise<string | null> {
  return null;
}
