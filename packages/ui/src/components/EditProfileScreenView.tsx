import * as db from '@tloncorp/shared/db';
import * as domain from '@tloncorp/shared/domain';
import { ListItem, MiniPlayableTrack, Pressable } from '@tloncorp/ui';
import { useCallback, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, View, XStack, YStack } from 'tamagui';

import {
  useAudioPlayer,
  useContact,
  useCurrentUserId,
  useStore,
} from '../contexts';
import { SigilAvatar } from './Avatar';
import { FavoriteGroupsDisplay } from './FavoriteGroupsDisplay';
import {
  ControlledImageField,
  ControlledTextField,
  ControlledTextareaField,
  Field,
  FormFrame,
} from './Form';
import KeyboardAvoidingView from './KeyboardAvoidingView';
import { LocationPicker } from './LocationWidgets';
import { PinnedPostsDisplay } from './ProfilePinnedPosts';
import { ScreenHeader } from './ScreenHeader';
import { Text } from './TextV2';
import {
  BioDisplay,
  PinnedGroupsDisplay,
  PinnedTunesDisplay,
  ProfileLinkDisplay,
} from './UserProfileScreenView';

interface Props {
  userId: string;
  onGoBack: () => void;
  onGoToAddProfileAudio: () => void;
  onGoToEditLinks: () => void;
}

