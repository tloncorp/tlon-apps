import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import { useCallback, useEffect, useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useContact, useCurrentUserId, useNavigation } from '../contexts';
import { ScrollView, SizableText, View, XStack, YStack } from '../core';
import { useCopy } from '../hooks/useCopy';
import { triggerHaptic } from '../utils';
import { ContactAvatar } from './Avatar';
import { BioDisplay } from './BioDisplay';
import { Button } from './Button';
import ContactName from './ContactName';
import { FavoriteGroupsDisplay } from './FavoriteGroupsDisplay';
import { GenericHeader } from './GenericHeader';
import { Icon } from './Icon';

interface Props {
  userId: string;
  onBack: () => void;
}

export function UserProfileScreenView(props: Props) {
  const insets = useSafeAreaInsets();
  const currentUserId = useCurrentUserId();
  const userContact = useContact(props.userId);
  const hasBio = !!userContact?.bio?.length;
  const favoriteGroups = useMemo(() => {
    return userContact?.pinnedGroups?.map((g) => g.group) ?? [];
  }, [userContact?.pinnedGroups]);

  return (
    <View flex={1}>
      <GenericHeader goBack={props.onBack} />
      <ScrollView flex={1}>
        <YStack marginTop="$2xl" paddingBottom={insets.bottom}>
          <View marginHorizontal="$2xl" marginBottom="$3xl">
            <UserInfoRow
              userId={props.userId}
              hasNickname={!!userContact?.nickname?.length}
            />
          </View>

          {currentUserId !== props.userId ? (
            <View marginHorizontal="$l" marginBottom="$xl">
              <ProfileButtons userId={props.userId} contact={userContact} />
            </View>
          ) : null}

          <YStack marginHorizontal="$l" gap="$l">
            {hasBio ? <BioDisplay bio={userContact?.bio ?? ''} /> : null}
            {favoriteGroups.length ? (
              <FavoriteGroupsDisplay groups={favoriteGroups as db.Group[]} />
            ) : null}
          </YStack>
          {!hasBio && !favoriteGroups.length ? (
            <XStack justifyContent="center" marginTop={120}>
              <SizableText color="$tertiaryText">
                Nothing to see here...
              </SizableText>
            </XStack>
          ) : null}
        </YStack>
      </ScrollView>
    </View>
  );
}

function UserInfoRow(props: { userId: string; hasNickname: boolean }) {
  const { didCopy, doCopy } = useCopy(props.userId);

  const handleCopy = useCallback(() => {
    doCopy();
    triggerHaptic('success');
  }, [doCopy]);

  return (
    <XStack alignItems="center" onPress={handleCopy}>
      <ContactAvatar contactId={props.userId} size="$5xl" marginRight="$xl" />
      <YStack flexGrow={1}>
        {props.hasNickname ? (
          <>
            <ContactName userId={props.userId} showNickname size="$xl" />
            <XStack alignItems="center">
              <ContactName
                userId={props.userId}
                color="$secondaryText"
                marginRight="$s"
              />
              {didCopy ? (
                <Icon
                  type="Checkmark"
                  customSize={[14, 14]}
                  position="relative"
                  top={1}
                />
              ) : null}
            </XStack>
          </>
        ) : (
          <ContactName userId={props.userId} size="$xl" />
        )}
      </YStack>
    </XStack>
  );
}

function ProfileButtons(props: { userId: string; contact: db.Contact | null }) {
  const navContext = useNavigation();
  const handleMessageUser = useCallback(() => {
    navContext.onPressGoToDm?.([props.userId]);
  }, [navContext, props.userId]);

  const handleBlock = useCallback(() => {
    if (props.contact && props.contact.isBlocked) {
      store.unblockUser(props.userId);
    } else {
      store.blockUser(props.userId);
    }
  }, [props]);

  const isBlocked = useMemo(() => {
    return props.contact?.isBlocked ?? false;
  }, [props.contact]);

  return (
    <XStack gap="$m">
      <ProfileButton title="Message" onPress={handleMessageUser} />
      <ProfileButton
        title={isBlocked ? 'Unblock' : 'Block'}
        onPress={handleBlock}
      />
    </XStack>
  );
}

function ProfileButton(props: { title: string; onPress: () => void }) {
  return (
    <Button
      // borderWidth={0}
      flexGrow={1}
      paddingVertical={14} // that extra 2px tho
      paddingHorizontal="$2xl"
      borderRadius="$xl"
      onPress={props.onPress}
    >
      <Button.Text size="$l">{props.title}</Button.Text>
    </Button>
  );
}
