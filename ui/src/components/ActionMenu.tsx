import React, { PropsWithChildren, ReactNode } from 'react';
import { Drawer } from 'vaul';
import cn from 'classnames';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
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
  onClick?: React.MouseEventHandler<HTMLDivElement>;
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
                className={cn('appearance-none', triggerClassName)}
              >
                {children}
              </Drawer.Trigger>
            )}
            <Drawer.Portal>
              <Drawer.Overlay className="fixed inset-0 z-[49] bg-black/20" />
              <Drawer.Content className="fixed inset-x-[32px] bottom-[32px] z-[49] flex flex-col rounded-[32px] bg-white px-[32px] py-[16px] after:!bg-transparent">
                {actions.map((action) => (
                  <div
                    key={action.key}
                    onClick={
                      action.keepOpenOnClick
                        ? action.onClick
                        : (event) => {
                            onOpenChange(false);
                            action.onClick?.(event);
                          }
                    }
                    className={cn(classNameForType(action.type), 'py-[16px]')}
                  >
                    {typeof action.content === 'string' ? (
                      <span>{action.content}</span>
                    ) : (
                      action.content
                    )}
                  </div>
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
            >
              {actions.map((action) => (
                <DropdownMenu.Item
                  asChild
                  key={action.key}
                  disabled={action.type === 'disabled'}
                  onClick={action.onClick}
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
