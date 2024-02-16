import { useIsMobile } from '@/logic/useMedia';
import { disableDefault, handleDropdownLink } from '@/logic/utils';
import useDocketState from '@/state/docket';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Chad, chadIsRunning } from '@urbit/api';
import classNames from 'classnames';
import React, { ReactElement, useCallback, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useEventListener } from 'usehooks-ts';

export interface TileMenuProps {
  desk: string;
  lightText: boolean;
  menuColor: string;
  chad: Chad;
  className?: string;
}

function MenuIcon({ className }: { className: string }) {
  return (
    <svg className={classNames('fill-current', className)} viewBox="0 0 16 16">
      <path fillRule="evenodd" clipRule="evenodd" d="M14 8.5H2V7.5H14V8.5Z" />
      <path fillRule="evenodd" clipRule="evenodd" d="M2 2.5H14V3.5H2V2.5Z" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M14 13.5H2V12.5H14V13.5Z"
      />
    </svg>
  );
}

const Item = React.forwardRef<HTMLDivElement, DropdownMenu.MenuItemProps>(
  ({ children, ...props }, ref) => (
    <DropdownMenu.Item
      ref={ref}
      {...props}
      className="default-focus block w-full select-none rounded leading-none mix-blend-hard-light ring-gray-600"
    >
      {children}
    </DropdownMenu.Item>
  )
);

export default function TileMenu({
  desk,
  chad,
  menuColor,
  lightText,
  className,
}: TileMenuProps) {
  const [open, setOpen] = useState(false);
  const {
    state: { backgroundLocation },
  } = useLocation();
  const toggleDocket = useDocketState((s) => s.toggleDocket);
  const menuBg = { backgroundColor: menuColor };
  const linkOnSelect = useCallback(() => handleDropdownLink(setOpen), []);
  const active = chadIsRunning(chad);
  const suspended = 'suspend' in chad;
  const isMobile = useIsMobile();

  return (
    <DropdownMenu.Root open={open} onOpenChange={(isOpen) => setOpen(isOpen)}>
      <DropdownMenu.Trigger
        className={classNames(
          'default-focus flex h-8 w-8 items-center justify-center rounded-full transition-opacity duration-75',
          open && 'opacity-100',
          className
        )}
        style={menuBg}
        // onMouseOver={() => queryClient.setQueryData(['apps', name], app)}
      >
        <MenuIcon
          className={classNames(
            'h-4 w-4 mix-blend-hard-light',
            lightText && 'text-gray-100'
          )}
        />
        <span className="sr-only">Menu</span>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          onCloseAutoFocus={disableDefault}
          className={classNames(
            'dropdown z-40 py-2 font-semibold',
            lightText ? 'text-gray-100' : 'text-gray-800'
          )}
          style={menuBg}
        >
          <DropdownMenu.Group>
            <Item
              onSelect={isMobile ? (e) => e.preventDefault() : linkOnSelect}
              asChild
            >
              <Link
                to={`/app/${desk}/info`}
                state={{ backgroundLocation }}
                className="block w-full px-4 py-3"
              >
                App Info
              </Link>
            </Item>
          </DropdownMenu.Group>
          <DropdownMenu.Separator className="-mx-4 my-2 border-t-2 border-solid border-gray-600 mix-blend-soft-light" />
          <DropdownMenu.Group>
            {active && (
              <Item
                asChild
                onSelect={isMobile ? (e) => e.preventDefault() : linkOnSelect}
              >
                <Link
                  to={`/app/${desk}/suspend`}
                  className="block w-full px-4 py-3"
                >
                  Suspend App
                </Link>
              </Item>
            )}
            {suspended && (
              <Item onSelect={() => toggleDocket(desk)}>
                <span className="block w-full px-4 py-3">Resume App</span>
              </Item>
            )}
            <Item
              asChild
              onSelect={isMobile ? (e) => e.preventDefault() : linkOnSelect}
            >
              <Link
                to={`/app/${desk}/remove`}
                className="block w-full px-4 py-3"
              >
                Uninstall App
              </Link>
            </Item>
          </DropdownMenu.Group>
          <DropdownMenu.Arrow
            className="h-[10px] w-4 fill-current"
            style={{ color: menuColor }}
          />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
