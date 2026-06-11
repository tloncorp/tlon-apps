import { getTextContent } from "@tloncorp/api";

export interface SequencePostView {
  authorId?: string;
  sequenceNum?: number | null;
  sentAt?: number;
  textContent?: string | null;
  content?: unknown;
}

export interface SequenceAwareStateClient {
  channelPosts(channelId: string, count: number): Promise<unknown[] | undefined>;
}

export function extractPostText(post: SequencePostView): string {
  return (post.textContent ?? getTextContent(post.content) ?? "").trim();
}

export function getPostSequence(post: SequencePostView): number {
  return typeof post.sequenceNum === "number" ? post.sequenceNum : -1;
}

export async function getLatestSequenceForAuthor(
  state: SequenceAwareStateClient,
  channelId: string,
  authorId: string,
  count = 30,
): Promise<number> {
  try {
    const posts = await state.channelPosts(channelId, count);
    return (posts ?? [])
      .map((post) => {
        const p = post as SequencePostView;
        return p.authorId === authorId ? getPostSequence(p) : -1;
      })
      .reduce((max, seq) => Math.max(max, seq), -1);
  } catch {
    return -1;
  }
}

export function isPostNewerThanSequence(
  post: SequencePostView,
  baselineSequence: number,
): boolean {
  return getPostSequence(post) > baselineSequence;
}
