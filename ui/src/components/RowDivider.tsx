import React from 'react';
import cn from 'classnames';

export default function RowDivider(props: {
  label: string;
  className?: string;
}) {
  const { label, className = '' } = props;

  return (
    <div className={cn('flex items-center space-x-2', className)}>
      <div>{label}</div>
      <div className="grow border-b" />
    </div>
  );
}
