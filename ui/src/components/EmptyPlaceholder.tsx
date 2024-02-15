import { PropsWithChildren } from 'react';

export default function EmptyPlaceholder({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return (
    <div
      className={`flex h-full w-full flex-col items-center justify-center px-4 text-center text-lg text-gray-300 sm:text-base sm:leading-5 ${className}`}
    >
      {children}
    </div>
  );
}

export function InlineEmptyPlaceholder({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return (
    <div
      className={`flex w-full flex-col items-center justify-center px-4 text-center text-lg text-gray-300 sm:text-base sm:leading-5 ${className}`}
    >
      {children}
    </div>
  );
}
