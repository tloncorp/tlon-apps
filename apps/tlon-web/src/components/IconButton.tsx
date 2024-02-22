import * as Tooltip from '@radix-ui/react-tooltip';
import cn from 'classnames';
import React, { MouseEventHandler } from 'react';

interface IconButtonProps {
  icon: React.ReactElement;
  action?: MouseEventHandler<HTMLButtonElement>;
  label: string;
  showTooltip?: boolean;
  className?: string;
  small?: boolean;
  disabled?: boolean;
}

export default function IconButton({
  icon,
  action,
  label,
  showTooltip,
  className = '',
  small = false,
  disabled = false,
}: IconButtonProps) {
  return (
    <div className={cn('group-two cursor-pointer', className)}>
      <Tooltip.Root delayDuration={800} disableHoverableContent>
        {showTooltip ? (
          <Tooltip.Portal>
            <Tooltip.Content asChild sideOffset={5} hideWhenDetached>
              <div className="pointer-events-none z-20 justify-items-center rounded">
                <div className="z-[100] w-fit cursor-none rounded bg-gray-400 px-4 py-2">
                  <label className="whitespace-nowrap font-semibold text-white">
                    {label}
                  </label>
                </div>
                <Tooltip.Arrow asChild>
                  <svg
                    width="17"
                    height="8"
                    viewBox="0 0 17 8"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M16.5 0L0.5 0L7.08579 6.58579C7.86684 7.36684 9.13316 7.36684 9.91421 6.58579L16.5 0Z"
                      // fill="#999999"
                      className="fill-gray-400"
                    />
                  </svg>
                </Tooltip.Arrow>
              </div>
            </Tooltip.Content>
          </Tooltip.Portal>
        ) : null}
        <Tooltip.Trigger asChild>
          <button
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded',
              !disabled && 'group-two-hover:bg-gray-50',
              {
                'h-8 w-8': !small,
                'h-6 w-6': small,
              }
            )}
            onClick={action}
            aria-label={label}
            disabled={disabled}
          >
            {icon}
          </button>
        </Tooltip.Trigger>
      </Tooltip.Root>
    </div>
  );
}
