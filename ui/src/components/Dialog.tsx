import React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import classNames from 'classnames';

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
            <DialogPrimitive.Close className="default-ring absolute top-3 right-3 rounded-full bg-gray-100 p-2">
              <svg
                className="h-3.5 w-3.5 stroke-current text-gray-500"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M4 4L20 20" strokeWidth="3" strokeLinecap="round" />
                <path d="M20 4L4 20" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </DialogPrimitive.Close>
          )}
        </div>
      </section>
    </DialogPrimitive.Content>
  )
);

export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
