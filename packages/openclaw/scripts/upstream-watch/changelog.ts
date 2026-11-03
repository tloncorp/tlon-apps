export interface Bullet {
  release: string;
  section: string;
  text: string;
  prs: number[];
}

// The PR record repeats every PR as a bare bullet; the curated sections above
// it are what upstream wrote for readers.
const UNCURATED = /contribution record|pull requests/i;
const PR_GROUP = /\((#\d+(?:,\s*#\d+)*)\)/g;

export function parseChangelog(markdown: string, release: string) {
  const bullets: Bullet[] = [];
  let section: string | undefined;
  let curated = false;
  let current: Bullet | undefined;

  for (const raw of markdown.split('\n')) {
    const heading = /^(#{1,6})\s+(.*?)\s*$/.exec(raw);
    if (heading) {
      current = undefined;
      const level = heading[1].length;
      if (level === 3) {
        section = heading[2];
        curated = !UNCURATED.test(section);
      } else if (level > 3 && UNCURATED.test(heading[2])) {
        curated = false;
      } else if (level < 3) {
        section = undefined;
        curated = false;
      }
      continue;
    }
    if (!curated || !section) {
      continue;
    }
    if (raw.startsWith('- ')) {
      current = { release, section, text: raw.slice(2), prs: [] };
      bullets.push(current);
    } else if (current && /^\s+\S/.test(raw)) {
      current.text += ` ${raw.trim()}`;
    } else {
      current = undefined;
    }
  }

  for (const bullet of bullets) {
    bullet.text = bullet.text.replace(/\s*Thanks @.*$/, '').trim();
    bullet.prs = prNumbers(bullet.text);
  }
  return bullets;
}

// Real changelogs are well under 100 kB; past this, a release file is not
// worth parsing (and labeling) in full.
export const MAX_CHANGELOG_BYTES = 1024 * 1024;

// Cuts at the last line break inside the cap, so the parser never sees a
// half line.
export function capChangelog(
  markdown: string,
  maxBytes: number = MAX_CHANGELOG_BYTES
) {
  const bytes = Buffer.from(markdown, 'utf8');
  if (bytes.byteLength <= maxBytes) {
    return { text: markdown, truncated: false };
  }
  const head = bytes.subarray(0, maxBytes);
  const end = head.lastIndexOf(0x0a);
  return {
    text: head.subarray(0, end === -1 ? 0 : end + 1).toString('utf8'),
    truncated: true,
  };
}

export function prNumbers(text: string) {
  const prs: number[] = [];
  for (const group of text.matchAll(PR_GROUP)) {
    for (const ref of group[1].matchAll(/#(\d+)/g)) {
      prs.push(Number(ref[1]));
    }
  }
  return [...new Set(prs)];
}

// Highlights restate items from Fixes/Changes with the same PR set; the first
// occurrence wins. A bullet without PR numbers has nothing to match on, so it
// is always kept.
export function dedupeBullets(bullets: Bullet[]) {
  const seen = new Set<string>();
  return bullets.filter((bullet) => {
    if (bullet.prs.length === 0) {
      return true;
    }
    const key = [...bullet.prs].sort((a, b) => a - b).join(',');
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