export function EditProfileScreenView(props: Props) {
  const store = useStore();
  const insets = useSafeAreaInsets();
  const currentUserId = useCurrentUserId();
  const userContact = useContact(props.userId);
  const [pinnedGroups, setPinnedGroups] = useState<db.Group[]>(
    (userContact?.pinnedGroups
      ?.map((pin) => pin.group)
      .filter(Boolean) as db.Group[]) ?? []
  );

  const initialLocation = useMemo(() => {
    return userContact?.location
      ? (userContact.location as domain.ProfileLocation)
      : null;
  }, [userContact]);

  const initialPinnedPosts = useMemo(() => {
    return userContact?.pinnedPosts ?? [];
  }, [userContact?.pinnedPosts]);
  const initialPinnedPostsKey = useMemo(() => {
    return (userContact?.pinnedPosts?.map((pp) => pp.postId) ?? []).join(',');
  }, [userContact?.pinnedPosts]);

  const [pinnedPosts, setPinnedPosts] = useState(initialPinnedPosts);
  const currPinnedPostsKey = useMemo(() => {
    return pinnedPosts.map((p) => p.postId).join(',');
  }, [pinnedPosts]);

  const handleRemovePinnedPost = useCallback((postId: string) => {
    setPinnedPosts((curr) => curr.filter((p) => p.postId !== postId));
  }, []);

  const [location, setLocation] = useState<domain.ProfileLocation | null>(
    initialLocation
  );

  const pinnedTunes = useMemo(() => {
    return (userContact?.tunes ?? []) as domain.NormalizedTrack[];
  }, [userContact?.tunes]);

  const pinnedLinks = useMemo(() => {
    return (userContact?.links ?? []) as domain.ProfileLink[];
  }, [userContact?.links]);

  const isCurrUser = useMemo(
    () => props.userId === currentUserId,
    [props.userId, currentUserId]
  );

  const currentNickname = useMemo(() => {
    return isCurrUser
      ? userContact?.nickname
      : userContact?.customNickname ?? '';
  }, [isCurrUser, userContact?.nickname, userContact?.customNickname]);

  const nicknamePlaceholder = useMemo(() => {
    return isCurrUser
      ? userContact?.id
      : userContact?.peerNickname ?? userContact?.id;
  }, [isCurrUser, userContact]);

  const currentAvatarImage = useMemo(() => {
    return isCurrUser
      ? userContact?.avatarImage
      : userContact?.customAvatarImage ?? '';
  }, [isCurrUser, userContact]);

  const avatarPlaceholder = useMemo(() => {
    return isCurrUser ? undefined : userContact?.peerAvatarImage ?? undefined;
  }, [isCurrUser, userContact]);

  const {
    control,
    handleSubmit,
    formState: { isDirty: formIsDirty, isValid },
  } = useForm({
    mode: 'onChange',
    defaultValues: {
      nickname: currentNickname ?? '',
      status: userContact?.status ?? '',
      bio: userContact?.bio ?? '',
      avatarImage: currentAvatarImage ?? '',
    },
  });

  const locationIsDirty = useMemo(
    () => !domain.locationsEquivalent(location, initialLocation),
    [location, initialLocation]
  );

  const pinnedPostsIsDirty = useMemo(() => {
    console.log('pinnedPostsIsDirty', {
      initial: initialPinnedPostsKey,
      curr: currPinnedPostsKey,
    });
    return initialPinnedPostsKey !== currPinnedPostsKey;
  }, [initialPinnedPostsKey, currPinnedPostsKey]);

  const isDirty = useMemo(
    () => formIsDirty || locationIsDirty || pinnedPostsIsDirty,
    [formIsDirty, locationIsDirty, pinnedPostsIsDirty]
  );

  const handlePressDone = useCallback(() => {
    if (isDirty) {
      handleSubmit((formData) => {
        const nicknameStartVal = isCurrUser
          ? userContact?.nickname
          : userContact?.customNickname;
        const avatarStartVal = isCurrUser
          ? userContact?.avatarImage
          : userContact?.customAvatarImage;

        const update = {
          status: formData.status,
          bio: formData.bio,
          nickname: formData.nickname
            ? formData.nickname
            : nicknameStartVal
              ? null // clear existing
              : undefined,
          avatarImage: formData.avatarImage
            ? formData.avatarImage
            : avatarStartVal
              ? null // clear existing
              : undefined,
          location: location
            ? domain.locationsEquivalent(location, initialLocation)
              ? undefined
              : location
            : initialLocation
              ? null
              : undefined,
        };

        if (isCurrUser) {
          store.updateCurrentUserProfile(update);
          if (pinnedPostsIsDirty) {
            console.log('updating pinned posts', pinnedPosts);
            store.setProfilePinnedPosts({
              // this will auto remove any posts that haven't loaded (you should always have your own pinned ones)
              posts: pinnedPosts
                .map((p) => p.post)
                .filter(Boolean) as db.Post[],
            });
          }
        } else {
          store.updateContactMetadata(props.userId, {
            nickname: update.nickname,
            avatarImage: update.avatarImage,
          });
        }
      })();
    }
    props.onGoBack();
  }, [
    handleSubmit,
    initialLocation,
    isCurrUser,
    isDirty,
    location,
    pinnedPosts,
    pinnedPostsIsDirty,
    props,
    store,
    userContact?.avatarImage,
    userContact?.customAvatarImage,
    userContact?.customNickname,
    userContact?.nickname,
  ]);

  const handlePressCancel = () => {
    if (isDirty) {
      Alert.alert('Discard changes?', 'Your changes will not be saved.', [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            props.onGoBack();
          },
        },
      ]);
    } else {
      props.onGoBack();
    }
  };

  const handleUpdatePinnedGroups = useCallback((groups: db.Group[]) => {
    setPinnedGroups(groups);
    store.updateProfilePinnedGroups(groups);
  }, []);

  return (
    <View flex={1}>
      <ScreenHeader
        title="Edit Profile"
        leftControls={
          <ScreenHeader.TextButton onPress={handlePressCancel}>
            Cancel
          </ScreenHeader.TextButton>
        }
        rightControls={
          <ScreenHeader.TextButton
            onPress={handlePressDone}
            color="$positiveActionText"
            disabled={!isValid}
          >
            Done
          </ScreenHeader.TextButton>
        }
      />

      <KeyboardAvoidingView>
        <ScrollView keyboardDismissMode="on-drag">
          <FormFrame paddingBottom={insets.bottom}>
            <XStack alignItems="flex-end" gap="$m">
              <View flex={1}>
                <ControlledTextField
                  name="nickname"
                  label="Nickname"
                  control={control}
                  renderInputContainer={
                    isCurrUser
                      ? ({ children }) => {
                          return (
                            <XStack gap="$m">
                              <View flex={1}>{children}</View>
                              <SigilAvatar
                                contactId={currentUserId}
                                width={56}
                                height={56}
                                borderRadius="$l"
                                size="custom"
                              />
                            </XStack>
                          );
                        }
                      : undefined
                  }
                  inputProps={{ placeholder: nicknamePlaceholder }}
                  rules={{
                    maxLength: {
                      value: 30,
                      message: 'Your nickname is limited to 30 characters',
                    },
                  }}
                />
              </View>
            </XStack>

            <ControlledImageField
              label="Avatar image"
              name="avatarImage"
              hideError={true}
              control={control}
              inputProps={{
                buttonLabel: 'Change avatar image',
                placeholderUri: avatarPlaceholder,
              }}
              rules={{
                pattern: {
                  value: /^(?!file).+/,
                  message: 'Image has not finished uploading',
                },
              }}
            />

            {isCurrUser ? (
              <>
                <ControlledTextField
                  name="status"
                  label="Status"
                  control={control}
                  inputProps={{
                    placeholder: 'Hanging out...',
                  }}
                  rules={{
                    maxLength: {
                      value: 50,
                      message: 'Your status is limited to 50 characters',
                    },
                  }}
                />
                <ControlledTextareaField
                  name="bio"
                  label="Bio"
                  control={control}
                  inputProps={{
                    placeholder: 'About yourself',
                    numberOfLines: 5,
                    multiline: true,
                  }}
                  rules={{
                    maxLength: {
                      value: 300,
                      message: 'Your bio is limited to 300 characters',
                    },
                  }}
                />
                <Field label="Pinned groups">
                  <FavoriteGroupsDisplay
                    groups={pinnedGroups}
                    onUpdate={handleUpdatePinnedGroups}
                  />
                </Field>
                <Field label="Pinned Tunes">
                  <EditPinnedTunesWidget
                    tunes={pinnedTunes}
                    onAddTune={() => props.onGoToAddProfileAudio()}
                  />
                </Field>
                <Field label="Location">
                  <LocationPicker
                    initialLocation={initialLocation}
                    onLocationChange={setLocation}
                  />
                </Field>
                <Field label="Links">
                  <EditPinnedLinksWidget
                    links={pinnedLinks}
                    onAddLink={props.onGoToEditLinks}
                  />
                </Field>
                <Field label="Pinned Posts">
                  <EditPinnedPostsWidget
                    posts={pinnedPosts}
                    onRemovePost={handleRemovePinnedPost}
                  />
                </Field>
              </>
            ) : (
              <>
                <BioDisplay
                  bio={userContact?.bio ?? ''}
                  backgroundColor="$secondaryBackground"
                />
                <PinnedGroupsDisplay
                  groups={pinnedGroups ?? []}
                  onPressGroup={() => {}}
                  itemProps={{ backgroundColor: '$secondaryBackground' }}
                />
              </>
            )}
          </FormFrame>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function EditPinnedTunesWidget(props: {
  tunes: domain.NormalizedTrack[];
  onAddTune?: () => void;
}) {
  const player = useAudioPlayer();
  return (
    <YStack
      marginTop="$m"
      gap="$l"
      borderWidth={1}
      borderColor="$border"
      padding="$m"
      borderRadius="$l"
      justifyContent="center"
    >
      {props.tunes.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          marginTop="$l"
        >
          <View marginLeft="$m" flexDirection="row" gap="$l">
            {props.tunes.map((tune) => (
              <MiniPlayableTrack
                key={tune.id}
                track={tune}
                player={player}
                size={50}
              />
            ))}
          </View>
        </ScrollView>
      )}
      <Pressable onPress={props.onAddTune}>
        <ListItem padding="$m" backgroundColor="$unset">
          <ListItem.MainContent>
            <ListItem.Title>Select tunes</ListItem.Title>
          </ListItem.MainContent>
          <ListItem.EndContent>
            <ListItem.SystemIcon icon="ChevronRight" backgroundColor="$unset" />
          </ListItem.EndContent>
        </ListItem>
      </Pressable>
    </YStack>
  );
}

