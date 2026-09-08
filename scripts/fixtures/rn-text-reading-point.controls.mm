#import "RCTTextReadingPoint.h"
#include <functional>
#include <cmath>
#include <iostream>
#include <stdexcept>
#include <string>

using namespace facebook::react;
extern NSUInteger queryTestGlyphPreparations;
extern NSUInteger queryTestRangeMeasurements;
#if HAS_QUERY
#define QUERY_ARG query:&q
#else
struct TextReadingPointQuery {};
#define QUERY_ARG
#endif
static int passed = 0, failed = 0;
static NSMutableArray *records;
static NSMutableArray *rangeObservations;
void require(bool value, const char *message) { if (!value) throw std::runtime_error(message); }
void test(const char *name, std::function<void()> run) {
  try { run(); passed++; [records addObject:@{@"name":@(name), @"status":@"PASS"}]; }
  catch (const std::exception &e) { failed++; [records addObject:@{@"name":@(name), @"status":@"FAIL", @"error":@(e.what())}]; }
  catch (...) { failed++; [records addObject:@{@"name":@(name), @"status":@"FAIL", @"error":@"unknown exception"}]; }
}
struct Layout {
  NSTextStorage *__strong storage;
  CGRect frame;
  Layout(NSString *text, CGFloat width = 340, CGFloat height = 300, NSInteger lines = 0,
         NSLineBreakMode mode = NSLineBreakByClipping, CGFloat lineSpacing = 0) {
    frame = CGRectMake(7, 11, width, height);
    NSMutableParagraphStyle *paragraph = [NSMutableParagraphStyle new];
    paragraph.lineSpacing = lineSpacing;
    storage = [[NSTextStorage alloc] initWithString:text attributes:@{
      NSFontAttributeName:[NSFont systemFontOfSize:22], NSParagraphStyleAttributeName:paragraph}];
    NSTextContainer *container = [[NSTextContainer alloc] initWithSize:frame.size];
    container.lineFragmentPadding = 0;
    container.lineBreakMode = mode;
    container.maximumNumberOfLines = lines;
    NSLayoutManager *manager = [NSLayoutManager new];
    manager.usesFontLeading = NO;
    [manager addTextContainer:container];
    [storage addLayoutManager:manager];
  }
  TextReadingPointResult range(NSRange r) { return RCTTextReadingPointForRange(storage, frame, r, storage.string); }
  TextReadingPointResult hit(CGPoint p) { return RCTTextReadingPointAtPoint(storage, frame, p); }
};
CGPoint center(CGRect r) { return CGPointMake(CGRectGetMidX(r), CGRectGetMidY(r)); }
void measured(const TextReadingPointResult &r) {
  if (r.status != TextReadingPointStatus::Measured) {
    throw std::runtime_error("expected measured, reason="+std::to_string((int)r.reason));
  }
  require(!r.fragments.empty(), "no fragments");
}
void unavailable(const TextReadingPointResult &r, TextReadingPointReason reason) {
  require(r.status == TextReadingPointStatus::Unavailable, "expected unavailable");
  if (r.reason != reason) throw std::runtime_error("wrong unavailable reason="+std::to_string((int)r.reason));
  require(r.fragments.empty(), "unavailable leaked geometry");
}
// Exact production wrapper bodies follow. The host adapter supplies only RN
// argument conversion/factory plumbing, not the branch under test.
using AttributedString = NSAttributedString *;
struct ParagraphAttributes {};
static NSUInteger factoryCalls = 0;
static std::function<void()> factoryHook;
@interface RCTTextLayoutManager : NSObject
@end
@implementation RCTTextLayoutManager
- (NSAttributedString *)_nsAttributedStringFromAttributedString:(AttributedString)value { return value; }
- (NSTextStorage *)_textStorageAndLayoutManagerWithAttributesString:(NSAttributedString *)value
                                              paragraphAttributes:(ParagraphAttributes)attributes size:(CGSize)size
{
  factoryCalls++;
  Layout layout(value.string,size.width,size.height);
  [layout.storage setAttributedString:value];
  if (factoryHook) { auto callback = std::move(factoryHook); factoryHook = {}; callback(); }
  return layout.storage;
}
#include MANAGER_WRAPPERS
@end

