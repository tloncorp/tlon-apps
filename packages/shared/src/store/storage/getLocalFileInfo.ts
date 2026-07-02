// Web asset URIs are blob:/data:, which the browser's fetch resolves and
// expo-file-system's web shim cannot stat.
export async function getLocalFileInfo(
  uri: string
): Promise<{ size: number; mimeType?: string }> {
  const blob = await (await fetch(uri)).blob();
  return { size: blob.size, mimeType: blob.type || undefined };
}
