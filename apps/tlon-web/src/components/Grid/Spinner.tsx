import classNames from 'classnames';
import React from 'react';

import SpinnerIcon from '../icons/SpinnerIcon';

export default function Spinner({
  className,
  ...props
}: React.HTMLAttributes<SVGSVGElement>) {
  return (
    <SpinnerIcon className={classNames('spinner', className)} {...props} />
  );
}
