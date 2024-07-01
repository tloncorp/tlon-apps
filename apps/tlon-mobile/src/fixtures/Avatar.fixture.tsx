import {
  ImageAvatar,
  SigilAvatar,
  SizableText,
  SystemIconAvatar,
  TextAvatar,
  View,
  XStack,
  YStack,
} from '@tloncorp/ui';

import { FixtureWrapper } from './FixtureWrapper';
import { brianContact } from './fakeData';

const sizes = ['$xl', '$2xl', '$3xl', '$4xl', '$5xl'] as const;

const renderSigilAvatar = (size: (typeof sizes)[number]) => (
  <SigilAvatar key={size} size={size} contactId="~latter-bolden" />
);

const renderTextAvatar = (size: (typeof sizes)[number]) => (
  <TextAvatar key={size} size={size} text="B" />
);

const renderIconAvatar = (size: (typeof sizes)[number]) => (
  <SystemIconAvatar key={size} size={size} icon="Channel" />
);

const renderImageAvatar = (size: (typeof sizes)[number]) => (
  <ImageAvatar
    key={size}
    size={size}
    imageUrl={brianContact.avatarImage ?? undefined}
  />
);

export default (
  <FixtureWrapper fillWidth>
    <YStack gap="$l" padding="$l">
      {sizes.map((s) => {
        return (
          <View key={s}>
            <SizableText size="$s" color="$secondaryText">
              {s}
            </SizableText>
            <XStack gap="$l">
              {renderSigilAvatar(s)}
              {renderTextAvatar(s)}
              {renderIconAvatar(s)}
              {renderImageAvatar(s)}
            </XStack>
          </View>
        );
      })}
    </YStack>
  </FixtureWrapper>
);
