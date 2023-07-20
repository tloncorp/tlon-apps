import React, {
  createContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';

interface DragAndDropContext {
  isDragging: boolean;
  isOver: boolean;
  droppedFiles?: FileList;
}

export const DragAndDropContext = createContext<DragAndDropContext>({
  isDragging: false,
  isOver: false,
  droppedFiles: undefined,
});

export function DragAndDropProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [isOver, setIsOver] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState<FileList>();

  // Prevent the default behavior of the browser when a file is dropped
  const preventDefault = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = useCallback((e: DragEvent) => {
    console.log('drag enter');
    preventDefault(e);
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    console.log('drag leave');
    preventDefault(e);
    setIsDragging(false);
    setIsOver(false);
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    console.log('drag over');
    preventDefault(e);
    setIsOver(true);
    // e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    console.log('drop');
    preventDefault(e);
    setIsDragging(false);
    setIsOver(false);
    // You can access uploaded files with e.dataTransfer.files;
    if (e.dataTransfer === null || !e.dataTransfer.files.length) return;
    setDroppedFiles(e.dataTransfer.files);
  }, []);

  // Add event listeners when the component mounts
  useEffect(() => {
    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);

    return () => {
      // Remove event listeners when the component unmounts
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, [handleDragEnter, handleDragLeave, handleDragOver, handleDrop]);

  const value = useMemo(
    () => ({ isDragging, isOver, droppedFiles }),
    [isDragging, isOver, droppedFiles]
  );

  return (
    <DragAndDropContext.Provider value={value}>
      {children}
    </DragAndDropContext.Provider>
  );
}

export function useDragAndDrop() {
  return React.useContext(DragAndDropContext);
}
