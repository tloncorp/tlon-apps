// tamagui-ignore
import { ScrollView, View, XStack, YStack } from '@tloncorp/ui';
import { FontStyle, Text } from '@tloncorp/ui/src/components/TextV2';
import { useCopy } from '@tloncorp/ui/src/hooks/useCopy';
import { PropsWithChildren, useCallback, useEffect, useState } from 'react';
import React from 'react';
import {
  NativeSyntheticEvent,
  StyleSheet,
  TextLayoutEventData,
  TextLayoutLine,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { styled } from 'tamagui';

import { FixtureWrapper } from './FixtureWrapper';

const textStyles: FontStyle[] = [
  '$mono/s',
  '$mono/m',
  '$emoji/m',
  '$emoji/l',
  '$label/s',
  '$label/m',
  '$label/l',
  '$label/xl',
  '$label/2xl',
  '$label/3xl',
  '$body',
  '$title/l',
];

type FontConfig = Record<
  FontStyle,
  { marginTop: number; marginBottom: number }
>;

const TrimmedTextFixture = () => {
  const insets = useSafeAreaInsets();

  const [info, setInfo] = useState<Partial<FontConfig>>({});
  const handleInfoUpdated = useCallback(
    (fontStyle: FontStyle, info: FontInfo) => {
      setInfo((prev) => ({
        ...prev,
        [fontStyle]: {
          marginTop: info.marginTop,
          marginBottom: info.marginBottom,
        },
      }));
    },
    []
  );
  const { doCopy, didCopy } = useCopy(JSON.stringify(info, null, 2));

  return (
    <FixtureWrapper fillHeight fillWidth>
      <ScrollView
        flex={1}
        automaticallyAdjustContentInsets={true}
        contentContainerStyle={{
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 100,
          paddingHorizontal: 24,
        }}
      >
        <View onPress={doCopy} padding={10}>
          <Text size="$label/s">
            {didCopy ? 'Copied!' : 'Copy margin settings'}
          </Text>
        </View>
        <YStack gap="$4xl">
          {textStyles.map((size) => {
            return (
              <TextSpecimen
                fontStyle={size}
                key={size}
                onInfoUpdated={handleInfoUpdated}
              />
            );
          })}
        </YStack>
      </ScrollView>
    </FixtureWrapper>
  );
};

type TextMeasures = {
  baseline: number;
  descender: number;
  xHeight: number;
  capHeight: number;
  height: number;
};

type FontInfo = {
  metrics: TextLayoutLine;
  measures: TextMeasures;
  offset: number;
  marginTop: number;
  marginBottom: number;
};

const TextSpecimen = React.memo(function TextSpecimenInner({
  fontStyle: size,
  onInfoUpdated,
}: PropsWithChildren<{
  fontStyle: FontStyle;
  onInfoUpdated: (fontStyle: FontStyle, info: FontInfo) => void;
}>) {
  const [info, setInfo] = useState<FontInfo | null>(null);

  const handleLayout = (e: NativeSyntheticEvent<TextLayoutEventData>) => {
    const metrics = e.nativeEvent.lines[0];
    const { y, ascender, descender, xHeight, capHeight, height } = metrics;

    const measures = {
      baseline: y + ascender,
      descender: y + ascender + descender,
      xHeight: y + ascender - xHeight,
      capHeight: y + ascender - capHeight,
      height,
    };

    const offset =
      measures.height > measures.descender
        ? (measures.height - measures.descender) / 2
        : -(measures.descender - measures.height);

    const margins = {
      marginTop: -(measures?.capHeight + offset),
      marginBottom: -(measures.height - (measures?.baseline + offset)),
    };

    setInfo({
      metrics,
      measures,
      offset,
      ...margins,
    });
  };

  useEffect(() => {
    if (info) {
      onInfoUpdated?.(size, info);
    }
  }, [info, onInfoUpdated, size]);

  return (
    <YStack gap="$l">
      <Text fontSize="$xs" color="$tertiaryText">{`${size}`}</Text>
      <View backgroundColor={'$secondaryBackground'}>
        <Text
          trimmed={false}
          numberOfLines={1}
          onTextLayout={handleLayout}
          size={size}
          key={size}
          marginTop={info?.marginTop}
          marginBottom={info?.marginBottom}
        >
          {message}
        </Text>
      </View>
      <View backgroundColor={'$secondaryBackground'}>
        <Text
          numberOfLines={1}
          trimmed={false}
          onTextLayout={handleLayout}
          size={size}
        >
          {message}
        </Text>
        {info && (
          <>
            <Metric
              top={info.measures.baseline + info.offset}
              color="red"
              label="Baseline"
            />
            <Metric
              top={info.measures.descender + info.offset}
              color="blue"
              label="Descender"
            />
            <Metric
              top={info.measures.capHeight + info.offset}
              color="green"
              label="Capheight"
            />
            <Metric
              top={info.measures.xHeight + info.offset}
              color="purple"
              label="X-height"
            />
          </>
        )}
      </View>
      {info && (
        <XStack gap={10}>
          <View>
            <Text fontSize={8} color="$tertiaryText">
              size
            </Text>
            {Object.entries(info.metrics)
              .filter(([k]) => !['text', 'x', 'y', 'width'].includes(k))
              .map(([key, value]) => (
                <Text key={key} fontSize={8} color="$tertiaryText">
                  {key}: {value}
                </Text>
              ))}
          </View>
          <View>
            <Text fontSize={8} color="$tertiaryText">
              position
            </Text>
            {Object.entries({
              ...info.measures,
              offset: info.offset,
              margingTop: info.marginTop,
              marginBottom: info.marginBottom,
            })
              .filter(([k]) => !['text', 'x', 'y', 'width'].includes(k))
              .map(([key, value]) => (
                <Text key={key} fontSize={8} color="$tertiaryText">
                  {key}: {value}
                </Text>
              ))}
          </View>
        </XStack>
      )}
    </YStack>
  );
});

function Metric({
  top,
  color,
  label,
}: {
  top: number;
  color: string;
  label: string;
}) {
  return (
    <>
      <MetricRule key="descender rule" borderColor={color} top={top} />
      <MetricLabel key={'descender text'} top={top} color={color}>
        {label}
      </MetricLabel>
    </>
  );
}

const MetricLabel = styled(Text, {
  position: 'absolute',
  fontSize: 6,
  right: 0,
});

const MetricRule = styled(View, {
  position: 'absolute',
  right: 0,
  left: 0,
  borderBottomWidth: StyleSheet.hairlineWidth,
});

const message = 'Flying fixjItnamq 🙏🤪🥵';

export default <TrimmedTextFixture />;
