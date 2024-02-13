import cn from 'classnames';

function ReferenceInHeap({
  contextApp,
  type,
  children,
  image,
  title,
  byline,
}: {
  contextApp: string;
  type?: string;
  children?: React.ReactNode;
  image?: React.ReactNode | undefined;
  title?: React.ReactNode | string;
  byline?: React.ReactNode | string;
}) {
  if (contextApp === 'heap-row') {
    return (
      <>
        <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded bg-gray-100">
          {image}
        </div>
        <div className="flex grow flex-col">
          <div className="line-clamp-1 text-lg font-semibold">{title}</div>
          <div className="mt-1 line-clamp-1 flex space-x-2 text-base font-semibold text-gray-400">
            {byline}
          </div>
          {children}
        </div>
      </>
    );
  }

  if (contextApp === 'heap-comment') {
    return (
      <>
        {image ? (
          <div className="m-2 flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded bg-gray-100">
            {image}
          </div>
        ) : null}
        <div className="flex grow flex-col">
          {title && (
            <div className="line-clamp-1 p-2 text-lg font-semibold">
              {title}
            </div>
          )}
          <div className="mt-1 line-clamp-1 flex space-x-2 text-base font-semibold text-gray-400">
            {byline}
          </div>
          {children}
        </div>
      </>
    );
  }

  if (contextApp === 'heap-block') {
    return (
      <div
        className={cn(
          'absolute left-0 top-0 h-full w-full',
          type === 'text' ? 'bg-white p-4' : ''
        )}
      >
        {type === 'text' && title}
        {image}
        {type === 'text' && (
          <div
            className={cn(
              'absolute left-0 top-0 h-full w-full bg-gradient-to-t from-white from-10% via-transparent via-30%'
            )}
          />
        )}
      </div>
    );
  }

  return null;
}

export default ReferenceInHeap;
