import type { IconType } from '@tloncorp/ui';
import * as icons from '@tloncorp/ui/assets/icons';

// Module metadata that shows up as a real own key under CJS interop but is not
// an icon.
const NON_ICON_KEYS = new Set(['__esModule', 'default']);

/**
 * Build an icon-name resolver bound to a module namespace.
 *
 * Whatever the resolver returns is looked up in that namespace and rendered as
 * a React component, so the lookup has to be exact. `name in ns` would not do:
 * under Babel/CJS interop the namespace carries `__esModule` and inherits
 * `constructor`/`toString`/`__proto__`, all of which pass an `in` check and
 * would then be mounted by the renderer — a typo'd `icon: "__esModule"` would
 * crash the composer rather than fall back to the default glyph. Hence
 * membership is own-enumerable keys (`Object.keys`) minus that metadata.
 *
 * It deliberately ignores the *value*: an icon is a component in the app but a
 * string under the test runner's SVG transform, so a shape check would reject
 * every real icon in one of those worlds.
 */
export function makeIconResolver(namespace: object) {
  const iconNames = new Set(
    Object.keys(namespace).filter((key) => !NON_ICON_KEYS.has(key))
  );
  return function toIconType(name?: string): IconType {
    return name && iconNames.has(name) ? (name as IconType) : 'Command';
  };
}

export const toIconType = makeIconResolver(icons);
