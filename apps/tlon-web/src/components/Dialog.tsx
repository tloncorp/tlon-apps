import * as DialogPrimitive from '@radix-ui/react-dialog';
import classNames from 'classnames';
import React, { ReactNode } from 'react';

import X16Icon from './icons/X16Icon';
import XIcon from './icons/XIcon';

type DialogCloseLocation = 'default' | 'none' | 'lightbox' | 'app' | 'header';

interface DialogContentProps extends DialogPrimitive.DialogContentProps {
  containerClass?: string;
  close?: DialogCloseLocation;
}

export const DialogContent = React.forwardRef<
  HTMLDivElement,
  DialogContentProps
>(
  (
    { close = 'default', containerClass, children, className, ...props },
    forwardedRef
  ) => (
    <DialogPrimitive.Content asChild {...props} ref={forwardedRef}>
      <section className={classNames('dialog-container', containerClass)}>
        <div className={classNames('dialog', className)}>
          {children}
          {close === 'default' && (
            <DialogPrimitive.Close className="icon-button absolute right-6 top-6">
              <X16Icon className="h-4 w-4" />
            </DialogPrimitive.Close>
          )}
        </div>
        {close === 'lightbox' && (
          <DialogPrimitive.Close className="icon-button absolute right-6 top-6 bg-white">
            <X16Icon className="h-4 w-4" />
          </DialogPrimitive.Close>
        )}
        {close === 'app' && (
          <DialogPrimitive.Close className="icon-button absolute right-6 top-8 h-8 w-8 bg-white p-1">
            <XIcon className="h-5 w-5" />
          </DialogPrimitive.Close>
        )}
        {close === 'header' && (
          <DialogPrimitive.Close className="icon-button absolute right-8 top-8 bg-white">
            <X16Icon className="h-4 w-4" />
          </DialogPrimitive.Close>
        )}
      </section>
    </DialogPrimitive.Content>
  )
);

export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;

type DialogProps = DialogPrimitive.DialogProps &
  DialogContentProps & {
    trigger?: ReactNode;
  };

export default function Dialog({
  children,
  open,
  modal,
  defaultOpen,
  onOpenChange,
  trigger,
  ...content
}: DialogProps) {
  const props = { open, modal, defaultOpen, onOpenChange };
  return (
    <DialogPrimitive.Root {...props}>
      {trigger}
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 transform-gpu bg-black opacity-30" />
        <DialogContent {...content}>{children}</DialogContent>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
