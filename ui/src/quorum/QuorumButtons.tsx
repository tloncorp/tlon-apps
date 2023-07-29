import React from 'react';
import cn from 'classnames';
import { LinkProps } from 'react-router-dom';
import { GenericLink, AnchorLink, ModalLink } from '@/components/Links';


export function GenericButton({
  anchor = false,
  disabled = false,
  modal = false,
  className,
  ...props
}: LinkProps & {
  anchor?: boolean;
  disabled?: boolean;
  modal?: boolean;
}) {
  const aprops = { anchor, disabled, modal, ...props };
  return (<GenericLink className={cn("button", className)} {...aprops} />);
}

export function AnchorButton({className, ...props}: LinkProps) {
  return (<AnchorLink className={cn("button", className)} {...props} />);
}

export function ModalButton({className, ...props}: LinkProps) {
  return (<ModalLink className={cn("button", className)} {...props} />);
}
