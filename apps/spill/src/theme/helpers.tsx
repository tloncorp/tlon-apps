import {ColorProp, useStyle} from 'tamagui';

/**
 * Resolve a tamagui color prop in the context of the current theme.
 *
 * TODO: There's gotta be a better way to do this...
 */
export function useColorProp(color: ColorProp) {
  const style = useStyle({color}, {resolveValues: 'value'});
  return (style.color as string) ?? '#000';
}
