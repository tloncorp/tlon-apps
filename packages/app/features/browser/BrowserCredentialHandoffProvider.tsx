import {
  type PropsWithChildren,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  BrowserCredentialHandoffContext,
  type Handoff,
} from './BrowserCredentialHandoffContext';
import { BrowserCredentialHandoffSheet } from './BrowserCredentialHandoffSheet';
import type { BrowserCredentialHandoffParams } from '../../navigation/types';

import { BrowserViewerModal } from './BrowserViewerModal';
import { authorizeBrowserViewer } from './browserCredentialHandoff';

export function BrowserCredentialHandoffProvider({
  children,
}: PropsWithChildren) {
  const [form, setForm] = useState<
    BrowserCredentialHandoffParams & { open: boolean }
  >();
  const [viewer, setViewer] = useState<{ url: string; sourceUrl: string }>();
  const openViewer = useCallback(async (url: string) => {
    setViewer({ url: await authorizeBrowserViewer(url), sourceUrl: url });
  }, []);
  const handoffs = useRef(new Map<string, Handoff>());
  const sequence = useRef(0);

  const register = useCallback((handoff: Handoff) => {
    const id = `browser-handoff-${Date.now()}-${++sequence.current}`;
    handoffs.current.set(id, { ...handoff });
    return id;
  }, []);

  const resolve = useCallback(
    (id: string) => handoffs.current.get(id)?.viewerUrl,
    []
  );

  const discard = useCallback((id: string) => {
    handoffs.current.delete(id);
  }, []);

  const openForm = useCallback(
    (
      url: string,
      loginApproval?: BrowserCredentialHandoffParams['loginApproval']
    ) => {
      setForm({
        handoffId: register({ viewerUrl: url }),
        loginApproval,
        open: true,
      });
    },
    [register]
  );
  const closeForm = useCallback(() => {
    setForm((current) => (current ? { ...current, open: false } : current));
  }, []);

  const value = useMemo(
    () => ({
      register,
      resolve,
      discard,
      openViewer,
      openForm,
      viewerOpen: Boolean(viewer),
    }),
    [discard, register, resolve, openViewer, openForm, viewer]
  );

  return (
    <BrowserCredentialHandoffContext.Provider value={value}>
      {children}
      {form ? (
        <BrowserCredentialHandoffSheet
          key={form.handoffId}
          {...form}
          onClose={closeForm}
          onDismiss={() =>
            setForm((current) =>
              current?.handoffId === form.handoffId ? undefined : current
            )
          }
        />
      ) : null}
      {viewer ? (
        <BrowserViewerModal
          viewerUrl={viewer.url}
          sourceViewerUrl={viewer.sourceUrl}
          onClose={() => setViewer(undefined)}
        />
      ) : null}
    </BrowserCredentialHandoffContext.Provider>
  );
}
