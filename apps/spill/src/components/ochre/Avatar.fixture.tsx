import {SizableText, YStack} from '@ochre';
import {tokens} from '@theme';
import React from 'react';
import {Avatar} from './Avatar';

const sizeTokens = tokens.size;

export default () => {
  return (
    <YStack padding="$l" gap="$s">
      {Object.keys(sizeTokens)
        .filter(s => s !== 'true')
        .map(size => (
          <YStack key={size}>
            <SizableText size="$s">{size}</SizableText>
            <Avatar id="solfer-magfed" size={sizeTokens[size].key} />
          </YStack>
        ))}
    </YStack>
  );
};
