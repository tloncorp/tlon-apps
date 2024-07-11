import { useCallback, useMemo } from 'react';
import { SizableText } from 'tamagui';

import { useNavigation } from '../../contexts';
import { useRequests } from '../../contexts/requests';
import { getGroupHost } from '../../utils';
import { ContactAvatar } from '../Avatar';
import ContactName from '../ContactName';
import { PostViewMode } from '../ContentRenderer';
import { ListItem } from '../ListItem';
import { LoadingSpinner } from '../LoadingSpinner';
import { REF_AUTHOR_WIDTH, Reference } from './Reference';

export function GroupReference({
  groupId,
  viewMode = 'chat',
}: {
  groupId: string;
  viewMode?: PostViewMode;
}) {
  const { useGroup } = useRequests();
  const { onPressGroupRef } = useNavigation();
  const { data: group, isLoading, isError } = useGroup(groupId);

  const host = useMemo(() => getGroupHost(groupId), [groupId]);

  const onPress = useCallback(() => {
    if (group) {
      onPressGroupRef(group);
    }
  }, [group, onPressGroupRef]);

  return (
    <Reference onPress={onPress} viewMode={viewMode}>
      <Reference.Header>
        <Reference.Title>
          <ContactAvatar contactId={host} size="$xl" />
          <ContactName
            color="$tertiaryText"
            size="$s"
            userId={host}
            maxWidth={REF_AUTHOR_WIDTH}
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
            <ListItem.GroupIcon model={group} />
            <ListItem.MainContent>
              <ListItem.Title>{group.title ?? group.id}</ListItem.Title>
            </ListItem.MainContent>
          </ListItem>
        )}
      </Reference.Body>
    </Reference>
  );
}
