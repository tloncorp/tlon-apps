// Leave headroom below GitHub's body limit, including for multibyte text.
export function boundReport(markdown, limit = 40_000, sourceUrl) {
  if (Buffer.byteLength(markdown) <= limit) return markdown;
  const videos = [
    ...new Set(
      markdown.match(
        /https:\/\/github\.com\/user-attachments\/assets\/[a-f0-9-]+/g
      ) || []
    ),
  ];
  const links = [
    ...new Set(
      markdown.match(
        /https:\/\/expo\.dev\/accounts\/tlon\/projects\/groups\/workflows\/[a-f0-9-]+/g
      ) || []
    ),
  ];
  if (sourceUrl && !links.includes(sourceUrl)) links.push(sourceUrl);
  const tail =
    '\n\nReport shortened to fit GitHub. Full findings and evidence remain in the ios-agent-qa artifacts.\n\n' +
    links.map((url) => `[Full run and artifacts](${url})`).join('\n') +
    (videos.length
      ? '\n\nRecordings (in report order):\n\n' + videos.join('\n\n')
      : '');
  const budget = limit - Buffer.byteLength(tail);
  if (budget < 1000)
    throw new Error('Too many evidence links to fit the report');
  // Drop verbose folded evidence before shortening the visible findings.
  const visible = markdown
    .replace(/<details>[\s\S]*?<\/details>/g, '')
    .replace(
      /https:\/\/github\.com\/user-attachments\/assets\/[a-f0-9-]+/g,
      ''
    );
  let prefix = Buffer.from(visible).subarray(0, budget).toString('utf8');
  // A sliced multibyte character can expand into a replacement character.
  while (Buffer.byteLength(prefix) > budget) prefix = prefix.slice(0, -1);
  const newline = prefix.lastIndexOf('\n');
  if (newline > 0) prefix = prefix.slice(0, newline);
  return prefix.trimEnd() + tail;
}
