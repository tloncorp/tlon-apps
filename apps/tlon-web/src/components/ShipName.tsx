import { useCalm } from '@/state/settings';
import { cite } from '@urbit/api';
import React, { HTMLAttributes, useMemo } from 'react';

import { useContact } from '../state/contact';

type ShipNameProps = {
  name: string;
  full?: boolean;
  showAlias?: boolean;
} & HTMLAttributes<HTMLSpanElement>;

export default function ShipName({
  name,
  full = false,
  showAlias = false,
  ...props
}: ShipNameProps) {
  const contact = useContact(name);
  const separator = /([_^-])/;
  const citedName = useMemo(() => (full ? name : cite(name)), [name, full]);
  const calm = useCalm();

  if (!citedName) {
    return null;
  }

  const parts = citedName.replace('~', '').split(separator);
  const first = parts.shift();

  return (
    <span
      title={calm.disableNicknames ? contact?.nickname : undefined}
      {...props}
    >
      {contact?.nickname && !calm.disableNicknames && showAlias ? (
        <span title={citedName}>{contact.nickname}</span>
      ) : (
        <>
          <span aria-hidden>~</span>
          <span>{first}</span>
          {parts.length > 1 && (
            <>
              {parts.map((piece, index) => (
                <span
                  key={`${piece}-${index}`}
                  aria-hidden={separator.test(piece)}
                >
                  {piece}
                </span>
              ))}
            </>
          )}
        </>
      )}
    </span>
  );
}
