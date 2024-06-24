import { useCallback, useMemo } from 'react';
import { SizableText } from 'tamagui';

import { useContact, useNavigation } from '../../contexts';
import { useRequests } from '../../contexts/requests';
import { getGroupHost } from '../../utils';
import { Avatar } from '../Avatar';
import ContactName from '../ContactName';
import { ListItem } from '../ListItem';
import { LoadingSpinner } from '../LoadingSpinner';
import { Reference } from './Reference';

export function GroupReference({ groupId }: { groupId: string }) {
  const { useGroup } = useRequests();
  const { onPressGroupRef } = useNavigation();
  const { data: group, isLoading, isError } = useGroup(groupId);

  const host = useMemo(() => getGroupHost(groupId), [groupId]);
  const contact = useContact(host);

  const onPress = useCallback(() => {
    if (group) {
      onPressGroupRef(group);
    }
  }, [group, onPressGroupRef]);

  return (
    <Reference onPress={onPress}>
      <Reference.Header>
        <Reference.Title>
          <Avatar contact={contact} contactId={host} size="$xl" />
          <ContactName
            color="$tertiaryText"
            size="$s"
            userId={host}
            showNickname
          />
        </Reference.Title>
        <Reference.Icon type="ArrowRef" />
      </Reference.Header>
      <Reference.Body>
        {!group && isLoading && <LoadingSpinner />}
        {!group && isError && (
          <SizableText color="$negativeActionText">
            Error loading group
          </SizableText>
        )}
        {group && (
          <ListItem pressable={false}>
            <ListItem.Icon
              fallbackText={group.title?.[0] ?? group.id[0]}
              backgroundColor={group.iconImageColor ?? undefined}
              imageUrl={group.iconImage ?? undefined}
            />
            <ListItem.MainContent>
              <ListItem.Title>{group.title ?? group.id}</ListItem.Title>
            </ListItem.MainContent>
          </ListItem>
        )}
      </Reference.Body>
    </Reference>
  );
}
