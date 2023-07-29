import React from 'react';
import { Link, LinkProps, useLocation } from 'react-router-dom';
import { useAnchorLink } from '@/logic/routing';


export function GenericLink({
  anchor = false,
  disabled = false,
  modal = false,
  ...props
}: LinkProps & {
  anchor?: boolean;
  disabled?: boolean;
  modal?: boolean;
}) {
  const anchorLink = useAnchorLink();
  const location = useLocation();

  const fprops: LinkProps = {
    ...props,
    ...(!anchor ? {} : {
      to: `${anchorLink}/${props.to}`,
      relative: "path",
    }),
    ...(!modal ? {} : {
      state: {backgroundLocation: location},
    }),
  };

  return disabled ? (
    <a aria-disabled="true" {...fprops} />
  ) : (
    <Link {...fprops} />
  );
}

export function AnchorLink(props: LinkProps) {
  return (<GenericLink anchor {...props} />);
}

export function ModalLink(props: LinkProps) {
  return (<GenericLink anchor modal {...props} />);
}