#include <memory>
struct QueryManager { RCTTextLayoutManager *__strong native; id getNativeTextLayoutManager() { return native; } };
struct QueryData { NSAttributedString *__strong attributedString; std::weak_ptr<QueryManager> layoutManager; };
struct QueryState { QueryData data; const QueryData &getData() const { return data; } };
struct QueryTextView { std::shared_ptr<QueryState> state; };
struct QueryLayout { CGRect frame; CGRect getContentFrame() const { return frame; } };
static CGRect RCTCGRectFromRect(CGRect frame) { return frame; }
static id unwrapManagedObject(id value) { return value; }
@interface QueryHostView : NSObject
@property(nonatomic,strong) id window;
@property(nonatomic,weak) QueryHostView *superview;
@property(nonatomic) BOOL hidden;
@property(nonatomic) CGFloat alpha;
@end
@implementation QueryHostView
@end
#define UIView QueryHostView
@interface RCTParagraphComponentView : QueryHostView {
@public
  NSObject *_readingPointOwner;
  uint64_t _readingPointRevision;
  QueryTextView _textView;
  QueryLayout _layoutMetrics;
  ParagraphAttributes _paragraphAttributes;
}
@end
@implementation RCTParagraphComponentView
#include PARAGRAPH_WRAPPERS
@end
#undef UIView
struct ParagraphFixture {
  RCTParagraphComponentView *__strong paragraph;
  std::shared_ptr<QueryManager> manager;
  ParagraphFixture() {
    paragraph=[RCTParagraphComponentView new];paragraph.window=[NSObject new];paragraph.alpha=1;
    paragraph->_readingPointOwner=[NSObject new];paragraph->_readingPointRevision=1;
    paragraph->_layoutMetrics.frame=CGRectMake(0,0,340,300);
    manager=std::make_shared<QueryManager>();manager->native=[RCTTextLayoutManager new];
    auto state=std::make_shared<QueryState>();state->data.attributedString=[[NSAttributedString alloc] initWithString:@"Alpha bravo" attributes:@{NSFontAttributeName:[NSFont systemFontOfSize:22]}];state->data.layoutManager=manager;paragraph->_textView.state=state;
  }
  TextReadingPointResult read(TextReadingPointQuery &q) {
    return [paragraph readingPointForRange:NSMakeRange(0,1) expectedCurrentText:@"Alpha bravo" owner:paragraph->_readingPointOwner QUERY_ARG];
  }
};

