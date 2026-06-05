// Stub for @expensify/react-native-live-markdown's parseExpensiMark.
//
// The live-markdown library's entry statically re-exports parseExpensiMark,
// whose module top-level throws (in dev) unless `html-entities` is workletized.
// We never use parseExpensiMark — the live-markdown editor passes its own parser
// (tlonMarkdownParser) — so Metro resolves that import here instead, avoiding the
// html-entities patch. (expensify-common stays as the fork's peer dep but is
// never loaded.) It returns no ranges and is never actually called.
export default function parseExpensiMark() {
  return [];
}
