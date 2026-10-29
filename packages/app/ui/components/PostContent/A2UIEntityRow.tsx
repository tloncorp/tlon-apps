import { useGroupPreview } from '@tloncorp/shared/store';
import type { A2UI } from '@tloncorp/shared/logic';
import { Text } from '@tloncorp/ui';
import { XStack, YStack } from 'tamagui';

import { useCalm, useContact } from '../../contexts/appDataContext';
import { ContactAvatar } from '../Avatar';
import { GroupAvatar } from '../GroupAvatar';
import { A2UI_TEXT_BREAKING } from './a2uiCardParts';

/** Width of the avatar plus the gap after it, for text lined up under a name. */
export const A2UI_ENTITY_INDENT = 44;

/**
 * A person or group a bot card is about: avatar, name and handle. The bot's
 * `text` is the accessible label, so screen readers hear what older apps show.
 */
export function A2UIEntityRow({
  entity,
  fallbackText,
}: {
  entity: A2UI.TextEntity;
  fallbackText: string;
}) {
  return entity.type === 'ship' ? (
    <ShipRow entity={entity} fallbackText={fallbackText} />
  ) : (
    <GroupRow entity={entity} fallbackText={fallbackText} />
  );
}

function ShipRow({
  entity,
  fallbackText,
}: {
  entity: A2UI.TextEntity;
  fallbackText: string;
}) {
  const contact = useContact(entity.id);
  const { disableNicknames } = useCalm();
  const nickname = disableNicknames ? undefined : contact?.nickname;
  return (
    <EntityLayout
      avatar={<ContactAvatar contactId={entity.id} size="$3.5xl" />}
      name={nickname || entity.name || entity.id}
      handle={entity.id}
      label={fallbackText}
    />
  );
}

function GroupRow({
  entity,
  fallbackText,
}: {
  entity: A2UI.TextEntity;
  fallbackText: string;
}) {
  const { data: group } = useGroupPreview(entity.id);
  const title = group?.title || entity.name || entity.id;
  return (
    <EntityLayout
      avatar={
        <GroupAvatar model={group ?? { id: entity.id, title }} size="$3.5xl" />
      }
      name={title}
      handle={entity.id}
      label={fallbackText}
    />
  );
}

function EntityLayout({
  avatar,
  handle,
  label,
  name,
}: {
  avatar: React.ReactNode;
  handle: string;
  label: string;
  name: string;
}) {
  return (
    <XStack gap="$m" alignItems="center" accessible accessibilityLabel={label}>
      {avatar}
      <YStack flex={1} minWidth={0}>
        <Text
          size="$label/l"
          fontWeight="500"
          trimmed={false}
          numberOfLines={1}
          {...A2UI_TEXT_BREAKING}
        >
          {name}
        </Text>
        <Text
          size="$label/m"
          color="$secondaryText"
          trimmed={false}
          numberOfLines={1}
        >
          {handle}
        </Text>
      </YStack>
    </XStack>
  );
}
