import classNames from 'classnames';
import React, { ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'secondary';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variantMap: Record<ButtonVariant, string> = {
  primary: 'text-white bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400',
  secondary: '',
};

export default function Button({
  variant = 'primary',
  children,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={classNames('button', variantMap[variant], className)}
      {...props}
    >
      {children}
    </button>
  );
}
