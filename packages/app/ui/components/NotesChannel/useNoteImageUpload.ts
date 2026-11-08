import {
  AnalyticsEvent,
  Attachment,
  trackEvent,
  useMutableCallback,
} from '@tloncorp/shared';
import * as store from '@tloncorp/shared/store';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { isWeb } from 'tamagui';

import { normalizeUploadIntents } from '../../../utils/filepicker';
import {
  type NoteBodySelection,
  insertNoteBodyBlocks,
  noteImageMarkdown,
} from './noteImageMarkdown';

export type NoteImageSource = 'paste' | 'drop' | 'picker';

const UPLOAD_FAILED_MESSAGE = 'Couldn’t upload the image. Try again.';
const UNREADABLE_IMAGE_MESSAGE = 'Couldn’t read that image. Try a JPEG or PNG.';

/**
 * Uploads images and inserts their markdown at the caret once they land.
 * Nothing goes into the body while they upload, so leaving the note mid-upload
 * can't save a stand-in into it: the finished upload is dropped instead.
 */
export function useNoteImageUpload({
  noteKey,
  getBody,
  getSelection,
  applyBody,
  onError,
}: {
  noteKey: string | null;
  getBody: () => string;
  getSelection: () => NoteBodySelection;
  applyBody: (body: string, caret: number) => void;
  onError: (message: string) => void;
}) {
  const [pendingBatches, setPendingBatches] = useState(0);
  const noteKeyRef = useRef(noteKey);
  useLayoutEffect(() => {
    noteKeyRef.current = noteKey;
  }, [noteKey]);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const insertImages = useMutableCallback(
    async (
      intents: Attachment.UploadIntent[],
      source: NoteImageSource,
      // The note the images were added to, for callers that awaited a picker
      // before getting here; otherwise the note open now.
      noteKey: string | null = noteKeyRef.current
    ) => {
      const targetNoteKey = noteKey;
      const { uploadIntents } = await normalizeUploadIntents(intents);
      // Normalization leaves an image the platform can't decode (HEIC in most
      // browsers) as a plain file.
      const images = uploadIntents.filter((intent) => intent.type === 'image');
      if (images.length < intents.length) {
        onError(UNREADABLE_IMAGE_MESSAGE);
      }
      if (images.length === 0) {
        return;
      }
      const startedAt = Date.now();
      setPendingBatches((count) => count + 1);
      const results = await Promise.allSettled(
        images.map((intent) => store.uploadAssetForUrl(intent, isWeb))
      );
      const urls = results.flatMap((result) =>
        result.status === 'fulfilled' ? [result.value] : []
      );
      const failure = results.find(
        (result): result is PromiseRejectedResult =>
          result.status === 'rejected'
      );
      const noteStillOpen =
        mountedRef.current && noteKeyRef.current === targetNoteKey;
      const telemetry = { source, durationMs: Date.now() - startedAt };
      if (failure) {
        // The upload itself reports its error; this records the outcome.
        trackEvent(AnalyticsEvent.NoteImageInsertFailed, {
          ...telemetry,
          reason: 'upload',
          failedCount: images.length - urls.length,
          errorMessage:
            failure.reason instanceof Error
              ? failure.reason.message
              : String(failure.reason),
        });
      }
      if (!mountedRef.current) {
        return;
      }
      setPendingBatches((count) => count - 1);
      if (!noteStillOpen) {
        if (urls.length > 0) {
          trackEvent(AnalyticsEvent.NoteImageInsertFailed, {
            ...telemetry,
            reason: 'note closed',
            failedCount: urls.length,
          });
        }
        return;
      }
      if (failure) {
        onError(UPLOAD_FAILED_MESSAGE);
      }
      if (urls.length === 0) {
        return;
      }
      const inserted = insertNoteBodyBlocks(
        getBody(),
        getSelection(),
        urls.map(noteImageMarkdown)
      );
      applyBody(inserted.body, inserted.caret);
      trackEvent(AnalyticsEvent.NoteImageInserted, {
        ...telemetry,
        count: urls.length,
      });
    }
  );

  return { insertImages, isUploading: pendingBatches > 0 };
}

/**
 * Web only: routes images pasted into, or dropped onto, the body input to
 * `onImages`. Text and other files keep their default handling, so markdown
 * dropped on the editor still reaches the notebook's import drop target.
 */
export function useNoteImagePasteAndDrop(
  getInputElement: () => HTMLElement | null,
  enabled: boolean,
  onImages: (
    intents: Attachment.UploadIntent[],
    source: NoteImageSource
  ) => void
) {
  const handleImages = useMutableCallback(onImages);
  useEffect(() => {
    const element = enabled && isWeb ? getInputElement() : null;
    if (!element) {
      return;
    }

    const insertFiles = (files: File[], source: NoteImageSource) => {
      handleImages(
        files.map((file) => Attachment.UploadIntent.fromFile(file)),
        source
      );
    };

    const handlePaste = (event: ClipboardEvent) => {
      // Office apps put a picture of the copied text beside the text itself;
      // the text is what was meant.
      if (event.clipboardData?.types.includes('text/plain')) return;
      const files = imageFiles(event.clipboardData);
      if (files.length === 0) return;
      event.preventDefault();
      insertFiles(files, 'paste');
    };

    // Claims the drag only while it carries an image, and keeps it from
    // reaching the notebook's import target, whose overlay would otherwise
    // light up and whose drop would report that no markdown was found.
    const claimImageDrag = (event: DragEvent) => {
      if (!hasImageItem(event.dataTransfer)) return false;
      event.preventDefault();
      event.stopPropagation();
      return true;
    };
    const handleDragOver = (event: DragEvent) => {
      if (claimImageDrag(event) && event.dataTransfer) {
        event.dataTransfer.dropEffect = 'copy';
      }
    };
    const handleDrop = (event: DragEvent) => {
      if (!claimImageDrag(event)) return;
      insertFiles(imageFiles(event.dataTransfer), 'drop');
    };

    element.addEventListener('paste', handlePaste);
    element.addEventListener('dragenter', claimImageDrag);
    element.addEventListener('dragover', handleDragOver);
    element.addEventListener('dragleave', claimImageDrag);
    element.addEventListener('drop', handleDrop);
    return () => {
      element.removeEventListener('paste', handlePaste);
      element.removeEventListener('dragenter', claimImageDrag);
      element.removeEventListener('dragover', handleDragOver);
      element.removeEventListener('dragleave', claimImageDrag);
      element.removeEventListener('drop', handleDrop);
    };
  }, [enabled, getInputElement, handleImages]);
}

function hasImageItem(data: DataTransfer | null) {
  return Array.from(data?.items ?? []).some(
    (item) => item.kind === 'file' && item.type.startsWith('image/')
  );
}

function imageFiles(data: DataTransfer | null) {
  return Array.from(data?.files ?? []).filter((file) =>
    file.type.startsWith('image/')
  );
}
