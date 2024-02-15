import classNames from 'classnames';
import React, { ButtonHTMLAttributes, PropsWithChildren } from 'react';

type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'caution'
  | 'destructive'
  | 'alt-primary'
  | 'alt-secondary';

const variants: Record<ButtonVariant, string> = {
  primary: 'text-white bg-black',
  secondary: 'text-black bg-gray-100',
  caution: 'text-white bg-orange-400',
  destructive: 'text-white bg-red-500',
  'alt-primary': 'text-white bg-blue-400 ring-blue-300',
  'alt-secondary': 'text-blue-400 bg-blue-50',
};

type ButtonProps = {
  variant?: ButtonVariant;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', children, className, ...props }, ref) => (
    <button
      ref={ref}
      {...props}
      className={classNames(
        'button default-focus',
        variants[variant],
        className
      )}
    >
      {children}
    </button>
  )
);

export const PillButton = React.forwardRef<
  React.ElementType,
  React.ComponentPropsWithRef<React.ElementType>
>(({ className, children, ...props }, ref) => (
  <Button
    ref={ref}
    {...props}
    className={classNames(
      'rounded-full px-4 py-2 text-sm sm:px-6 sm:py-3 sm:text-base',
      className
    )}
  >
    {children}
  </Button>
));
