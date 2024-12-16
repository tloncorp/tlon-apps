import * as domain from '@tloncorp/shared/domain';
import * as logic from '@tloncorp/shared/logic';
import { useCallback, useEffect, useState } from 'react';
import { Keyboard } from 'react-native';
import { ScrollView, View, YStack } from 'tamagui';

import { useStore } from '../contexts';
import { triggerHaptic } from '../utils';
import { Button } from './Button';
import { Field, TextInput, TextInputWithIcon } from './Form';
import { IconType } from './Icon';
import { ListItem } from './ListItem';
import { ScreenHeader } from './ScreenHeader';

interface Props {
  onGoBack: () => void;
  initialLinks?: domain.ProfileLink[];
}

export function EditProfileLinksPane(props: Props) {
  const store = useStore();
  const [formState, setFormState] = useState<'initial' | 'setTitle'>('initial');
  const [links, setLinks] = useState<domain.ProfileLink[]>(
    props.initialLinks || []
  );
  const [link, setLink] = useState('');
  const [title, setTitle] = useState('');
  const [haveValidLink, setHaveValidLink] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    const initialKey = props.initialLinks?.map((link) => link.url).join('');
    const currentKey = links.map((link) => link.url).join('');
    setIsDirty(initialKey !== currentKey);
  }, [links, props.initialLinks]);

  const onChangeText = (nextLinkValue: string) => {
    setLink(nextLinkValue);
    if (isValidUrl(nextLinkValue)) {
      setHaveValidLink(true);
    }
  };

  const onSave = useCallback(() => {
    if (isDirty) {
      store.updateCurrentUserProfile({ links });
      props.onGoBack();
    }
  }, [links, isDirty, store, props]);

  const removeLink = useCallback((url: string) => {
    setLinks((prev) => prev.filter((link) => link.url !== url));
  }, []);

  const onPressAddLink = () => {
    triggerHaptic('baseButtonClick');
    console.log('addding link', link);
    try {
      const socialLink = logic.parseSocialLink(link);
      if (socialLink) {
        setLinks((prev) => [...prev, socialLink]);
        setFormState('initial');
        setLink('');
        setTitle('');
      } else {
        // otherwise, prompt the user to title the link
        setFormState('setTitle');
      }
    } catch (e) {
      console.error('error parsing link', e);
      setFormState('setTitle');
    }
  };

  const onTitleLink = () => {
    triggerHaptic('baseButtonClick');
    setLinks((prev) => [
      ...prev,
      {
        url: link,
        title,
      },
    ]);
    setFormState('initial');
    setLink('');
    setTitle('');
  };

  return (
    <View flex={1}>
      <ScreenHeader
        title="Profile Links"
        backAction={props.onGoBack}
        rightControls={
          <ScreenHeader.TextButton disabled={!isDirty} onPress={onSave}>
            Save
          </ScreenHeader.TextButton>
        }
      />
      <YStack marginTop="$m" gap="$l" paddingHorizontal="$xl">
        {formState === 'initial' && (
          <>
            <Field label="Link">
              <TextInputWithIcon
                fontSize="$s"
                icon="Link"
                placeholder="https://example.com"
                value={link}
                onChangeText={onChangeText}
                autoFocus
              />
            </Field>
            <Button hero disabled={!haveValidLink} onPress={onPressAddLink}>
              <Button.Text>Add Link</Button.Text>
            </Button>
          </>
        )}
        {formState === 'setTitle' && (
          <>
            <Field label="Link Preview">
              <TextInput
                placeholder="Optional title..."
                value={title}
                onChangeText={setTitle}
                maxLength={30}
                autoFocus
              />
            </Field>
            <Button hero disabled={!haveValidLink} onPress={onTitleLink}>
              <Button.Text>Use Title</Button.Text>
            </Button>
          </>
        )}
      </YStack>
      <ScrollView marginTop="$xl" flex={1} onTouchStart={Keyboard.dismiss}>
        {links.map((link) => (
          <ListItem key={link.url} marginHorizontal="$m">
            <ListItem.SystemIcon icon={getSocialIcon(link.socialPlatformId)} />
            <ListItem.MainContent>
              <ListItem.Title>
                {link.socialUserId
                  ? `${link.socialUserId}`
                  : link.title || link.url}
              </ListItem.Title>
            </ListItem.MainContent>
            <ListItem.EndContent onPress={() => removeLink(link.url)}>
              <ListItem.SystemIcon icon="Close" backgroundColor="$unset" />
            </ListItem.EndContent>
          </ListItem>
        ))}
      </ScrollView>
    </View>
  );
}

function isValidUrl(text: string) {
  const urlRegex = /^(https?:\/\/)[^\s$.?#].[^\s]*$/;
  return urlRegex.test(text);
}

export function getSocialIcon(
  profileId: domain.SocialPlatormId | undefined
): IconType {
  if (profileId === domain.SocialPlatormId.Instagram) {
    return 'LogoInstagram';
  }

  if (profileId === domain.SocialPlatormId.SoundCloud) {
    return 'LogoSoundcloud';
  }

  if (profileId === domain.SocialPlatormId.TikTok) {
    return 'LogoTiktok';
  }

  if (profileId === domain.SocialPlatormId.Twitter) {
    return 'LogoTwitter';
  }

  if (profileId === domain.SocialPlatormId.YouTube) {
    return 'LogoYoutube';
  }

  return 'Link';
}
