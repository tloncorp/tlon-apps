import * as DialogPrimitive from '@radix-ui/react-dialog';
import classNames from 'classnames';
import React from 'react';

import X16Icon from './icons/X16Icon';

export default function Sheet({
  children,
  ...props
}: DialogPrimitive.DialogProps) {
  return (
    <DialogPrimitive.Root {...props}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 transform-gpu bg-black opacity-30" />
        {children}
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

interface SheetContentProps extends DialogPrimitive.DialogContentProps {
  containerClass?: string;
  showClose?: boolean;
  lightbox?: boolean;
}

export const SheetContent = React.forwardRef<HTMLDivElement, SheetContentProps>(
  (
    {
      showClose = true,
      lightbox = false,
      containerClass,
      children,
      className,
      ...props
    },
    forwardedRef
  ) => (
    <DialogPrimitive.Content asChild {...props} ref={forwardedRef}>
      <section className={classNames('sheet-container', containerClass)}>
        <div className={classNames('sheet', className)}>
          {children}
          {showClose && !lightbox && (
            <DialogPrimitive.Close className="icon-button absolute right-6 top-6">
              <X16Icon className="h-4 w-4" />
            </DialogPrimitive.Close>
          )}
        </div>
        {showClose && lightbox && (
          <DialogPrimitive.Close className="icon-button absolute right-6 top-6 bg-white">
            <X16Icon className="h-4 w-4" />
          </DialogPrimitive.Close>
        )}
      </section>
    </DialogPrimitive.Content>
  )
);

export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;
export const SheetTitle = DialogPrimitive.Title;
export const SheetDescription = DialogPrimitive.Description;
