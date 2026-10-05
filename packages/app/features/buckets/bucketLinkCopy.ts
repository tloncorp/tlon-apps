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
  if (Platform.OS !== 'web') {
    await Clipboard.setStringAsync(await text);
    return;
  }
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    const blob = text.then(
      (value) => new Blob([value], { type: 'text/plain' })
    );
    // write() can refuse before it reads the blob, which would leave a failed
    // fetch unhandled; that failure is reported through `text` below.
    blob.catch(() => {});
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ 'text/plain': blob }),
      ]);
      return;
    } catch {
      // A failed fetch surfaces from write() as a clipboard error, so report
      // the fetch's own. Otherwise the browser refused the write itself (a
      // blocked permission, an unfocused page), and the copy below may still
      // be allowed.
      await text;
    }
  }
  // Pages served over plain http have no async clipboard at all.
  if (!copyWithExecCommand(await text)) {
    throw new Error('Your browser did not allow copying the link');
  }
}

/**
 * expo-clipboard's own fallback reports success whatever execCommand returns,
 * which here would turn a refused copy into a "Link copied" toast.
 */
function copyWithExecCommand(text: string): boolean {
  const field = document.createElement('textarea');
  field.value = text;
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.appendChild(field);
  field.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(field);
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
  // The grant was minted a moment ago, so anything under a minute means the
  // device clock disagrees with the broker's, not that the link is spent.
  const minutes = Math.max(1, Math.round((expiry - now) / 60_000));
  return `Link copied. It expires in ${minutes} ${
    minutes === 1 ? 'minute' : 'minutes'
  }.`;
}
