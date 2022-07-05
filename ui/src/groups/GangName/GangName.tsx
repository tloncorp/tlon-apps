import React from 'react';
import cn from 'classnames';
import { useGang } from '../../state/groups/groups';

export default function GangName(props: { flag: string; className?: string }) {
  const { flag, className } = props;
  const { preview } = useGang(flag);

  return (
    <span className={cn(className, preview ? '' : 'text-mono')}>
      {preview ? preview.meta.title : flag}
    </span>
  );
}
