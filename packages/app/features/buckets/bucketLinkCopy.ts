import * as Clipboard from 'expo-clipboard';
import { Platform } from 'react-native';

/**
 * Copies text that is still being fetched.
 *
 * Browsers only let a page write the clipboard during a user gesture, and
 * Safari treats the gesture as over once a network round trip has started.
 * On web the write therefore starts synchronously, with the text as a promised
 * value; native clipboards have no such rule.
 */
export async function copyPendingText(text: Promise<string>): Promise<void> {
  if (
    Platform.OS === 'web' &&
    typeof ClipboardItem !== 'undefined' &&
    navigator.clipboard?.write
  ) {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/plain': text.then(
          (value) => new Blob([value], { type: 'text/plain' })
        ),
      }),
    ]);
    return;
  }
  // Resolves false rather than throwing when the browser refuses.
  if (!(await Clipboard.setStringAsync(await text))) {
    throw new Error('Could not copy the link');
  }
}

/**
 * What to tell someone who just copied a Bucket file's link. The link is a
 * signed read grant, so it stops working after a few minutes; say how many.
 */
export function bucketLinkCopiedMessage(
  expiresAt: string,
  now = Date.now()
): string {
  // The broker sends more fractional digits than every engine's Date.parse
  // accepts; milliseconds are plenty.
  const expiry = Date.parse(expiresAt.replace(/(\.\d{3})\d+/, '$1'));
  if (Number.isNaN(expiry)) {
    return 'Link copied. It expires in a few minutes.';
  }
  const minutes = Math.max(1, Math.round((expiry - now) / 60_000));
  return `Link copied. It expires in ${minutes} ${
    minutes === 1 ? 'minute' : 'minutes'
  }.`;
}
