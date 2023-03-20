import React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import classNames from 'classnames';
import X16Icon from './icons/X16Icon';
import XIcon from './icons/XIcon';

export default function Dialog({
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

interface DialogContentProps extends DialogPrimitive.DialogContentProps {
  containerClass?: string;
  showClose?: boolean;
  lightbox?: boolean;
  appModal?: boolean;
}

export const DialogContent = React.forwardRef<
  HTMLDivElement,
  DialogContentProps
>(
  (
    {
      showClose = true,
      lightbox = false,
      appModal = false,
      containerClass,
      children,
      className,
      ...props
    },
    forwardedRef
  ) => (
    <DialogPrimitive.Content asChild {...props} ref={forwardedRef}>
      <section className={classNames('dialog-container', containerClass)}>
        <div className={classNames('dialog', className)}>
          {children}
          {showClose && !lightbox && !appModal && (
            <DialogPrimitive.Close className="icon-button absolute top-6 right-6">
              <X16Icon className="h-4 w-4" />
            </DialogPrimitive.Close>
          )}
        </div>
        {showClose && lightbox && (
          <DialogPrimitive.Close className="icon-button absolute top-6 right-6 bg-white">
            <X16Icon className="h-4 w-4" />
          </DialogPrimitive.Close>
        )}
        {showClose && appModal && (
          <DialogPrimitive.Close className="icon-button absolute top-8 right-6 h-8 w-8 bg-white p-1">
            <XIcon className="h-5 w-5" />
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
