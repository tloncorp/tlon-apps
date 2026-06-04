// Stub for @expensify/react-native-live-markdown's parseExpensiMark.
//
// The live-markdown library's entry statically re-exports parseExpensiMark,
// whose module top-level throws (in dev) unless `html-entities` is workletized,
// and which pulls in `expensify-common`. We never use parseExpensiMark — the
// live-markdown editor passes its own parser (tlonMarkdownParser) — so Metro
// resolves that import here instead, avoiding the html-entities patch and the
// expensify-common dependency. It returns no ranges and is never actually called.
export default function parseExpensiMark() {
  return [];
}
