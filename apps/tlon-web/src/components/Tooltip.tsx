import * as RadixTooltip from '@radix-ui/react-tooltip';
import cn from 'classnames';
import { PropsWithChildren, ReactNode } from 'react';

type TooltipProps = PropsWithChildren<
  {
    content: ReactNode;
    className?: string;
  } & RadixTooltip.TooltipProps &
    RadixTooltip.TooltipContentProps
>;

export default function Tooltip({
  content,
  className,
  children,
  open,
  defaultOpen,
  onOpenChange,
  delayDuration,
  ...props
}: TooltipProps) {
  return (
    <RadixTooltip.Root
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      delayDuration={delayDuration}
    >
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content asChild {...props}>
          <div
            className={cn(
              'pointer-events-none z-50 w-fit max-w-[300px] cursor-none rounded bg-gray-800 px-3 py-1 font-semibold text-white',
              className
            )}
          >
            {content}
            <RadixTooltip.Arrow asChild>
              <svg
                width="17"
                height="8"
                viewBox="0 0 17 8"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M16.5 0L0.5 0L7.08579 6.58579C7.86684 7.36684 9.13316 7.36684 9.91421 6.58579L16.5 0Z"
                  className="fill-gray-800"
                />
              </svg>
            </RadixTooltip.Arrow>
          </div>
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
