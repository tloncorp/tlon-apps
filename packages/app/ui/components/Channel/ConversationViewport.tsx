import { PropsWithChildren } from 'react';

export function ConversationViewport({
  children,
}: PropsWithChildren<{ anchorToEnd: boolean }>) {
  return <>{children}</>;
}
