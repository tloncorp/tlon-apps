import type { IconType } from '@tloncorp/ui';
import * as icons from '@tloncorp/ui/assets/icons';

// Module metadata that shows up as a real own key under CJS interop but is not
// an icon.
const NON_ICON_KEYS = new Set(['__esModule', 'default']);

/**
 * Build an icon-name resolver bound to a module namespace.
 *
 * Icon names arrive inside a bot-published manifest, so this is a trust
 * boundary: whatever the resolver returns is looked up in that same namespace
 * and rendered as a React component.
 *
 * `name in ns` would not do. Under the native Babel/CJS interop the namespace
 * is an ordinary object carrying `__esModule` (a boolean) and inheriting
 * `constructor`, `toString` and `__proto__` — all of which pass an `in` check
 * and are then handed to the renderer, so a bot could crash the composer for a
 * whole conversation by publishing `icon: "__esModule"`. (A true ESM namespace
 * has a null prototype and no `__esModule`, which is why this is only reachable
 * in some builds — and why the tests inject a CJS-shaped namespace rather than
 * relying on whatever the test runner happens to produce.)
 *
 * Membership is an own-enumerable-key test (`Object.keys` skips the prototype
 * chain) minus that metadata. It deliberately does not inspect the *value*: an
 * icon is a component in the app but a string under the test runner's SVG
 * transform, so a shape check would reject every real icon in one of those
 * worlds.
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
