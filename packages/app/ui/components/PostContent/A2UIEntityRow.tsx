import { useGroupPreview } from '@tloncorp/shared/store';
import type { A2UI } from '@tloncorp/shared/logic';
import { Text } from '@tloncorp/ui';
import { XStack, YStack, getTokenValue } from 'tamagui';

import { useCalm, useContact } from '../../contexts/appDataContext';
import { ContactAvatar } from '../Avatar';
import { GroupAvatar } from '../GroupAvatar';
import { A2UI_TYPE } from './a2uiCardParts';

const AVATAR_GAP = 10;

/**
 * A request inside a list of requests, which holds its own answers, gets the
 * smaller avatar, as in the design.
 */
function getAvatarSize(compact: boolean) {
  return compact ? '$3xl' : '$3.5xl';
}

/** Width of the avatar plus the gap after it, for text lined up under a name. */
export function getA2UIEntityIndent(compact = false) {
  return getTokenValue(getAvatarSize(compact), 'size') + AVATAR_GAP;
}

/**
 * A person or group a bot card is about: avatar, name and handle. The bot's
 * `text` is the accessible label, so screen readers hear what older apps show.
 */
export function A2UIEntityRow({
  compact = false,
  detail,
  entity,
  fallbackText,
  marginTop,
}: {
  compact?: boolean;
  /** A short line about the request, drawn after the handle. */
  detail?: string;
  entity: A2UI.TextEntity;
  fallbackText: string;
  marginTop?: number;
}) {
  const props = { compact, detail, entity, fallbackText, marginTop };
  return entity.type === 'ship' ? (
    <ShipRow {...props} />
  ) : (
    <GroupRow {...props} />
  );
}

type RowProps = {
  compact: boolean;
  detail?: string;
  entity: A2UI.TextEntity;
  fallbackText: string;
  marginTop?: number;
};

function ShipRow({
  compact,
  detail,
  entity,
  fallbackText,
  marginTop,
}: RowProps) {
  const contact = useContact(entity.id);
  const { disableNicknames } = useCalm();
  const nickname = disableNicknames ? undefined : contact?.nickname;
  return (
    <EntityLayout
      avatar={
        <ContactAvatar contactId={entity.id} size={getAvatarSize(compact)} />
      }
      compact={compact}
      detail={detail}
      name={nickname || entity.name || entity.id}
      handle={entity.id}
      label={fallbackText}
      marginTop={marginTop}
    />
  );
}

function GroupRow({
  compact,
  detail,
  entity,
  fallbackText,
  marginTop,
}: RowProps) {
  const { data: group } = useGroupPreview(entity.id);
  const title = group?.title || entity.name || entity.id;
  return (
    <EntityLayout
      avatar={
        <GroupAvatar
          model={group ?? { id: entity.id, title }}
          size={getAvatarSize(compact)}
        />
      }
      compact={compact}
      detail={detail}
      name={title}
      handle={entity.id}
      label={fallbackText}
      marginTop={marginTop}
    />
  );
}

function EntityLayout({
  avatar,
  compact,
  detail,
  handle,
  label,
  marginTop,
  name,
}: {
  avatar: React.ReactNode;
  compact: boolean;
  detail?: string;
  handle: string;
  label: string;
  marginTop?: number;
  name: string;
}) {
  return (
    <XStack
      marginTop={marginTop}
      gap={AVATAR_GAP}
      // A compact row's second line can wrap, so the avatar stays at the top.
      alignItems={compact ? 'flex-start' : 'center'}
      accessible
      accessibilityLabel={detail ? `${label} ${detail}` : label}
    >
      {avatar}
      <YStack flex={1} minWidth={0}>
        <Text
          size="$label/l"
          {...A2UI_TYPE.labelStrong}
          trimmed={false}
          numberOfLines={1}
        >
          {name}
        </Text>
        <Text
          size="$label/m"
          {...A2UI_TYPE.note}
          color="$secondaryText"
          trimmed={false}
          numberOfLines={detail ? 2 : 1}
        >
          {detail ? `${handle} ${detail}` : handle}
        </Text>
      </YStack>
    </XStack>
  );
}
