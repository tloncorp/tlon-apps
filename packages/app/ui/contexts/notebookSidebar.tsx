import React, {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export type NotebookSidebarContent = {
  actions?: ReactNode;
  channelId: string;
  content: ReactNode;
  groupId?: string | null;
  sourceId: string;
  title?: ReactNode;
};

const NotebookSidebarContentContext =
  createContext<NotebookSidebarContent | null>(null);
const NotebookSidebarSetterContext = createContext<React.Dispatch<
  React.SetStateAction<NotebookSidebarContent | null>
> | null>(null);

export function NotebookSidebarProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<NotebookSidebarContent | null>(null);

  return (
    <NotebookSidebarSetterContext.Provider value={setContent}>
      <NotebookSidebarContentContext.Provider value={content}>
        {children}
      </NotebookSidebarContentContext.Provider>
    </NotebookSidebarSetterContext.Provider>
  );
}

export function useNotebookSidebarContent() {
  return useContext(NotebookSidebarContentContext);
}

export function useRegisterNotebookSidebarContent(
  content: NotebookSidebarContent | null,
  sourceId: string
) {
  const setContent = useContext(NotebookSidebarSetterContext);

  useEffect(() => {
    if (!setContent) return;

    if (content) {
      setContent(content);
      return;
    }

    setContent((current) => (current?.sourceId === sourceId ? null : current));
  }, [content, setContent, sourceId]);

  useEffect(() => {
    if (!setContent) return;

    return () => {
      setContent((current) =>
        current?.sourceId === sourceId ? null : current
      );
    };
  }, [setContent, sourceId]);
}

export function useNotebookSidebarRegistration(
  content: Omit<NotebookSidebarContent, 'sourceId'> | null,
  sourceId: string
) {
  const registration = useMemo(
    () => (content ? { ...content, sourceId } : null),
    [content, sourceId]
  );

  useRegisterNotebookSidebarContent(registration, sourceId);
}
