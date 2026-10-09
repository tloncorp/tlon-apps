import * as babel from '@babel/core';
import tamaguiBabelPlugin from '@tamagui/babel-plugin';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

import { trimOverrides } from '../src/components/TextV2/trimOverrides';
import { trimAndroid, trimIos } from '../src/components/TextV2/trimSettings';
import androidTextStyles from './androidTextStyles.cjs';

const uiRoot = path.resolve(__dirname, '..');

const iosTrim = (size: keyof typeof trimIos) => ({
  ...trimIos[size],
  ...(trimOverrides.ios as Record<string, object>)[size],
});
const androidTrim = (size: keyof typeof trimAndroid) => ({
  ...trimAndroid[size],
  ...(trimOverrides.android as Record<string, object>)[size],
});

function transform(code: string, plugins: babel.PluginItem[]) {
  return babel.transformSync(code, {
    babelrc: false,
    configFile: false,
    cwd: uiRoot,
    filename: path.join(uiRoot, 'src/AndroidTextStylesFixture.tsx'),
    parserOpts: { plugins: ['jsx', 'typescript'] },
    plugins,
  })!.code!;
}

describe('androidTextStyles', () => {
  test('maps every iOS text size and font to its Android value', () => {
    const { trims, fontFamilies: families } =
      androidTextStyles.buildReplacements(babel);
    for (const size of Object.keys(trimIos) as (keyof typeof trimIos)[]) {
      const ios = iosTrim(size);
      expect(trims.get(`${ios.marginTop}|${ios.marginBottom}`)).toEqual(
        androidTrim(size)
      );
    }
    expect(families.get('System-Monospaced')).toBe('monospace');
    expect(families.has('System')).toBe(false);
  });

  test('rewrites the compiler sheet and leaves other styles alone', () => {
    const ios = iosTrim('$label/m');
    const android = androidTrim('$label/m');
    const code = transform(
      `const __ReactNativeStyleSheet = require('react-native').StyleSheet;
       const _sheet = __ReactNativeStyleSheet.create({
         "0": { marginTop: ${ios.marginTop}, marginBottom: ${ios.marginBottom}, fontSize: 14, fontFamily: "System-Monospaced" },
         "1": { marginTop: -3, marginBottom: -4, fontFamily: "System" },
       });
       const other = { marginTop: ${ios.marginTop}, marginBottom: ${ios.marginBottom} };`,
      [androidTextStyles]
    );
    expect(code).toContain(
      `marginTop: ${android.marginTop},\n    marginBottom: ${android.marginBottom}`
    );
    expect(code).toContain('fontFamily: "monospace"');
    expect(code).toContain('marginTop: -3,\n    marginBottom: -4');
    expect(code).toContain('fontFamily: "System"');
    expect(code).toContain(
      `other = {\n  marginTop: ${ios.marginTop},\n  marginBottom: ${ios.marginBottom}`
    );
  });

  // Runs the real Tamagui compiler, so a Tamagui upgrade that changes how it
  // bakes styles fails here rather than silently shipping wrong values.
  test('fixes the values the Tamagui compiler bakes for native', () => {
    const fixture = `
      import { Text } from '@tloncorp/ui';
      import { View } from 'tamagui';
      export function Fixture() {
        return (
          <View paddingHorizontal="$xl">
            <Text size="$label/m" fontFamily="$mono">hi</Text>
          </View>
        );
      }`;
    const tamagui = [
      tamaguiBabelPlugin,
      {
        config: './tamagui.config.ts',
        components: ['tamagui', '@tloncorp/ui'],
      },
    ];
    const sheet = (code: string) =>
      code.match(/__ReactNativeStyleSheet\.create\(([\s\S]*?)\);/)?.[1] ?? '';

    const ios = iosTrim('$label/m');
    const iosSheet = sheet(transform(fixture, [tamagui]));
    expect(iosSheet).toContain('"paddingLeft": 16');
    expect(iosSheet).toContain(`"marginTop": ${ios.marginTop}`);
    expect(iosSheet).toContain('"fontFamily": "System-Monospaced"');

    const android = androidTrim('$label/m');
    const androidSheet = sheet(
      transform(fixture, [tamagui, androidTextStyles])
    );
    expect(androidSheet).toContain('"paddingLeft": 16');
    expect(androidSheet).toContain(`"marginTop": ${android.marginTop}`);
    expect(androidSheet).toContain('"fontFamily": "monospace"');
  }, 60_000);
});
