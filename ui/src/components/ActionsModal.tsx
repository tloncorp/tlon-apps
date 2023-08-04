import React, { PropsWithChildren, ReactNode } from 'react';
import cn from 'classnames';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useIsMobile } from '@/logic/useMedia';
import Drawer from '@/components/Drawer';

export type ActionType =
  | 'default'
  | 'disabled'
  | 'prominent'
  | 'destructive'
  | 'icon';

export interface Action {
  key: string;
  type: ActionType;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  content: ReactNode;
}

type ActionsModalProps = PropsWithChildren<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions: Action[];
  className?: string;
}>;

function classNameForType(type: ActionType) {
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

const ActionsModal = React.memo(
  ({ open, onOpenChange, actions, className, children }: ActionsModalProps) => {
    const isMobile = useIsMobile();

    return (
      <div className={className}>
        {isMobile ? (
          <Drawer.Root open={open} onOpenChange={onOpenChange}>
            <Drawer.Trigger asChild className="appearance-none">
              {children}
            </Drawer.Trigger>
            <Drawer.Portal>
              <Drawer.Overlay className="fixed inset-0 z-[9999] bg-black/20" />
              <Drawer.Content className="fixed inset-x-[32px] bottom-[32px] z-[9999] flex flex-col rounded-[32px] bg-white px-[32px] py-[16px]">
                {actions.map((action) => (
                  <div
                    key={action.key}
                    onClick={action.onClick}
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
            <DropdownMenu.Trigger asChild className="appearance-none">
              {children}
            </DropdownMenu.Trigger>
            <DropdownMenu.Content className="dropdown min-w-52">
              {actions.map((action) => (
                <DropdownMenu.Item
                  asChild
                  key={action.key}
                  onClick={action.onClick}
                  className={classNameForType(action.type)}
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

export default ActionsModal;
