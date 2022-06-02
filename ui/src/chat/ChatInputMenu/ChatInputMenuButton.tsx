import classNames from 'classnames';
import React, { PropsWithChildren, useEffect, useRef } from 'react';

type ChatInputMenuButtonProps = PropsWithChildren<{
  isActive?: boolean;
  isSelected?: boolean;
  textButton?: boolean;
  unpressedLabel: string;
  pressedLabel: string;
  onClick: () => void;
}>;

export default function ChatInputMenuButton({
  isActive = false,
  isSelected = false,
  textButton = false,
  unpressedLabel,
  pressedLabel,
  onClick,
  children,
}: ChatInputMenuButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isSelected) {
      ref.current?.focus();
    }
  }, [isSelected]);

  return (
    <button
      ref={ref}
      className={classNames(
        'icon-toggle default-focus',
        isActive && 'icon-toggle-active',
        textButton && 'w-auto'
      )}
      onClick={onClick}
      tabIndex={-1}
      aria-label={isActive ? pressedLabel : unpressedLabel}
    >
      {children}
    </button>
  );
}