void identicalGeometry(const TextReadingPointResult &a, const TextReadingPointResult &b) {
  require(a.status==b.status && a.reason==b.reason,"different result status");
  require([a.sourceText isEqualToString:b.sourceText],"different result source");
  require(NSEqualRanges(a.characterRange,b.characterRange),"different result range");
  require(a.owner==b.owner && a.revision==b.revision,"different result owner/revision");
  require(a.fragments.size()==b.fragments.size(),"different fragment count");
  for(size_t i=0;i<a.fragments.size();i++) {
    require(CGRectEqualToRect(a.fragments[i].rect,b.fragments[i].rect),"different exact fragment frame");
    require(NSEqualRanges(a.fragments[i].characterRange,b.fragments[i].characterRange),"different fragment range");
  }
}
TextReadingPointResult paragraphRange(ParagraphFixture &f, TextReadingPointQuery &q, NSRange range) {
  return [f.paragraph readingPointForRange:range expectedCurrentText:f.paragraph->_textView.state->data.attributedString.string owner:f.paragraph->_readingPointOwner query:&q];
}
int main() { @autoreleasepool {
  records = [NSMutableArray new];
  rangeObservations = [NSMutableArray new];
  test("plain exact UTF16 range and local frame origin", [] {
    Layout l(@"Alpha bravo"); auto r=l.range(NSMakeRange(6,5)); measured(r);
    require(NSEqualRanges(r.characterRange,NSMakeRange(6,5)),"wrong plain range");
    require(r.fragments.front().rect.origin.x>=l.frame.origin.x,"missing origin");
    require([r.sourceText isEqualToString:l.storage.string],"missing source");
    auto h=l.hit(center(r.fragments.front().rect)); measured(h);
    require(NSLocationInRange(6,h.characterRange),"wrong character");
  });
  test("surrogate pair hit expands complete emoji", [] {
    Layout l(@"A 😀 B"); NSRange range=[l.storage.string rangeOfString:@"😀"];
    auto r=l.range(range); measured(r); auto h=l.hit(center(r.fragments.front().rect)); measured(h);
    require(NSEqualRanges(h.characterRange,range),"split emoji");
  });
  test("ZWJ family cluster hit retains exact composed range", [] {
    Layout l(@"A 👨‍👩‍👧‍👦 B"); NSRange range=[l.storage.string rangeOfString:@"👨‍👩‍👧‍👦"];
    auto r=l.range(range); measured(r); auto h=l.hit(center(r.fragments.front().rect)); measured(h);
    require(NSEqualRanges(h.characterRange,range),"split ZWJ cluster");
  });
  test("combining accent is a complete cluster", [] {
    Layout l(@"A e\u0301 B"); NSRange range=[l.storage.string rangeOfString:@"e\u0301"];
    auto r=l.range(range); measured(r); auto h=l.hit(center(r.fragments.front().rect)); measured(h);
    require(NSEqualRanges(h.characterRange,range),"split combining cluster");
  });
  test("flag regional indicators stay composed", [] {
    Layout l(@"A 🇺🇸 B"); NSRange range=[l.storage.string rangeOfString:@"🇺🇸"];
    auto r=l.range(range); measured(r); auto h=l.hit(center(r.fragments.front().rect)); measured(h);
    require(NSEqualRanges(h.characterRange,range),"split flag");
  });
  test("reject split surrogate range", [] {
    Layout l(@"A 😀 B"); unavailable(l.range(NSMakeRange(2,1)),TextReadingPointReason::SplitComposedCharacter);
  });
  test("reject split combining range", [] {
    Layout l(@"A e\u0301 B"); unavailable(l.range(NSMakeRange(2,1)),TextReadingPointReason::SplitComposedCharacter);
  });
  test("multiline range retains separate real glyph fragments", [] {
    Layout l(@"First line\nSecond line"); auto r=l.range(NSMakeRange(0,l.storage.length)); measured(r);
    CGFloat minY=CGFLOAT_MAX,maxY=-CGFLOAT_MAX;
    for (const auto &f:r.fragments) { minY=std::min(minY,f.rect.origin.y); maxY=std::max(maxY,f.rect.origin.y); }
    require(maxY>minY+10,"multiline union/one line");
    auto second=l.range([l.storage.string rangeOfString:@"Second"]); measured(second);
    auto h=l.hit(center(second.fragments.front().rect)); measured(h);
    require(NSLocationInRange(11,h.characterRange),"wrong second line");
  });
  test("wrapped text reads actual later line", [] {
    Layout l(@"one two three four five six seven eight",100); auto r=l.range([l.storage.string rangeOfString:@"seven"]); measured(r);
    auto h=l.hit(center(r.fragments.front().rect)); measured(h);
    require(NSLocationInRange([l.storage.string rangeOfString:@"seven"].location,h.characterRange),"wrong wrapped hit");
  });
  test("bidi fragments retain nonmonotonic visual order", [] {
    Layout l(@"abc אבג def"); auto r=l.range([l.storage.string rangeOfString:@"אבג"]); measured(r);
    require(r.fragments.size()>=3,"missing bidi fragments");
    require(r.fragments[0].rect.origin.x>r.fragments[1].rect.origin.x,"logical characters interpolated left-to-right");
    for (const auto &f:r.fragments) { auto h=l.hit(center(f.rect)); measured(h); require(NSIntersectionRange(h.characterRange,f.characterRange).length>0,"wrong bidi hit"); }
  });
  test("Arabic shaping returns actual cluster geometry", [] {
    Layout l(@"abc سلام def"); auto r=l.range([l.storage.string rangeOfString:@"سلام"]); measured(r);
    for (const auto &f:r.fragments) { auto h=l.hit(center(f.rect)); measured(h); require(NSIntersectionRange(h.characterRange,f.characterRange).length>0,"wrong Arabic hit"); }
  });
  test("blank right side does not snap to last character", [] {
    Layout l(@"short"); auto r=l.range(NSMakeRange(0,1)); measured(r);
    unavailable(l.hit(CGPointMake(CGRectGetMaxX(l.frame)-2,CGRectGetMidY(r.fragments.front().rect))),TextReadingPointReason::NonRenderedRange);
  });
  test("line gap does not snap to another line", [] {
    Layout l(@"First\nSecond",340,300,0,NSLineBreakByClipping,30);
    auto a=l.range(NSMakeRange(0,1)),b=l.range(NSMakeRange(6,1)); measured(a);measured(b);
    CGFloat y=(CGRectGetMaxY(a.fragments.front().rect)+CGRectGetMinY(b.fragments.front().rect))/2;
    unavailable(l.hit(CGPointMake(CGRectGetMidX(a.fragments.front().rect),y)),TextReadingPointReason::NonRenderedRange);
  });
  test("internal whitespace has no rendered point", [] {
    Layout l(@"A     B"); unavailable(l.range(NSMakeRange(1,5)),TextReadingPointReason::NonRenderedRange);
  });
  test("newline alone is not a rendered reading point", [] {
    Layout l(@"A\nB"); unavailable(l.range(NSMakeRange(1,1)),TextReadingPointReason::NonRenderedRange);
  });
  test("out-of-frame and nonfinite point unavailable", [] {
    Layout l(@"abc"); unavailable(l.hit(CGPointMake(-1,20)),TextReadingPointReason::OutsideContainer);
    unavailable(l.hit(CGPointMake(NAN,20)),TextReadingPointReason::OutsideContainer);
  });
  for (NSLineBreakMode mode : {NSLineBreakByTruncatingHead, NSLineBreakByTruncatingMiddle, NSLineBreakByTruncatingTail}) {
    std::string name="truncated line never maps ellipsis to source, mode="+std::to_string(mode);
    test(name.c_str(), [mode] {
      Layout l(@"A very long line with enough text to truncate well beyond the width",110,80,1,mode);
      NSLayoutManager *m=l.storage.layoutManagers.firstObject; NSTextContainer *c=m.textContainers.firstObject;
      [m ensureLayoutForTextContainer:c]; NSRange g=[m glyphRangeForTextContainer:c];
      NSRange cut=[m truncatedGlyphRangeInLineFragmentForGlyphAtIndex:g.location];
      NSUInteger hidden=0; for(NSUInteger i=0;i<m.numberOfGlyphs;i++) { if([m notShownAttributeForGlyphAtIndex:i]) hidden++; }
      require(cut.location!=NSNotFound || hidden>10,"setup did not remove glyphs with declared truncation");
      unavailable(l.range(NSMakeRange(0,l.storage.length)),TextReadingPointReason::Truncated);
      CGRect used=[m lineFragmentUsedRectForGlyphAtIndex:g.location effectiveRange:nullptr];
      auto h=l.hit(CGPointMake(l.frame.origin.x+CGRectGetMidX(used),l.frame.origin.y+CGRectGetMidY(used)));
      unavailable(h,TextReadingPointReason::Truncated);
    });
  }
  test("unlaid lines unavailable, never removed", [] {
    Layout l(@"First\nSecond\nThird",200,26); auto r=l.range([l.storage.string rangeOfString:@"Third"]);
    require(r.status==TextReadingPointStatus::Unavailable,"clipped range qualified");
  });
  test("real attachment range and hit unavailable", [] {
    Layout l(@"A \uFFFC B"); NSTextAttachment *attachment=[[NSTextAttachment alloc] initWithFileWrapper:nil];
    NSImage *img=[[NSImage alloc] initWithSize:NSMakeSize(28,28)];
    attachment.attachmentCell=[[NSTextAttachmentCell alloc] initImageCell:img];
    [l.storage addAttribute:NSAttachmentAttributeName value:attachment range:NSMakeRange(2,1)];
    unavailable(l.range(NSMakeRange(2,1)),TextReadingPointReason::Attachment);
    NSLayoutManager *m=l.storage.layoutManagers.firstObject; NSTextContainer *c=m.textContainers.firstObject; [m ensureLayoutForTextContainer:c];
    NSRange g=[m glyphRangeForCharacterRange:NSMakeRange(2,1) actualCharacterRange:nullptr];
    CGRect bounds=[m boundingRectForGlyphRange:g inTextContainer:c];
    require(bounds.size.width>0,"attachment not laid out");
    unavailable(l.hit(CGPointMake(l.frame.origin.x+CGRectGetMidX(bounds),l.frame.origin.y+CGRectGetMidY(bounds))),TextReadingPointReason::Attachment);
  });
  test("unattributed attachment placeholder unavailable", [] {
    Layout l(@"A \uFFFC B"); unavailable(l.range(NSMakeRange(2,1)),TextReadingPointReason::Attachment);
  });
  test("nonempty source change unavailable not removed", [] {
    Layout l(@"revised"); unavailable(RCTTextReadingPointForRange(l.storage,l.frame,NSMakeRange(0,3),@"original"),TextReadingPointReason::SourceChanged);
  });
  test("empty current text distinguishes removed saved witness", [] {
    Layout l(@""); auto r=RCTTextReadingPointForRange(l.storage,l.frame,NSMakeRange(0,3),@"original");
    require(r.status==TextReadingPointStatus::Removed,"empty not removed");
    require(r.reason==TextReadingPointReason::EmptyCurrentText,"wrong reason");
    unavailable(l.hit(CGPointMake(10,20)),TextReadingPointReason::NoLayout);
  });
  test("empty with invalid old witness remains unavailable", [] {
    Layout l(@""); unavailable(RCTTextReadingPointForRange(l.storage,l.frame,NSMakeRange(100,3),@"original"),TextReadingPointReason::InvalidRange);
  });
  test("overflow and NSNotFound ranges reject without exception", [] {
    Layout l(@"abc"); unavailable(l.range(NSMakeRange(2,NSUIntegerMax)),TextReadingPointReason::InvalidRange);
    unavailable(l.range(NSMakeRange(NSNotFound,1)),TextReadingPointReason::InvalidRange);
    unavailable(l.range(NSMakeRange(0,0)),TextReadingPointReason::InvalidRange);
  });
  test("missing storage/layout unavailable not removed", [] {
    unavailable(RCTTextReadingPointForRange(nil,CGRectMake(0,0,200,200),NSMakeRange(0,1),@"a"),TextReadingPointReason::InvalidRange);
    NSTextStorage *s=[[NSTextStorage alloc] initWithString:@"abc"];
    unavailable(RCTTextReadingPointForRange(s,CGRectMake(0,0,200,200),NSMakeRange(0,1),@"abc"),TextReadingPointReason::NoLayout);
  });
  test("transparent foreground is unavailable", [] {
    Layout l(@"transparent"); [l.storage addAttribute:NSForegroundColorAttributeName value:NSColor.clearColor range:NSMakeRange(0,l.storage.length)];
    unavailable(l.range(NSMakeRange(0,1)),TextReadingPointReason::Invisible);
  });
  test("saved range returns complete font ligature mapping", [] {
    Layout l(@"office"); [l.storage addAttribute:NSFontAttributeName value:[NSFont fontWithName:@"Times-Roman" size:24] range:NSMakeRange(0,l.storage.length)];
    [l.storage addAttribute:NSLigatureAttributeName value:@1 range:NSMakeRange(0,l.storage.length)];
    auto r=l.range(NSMakeRange(2,1)); measured(r);
    require(NSLocationInRange(2,r.characterRange),"ligature excludes request");
    auto again=l.range(r.characterRange); measured(again);
    require(NSEqualRanges(again.characterRange,r.characterRange),"returned witness is not stable");
  });
  test("literal source ellipsis is measurable", [] {
    Layout l(@"A … B"); measured(l.range([l.storage.string rangeOfString:@"…"]));
  });
  test("same UTF16 witness remeasures after actual wrapping changes", [] {
    NSString *text=@"one two three four five six seven eight";
    Layout wide(text,340), narrow(text,100);
    auto saved=wide.range([text rangeOfString:@"seven"]); measured(saved);
    auto current=RCTTextReadingPointForRange(narrow.storage,narrow.frame,saved.characterRange,saved.sourceText); measured(current);
    require(NSEqualRanges(saved.characterRange,current.characterRange),"reflow changed logical witness");
    require(current.fragments.front().rect.origin.y>saved.fragments.front().rect.origin.y+10,"stale pre-reflow geometry");
  });
  test("rendered source revision changes stay explicitly unavailable", [] {
    Layout before(@"one two three"),after(@"one revised two three");
    auto saved=before.range(NSMakeRange(4,3)); measured(saved);
    unavailable(RCTTextReadingPointForRange(after.storage,after.frame,saved.characterRange,saved.sourceText),TextReadingPointReason::SourceChanged);
  });
  test("actual wrapper: empty zero-height current paragraph is removed", [] {
    RCTTextLayoutManager *manager=[RCTTextLayoutManager new]; factoryCalls=0;
    auto result=[manager readingPointWithAttributedString:[[NSAttributedString alloc] initWithString:@""]
                                      paragraphAttributes:ParagraphAttributes{} frame:CGRectMake(0,0,100,0)
                                             characterRange:NSMakeRange(0,1) expectedCurrentText:@"saved"];
    require(result.status==TextReadingPointStatus::Removed,"empty zero-height wrapper rejected removed witness");
    require(factoryCalls==0,"empty source reached layout factory");
  });
  test("actual wrapper: invalid saved range remains unavailable on empty source", [] {
    RCTTextLayoutManager *manager=[RCTTextLayoutManager new]; factoryCalls=0;
    auto result=[manager readingPointWithAttributedString:[[NSAttributedString alloc] initWithString:@""]
                                      paragraphAttributes:ParagraphAttributes{} frame:CGRectMake(0,0,100,0)
                                             characterRange:NSMakeRange(50,1) expectedCurrentText:@"saved"];
    unavailable(result,TextReadingPointReason::InvalidRange); require(factoryCalls==0,"empty reached layout");
  });
  test("actual wrapper: nonempty zero-height source unavailable without layout", [] {
    RCTTextLayoutManager *manager=[RCTTextLayoutManager new]; factoryCalls=0;
    auto result=[manager readingPointWithAttributedString:[[NSAttributedString alloc] initWithString:@"saved"]
                                      paragraphAttributes:ParagraphAttributes{} frame:CGRectMake(0,0,100,0)
                                             characterRange:NSMakeRange(0,1) expectedCurrentText:@"saved"];
    unavailable(result,TextReadingPointReason::OutsideContainer); require(factoryCalls==0,"invalid frame reached layout");
  });
  test("actual wrapper: normal layout invokes real query and matches range", [] {
    RCTTextLayoutManager *manager=[RCTTextLayoutManager new]; factoryCalls=0;
    NSAttributedString *value=[[NSAttributedString alloc] initWithString:@"saved" attributes:@{NSFontAttributeName:[NSFont systemFontOfSize:22]}];
    auto result=[manager readingPointWithAttributedString:value paragraphAttributes:ParagraphAttributes{}
                                                     frame:CGRectMake(0,0,100,100) characterRange:NSMakeRange(0,1) expectedCurrentText:@"saved"];
    measured(result); require(factoryCalls==1,"wrapper bypassed renderer factory");
  });
  test("same-candidate point and cluster construct one renderer storage", [] {
    RCTTextLayoutManager *manager=[RCTTextLayoutManager new];
    Layout l(@"Alpha bravo"); auto reference=l.range(NSMakeRange(2,1)); measured(reference);
    CGPoint point=center(reference.fragments.front().rect); TextReadingPointQuery q;
    factoryCalls=0; queryTestGlyphPreparations=0;
    auto hit=[manager readingPointWithAttributedString:l.storage paragraphAttributes:ParagraphAttributes{} frame:l.frame atPoint:point QUERY_ARG]; measured(hit);
    auto cluster=[manager readingPointWithAttributedString:l.storage paragraphAttributes:ParagraphAttributes{} frame:l.frame characterRange:hit.characterRange expectedCurrentText:hit.sourceText QUERY_ARG]; measured(cluster);
    require(NSEqualRanges(hit.characterRange,cluster.characterRange),"cluster changed");
    require(factoryCalls==1,"multiple storage factories within candidate");
  });
  test("same-candidate point and cluster regenerate glyphs once", [] {
    RCTTextLayoutManager *manager=[RCTTextLayoutManager new];
    Layout l(@"Alpha bravo"); auto reference=l.range(NSMakeRange(2,1)); measured(reference);
    CGPoint point=center(reference.fragments.front().rect); TextReadingPointQuery q;
    factoryCalls=0; queryTestGlyphPreparations=0;
    auto hit=[manager readingPointWithAttributedString:l.storage paragraphAttributes:ParagraphAttributes{} frame:l.frame atPoint:point QUERY_ARG]; measured(hit);
    auto cluster=[manager readingPointWithAttributedString:l.storage paragraphAttributes:ParagraphAttributes{} frame:l.frame characterRange:hit.characterRange expectedCurrentText:hit.sourceText QUERY_ARG]; measured(cluster);
    require(queryTestGlyphPreparations==1,"multiple glyph generations within candidate");
  });
  test("whitespace fallback and final cluster share one layout", [] {
    RCTTextLayoutManager *manager=[RCTTextLayoutManager new];Layout l(@"Alpha bravo");TextReadingPointQuery q;
    factoryCalls=0;queryTestGlyphPreparations=0;
    auto hit=[manager readingPointWithAttributedString:l.storage paragraphAttributes:ParagraphAttributes{} frame:l.frame atPoint:CGPointMake(330,280) QUERY_ARG];
    require(hit.status!=TextReadingPointStatus::Measured,"expected whitespace");
    auto all=[manager readingPointWithAttributedString:l.storage paragraphAttributes:ParagraphAttributes{} frame:l.frame characterRange:NSMakeRange(0,l.storage.length) expectedCurrentText:l.storage.string QUERY_ARG];measured(all);
    auto cluster=[manager readingPointWithAttributedString:l.storage paragraphAttributes:ParagraphAttributes{} frame:l.frame characterRange:all.fragments.front().characterRange expectedCurrentText:l.storage.string QUERY_ARG];measured(cluster);
    require(factoryCalls==1 && queryTestGlyphPreparations==1,"fallback repeated layout/glyph generation");
  });
  test("actual Paragraph query retains one storage only for the same live binding", [] {
    ParagraphFixture f;TextReadingPointQuery q;factoryCalls=0;queryTestGlyphPreparations=0;
    auto first=f.read(q);measured(first);auto second=f.read(q);measured(second);
    require(first.owner==second.owner && first.revision==second.revision,"owner changed");
    require(CGRectEqualToRect(first.fragments.front().rect,second.fragments.front().rect),"changed same-source geometry");
    require(factoryCalls==1 && queryTestGlyphPreparations==1,"Paragraph failed to reuse scoped layout");
  });
#if HAS_QUERY
  for (int field=0;field<5;field++) test((std::string("actual Paragraph retires changed binding field ")+std::to_string(field)).c_str(), [field] {
    ParagraphFixture f;TextReadingPointQuery q;measured(f.read(q));factoryCalls=0;
    switch(field){
      case 0:f.paragraph->_readingPointOwner=[NSObject new];break;
      case 1:f.paragraph->_readingPointRevision++;break;
      case 2:f.paragraph->_textView.state=std::make_shared<QueryState>(*f.paragraph->_textView.state);break;
      case 3:f.manager->native=[RCTTextLayoutManager new];break;
      case 4:f.paragraph->_layoutMetrics.frame.size.width=300;break;
    }
    unavailable(f.read(q),TextReadingPointReason::OwnerChanged);require(q.retired,"query not retired");require(factoryCalls==0,"invalid binding reached factory");
    TextReadingPointQuery fresh;measured(f.read(fresh));
  });
  test("actual Paragraph rejects another physical host despite copied state/token", [] {
    ParagraphFixture a,b;TextReadingPointQuery q;measured(a.read(q));
    b.paragraph->_readingPointOwner=a.paragraph->_readingPointOwner;b.paragraph->_textView.state=a.paragraph->_textView.state;b.manager=a.manager;
    unavailable(b.read(q),TextReadingPointReason::OwnerChanged);
  });
  test("actual Paragraph hidden ancestor ABA cannot revive query", [] {
    ParagraphFixture f;QueryHostView *parent=[QueryHostView new];parent.alpha=1;f.paragraph.superview=parent;TextReadingPointQuery q;measured(f.read(q));parent.hidden=YES;
    unavailable(f.read(q),TextReadingPointReason::Invisible);parent.hidden=NO;unavailable(f.read(q),TextReadingPointReason::OwnerChanged);
    TextReadingPointQuery fresh;measured(f.read(fresh));
  });
  test("actual Paragraph detach ABA cannot revive query", [] {
    ParagraphFixture f;TextReadingPointQuery q;measured(f.read(q));f.paragraph.window=nil;unavailable(f.read(q),TextReadingPointReason::Detached);f.paragraph.window=[NSObject new];unavailable(f.read(q),TextReadingPointReason::OwnerChanged);
  });
  for(int field=0;field<6;field++) test((std::string("actual Paragraph rejects reentrant query change ")+std::to_string(field)).c_str(),[field]{
    ParagraphFixture f;TextReadingPointQuery q;
    factoryHook=[&]{switch(field){
      case 0:f.paragraph->_readingPointOwner=[NSObject new];break;
      case 1:f.paragraph->_readingPointRevision++;break;
      case 2:f.paragraph->_textView.state=std::make_shared<QueryState>(*f.paragraph->_textView.state);break;
      case 3:f.manager->native=[RCTTextLayoutManager new];break;
      case 4:f.paragraph->_layoutMetrics.frame.size.width=300;break;
      case 5:f.paragraph.hidden=YES;break;
    }};
    auto value=f.read(q);require(value.status==TextReadingPointStatus::Unavailable,"stale callback returned geometry");require(value.fragments.empty(),"stale fragments exposed");require(q.retired,"callback query not retired");
  });
  test("actual manager rejects changed paragraph attributes", [] {
    RCTTextLayoutManager *m=[RCTTextLayoutManager new];Layout l(@"Alpha bravo");TextReadingPointQuery q;ParagraphAttributes attrs;
    measured([m readingPointWithAttributedString:l.storage paragraphAttributes:attrs frame:l.frame characterRange:NSMakeRange(0,1) expectedCurrentText:l.storage.string query:&q]);
    attrs.maximumNumberOfLines=1;
    unavailable([m readingPointWithAttributedString:l.storage paragraphAttributes:attrs frame:l.frame characterRange:NSMakeRange(0,1) expectedCurrentText:l.storage.string query:&q],TextReadingPointReason::OwnerChanged);
  });
  test("actual Paragraph rejects reentrant paragraph attributes", [] {
    ParagraphFixture f;TextReadingPointQuery q;factoryHook=[&]{f.paragraph->_paragraphAttributes.maximumNumberOfLines=1;};
    unavailable(f.read(q),TextReadingPointReason::OwnerChanged);require(q.retired,"attributes did not retire query");
  });
  test("actual manager rejects changed current attributed style", [] {
    RCTTextLayoutManager *m=[RCTTextLayoutManager new];Layout l(@"Alpha bravo");TextReadingPointQuery q;
    measured([m readingPointWithAttributedString:l.storage paragraphAttributes:ParagraphAttributes{} frame:l.frame characterRange:NSMakeRange(0,1) expectedCurrentText:l.storage.string query:&q]);
    [l.storage addAttribute:NSFontAttributeName value:[NSFont systemFontOfSize:30] range:NSMakeRange(0,l.storage.length)];
    unavailable([m readingPointWithAttributedString:l.storage paragraphAttributes:ParagraphAttributes{} frame:l.frame characterRange:NSMakeRange(0,1) expectedCurrentText:l.storage.string query:&q],TextReadingPointReason::OwnerChanged);
  });
#endif

  test("exact range: actual Paragraph point then same cluster measures once", [] {
    ParagraphFixture f;TextReadingPointQuery reference;
    auto baseline=f.read(reference);measured(baseline);
    TextReadingPointQuery q;queryTestRangeMeasurements=0;
    auto hit=[f.paragraph readingPointAtPoint:center(baseline.fragments.front().rect) query:&q];measured(hit);
    auto repeated=paragraphRange(f,q,hit.characterRange);measured(repeated);
    identicalGeometry(hit,repeated);
    [rangeObservations addObject:@{@"case":@"point-same-cluster",@"measureRangeCalls":@(queryTestRangeMeasurements),@"exactGeometryEqual":@YES}];
    require(queryTestRangeMeasurements==1,"same point cluster repeated measureRange");
  });
  for(NSString *text : {@"Alpha bravo", @"A 👨‍👩‍👧‍👦 B", @"abc אבג def", @"office"}) {
    test((std::string("exact range shape parity: ")+text.UTF8String).c_str(),[text]{
      ParagraphFixture f;
      f.paragraph->_textView.state->data.attributedString=[[NSAttributedString alloc] initWithString:text attributes:@{NSFontAttributeName:[NSFont fontWithName:@"Times-Roman" size:24],NSLigatureAttributeName:@1}];
      NSRange requested=NSMakeRange(0,text.length);TextReadingPointQuery q;
      queryTestRangeMeasurements=0;auto first=paragraphRange(f,q,requested);measured(first);
      auto repeated=paragraphRange(f,q,requested);measured(repeated);identicalGeometry(first,repeated);
      [rangeObservations addObject:@{@"case":text,@"measureRangeCalls":@(queryTestRangeMeasurements),@"exactGeometryEqual":@YES}];
      require(queryTestRangeMeasurements==1,"same requested shape range remeasured");
      TextReadingPointQuery fresh;auto uncached=paragraphRange(f,fresh,requested);identicalGeometry(first,uncached);
      require(queryTestRangeMeasurements==2,"fresh query reused previous geometry");
    });
  }
  test("exact range mismatch never substitutes previous fragment", [] {
    ParagraphFixture f;TextReadingPointQuery q;queryTestRangeMeasurements=0;
    auto first=paragraphRange(f,q,NSMakeRange(0,1));measured(first);
    auto different=paragraphRange(f,q,NSMakeRange(1,1));measured(different);
    require(queryTestRangeMeasurements==2,"different range reused old measurement");
    require(different.characterRange.location==1,"wrong range returned");
    TextReadingPointQuery fresh;identicalGeometry(different,paragraphRange(f,fresh,NSMakeRange(1,1)));
  });
  test("exact range whitespace fallback cannot substitute whole paragraph for cluster", [] {
    ParagraphFixture f;TextReadingPointQuery q;queryTestRangeMeasurements=0;
    auto hit=[f.paragraph readingPointAtPoint:CGPointMake(330,280) query:&q];
    require(hit.status!=TextReadingPointStatus::Measured,"expected blank point");
    auto all=paragraphRange(f,q,NSMakeRange(0,11));measured(all);
    auto before=queryTestRangeMeasurements;
    auto cluster=paragraphRange(f,q,all.fragments.front().characterRange);measured(cluster);
    require(queryTestRangeMeasurements==before+1,"fallback whole range reused for subrange");
    require(cluster.characterRange.length<all.characterRange.length,"returned full paragraph");
    TextReadingPointQuery fresh;identicalGeometry(cluster,paragraphRange(f,fresh,all.fragments.front().characterRange));
  });
  test("exact range unavailable results never become reusable geometry", [] {
    ParagraphFixture f;TextReadingPointQuery q;queryTestRangeMeasurements=0;
    measured(f.read(q));
    auto first=paragraphRange(f,q,NSMakeRange(5,1));unavailable(first,TextReadingPointReason::NonRenderedRange);
    auto again=paragraphRange(f,q,NSMakeRange(5,1));unavailable(again,TextReadingPointReason::NonRenderedRange);
    require(queryTestRangeMeasurements==3,"unavailable measurement was cached");
    measured(f.read(q));require(queryTestRangeMeasurements==4,"failed new measurement retained old result");
  });
  test("exact range explicit retire never revives saved geometry", [] {
    ParagraphFixture f;TextReadingPointQuery q;queryTestRangeMeasurements=0;measured(f.read(q));q.retire();
    unavailable(f.read(q),TextReadingPointReason::OwnerChanged);
    require(queryTestRangeMeasurements==1,"retired query measured again");
    TextReadingPointQuery fresh;measured(f.read(fresh));require(queryTestRangeMeasurements==2,"fresh lifetime did not measure");
  });
  test("exact range changed current text rejects primed result", [] {
    ParagraphFixture f;TextReadingPointQuery q;measured(f.read(q));
    f.paragraph->_textView.state->data.attributedString=[[NSAttributedString alloc] initWithString:@"Omega bravo" attributes:@{NSFontAttributeName:[NSFont systemFontOfSize:22]}];
    unavailable(paragraphRange(f,q,NSMakeRange(0,1)),TextReadingPointReason::OwnerChanged);
    require(q.retired,"changed source did not retire query");
  });
  test("exact range frame-origin change rejects primed result", [] {
    ParagraphFixture f;TextReadingPointQuery q;measured(f.read(q));f.paragraph->_layoutMetrics.frame.origin.y+=1;
    unavailable(f.read(q),TextReadingPointReason::OwnerChanged);require(q.retired,"changed origin did not retire query");
  });
  test("exact range owner ABA cannot revive primed result", [] {
    ParagraphFixture f;TextReadingPointQuery q;measured(f.read(q));NSObject *old=f.paragraph->_readingPointOwner;
    f.paragraph->_readingPointOwner=[NSObject new];unavailable(f.read(q),TextReadingPointReason::OwnerChanged);
    f.paragraph->_readingPointOwner=old;unavailable(f.read(q),TextReadingPointReason::OwnerChanged);
  });
  test("exact range wrong expected text cannot return primed geometry", [] {
    ParagraphFixture f;TextReadingPointQuery q;measured(f.read(q));
    unavailable([f.paragraph readingPointForRange:NSMakeRange(0,1) expectedCurrentText:@"Other bravo" owner:f.paragraph->_readingPointOwner query:&q],TextReadingPointReason::SourceChanged);
  });
  test("exact range result is copied before caller changes fragments", [] {
    ParagraphFixture f;TextReadingPointQuery q;queryTestRangeMeasurements=0;auto first=f.read(q);measured(first);auto original=first;
    first.fragments[0].rect.origin.y+=100;first.fragments.clear();
    identicalGeometry(original,f.read(q));require(queryTestRangeMeasurements==1,"same range did not reuse result");
  });
  test("exact range query-less helper keeps independent measurements", [] {
    Layout l(@"Alpha bravo");queryTestRangeMeasurements=0;auto a=l.range(NSMakeRange(0,1));auto b=l.range(NSMakeRange(0,1));
    identicalGeometry(a,b);require(queryTestRangeMeasurements==2,"query-less helper gained shared cache");
  });
  test("exact range manager-only unbound query remains uncached", [] {
    RCTTextLayoutManager *m=[RCTTextLayoutManager new];Layout l(@"Alpha bravo");TextReadingPointQuery q;queryTestRangeMeasurements=0;
    for(int i=0;i<2;i++) measured([m readingPointWithAttributedString:l.storage paragraphAttributes:ParagraphAttributes{} frame:l.frame characterRange:NSMakeRange(0,1) expectedCurrentText:l.storage.string query:&q]);
    require(queryTestRangeMeasurements==2,"owner-unbound query cached geometry");
  });
  NSDictionary *report=@{@"passed":@(passed),@"failed":@(failed),@"scope":@"host AppKit TextKit using unchanged new native operation source; not iOS UIKit rendering or mounted Paragraph proof",@"tests":records,@"rangeMeasurementObservations":rangeObservations};
  NSData *json=[NSJSONSerialization dataWithJSONObject:report options:NSJSONWritingPrettyPrinted error:nil];
  std::cout.write((const char *)json.bytes,json.length); std::cout<<"\n";
  return failed?1:0;
} }
