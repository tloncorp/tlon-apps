import React, { ReactNode } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import classNames from 'classnames';
import X16Icon from './icons/X16Icon';

interface DialogContentProps extends DialogPrimitive.DialogContentProps {
  containerClass?: string;
  showClose?: boolean;
  lightbox?: boolean;
}

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
  className,
  containerClass,
  showClose = true,
  lightbox = false,
  ...content
}: DialogProps) {
  const props = { open, modal, defaultOpen, onOpenChange };
  return (
    <DialogPrimitive.Root {...props}>
      {trigger}
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 transform-gpu bg-black opacity-30" />
        <DialogPrimitive.Content asChild {...content}>
          <section className={classNames('dialog-container', containerClass)}>
            <div className={classNames('dialog', className)}>
              {children}
              {showClose && !lightbox && (
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
          </section>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export const DialogContent = React.forwardRef<
  HTMLDivElement,
  DialogContentProps
>(
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
      <section className={classNames('dialog-container', containerClass)}>
        <div className={classNames('dialog', className)}>
          {children}
          {showClose && !lightbox && (
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
      </section>
    </DialogPrimitive.Content>
  )
);

export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;
