/**
 * READ admission host controls against installed RN sources (original45 plus resident transaction cases).
 * node scripts/test-rn-read-point.mjs [--source-root RN_ROOT] [--report FILE]
 * UIKit, native delivery and provider geometry remain modeled; no app registration/paint proof.
 */
import assert from 'node:assert/strict';
import { methodSource, runRNHostControls } from './lib/rn-host-controls.mjs';

const signatures = [
  '- (void)updateState:(const State::Shared &)state oldState:(const State::Shared &)oldState',
  '- (void)_preserveContentOffsetIfNeededWithBlock:(void (^)())block',
  '- (void)mountingTransactionWillMount:(const facebook::react::MountingTransaction &)transaction\n                withSurfaceTelemetry:(const facebook::react::SurfaceTelemetry &)surfaceTelemetry',
  '- (void)mountingTransactionDidMount:(const MountingTransaction &)transaction\n               withSurfaceTelemetry:(const facebook::react::SurfaceTelemetry &)surfaceTelemetry',
  '- (UIScrollView *)scrollView',
  '- (void)setScrollView:(UIScrollView *)scrollView',
  '- (void)beginReadPointLease:(std::shared_ptr<scroll_read::Provider>)provider',
  '- (void)invalidateReadPointLease',
  '- (scroll_read::Mount)_readPointMount:(const MountingTransaction &)transaction',
  '- (std::optional<scroll_read::Viewport>)_readPointViewport',
  '- (void)scrollTo:(double)x y:(double)y animated:(BOOL)animated',
  '- (void)_scrollTo:(double)x y:(double)y animated:(BOOL)animated preservingRead:(BOOL)preservingRead',
  '- (void)scrollToEnd:(BOOL)animated',
  '- (void)scrollToOffset:(CGPoint)offset animated:(BOOL)animated',
  '- (void)_scrollToOffset:(CGPoint)offset animated:(BOOL)animated preservingRead:(BOOL)preservingRead',
  '- (void)didMoveToWindow',
  '- (void)scrollViewWillBeginDragging:(UIScrollView *)scrollView',
  '- (void)scrollViewWillBeginDecelerating:(UIScrollView *)scrollView',
  '- (BOOL)scrollViewShouldScrollToTop:(UIScrollView *)scrollView',
  '- (void)_prepareForMaintainVisibleScrollPosition',
  '- (void)_adjustForMaintainVisibleContentPosition',
];
runRNHostControls({
  name: 'rn-read-point-handoff',
  expectedCount: 126,
  recordsKey: 'records',
  passField: 'passed',
  boundary:
    'Actual READ/FOLLOW coordinator and extracted RN content-size/mount methods; missing FOLLOW API is a no-op only in original-source controls; the old-source baseline adapter maps resident requests to the original immediate-begin API. UIKit properties/mounting, native delivery and provider point geometry modeled. Keyboard animation, recycle and zoom integration are source assertions only; no glyph provider, app registration, Fabric or presentation proof.',
  prepare({ readSource, readFixture, writeInput }) {
    const directory = 'React/Fabric/Mounting/ComponentViews/ScrollView/';
    const source = readSource(directory + 'RCTScrollViewComponentView.mm');
    const eventHeader = readSource(
      'ReactCommon/react/renderer/components/scrollview/ScrollEvent.h'
    );
    const eventSource = readSource(
      'ReactCommon/react/renderer/components/scrollview/ScrollEvent.cpp'
    );
    const emitter = readSource(
      'ReactCommon/react/renderer/components/scrollview/ScrollViewEventEmitter.cpp'
    );
    const eventQueue = readSource(
      'ReactCommon/react/renderer/core/EventQueue.cpp'
    );
    const ackStart = eventHeader.indexOf(
      'struct NativeReadPointAdjustmentAck {'
    );
    writeInput(
      'ack-type.inc',
      ackStart < 0
        ? 'struct NativeReadPointAdjustmentAck { std::string intent; uint64_t operationId; double startOffset,startAmount,amount,target; };'
        : eventHeader.slice(ackStart, eventHeader.indexOf('};', ackStart) + 2)
    );
    const cppMethod = (text, signature) =>
      methodSource(
        text.replace(signature + ' {', signature + '\n{'),
        signature
      );
    writeInput(
      'event-methods.inc',
      cppMethod(
        eventQueue,
        'void EventQueue::enqueueEvent(RawEvent&& rawEvent) const'
      ) +
        '\n' +
        cppMethod(
          emitter,
          'void ScrollViewEventEmitter::onScroll(const ScrollEvent& scrollEvent) const'
        )
    );
    if (ackStart >= 0) {
      assert.ok(
        eventHeader.includes(
          'std::optional<NativeReadPointAdjustmentAck> nativeReadPointAdjustmentAck'
        )
      );
      for (const key of [
        'intent',
        'operationId',
        'startOffset',
        'startAmount',
        'amount',
        'target',
      ])
        assert.ok(eventSource.includes('"' + key + '"'));
      assert.equal(
        eventSource.split('if (nativeReadPointAdjustmentAck)').length - 1,
        2,
        'both existing JSI and dynamic payload serializers include optional ACK'
      );
    }
    const header = readSource(directory + 'RCTScrollViewComponentView.h');
    const coordinator = readSource(
      directory + 'RCTScrollViewReadPointCoordinator.h'
    );
    writeInput(
      'actual-methods.inc',
      signatures.map((signature) => methodSource(source, signature)).join('') +
        (source.includes('- (void)beginFollowEndLease:')
          ? methodSource(
              source,
              '- (void)beginFollowEndLease:(NSString *)intent isCurrent:(std::function<bool()>)isCurrent'
            )
          : '- (void)beginFollowEndLease:(NSString *)intent isCurrent:(std::function<bool()>)isCurrent { (void)intent; (void)isCurrent; }\n') +
        (source.includes(
          '- (void)beginReadPointLeaseFromResident:(NSString *)intent'
        )
          ? [
              '- (void)setReadPointProviderFactory:(std::function<std::shared_ptr<scroll_read::Provider>()>)factory',
              '- (void)beginReadPointLeaseFromResident:(NSString *)intent',
              '- (scroll_read::RelativeSignal)_readPointRelativeSignal',
              '- (NSDictionary *)readPointDiagnostic',
            ]
              .map((signature) => methodSource(source, signature))
              .join('')
          : `
// Baseline adapter maps resident begin to the installed immediate-begin API; no candidate logic is modeled.
- (void)setReadPointProviderFactory:(std::function<std::shared_ptr<Provider>()>)factory { baselineFactory = std::move(factory); }
- (void)beginReadPointLeaseFromResident:(NSString *)intent { if(baselineFactory) [self beginReadPointLease:baselineFactory()]; }
- (NSDictionary *)readPointDiagnostic { return @{}; }
- (RelativeSignal)_readPointRelativeSignal { return {}; }
`)
    );
    writeInput(
      'RCTScrollViewReadPointCoordinator.h',
      coordinator +
        (coordinator.includes('struct RelativeSignal')
          ? ''
          : '\nnamespace facebook::react::scroll_read { struct RelativeSignal {}; }\n')
    );
    writeInput(
      'controls.mm',
      (source.includes('props.nativeReadPointAdjustment')
        ? '#define HAS_TAGGED_READ 1\n'
        : '') +
        readFixture(
          new URL('./fixtures/rn-read-point.controls.mm', import.meta.url)
        )
    );
    if (source.includes('props.nativeReadPointAdjustment')) {
      const plumbing = [
        [
          'Libraries/Components/ScrollView/ScrollView.js',
          'nativeReadPointAdjustment?: ?string',
        ],
        [
          'Libraries/Components/ScrollView/ScrollViewNativeComponentType.js',
          'nativeReadPointAdjustment?: ?string',
        ],
        [
          'Libraries/Components/ScrollView/ScrollViewNativeComponent.js',
          'nativeReadPointAdjustment: true',
        ],
        [
          'Libraries/Components/ScrollView/ScrollView.d.ts',
          'nativeReadPointAdjustment?: string',
        ],
        [
          'ReactCommon/react/renderer/components/scrollview/BaseScrollViewProps.h',
          'std::string nativeReadPointAdjustment',
        ],
        [
          'ReactCommon/react/renderer/components/scrollview/BaseScrollViewProps.cpp',
          'RAW_SET_PROP_SWITCH_CASE_BASIC(nativeReadPointAdjustment)',
        ],
      ];
      for (const [file, marker] of plumbing)
        assert.ok(
          readSource(file).includes(marker),
          `Missing native prop plumbing: ${file}`
        );
      assert.ok(
        readSource(
          'ReactCommon/react/renderer/components/scrollview/BaseScrollViewProps.cpp'
        ).includes(
          'rawProps, "nativeReadPointAdjustment", sourceProps.nativeReadPointAdjustment'
        )
      );
    }
    // Preserve the source-only wiring checks in the original extraction script.
    assert.ok(
      source.includes(
        '[self _scrollTo:newContentOffset.x y:newContentOffset.y animated:NO preservingRead:YES];'
      )
    );
    assert.equal(
      source.split('animated:NO preservingRead:YES];').length - 1,
      1
    );
    for (const signature of [
      '- (void)prepareForRecycle',
      '- (void)zoomToRect:(CGRect)rect animated:(BOOL)animated',
    ]) {
      assert.ok(
        methodSource(source, signature).startsWith(
          `${signature}\n{\n  [self invalidateReadPointLease];\n`
        ),
        `Missing READ retirement: ${signature}`
      );
    }
    assert.ok(
      header.includes('RCTScrollViewReadPointCoordinator.h') &&
        header.includes('beginReadPointLease:')
    );
    assert.match(source, /scroll_read::Coordinator _readPointCoordinator;/);
    return {
      frameworks: ['Foundation', 'CoreGraphics'],
      translationUnits: ['controls.mm'],
      metadata: {
        actualMethods: signatures,
        sourceOnlyBoundaries: [
          'passive keyboard call',
          'recycle invalidation',
          'zoom invalidation',
          'coordinator/public header wiring',
        ],
      },
    };
  },
});
