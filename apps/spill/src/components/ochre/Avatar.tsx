import React, {useMemo} from 'react';
import {SizeTokens, styled} from 'tamagui';
import {phonemeIndexes} from '../../utils/phonemes';
import {Stack, YStack} from './core';

function phonemeToColor(phoneme: string) {
  const index = phonemeIndexes[phoneme];
  if (typeof index === 'undefined') {
    throw new Error('Invalid phoneme: ' + phoneme);
  }
  const octalNum = index.toString(8).padStart(3, '0');
  const redOctal = parseInt(octalNum[0] ?? '0', 8);
  const greenOctal = parseInt(octalNum[1] ?? '0', 8);
  const blueOctal = parseInt(octalNum[2] ?? '0', 8);
  const red = Math.floor((redOctal / 7) * 255);
  const green = Math.floor((greenOctal / 7) * 255);
  const blue = Math.floor((blueOctal / 7) * 255);
  return `rgb(${red}, ${green}, ${blue})`;
}

function getIdColors(id: string) {
  return id
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .match(/.{1,3}/g)
    ?.map(phonemeToColor);
}

export const Avatar = Stack.styleable<{id: string; size: SizeTokens}>(
  ({id, size, ...props}, ref) => {
    const colors = useMemo(() => {
      return getIdColors(id) ?? [];
    }, [id]);

    const xScale = colors.length < 3 ? '100%' : '50%';
    const yScale = colors.length < 2 ? '100%' : '50%';

    return (
      <AvatarContainer
        sunny={true}
        width={size}
        height={size}
        ref={ref}
        {...props}>
        {colors?.map((color, index) => (
          <Stack
            key={index}
            //@ts-ignore we want to be able to use arbitrary colors
            backgroundColor={color}
            width={xScale}
            height={yScale}
          />
        ))}
      </AvatarContainer>
    );
  },
  {
    staticConfig: {
      variants: {
        size: {
          '...size': (size, {tokens}) => {
            return {
              width: tokens.size[size] ?? size,
              height: tokens.size[size] ?? size,
            };
          },
        },
      } as const,
      defaultVariants: {
        size: '$m',
      },
    },
  },
);

const AvatarContainer = styled(YStack, {
  borderRadius: 2,
  flexWrap: 'wrap',
  alignItems: 'center',
  overflow: 'hidden',
  pressStyle: {
    backgroundColor: '$background',
  },
  variants: {
    sunny: {
      true: {
        backgroundColor: 'yellow',
      },
    },
  } as const,
});
