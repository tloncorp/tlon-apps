// Web asset URIs are blob:/data:, which the browser's fetch resolves and
// expo-file-system's web shim cannot stat.
export async function getLocalFileSize(uri: string): Promise<number> {
  const blob = await (await fetch(uri)).blob();
  return blob.size;
}
