import { uniq } from 'lodash';
import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { isSafari } from './native';
import { useIsMobile } from './useMedia';
import { createDevLogger } from './utils';

interface DragTargetContext {
  targetIdStack: string[];
  pushTargetID: (id: string) => void;
  popTargetID: (id: string) => void;
}

export const dragLogger = createDevLogger('DragAndDrop', false);

export const DragTargetContext = createContext<DragTargetContext>({
  targetIdStack: [],
  pushTargetID: () => ({}),
  popTargetID: () => ({}),
});

interface DragAndDropContext {
  isDragging: boolean;
  isOver: boolean;
  droppedFiles?: Record<string, FileList>;
  setDroppedFiles: React.Dispatch<
    React.SetStateAction<Record<string, FileList> | undefined>
  >;
  handleDrop: (e: DragEvent, dropZone: string) => void;
}

export const DragAndDropContext = createContext<DragAndDropContext>({
  isDragging: false,
  isOver: false,
  droppedFiles: undefined,
  handleDrop: () => ({}),
  setDroppedFiles: () => ({}),
});

export function DragAndDropProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [isOver, setIsOver] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState<Record<string, FileList>>();
  const [targetIdStack, setTargetIdStack] = useState<string[]>([]);
  const safariDragCounter = useRef(0);

  const pushTargetID = useCallback((id: string) => {
    setTargetIdStack((stack) =>
      stack.includes(id) ? stack : uniq([...stack, id])
    );
  }, []);

  const popTargetID = useCallback((id: string) => {
    setTargetIdStack((stack) =>
      !stack.includes(id) ? stack : stack.filter((targetId) => targetId !== id)
    );
  }, []);

  const preventDefault = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = useCallback((e: DragEvent) => {
    preventDefault(e);

    if (document.visibilityState !== 'visible') return;

    // prevent drag enter from firing multiple times
    safariDragCounter.current += 1;
    setIsDragging(true);
    dragLogger.log('drag enter', safariDragCounter.current);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    preventDefault(e);

    // prevent drag leave from firing multiple times
    safariDragCounter.current -= 1;
    dragLogger.log('drag leave', safariDragCounter.current);

    if (isSafari()) {
      // Safari has a bug where event.relatedTarget is always null on dragleave.
      // So instead, we have attempt to use a counter to determine when the drag
      // truly leaves the window
      if (safariDragCounter.current === 0) {
        setIsDragging(false);
        setIsOver(false);
      }
    } else if (e.relatedTarget === null) {
      setIsDragging(false);
      setIsOver(false);
      safariDragCounter.current = 0;
    }
  }, []);

  // This is a backup for Safari in case the drag counter gets out of sync
  const handleSafariMouseLeave = useCallback((e: MouseEvent) => {
    if (isSafari()) {
      e.preventDefault();
      setIsDragging(false);
      setIsOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    preventDefault(e);
    if (document.visibilityState !== 'visible') return;

    setIsOver(true);
    dragLogger.log('drag over', safariDragCounter.current);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent, dropZone: string, recurseNode?: HTMLElement) => {
      preventDefault(e);

      e.stopPropagation();

      setIsDragging(false);
      setIsOver(false);
      dragLogger.log('handle drop');

      const targetElement = recurseNode || (e.target as HTMLElement);

      if (targetElement && targetElement.id !== dropZone) {
        if (targetElement.parentElement) {
          handleDrop(e, dropZone, targetElement.parentElement);
        }
      }

      if (e.dataTransfer === null || !e.dataTransfer.files.length) return;
      setDroppedFiles({
        ...droppedFiles,
        [dropZone]: e.dataTransfer.files,
      });
    },
    [droppedFiles]
  );

  useEffect(() => {
    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('mouseleave', handleSafariMouseLeave);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('mouseleave', handleSafariMouseLeave);
    };
  }, [
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleSafariMouseLeave,
  ]);

  const value = useMemo(
    () => ({ isDragging, isOver, droppedFiles, setDroppedFiles, handleDrop }),
    [isDragging, isOver, droppedFiles, handleDrop]
  );

  const targetIdValue = useMemo(
    () => ({ targetIdStack, pushTargetID, popTargetID }),
    [targetIdStack, pushTargetID, popTargetID]
  );

  return (
    <DragTargetContext.Provider value={targetIdValue}>
      <DragAndDropContext.Provider value={value}>
        {children}
      </DragAndDropContext.Provider>
    </DragTargetContext.Provider>
  );
}

export function useDragAndDrop(targetId: string) {
  const isMobile = useIsMobile();

  const { pushTargetID, popTargetID, targetIdStack } =
    React.useContext(DragTargetContext);
  const currentTargetId = targetIdStack[targetIdStack.length - 1];

  const { isDragging, isOver, droppedFiles, setDroppedFiles, handleDrop } =
    React.useContext(DragAndDropContext);

  const handleDropWithTarget = useCallback(
    (e: DragEvent) => {
      handleDrop(e, currentTargetId);
    },
    [handleDrop, currentTargetId]
  );

  useEffect(() => {
    if (isMobile) {
      return () => ({});
    }
    pushTargetID(targetId);

    window.addEventListener('drop', handleDropWithTarget);

    return () => {
      popTargetID(targetId);
      window.removeEventListener('drop', handleDropWithTarget);
    };
  }, [handleDropWithTarget, popTargetID, pushTargetID, targetId, isMobile]);

  if (isMobile)
    return {
      isDragging: false,
      isOver: false,
      droppedFiles: undefined,
      setDroppedFiles: () => ({}),
      targetId: '',
    };

  return {
    isDragging,
    isOver,
    droppedFiles,
    setDroppedFiles,
    targetId: currentTargetId,
  };
}
