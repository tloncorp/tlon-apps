import { ReactNode, useState } from 'react';
import { Popover } from 'tamagui';

import useIsWindowNarrow from '../hooks/useIsWindowNarrow';
import { ActionSheet } from './ActionSheet';

interface ResponsiveSheetProps {
  trigger: ReactNode;
  children: ReactNode;
  title?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ResponsiveSheet({
  trigger,
  children,
  title,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: ResponsiveSheetProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isWindowNarrow = useIsWindowNarrow();

  const open = controlledOpen ?? internalOpen;
  const onOpenChange = controlledOnOpenChange ?? setInternalOpen;

  if (isWindowNarrow) {
    return (
      <>
        {!open && trigger}
        <ActionSheet open={open} onOpenChange={onOpenChange}>
          {title && <ActionSheet.SimpleHeader title={title} />}
          <ActionSheet.ScrollableContent>
            <ActionSheet.ContentBlock>{children}</ActionSheet.ContentBlock>
          </ActionSheet.ScrollableContent>
        </ActionSheet>
      </>
    );
  }

  return (
    <Popover
      open={open}
      onOpenChange={onOpenChange}
      allowFlip
      placement="bottom-end"
    >
      <Popover.Trigger>{trigger}</Popover.Trigger>
      <Popover.Content padding={1} borderColor="$border" borderWidth={1}>
        {children}
      </Popover.Content>
    </Popover>
  );
}
