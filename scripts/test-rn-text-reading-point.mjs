/**
 * 73 TextKit query and Paragraph ownership host controls against installed RN helper/manager sources.
 * node scripts/test-rn-text-reading-point.mjs [--source-root RN_ROOT] [--report FILE]
 * Only the existing UIKit→AppKit header shim and RN argument/factory adapter apply.
 * This is host TextKit, not UIKit rendering or mounted Paragraph/Fabric proof.
 */
import assert from 'node:assert/strict';
import { runRNHostControls } from './lib/rn-host-controls.mjs';

runRNHostControls({
  name: 'rn-text-reading-point',
  expectedCount: 73,
  recordsKey: 'tests',
  passField: 'status',
  boundary:
    'Actual installed glyph query, manager and Paragraph reading-method bodies. Host AppKit TextKit with modeled Paragraph state/factory delivery, ParagraphAttributes type stand-in, and UIFont→NSFont alias. Query-local factory/glyph counts are test-only. Not UIKit/Fabric runtime or performance proof.',
  prepare({ readSource, readFixture, writeInput }) {
    const directory =
      'ReactCommon/react/renderer/textlayoutmanager/platform/ios/react/renderer/textlayoutmanager/';
    const helper = readSource(directory + 'RCTTextReadingPoint.mm');
    const header = readSource(directory + 'RCTTextReadingPoint.h');
    const manager = readSource(directory + 'RCTTextLayoutManager.mm');
    readSource(directory + 'RCTTextLayoutManager.h');
    // Execute the exact mounted-query methods with explicit host state/factory delivery.
    readSource(
      'React/Fabric/Mounting/ComponentViews/Text/RCTParagraphComponentView.h'
    );
    const paragraph = readSource(
      'React/Fabric/Mounting/ComponentViews/Text/RCTParagraphComponentView.mm'
    );
    const marker =
      '- (TextReadingPointResult)readingPointWithAttributedString:';
    const start = manager.indexOf(marker),
      end = manager.indexOf('- (void)drawAttributedString:', start);
    assert.ok(
      start >= 0 && end > start,
      'Missing exact manager wrapper region'
    );
    const wrappers = manager.slice(start, end);
    assert.equal(
      manager.split(marker).length - 1,
      4,
      'Unexpected manager query method count'
    );
    assert.equal(wrappers.split(marker).length - 1, 4);
    assert.equal(
      header.split('#import <UIKit/UIKit.h>').length - 1,
      1,
      'Unexpected helper header; do not silently rewrite a new platform boundary'
    );
    writeInput(
      'RCTTextReadingPoint.h',
      header
        .replace(
          '#import <UIKit/UIKit.h>',
          '#import <AppKit/AppKit.h>\n#define UIFont NSFont'
        )
        .replace(
          'class ParagraphAttributes;',
          'struct ParagraphAttributes { int maximumNumberOfLines{0}; bool operator==(const ParagraphAttributes &) const = default; };'
        )
    );
    const rangeMarker =
      'TextReadingPointResult measureRange(NSTextStorage *storage, CGRect frame, NSRange range, TextReadingPointQuery *query)\n{';
    assert.equal(helper.split(rangeMarker).length - 1, 1);
    const glyphMarker = '  // Query storage is created by the draw factory';
    assert.equal(helper.split(glyphMarker).length - 1, 1);
    assert.equal(header.split('class ParagraphAttributes;').length - 1, 1);
    assert.equal(header.split('struct TextReadingPointQuery').length - 1, 1);
    writeInput(
      'RCTTextReadingPoint.mm',
      helper
        .replace(
          '#import "RCTTextReadingPoint.h"',
          '#import "RCTTextReadingPoint.h"\nNSUInteger queryTestGlyphPreparations = 0;\nNSUInteger queryTestRangeMeasurements = 0;'
        )
        .replace(glyphMarker, '  ++queryTestGlyphPreparations;\n' + glyphMarker)
        .replace(rangeMarker, rangeMarker + '\n  ++queryTestRangeMeasurements;')
    );
    const paragraphStart = paragraph.indexOf(
      '- (TextReadingPointResult)readingPointAtPoint:'
    );
    const paragraphEnd = paragraph.indexOf(
      '#pragma mark - RCTComponentViewProtocol',
      paragraphStart
    );
    assert.ok(
      paragraphStart >= 0 && paragraphEnd > paragraphStart,
      'Missing exact Paragraph query region'
    );
    const paragraphWrappers = paragraph.slice(paragraphStart, paragraphEnd);
    assert.equal(
      paragraphWrappers.split('- (TextReadingPointResult)').length - 1,
      5
    );
    writeInput('paragraph-wrappers.inc', paragraphWrappers);
    writeInput('manager-wrappers.inc', wrappers);
    writeInput(
      'controls.mm',
      readFixture(
        new URL('./fixtures/rn-text-reading-point.controls.mm', import.meta.url)
      ).replace('struct ParagraphAttributes {};', '')
    );
    return {
      frameworks: ['Foundation', 'AppKit', 'CoreGraphics', 'CoreText'],
      translationUnits: ['RCTTextReadingPoint.mm', 'controls.mm'],
      defines: [
        'MANAGER_WRAPPERS="manager-wrappers.inc"',
        'PARAGRAPH_WRAPPERS="paragraph-wrappers.inc"',
        'HAS_QUERY=1',
      ],
      metadata: {
        hostAdaptation:
          'UIKit/AppKit and UIFont/NSFont aliases; explicit host ParagraphAttributes type stand-in; exact helper body with test-only glyph preparation counter; exact four manager wrappers and five Paragraph query methods with modeled state/factory delivery.',
        paragraph:
          'Exact query methods executed with host state/factory callbacks; not a mounted UIKit/Fabric view.',
      },
    };
  },
});