function EditPinnedLinksWidget(props: {
  links: domain.ProfileLink[];
  onAddLink?: () => void;
}) {
  return (
    <YStack
      marginTop="$m"
      gap="$l"
      borderWidth={1}
      borderColor="$border"
      padding="$m"
      borderRadius="$l"
      justifyContent="center"
    >
      {/* {props.links.length > 0 && (
        <XStack gap="$m">
          {props.links.map((link) => (
            <ProfileLinkDisplay key={link.url} link={link} />
          ))}
        </XStack>
      )} */}
      {props.links.length > 0 && (
        <Text marginTop="$2xl" marginLeft="$m" size="$label/l">
          You have {props.links.length} Pinned Links
        </Text>
      )}
      <Pressable onPress={props.onAddLink}>
        <ListItem padding="$m" backgroundColor="$unset">
          <ListItem.MainContent>
            <ListItem.Title>Select links</ListItem.Title>
          </ListItem.MainContent>
          <ListItem.EndContent>
            <ListItem.SystemIcon icon="ChevronRight" backgroundColor="$unset" />
          </ListItem.EndContent>
        </ListItem>
      </Pressable>
    </YStack>
  );
}

function EditPinnedPostsWidget(props: {
  posts: db.ContactPinnedPost[];
  onRemovePost: (postId: string) => void;
}) {
  return (
    <YStack
      marginTop="$m"
      gap="$l"
      borderWidth={1}
      borderColor="$border"
      padding="$m"
      borderRadius="$l"
      justifyContent="center"
    >
      {props.posts.length > 0 ? (
        <PinnedPostsDisplay
          pinnedPosts={props.posts}
          isLoading={false}
          removable
          onRemove={props.onRemovePost}
          defaultVertical={false}
        />
      ) : (
        <Text paddingVertical="$xl" paddingLeft="$m" size="$label/l">
          You have no pinned posts
        </Text>
      )}
    </YStack>
  );
}
