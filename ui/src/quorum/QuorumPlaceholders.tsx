import React, { useRef } from 'react';
import cn from 'classnames';
import { randomElement } from '@/logic/utils';


export function BoardGridPlaceholder({count}: {count: number;}) {
  return (
    <React.Fragment>
      {new Array(count).fill(true).map((_, i) => (
        <BoardGridItemPlaceholder key={i} />
      ))}
    </React.Fragment>
  );
}

function BoardGridItemPlaceholder() {
  const background = useRef(`bg-gray-${randomElement([200, 400, 600])}`);

  return (
    <div className="relative aspect-w-1 aspect-h-1 animate-pulse">
      <div
        className={cn(
          background.current,
          "w-full h-full rounded-3xl"
        )}
      />
    </div>
  );
}

export function PostWallPlaceholder({count}: {count: number;}) {
  return (
    <div className="flex h-full w-full animate-pulse flex-col my-6 px-6 space-y-6">
      {new Array(count).fill(true).map((_, i) => (
        <PostWallItemPlaceholder key={i} />
      ))}
    </div>
  );
}

function PostWallItemPlaceholder() {
  const background = useRef(`bg-gray-${randomElement([200, 400, 600])}`);

  return (
    <div className="flex-col items-center justify-center">
      <div
        className={cn(
          background.current,
          "h-64 w-full rounded-lg"
        )}
      />
    </div>
  );
}

export function PostThreadPlaceholder({count}: {count: number;}) {
  return (
    <div className="flex h-full w-full animate-pulse flex-col space-y-6">
      {new Array(count).fill(true).map((_, i) => (
        <PostWallItemPlaceholder key={i} />
      ))}
    </div>
  );
}

function PostThreadItemPlaceholder() {
  const background = useRef(`bg-gray-${randomElement([200, 400, 600])}`);

  return (
    <div className="flex flex-col items-center py-2 px-4 gap-y-4">
      <div
        className={cn(
          background.current,
          "my-4 mx-auto h-64 w-full rounded-lg"
        )}
      />
    </div>
  );
}

export function RefPlaceholder({count}: {count: number;}) {
  return (
    <div className="flex flex-col w-full items-center animate-pulse">
      {new Array(count).fill(true).map((_, i) => (
        <RefItemPlaceholder key={i} />
      ))}
    </div>
  );
}

function RefItemPlaceholder() {
  const background = useRef(`bg-gray-${randomElement([200, 400, 600])}`);

  return (
    <div className="w-full rounded-lg">
      <div
        className={cn(
          background.current,
          "h-32 w-full rounded-lg"
        )}
      />
    </div>
  );
}
