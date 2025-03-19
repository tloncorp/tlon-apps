export function parseForTwitterPostId(text: string): string | null {
  // If input is already just a numeric ID
  if (/^\d+$/.test(text)) {
    return text;
  }

  // Handle both twitter.com and x.com URLs with various prefixes
  const regex =
    /(?:https?:\/\/)?(?:www\.|mobile\.)?(?:twitter\.com|x\.com)\/[^/]+\/status\/(\d+)/i;
  const match = text.match(regex);

  if (match) {
    return match[1];
  }

  return null;
}
