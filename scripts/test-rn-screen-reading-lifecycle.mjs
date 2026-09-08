/**
 * Existing14 lifecycle host controls against installed react-native-screens.
 * node scripts/test-rn-screen-reading-lifecycle.mjs [--source-root SCREENS_ROOT] [--report FILE]
 * Foundation listener code is real; UIKit navigation and React/keyboard sinks are modeled.
 */
import assert from 'node:assert/strict';
import { methodSource, runRNHostControls } from './lib/rn-host-controls.mjs';

const screenMethods = [
  '- (BOOL)nativeReadingVisible',
  '- (void)addNativeReadingLifecycleListener:(id<RNSNativeReadingLifecycleListener>)listener',
  '- (void)removeNativeReadingLifecycleListener:(id<RNSNativeReadingLifecycleListener>)listener',
  '- (BOOL)setNativeReadingVisible:(BOOL)visible',
  '- (void)notifyWillDisappear',
  '- (void)notifyAppear',
  '- (void)notifyGestureCancel',
];
const controllerMethod = '- (void)viewDidAppear:(BOOL)animated';

runRNHostControls({
  name: 'rn-screen-reading-lifecycle',
  sourcePackage: 'react-native-screens',
  sourceManifest: new URL('../apps/tlon-mobile/package.json', import.meta.url),
  expectedCount: 14,
  recordsKey: 'records',
  passField: 'passed',
  boundary:
    'Exact installed seven RNSScreenView methods, controller viewDidAppear and Foundation lifecycle helper. Named UIKit controller, React event, interaction and keyboard sinks are modeled. Window-detach and will-appear wiring are source assertions only. No UIKit navigation, app/provider, Fabric or presentation proof.',
  prepare({ readSource, readFixture, writeInput }) {
    const source = readSource('ios/RNSScreen.mm');
    const header = readSource('ios/RNSScreen.h');
    writeInput(
      'RNSNativeReadingLifecycle.h',
      readSource('ios/RNSNativeReadingLifecycle.h')
    );
    writeInput(
      'RNSNativeReadingLifecycle.mm',
      readSource('ios/RNSNativeReadingLifecycle.mm')
    );
    // Match the frozen Python extractor's separator bytes without rewriting a method.
    const methods = (signatures) =>
      signatures
        .map((signature) => methodSource(source, signature).slice(0, -2))
        .join('\n\n') + '\n';
    writeInput('actual-screen-methods.inc', methods(screenMethods));
    writeInput('actual-controller-methods.inc', methods([controllerMethod]));
    writeInput(
      'controls.mm',
      readFixture(
        new URL(
          './fixtures/rn-screen-reading-lifecycle.controls.mm',
          import.meta.url
        )
      )
    );
    assert.ok(
      methodSource(source, '- (void)didMoveToWindow').startsWith(
        '- (void)didMoveToWindow\n{\n  if (!self.window) [self setNativeReadingVisible:NO];\n'
      ),
      'Window detach must retire native visibility'
    );
    assert.ok(
      !methodSource(source, '- (void)notifyWillAppear').includes(
        'setNativeReadingVisible:'
      ),
      'Will-appear must not admit a reading visit'
    );
    assert.ok(header.includes('RNSNativeReadingLifecycle.h'));
    assert.ok(header.includes('nativeReadingVisible'));
    return {
      frameworks: ['Foundation'],
      translationUnits: ['controls.mm', 'RNSNativeReadingLifecycle.mm'],
      metadata: {
        actualMethods: [...screenMethods, controllerMethod],
        sourceOnlyBoundaries: [
          'window detach retirement',
          'will-appear does not admit',
          'public header wiring',
        ],
      },
    };
  },
});
