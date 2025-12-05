import {
  Button,
  ButtonIntent,
  ButtonSize,
  ButtonStyle,
  Text,
} from '@tloncorp/ui';
import { useSelect } from 'react-cosmos/client';
import { ColorTokens, XStack, YStack } from 'tamagui';

import { FixtureWrapper } from './FixtureWrapper';

function ButtonRow({
  size,
  styleVariant,
  intent,
  disabled = false,
  loading = false,
  label = 'Label',
}: {
  size: ButtonSize;
  styleVariant: ButtonStyle;
  intent: ButtonIntent;
  disabled?: boolean;
  loading?: boolean;
  label?: string;
}) {
  const width = size === 'large' ? 200 : size === 'medium' ? 160 : 120;

  return (
    <XStack gap="$m" alignItems="center" flexWrap="wrap">
      {/* Text only */}
      <Button
        fill={styleVariant}
        type={intent}
        size={size}
        disabled={disabled}
        loading={loading}
        width={width}
        label={label}
        centered
      />

      {/* Trailing icon */}
      <Button
        fill={styleVariant}
        type={intent}
        size={size}
        disabled={disabled}
        loading={loading}
        width={width}
        label={label}
        trailingIcon="Placeholder"
      />

      {/* Leading icon */}
      <Button
        fill={styleVariant}
        type={intent}
        size={size}
        disabled={disabled}
        loading={loading}
        width={width}
        label={label}
        leadingIcon="Placeholder"
      />

      {/* Leading and trailing icons */}
      <Button
        fill={styleVariant}
        type={intent}
        size={size}
        disabled={disabled}
        loading={loading}
        width={width}
        label={label}
        leadingIcon="Placeholder"
        trailingIcon="Placeholder"
      />

      {/* Icon only */}
      <Button
        fill={styleVariant}
        type={intent}
        size={size}
        disabled={disabled}
        loading={loading}
        trailingIcon="Placeholder"
      />
    </XStack>
  );
}

function SizeBlock({
  size,
  styleVariant,
  intent,
}: {
  size: ButtonSize;
  styleVariant: ButtonStyle;
  intent: ButtonIntent;
}) {
  return (
    <YStack gap="$l">
      <Text size="$label/l" color="$secondaryText">
        {size.toUpperCase()}
      </Text>

      {/* Default */}
      <YStack gap="$xs">
        <Text size="$label/m" color="$tertiaryText">
          default
        </Text>
        <ButtonRow size={size} styleVariant={styleVariant} intent={intent} />
      </YStack>

      {/* Loading */}
      <YStack gap="$xs">
        <Text size="$label/m" color="$tertiaryText">
          loading
        </Text>
        <ButtonRow
          size={size}
          styleVariant={styleVariant}
          intent={intent}
          loading
          label="Loading"
        />
      </YStack>

      {/* Disabled */}
      <YStack gap="$xs">
        <Text size="$label/m" color="$tertiaryText">
          disabled
        </Text>
        <ButtonRow
          size={size}
          styleVariant={styleVariant}
          intent={intent}
          disabled
        />
      </YStack>
    </YStack>
  );
}

export default function ButtonV2Fixture() {
  const [intent] = useSelect<ButtonIntent>('Intent', {
    defaultValue: 'primary',
    options: [
      'primary',
      'secondary',
      'helper',
      'positive',
      'negative',
      'notice',
    ],
  });
  const [styleVariant] = useSelect<ButtonStyle>('Style', {
    defaultValue: 'solid',
    options: ['solid', 'outline', 'ghost', 'text'],
  });

  const sizes: ButtonSize[] = ['large', 'medium', 'small'];

  // Notice intent is designed for dark backgrounds
  const isNoticeIntent = intent === 'notice';

  return (
    <FixtureWrapper
      fillWidth
      safeArea={false}
      backgroundColor={
        isNoticeIntent ? ('$systemNoticeBackground' as ColorTokens) : undefined
      }
      innerBackgroundColor={
        isNoticeIntent ? ('$systemNoticeBackground' as ColorTokens) : undefined
      }
    >
      <YStack gap="$2xl" padding="$l">
        {sizes.map((size) => (
          <SizeBlock
            key={size}
            size={size}
            styleVariant={styleVariant}
            intent={intent}
          />
        ))}
      </YStack>
    </FixtureWrapper>
  );
}
