import React, { PropsWithChildren } from 'react';

type DividerProps = PropsWithChildren<unknown>;

export default function Divider({ children }: DividerProps) {
  return (
    <div className="flex items-center space-x-2 p-2">
      <h2 className="text-sm font-semibold text-gray-400">{children}</h2>
      <div className="grow border-b-2 border-gray-100" />
    </div>
  );
}
