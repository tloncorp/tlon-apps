import { cite } from '@urbit/aura';
import { useMemo } from 'react';
import { ColorTokens } from 'tamagui';

import { useCalm } from '../contexts/calm';
import { useContact } from '../contexts/contacts';
import { FontSizeTokens, SizableText, Text } from '../core';

export default function ContactName({
  name,
  full = false,
  showAlias = false,
  ...props
}: {
  name: string;
  full?: boolean;
  showAlias?: boolean;
  size?: FontSizeTokens;
  color?: ColorTokens;
}) {
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
    <SizableText
      color={props.color}
      accessibilityHint={
        !calm.disableNicknames && contact?.nickname
          ? contact.nickname
          : undefined
      }
      size={props.size}
    >
      {contact?.nickname && !calm.disableNicknames && showAlias ? (
        <Text accessibilityHint={citedName}>{contact.nickname}</Text>
      ) : (
        <>
          <Text aria-hidden>~</Text>
          <Text>{first}</Text>
          {parts.length > 1 && (
            <>
              {parts.map((piece, index) => (
                <Text
                  key={`${piece}-${index}`}
                  aria-hidden={separator.test(piece)}
                >
                  {piece}
                </Text>
              ))}
            </>
          )}
        </>
      )}
    </SizableText>
  );
}
