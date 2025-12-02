import { Text } from '@tloncorp/ui';
import { useSelect } from 'react-cosmos/client';
import { XStack, YStack } from 'tamagui';

import { bv2 } from '../ui';
import { FixtureWrapper } from './FixtureWrapper';

function ButtonRow({
  size,
  styleVariant,
  intent,
  disabled = false,
  loading = false,
  label = 'Label',
}: {
  size: bv2.ButtonSize;
  styleVariant: bv2.ButtonStyle;
  intent: bv2.ButtonRole;
  disabled?: boolean;
  loading?: boolean;
  label?: string;
}) {
  const width = size === 'large' ? 200 : size === 'medium' ? 160 : 120;

  return (
    <XStack gap="$m" alignItems="center" flexWrap="wrap">
      {/* Text only */}
      <bv2.Button
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
      <bv2.Button
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
      <bv2.Button
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
      <bv2.Button
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
      <bv2.Button
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
  size: bv2.ButtonSize;
  styleVariant: bv2.ButtonStyle;
  intent: bv2.ButtonRole;
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
  const [intent] = useSelect<bv2.ButtonRole>('Intent', {
    defaultValue: 'primary',
    options: ['primary', 'secondary', 'helper', 'positive', 'negative'],
  });
  const [styleVariant] = useSelect<bv2.ButtonStyle>('Style', {
    defaultValue: 'solid',
    options: ['solid', 'outline', 'ghost', 'text'],
  });

  const sizes: bv2.ButtonSize[] = ['large', 'medium', 'small'];

  return (
    <FixtureWrapper fillWidth safeArea={false}>
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
