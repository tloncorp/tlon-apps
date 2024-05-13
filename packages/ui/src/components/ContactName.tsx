import { ComponentProps, useMemo } from 'react';

import { useCalm } from '../contexts/calm';
import { useContact } from '../contexts/contacts';
import { SizableText } from '../core';
import { formatUserId } from '../utils/user';

const NickNameWithMatch = ({
  nickname,
  matchText,
  secondary = false,
}: {
  nickname: string;
  matchText: string;
  secondary?: boolean;
}) => {
  const matchedNickname =
    matchText && nickname?.match(new RegExp(matchText, 'i'));

  return matchedNickname && matchedNickname.index !== undefined ? (
    <>
      {nickname.slice(0, matchedNickname.index)}
      <SizableText
        color={secondary ? '$secondaryText' : undefined}
        fontWeight="bold"
      >
        {nickname.slice(
          matchedNickname.index,
          matchedNickname.index + matchedNickname[0].length
        )}
      </SizableText>
      {nickname.slice(matchedNickname.index + matchedNickname[0].length)}
    </>
  ) : (
    <SizableText color={secondary ? '$secondaryText' : undefined}>
      {nickname}
    </SizableText>
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
  showNickname = false,
  showUserId = false,
  matchText,
  ...rest
}: ComponentProps<typeof SizableText> & {
  userId: string;
  full?: boolean;
  matchText?: string;
  showNickname?: boolean;
  showUserId?: boolean;
}) {
  const calm = useCalm();
  const contact = useContact(userId);
  const shouldShowNickname = useMemo(
    () => contact?.nickname && !calm.disableNicknames && showNickname,
    [contact, calm.disableNicknames, showNickname]
  );

  const formattedId = formatUserId(userId, full);
  if (!formattedId) {
    return null;
  }

  const showBoth = showUserId && shouldShowNickname;

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
            <SizableText color="$secondaryText">
              {' '}
              <NickNameWithMatch
                nickname={contact.nickname}
                matchText={matchText}
                secondary
              />
            </SizableText>
          ) : (
            <SizableText color="$secondaryText">{` ${contact.nickname}`}</SizableText>
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
        {shouldShowNickname ? (
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
    <SizableText
      ellipsizeMode="tail"
      numberOfLines={1}
      maxWidth="75%"
      aria-label={formattedId.ariaLabel}
      {...rest}
    >
      {shouldShowNickname ? contact!.nickname : formattedId.display}
    </SizableText>
  );
}
