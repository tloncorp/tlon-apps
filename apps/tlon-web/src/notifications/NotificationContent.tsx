import { ActivityEvent } from '@tloncorp/shared/dist/urbit';

interface NotificationContentProps {
  time: number;
  top: ActivityEvent;
}

export function NotificationContent({ top, time }: NotificationContentProps) {
  function renderContent(c: YarnContent, i: number) {
    if (typeof c === 'string') {
      return (
        <span key={`${c}-${time}-${i}`}>
          {c.split(' ').map((s, index) =>
            ob.isValidPatp(s.replaceAll(PUNCTUATION_REGEX, '')) ? (
              <span
                key={`${s}-${index}`}
                className="mr-1 inline-block rounded bg-blue-soft px-1.5 py-0 text-blue mix-blend-multiply dark:mix-blend-normal"
              >
                <ShipName
                  name={s.replaceAll(PUNCTUATION_REGEX, '')}
                  showAlias
                />
              </span>
            ) : (
              <span key={`${s}-${index}`}>{s} </span>
            )
          )}
        </span>
      );
    }

    if ('ship' in c) {
      return (
        <ShipName
          key={c.ship + time}
          name={c.ship}
          className="font-semibold text-gray-800"
          showAlias={true}
        />
      );
    }

    if (conIsNote) {
      return <span key={c.emph + time}>{c.emph}</span>;
    }

    return <span key={c.emph + time}>&ldquo;{c.emph}&rdquo;</span>;
  }

  if (conIsNote) {
    return (
      <div className="flex flex-col space-y-2">
        <p className="line-clamp-1 leading-5 text-gray-800">
          {_.map(_.slice(content, 0, 2), (c: YarnContent, i) =>
            renderContent(c, i)
          )}
        </p>
        <div className="note-inline-block flex p-4">
          <p className="line-clamp-1 leading-5 text-gray-800">
            {_.map(_.slice(content, 2, 3), (c: YarnContent, i) =>
              renderContent(c, i)
            )}
          </p>
          <p className="line-clamp-1 leading-5 text-gray-400">
            {_.map(_.slice(content, 3), (c: YarnContent, i) =>
              renderContent(c, i)
            )}
          </p>
        </div>
      </div>
    );
  }

  if (conIsBlock) {
    return (
      <div className="flex flex-col space-y-2">
        <p className="line-clamp-1 leading-5 text-gray-800">
          {_.map(_.slice(content, 0, 2), (c: YarnContent, i) =>
            renderContent(c, i)
          )}
        </p>
      </div>
    );
  }

  if (conIsMention) {
    return (
      <>
        <p className="mb-2 line-clamp-4 leading-5 text-gray-400">
          {_.map(_.slice(content, 0, 2), (c: YarnContent, i) =>
            renderContent(c, i)
          )}
        </p>
        <p className="line-clamp-2 leading-5 text-gray-800">
          {_.map(_.slice(content, 2), (c: YarnContent, i) =>
            renderContent(c, i)
          )}
        </p>
      </>
    );
  }

  if (conIsReply || conIsComment) {
    return (
      <>
        <p className="mb-2 line-clamp-4 leading-5 text-gray-400">
          {_.map(_.slice(content, 0, 4), (c: YarnContent, i) =>
            renderContent(c, i)
          )}
        </p>
        <p className="line-clamp-2 leading-5 text-gray-800">
          {_.map(_.slice(content, 6), (c: YarnContent, i) =>
            renderContent(c, i)
          )}
        </p>
      </>
    );
  }

  return (
    <p className="line-clamp-3 leading-5 text-gray-800">
      {_.map(content, (c: YarnContent, i) => renderContent(c, i))}
    </p>
  );
}
