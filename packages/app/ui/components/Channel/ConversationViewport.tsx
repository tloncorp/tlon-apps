import { PropsWithChildren } from 'react';

export function ConversationViewport({
  children,
}: PropsWithChildren<{ anchorToEnd: boolean; newestRowKey: string | null }>) {
  return <>{children}</>;
}
