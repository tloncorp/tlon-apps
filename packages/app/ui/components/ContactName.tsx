import { Text } from '@tloncorp/ui';
import { ComponentProps, useMemo } from 'react';
import { SizableText } from 'tamagui';

import { useCalm, useContact } from '../contexts/appDataContext';
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
      <Text fontWeight="bold">
        {userId.slice(matchedId.index, matchedId.index + matchedId[0].length)}
      </Text>
      {userId.slice(matchedId.index + matchedId[0].length)}
    </>
  ) : (
    <Text>{userId}</Text>
  );
};

export default function ContactName({
  userId,
  full = false,
  showNickname = false,
  showUserId = false,
  matchText,
  maxWidth,
  ...rest
}: ComponentProps<typeof Text> & {
  userId: string;
  full?: boolean;
  matchText?: string;
  showNickname?: boolean;
  showUserId?: boolean;
  maxWidth?: number | string;
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
      <Text
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
            <Text color="$secondaryText">
              {' '}
              <NickNameWithMatch
                nickname={contact?.nickname ?? ''}
                matchText={matchText}
                secondary
              />
            </Text>
          ) : (
            <Text color="$secondaryText">{` ${contact.nickname}`}</Text>
          )
        ) : null}
      </Text>
    );
  }

  if (matchText) {
    return (
      <Text
        ellipsizeMode="tail"
        numberOfLines={1}
        aria-label={formattedId.ariaLabel}
        {...rest}
      >
        {shouldShowNickname ? (
          <NickNameWithMatch
            nickname={contact?.nickname ?? ''}
            matchText={matchText}
          />
        ) : (
          <UserIdWithMatch userId={formattedId.display} matchText={matchText} />
        )}
      </Text>
    );
  }

  return (
    <Text
      ellipsizeMode="tail"
      numberOfLines={1}
      maxWidth={maxWidth ?? '75%'}
      aria-label={formattedId.ariaLabel}
      {...rest}
    >
      {shouldShowNickname ? contact!.nickname : formattedId.display}
    </Text>
  );
}
