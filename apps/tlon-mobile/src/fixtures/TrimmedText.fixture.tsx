// tamagui-ignore
import { ScrollView, Text, View, YStack } from '@tloncorp/ui';
import {
  BigTitleText,
  BodyText,
  Emoji,
  LabelText,
  MonoText,
} from '@tloncorp/ui/src/components/TrimmedText';
import { PropsWithChildren } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FixtureWrapper } from './FixtureWrapper';

const TrimmedTextFixture = () => {
  const insets = useSafeAreaInsets();
  return (
    <FixtureWrapper
      fillHeight
      fillWidth
      verticalAlign="center"
      horizontalAlign="center"
      backgroundColor="yellow"
    >
      <ScrollView
        flex={1}
        automaticallyAdjustContentInsets={true}
        contentContainerStyle={{
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 100,
          paddingHorizontal: 24,
        }}
      >
        <YStack gap="$4xl">
          {[true, false].map((trimmed, index) => {
            return (
              <YStack key={index} gap="$2xl">
                <Text fontSize="$m" color="$tertiaryText">
                  {trimmed ? 'Trimmed' : 'Untrimmed'}
                </Text>
                <YStack key={index} gap="$2xl">
                  <YStack gap="$l">
                    {(['$s', '$m', '$l', '$xl', '$2xl'] as const).map(
                      (size) => (
                        <TextSpecimen type="label" size={size} key={size}>
                          <LabelText trimmed={trimmed} size={size} key={size}>
                            {message}
                          </LabelText>
                        </TextSpecimen>
                      )
                    )}
                  </YStack>
                  <YStack gap="$l">
                    {(['$s', '$m'] as const).map((size) => (
                      <TextSpecimen type="MonoText" size={size} key={size}>
                        <MonoText trimmed={trimmed} size={size} key={size}>
                          {message}
                        </MonoText>
                      </TextSpecimen>
                    ))}
                  </YStack>
                  <YStack gap="$l">
                    <TextSpecimen type="BodyText" size={'default'}>
                      <BodyText trimmed={trimmed}>{message}</BodyText>
                    </TextSpecimen>
                  </YStack>
                  <YStack gap="$l">
                    <TextSpecimen type="BigTitleText" size="default">
                      <BigTitleText trimmed={trimmed}>{message}</BigTitleText>
                    </TextSpecimen>
                  </YStack>
                  <YStack gap="$l">
                    {(['$m', '$l'] as const).map((size) => (
                      <TextSpecimen type="Emoji" size={size} key={size}>
                        <Emoji trimmed={trimmed} size={size} key={size}>
                          🥹🥹🥹
                        </Emoji>
                      </TextSpecimen>
                    ))}
                  </YStack>
                </YStack>
              </YStack>
            );
          })}
        </YStack>
      </ScrollView>
    </FixtureWrapper>
  );
};

const TextSpecimen = ({
  type,
  size,
  children,
}: PropsWithChildren<{ type: string; size: string }>) => {
  return (
    <YStack gap="$xs">
      <Text fontSize="$xs" color="$tertiaryText">{`${type}: ${size}`}</Text>
      <View backgroundColor={'$secondaryBackground'}>{children}</View>
    </YStack>
  );
};

const message = 'Flying fixjIilitnamq';

export default <TrimmedTextFixture />;
