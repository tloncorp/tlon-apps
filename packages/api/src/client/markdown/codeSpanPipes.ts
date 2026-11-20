// GFM splits a table row into cells before it parses inlines, and the only
// escape it honors there is `\|`, so a `|` inside a backtick code span splits
// the cell (GitHub renders it that way too). People and models write `a | b`
// in a cell expecting the code span to protect the pipe, so table-row code
// spans get their pipes escaped before the row is parsed.
//
// Code spans follow CommonMark: a run of n backticks is closed only by the
// next run of exactly n, backslashes inside a span are literal, and an
// escaped backtick outside a span opens nothing. A pipe that is already
// escaped is left as is.
export function escapeCodeSpanPipes(line: string): string {
  let out = '';
  let i = 0;
  while (i < line.length) {
    const char = line[i];
    if (char === '\\') {
      out += line.slice(i, i + 2);
      i += 2;
      continue;
    }
    if (char !== '`') {
      out += char;
      i += 1;
      continue;
    }
    const openEnd = backtickRunEnd(line, i);
    const runLength = openEnd - i;
    const close = findClosingRun(line, openEnd, runLength);
    if (close === -1) {
      out += line.slice(i, openEnd);
      i = openEnd;
      continue;
    }
    const closeEnd = close + runLength;
    out +=
      line.slice(i, openEnd) +
      line
        .slice(openEnd, close)
        .replace(/\\?\|/g, (match) => (match.length === 2 ? match : '\\|')) +
      line.slice(close, closeEnd);
    i = closeEnd;
  }
  return out;
}

function backtickRunEnd(line: string, from: number): number {
  let i = from;
  while (i < line.length && line[i] === '`') i += 1;
  return i;
}

function findClosingRun(line: string, from: number, length: number): number {
  let i = from;
  while (i < line.length) {
    if (line[i] !== '`') {
      i += 1;
      continue;
    }
    const end = backtickRunEnd(line, i);
    if (end - i === length) return i;
    i = end;
  }
  return -1;
}
