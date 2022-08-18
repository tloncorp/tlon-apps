import React from 'react';
import cn from 'classnames';

interface CoverImageInputProps {
  className?: string;
  url?: string;
}

export default function CoverImageInput(props: CoverImageInputProps) {
  const { className = '', url } = props;

  return (
    <div
      className={cn(
        'relative h-36 w-full rounded-lg bg-gray-100 bg-cover bg-center px-4',
        className
      )}
      style={url ? { backgroundImage: `url(${url})` } : {}}
    />
  );
}
