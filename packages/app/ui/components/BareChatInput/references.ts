import { toContentReference } from '@tloncorp/api';
import { REF_REGEX } from '@tloncorp/api/client/utils';
import { pathToCite } from '@tloncorp/api/urbit';
import { Attachment } from '@tloncorp/shared';

export interface ReferenceTextChange {
  /** The text with every parsed reference path removed. */
  text: string;
  /** True when the text contained at least one reference path. */
  hadReferences: boolean;
}

export type ReferenceExtractor = (
  newText: string,
  addAttachment: (attachment: Attachment) => void
) => ReferenceTextChange | null;

/**
 * Builds the reference handler for one text input.
 *
 * The handler turns the reference paths in the input's new text into reference
 * attachments and returns the remaining text. It returns null when the input
 * echoes back the text the handler itself produced: native inputs re-fire
 * `onChangeText` for the writes that follow extraction, and handling those
 * again would loop. Only a path the handler could not parse stays in the text,
 * so only that case can echo.
 */
export function createReferenceExtractor(): ReferenceExtractor {
  let lastExtractedText: string | null = null;

  return (newText, addAttachment) => {
    const references = newText.match(REF_REGEX);
    if (!references) {
      return { text: newText, hadReferences: false };
    }

    if (lastExtractedText === newText) {
      return null;
    }

    let text = newText;
    references.forEach((ref) => {
      const cite = pathToCite(ref);
      if (!cite) {
        return;
      }
      const reference = toContentReference(cite);
      if (!reference) {
        return;
      }

      addAttachment({
        type: 'reference',
        reference,
        path: ref,
      });

      text = text.replace(ref, '');
    });

    lastExtractedText = text;
    return { text, hadReferences: true };
  };
}
