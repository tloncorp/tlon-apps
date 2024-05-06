import { ComponentProps, useMemo } from 'react';

import { useCalm } from '../contexts/calm';
import { useContact } from '../contexts/contacts';
import { SizableText } from '../core';
import { formatUserId } from '../utils/user';

const NickNameWithMatch = ({
  nickname,
  matchText,
}: {
  nickname: string;
  matchText: string;
}) => {
  const matchedNickname =
    matchText && nickname?.match(new RegExp(matchText, 'i'));

  return matchedNickname && matchedNickname.index !== undefined ? (
    <>
      {nickname.slice(0, matchedNickname.index)}
      <SizableText fontWeight="bold">
        {nickname.slice(
          matchedNickname.index,
          matchedNickname.index + matchedNickname[0].length
        )}
      </SizableText>
      {nickname.slice(matchedNickname.index + matchedNickname[0].length)}
    </>
  ) : (
    <SizableText>{nickname}</SizableText>
  );
};

const UserIdWithMatch = ({
  userId,
  matchText,
}: {
  userId: string;
  matchText: string;
}) => {
  const matchedId = matchText && userId.match(new RegExp(matchText, 'i'));
  return matchedId && matchedId.index !== undefined ? (
    <>
      {userId.slice(0, matchedId.index)}
      <SizableText fontWeight="bold">
        {userId.slice(matchedId.index, matchedId.index + matchedId[0].length)}
      </SizableText>
      {userId.slice(matchedId.index + matchedId[0].length)}
    </>
  ) : (
    <SizableText>{userId}</SizableText>
  );
};

export default function ContactName({
  userId,
  full = false,
  showAlias = false,
  showBoth = false,
  matchText,
  ...rest
}: ComponentProps<typeof SizableText> & {
  userId: string;
  full?: boolean;
  matchText?: string;
  showAlias?: boolean;
  showBoth?: boolean;
}) {
  const calm = useCalm();
  const contact = useContact(userId);
  const showNickname = useMemo(
    () => contact?.nickname && !calm.disableNicknames && showAlias,
    [contact, calm.disableNicknames, showAlias]
  );

  const formattedId = formatUserId(userId, full);
  if (!formattedId) {
    return null;
  }

  if (showBoth) {
    return (
      <SizableText
        ellipsizeMode="tail"
        numberOfLines={1}
        aria-label={formattedId.ariaLabel}
        {...rest}
      >
        {matchText ? (
          <UserIdWithMatch userId={formattedId.display} matchText={matchText} />
        ) : (
          formattedId.display
        )}
        {!calm.disableNicknames && contact?.nickname ? (
          matchText ? (
            <>
              {' ('}
              <NickNameWithMatch
                nickname={contact.nickname}
                matchText={matchText}
              />
              {')'}
            </>
          ) : (
            ` (${contact.nickname})`
          )
        ) : null}
      </SizableText>
    );
  }

  if (matchText) {
    return (
      <SizableText
        ellipsizeMode="tail"
        numberOfLines={1}
        aria-label={formattedId.ariaLabel}
        {...rest}
      >
        {showNickname ? (
          <NickNameWithMatch
            nickname={contact!.nickname!}
            matchText={matchText}
          />
        ) : (
          <UserIdWithMatch userId={formattedId.display} matchText={matchText} />
        )}
      </SizableText>
    );
  }

  return (
    <SizableText aria-label={formattedId.ariaLabel} {...rest}>
      {showNickname ? contact!.nickname : formattedId.display}
    </SizableText>
  );
}
