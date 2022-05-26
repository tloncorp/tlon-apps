import React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import classNames from 'classnames';
import XIcon from './icons/XIcon';

export default function Dialog({
  children,
  ...props
}: DialogPrimitive.DialogProps) {
  return (
    <DialogPrimitive.Root {...props}>
      <DialogPrimitive.Overlay className="fixed inset-0 z-30 transform-gpu bg-black opacity-30" />
      {children}
    </DialogPrimitive.Root>
  );
}

interface DialogContentProps extends DialogPrimitive.DialogContentProps {
  containerClass?: string;
  showClose?: boolean;
}

export const DialogContent = React.forwardRef<
  HTMLDivElement,
  DialogContentProps
>(
  (
    { showClose = true, containerClass, children, className, ...props },
    forwardedRef
  ) => (
    <DialogPrimitive.Content asChild {...props} ref={forwardedRef}>
      <section className={classNames('dialog-container', containerClass)}>
        <div className={classNames('dialog', className)}>
          {children}
          {showClose && (
            <DialogPrimitive.Close className="default-ring absolute top-6 right-6 rounded-full bg-gray-100 p-1">
              <XIcon className="h-4 w-4" />
            </DialogPrimitive.Close>
          )}
        </div>
      </section>
    </DialogPrimitive.Content>
  )
);

export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
