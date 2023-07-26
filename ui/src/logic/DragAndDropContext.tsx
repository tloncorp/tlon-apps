import React, {
  createContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { uniq } from 'lodash';

interface DragTargetContext {
  targetIdStack: string[];
  pushTargetID: (id: string) => void;
  popTargetID: (id: string) => void;
}

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
  const dragCounter = useRef(0);

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

    // prevent drag enter from firing multiple times
    dragCounter.current += 1;
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    preventDefault(e);

    // prevent drag leave from firing multiple times
    dragCounter.current -= 1;

    if (dragCounter.current === 0) {
      setIsDragging(false);
      setIsOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    preventDefault(e);
    setIsOver(true);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent, dropZone: string) => {
      preventDefault(e);

      e.stopPropagation();

      setIsDragging(false);
      setIsOver(false);

      const targetElement = e.target as HTMLElement;

      if (targetElement && targetElement.id !== dropZone) return;

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

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
    };
  }, [handleDragEnter, handleDragLeave, handleDragOver, handleDrop]);

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
  const { pushTargetID, popTargetID, targetIdStack } =
    React.useContext(DragTargetContext);
  const currentTargetId = targetIdStack[targetIdStack.length - 1];

  const { isDragging, isOver, droppedFiles, setDroppedFiles, handleDrop } =
    React.useContext(DragAndDropContext);

  const handleDropWithTarget = useCallback(
    (e: DragEvent) => {
      const targetElement = e.target as HTMLElement;

      if (targetElement && targetElement.id !== targetId) return;

      handleDrop(e, targetId);
    },
    [handleDrop, targetId]
  );

  useEffect(() => {
    pushTargetID(targetId);

    window.addEventListener('drop', handleDropWithTarget);

    return () => {
      popTargetID(targetId);
      window.removeEventListener('drop', handleDropWithTarget);
    };
  }, [handleDropWithTarget, popTargetID, pushTargetID, targetId]);

  return {
    isDragging,
    isOver,
    droppedFiles,
    setDroppedFiles,
    targetId: currentTargetId,
  };
}
