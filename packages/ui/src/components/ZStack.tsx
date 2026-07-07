import React, {
  Children,
  ComponentProps,
  ElementRef,
  forwardRef,
  isValidElement,
} from 'react';
import { View, YStack } from 'tamagui';

export type ZStackProps = ComponentProps<typeof YStack>;

export const ZStack = forwardRef<ElementRef<typeof YStack>, ZStackProps>(
  function ZStack({ children, position = 'relative', ...props }, ref) {
    const childrenList = Children.toArray(children);

    return (
      <YStack ref={ref} position={position} {...props}>
        {childrenList.map((child, index) => (
          <View
            key={
              isValidElement(child) && child.key != null
                ? child.key
                : `${index}0t`
            }
            display="flex"
            flexDirection="column"
            position="absolute"
            top={0}
            right={0}
            bottom={0}
            left={0}
            pointerEvents="box-none"
          >
            {child}
          </View>
        ))}
      </YStack>
    );
  }
);

ZStack.displayName = 'ZStack';
