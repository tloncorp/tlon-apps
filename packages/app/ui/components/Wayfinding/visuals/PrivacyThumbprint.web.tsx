import { View } from 'tamagui';

import { Squiggle } from '../../Squiggle';

const squiggles = new Array(120).fill(true);
export function PrivacyThumbprint() {
  return (
    <View
      flex={1}
      paddingTop="$4xl"
      justifyContent="flex-start"
      alignItems="center"
    >
      <View
        width={500}
        height={300}
        opacity={0.04}
        overflow="hidden"
        borderRadius="$2xl"
      >
        <View flex={1}>
          {squiggles.map((_item, index) => {
            return (
              <Squiggle
                key={index}
                height={600}
                width={600}
                position="absolute"
                top={-(440 - index * 4.5)}
                left={-(300 - index * 4.5)}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}
