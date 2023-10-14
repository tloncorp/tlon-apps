import { useState } from 'react';
import { Drawer } from 'vaul';
import cn from 'classnames';

interface WidgetSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  children: React.ReactNode;
  showDragHandle?: boolean;
  hideOverlay?: boolean;
  className?: string;
  contentClassName?: string;
  snapPoints?: number[];
  activeSnapPoint?: number | string | null;
  setActiveSnapPoint?: (snap: number | string | null) => void;
}

export default function WidgetDrawer({
  open,
  onOpenChange,
  title,
  children,
  className,
  contentClassName,
  showDragHandle = true,
  hideOverlay = false,
  snapPoints,
  activeSnapPoint,
  setActiveSnapPoint,
}: WidgetSheetProps) {
  return (
    <Drawer.Root
      open={open}
      onOpenChange={onOpenChange}
      snapPoints={snapPoints || undefined}
      activeSnapPoint={activeSnapPoint || undefined}
      setActiveSnapPoint={setActiveSnapPoint || undefined}
    >
      <Drawer.Portal>
        {!hideOverlay && (
          <Drawer.Overlay className="fixed inset-0 z-[49] bg-black/20" />
        )}
        <Drawer.Content
          className={cn(
            'fixed bottom-0 left-0 right-0 z-50 flex flex-col overflow-y-auto rounded-t-[32px] bg-white',
            snapPoints && 'h-full max-h-[90%]',
            className
          )}
        >
          {showDragHandle && (
            <div className="absolute z-50 my-3 flex w-full items-center justify-center">
              <div className="h-1.5 w-11 rounded-full bg-gray-200" />
            </div>
          )}

          {title && (
            <div hidden={!title}>
              <h3 className="pl-3 text-lg leading-6">{title}</h3>
            </div>
          )}

          <div className={cn('flex flex-grow flex-col', contentClassName)}>
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
