import cn from 'classnames';
import {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  PropsWithChildren,
  useEffect,
  useState,
} from 'react';
import { NavLink, NavLinkProps } from 'react-router-dom';

import useLongPress from '@/logic/useLongPress';

const DOUBLE_CLICK_WINDOW = 300;

type NavTabProps = PropsWithChildren<
  (
    | Omit<NavLinkProps, 'className' | 'style'>
    | AnchorHTMLAttributes<HTMLAnchorElement>
  ) & {
    className?: string;
    linkClass?: string;
  }
>;

function isNavLinkProps(obj: unknown): obj is NavLinkProps {
  return !!obj && typeof obj === 'object' && 'to' in obj;
}

export default function NavTab({
  children,
  className,
  linkClass,
  ...props
}: NavTabProps) {
  return (
    <li className={cn('flex-1', className)}>
      {isNavLinkProps(props) ? (
        <NavLink
          {...props}
          to={props.to}
          className={cn(
            'flex h-full w-full items-center justify-center',
            linkClass
          )}
        >
          {children}
        </NavLink>
      ) : (
        <a
          {...props}
          className={cn(
            'flex h-full flex-col items-center justify-end pb-0.5',
            linkClass
          )}
        >
          {children}
        </a>
      )}
    </li>
  );
}

type DoubleClickableNavTabProps = PropsWithChildren<
  (
    | Omit<NavLinkProps, 'className' | 'style'>
    | AnchorHTMLAttributes<HTMLAnchorElement>
  ) & {
    className?: string;
    linkClass?: string;
    onSingleClick: () => void;
    onDoubleClick: () => void;
    onLongPress?: () => void;
  }
>;

export function DoubleClickableNavTab({
  onSingleClick,
  onDoubleClick,
  onLongPress,
  ...props
}: DoubleClickableNavTabProps) {
  const [clickTimeout, setClickTimeout] = useState<number | null>(null);
  const { action, handlers } = useLongPress();

  useEffect(() => {
    if (action === 'longpress') {
      onLongPress?.();
    }
  }, [action, onLongPress]);

  const onClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    handlers.onClick();
    e.preventDefault();

    if (clickTimeout !== null) {
      window.clearTimeout(clickTimeout);
      setClickTimeout(null);
      onDoubleClick();
    } else {
      const timeout = window.setTimeout(() => {
        setClickTimeout(null);
      }, DOUBLE_CLICK_WINDOW);
      setClickTimeout(timeout);
    }
    onSingleClick();
  };

  return (
    <NavTab {...handlers} onClick={onClick} {...props}>
      {props.children}
    </NavTab>
  );
}

type DoubleClickableNavButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    className?: string;
    onSingleClick: () => void;
    onDoubleClick: () => void;
    onLongPress?: () => void;
  }
>;

export function DoubleClickableNavButton({
  onSingleClick,
  onDoubleClick,
  onLongPress,
  ...props
}: DoubleClickableNavButtonProps) {
  const [clickTimeout, setClickTimeout] = useState<number | null>(null);
  const { action, handlers } = useLongPress();

  useEffect(() => {
    if (action === 'longpress') {
      onLongPress?.();
    }
  }, [action, onLongPress]);

  const onClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    handlers.onClick();
    e.preventDefault();

    if (clickTimeout !== null) {
      window.clearTimeout(clickTimeout);
      setClickTimeout(null);
      onDoubleClick();
    } else {
      const timeout = window.setTimeout(() => {
        setClickTimeout(null);
      }, DOUBLE_CLICK_WINDOW);
      setClickTimeout(timeout);
    }
    onSingleClick();
  };

  return (
    <button {...handlers} onClick={onClick} {...props}>
      {props.children}
    </button>
  );
}
