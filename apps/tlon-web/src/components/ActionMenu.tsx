import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import cn from 'classnames';
import React, { PropsWithChildren, ReactNode } from 'react';
import { Drawer } from 'vaul';

import { useIsMobile } from '@/logic/useMedia';

export type ActionType =
  | 'default'
  | 'disabled'
  | 'prominent'
  | 'destructive'
  | 'icon';

export interface Action {
  key: string;
  type?: ActionType;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  content: ReactNode;
  keepOpenOnClick?: boolean;
  containerClassName?: string;
}

type ActionMenuProps = PropsWithChildren<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions: Action[];
  disabled?: boolean;
  asChild?: boolean;
  align?: 'start' | 'end' | 'center';
  ariaLabel?: string;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  testId?: string;
}>;

function classNameForType(type?: ActionType) {
  switch (type) {
    case 'disabled':
      return 'dropdown-item-disabled';
    case 'prominent':
      return 'dropdown-item-blue';
    case 'destructive':
      return 'dropdown-item-red';
    case 'icon':
      return 'dropdown-item-icon';
    default:
      return 'dropdown-item';
  }
}

const ActionMenu = React.memo(
  ({
    open,
    onOpenChange,
    actions,
    asChild = true,
    disabled,
    align,
    ariaLabel,
    testId,
    className,
    triggerClassName,
    contentClassName,
    children,
  }: ActionMenuProps) => {
    const isMobile = useIsMobile();

    return (
      <div className={className}>
        {isMobile ? (
          <Drawer.Root open={open} onOpenChange={onOpenChange}>
            {children && (
              <Drawer.Trigger
                disabled={disabled}
                asChild={asChild}
                aria-label={ariaLabel}
                className={cn('select-none appearance-none', triggerClassName)}
              >
                {children}
              </Drawer.Trigger>
            )}
            <Drawer.Portal>
              <Drawer.Overlay className="fixed inset-0 z-[49] bg-black/20" />
              <Drawer.Content
                data-testid={testId}
                className="fixed bottom-0 z-[49] flex w-full flex-col rounded-t-[32px] bg-white px-[24px] pb-8 pt-4 outline-none after:!bg-transparent"
              >
                {actions.map((action) => (
                  <button
                    data-testid={action.key}
                    key={action.key}
                    onClick={
                      action.keepOpenOnClick
                        ? action.onClick
                        : (event) => {
                            onOpenChange(false);
                            action.onClick?.(event);
                          }
                    }
                    className={cn(
                      classNameForType(action.type),
                      action.containerClassName,
                      'select-none rounded-xl px-6 py-4'
                    )}
                    disabled={action.type === 'disabled'}
                  >
                    {typeof action.content === 'string' ? (
                      <span>{action.content}</span>
                    ) : (
                      action.content
                    )}
                  </button>
                ))}
              </Drawer.Content>
            </Drawer.Portal>
          </Drawer.Root>
        ) : (
          <DropdownMenu.Root open={open} onOpenChange={onOpenChange}>
            {children && (
              <DropdownMenu.Trigger
                disabled={disabled}
                asChild={asChild}
                aria-label={ariaLabel}
                className={cn('appearance-none', triggerClassName)}
              >
                {children}
              </DropdownMenu.Trigger>
            )}
            <DropdownMenu.Content
              align={align}
              className={cn('dropdown', contentClassName)}
              collisionPadding={8}
            >
              {actions.map((action) => (
                <DropdownMenu.Item
                  asChild
                  key={action.key}
                  disabled={action.type === 'disabled'}
                  onSelect={(event: Event) =>
                    action.onClick?.(
                      event as unknown as React.MouseEvent<
                        HTMLButtonElement,
                        MouseEvent
                      >
                    )
                  }
                  className={cn(
                    classNameForType(action.type),
                    action.containerClassName
                  )}
                >
                  {typeof action.content === 'string' ? (
                    <span>{action.content}</span>
                  ) : (
                    action.content
                  )}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        )}
      </div>
    );
  }
);

export default ActionMenu;
